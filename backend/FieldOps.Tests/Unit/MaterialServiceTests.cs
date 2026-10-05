using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure.Services;
using FieldOps.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Tests.Unit;

public class MaterialServiceTests
{
    private static MaterialService NewService(TestWorld world, TestCurrentUser? user = null) =>
        new(world.CreateContext(), user ?? world.Owner());

    [Fact]
    public async Task Recording_usage_deducts_stock_and_updates_job_cost()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1", JobStatus.InProgress, world.TechnicianId);
        var material = world.AddMaterial(10m, unitCost: 2.50m);

        var dto = await NewService(world).RecordJobUsageAsync(job.Id, new AddJobMaterialRequest(material.Id, 4m));

        Assert.Equal(4m, dto.Quantity);
        Assert.Equal(2.50m, dto.UnitCost);

        await using var db = world.CreateContext();
        Assert.Equal(6m, (await db.Materials.SingleAsync()).QuantityOnHand);
        Assert.Equal(10m, (await db.Jobs.SingleAsync()).MaterialsCost);
        Assert.Single(db.JobMaterials);
    }

    [Fact]
    public async Task Insufficient_stock_is_rejected_and_nothing_changes()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1", JobStatus.InProgress);
        var material = world.AddMaterial(3m);

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewService(world).RecordJobUsageAsync(job.Id, new AddJobMaterialRequest(material.Id, 5m)));

        await using var db = world.CreateContext();
        Assert.Equal(3m, (await db.Materials.SingleAsync()).QuantityOnHand);
        Assert.Empty(db.JobMaterials);
    }

    [Fact]
    public async Task Cannot_add_material_to_a_completed_job()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1", JobStatus.Completed);
        var material = world.AddMaterial(10m);

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewService(world).RecordJobUsageAsync(job.Id, new AddJobMaterialRequest(material.Id, 1m)));
    }

    [Fact]
    public async Task Technician_cannot_record_usage_on_a_job_assigned_to_someone_else()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1", JobStatus.InProgress, technicianId: null);
        var material = world.AddMaterial(10m);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            NewService(world, world.Technician()).RecordJobUsageAsync(job.Id, new AddJobMaterialRequest(material.Id, 1m)));
    }

    [Fact]
    public async Task Technician_can_record_usage_on_their_own_job()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1", JobStatus.InProgress, world.TechnicianId);
        var material = world.AddMaterial(10m);

        var dto = await NewService(world, world.Technician()).RecordJobUsageAsync(job.Id, new AddJobMaterialRequest(material.Id, 1m));
        Assert.Equal(1m, dto.Quantity);
    }

    [Fact]
    public async Task Another_tenant_cannot_use_this_companys_material()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1", JobStatus.InProgress);
        var material = world.AddMaterial(10m);

        var otherCompany = Guid.NewGuid();
        var intruder = new TestCurrentUser { UserId = world.OwnerUserId, CompanyId = otherCompany, Roles = [AppRoles.Owner] };
        var service = new MaterialService(world.CreateContext(otherCompany), intruder);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.RecordJobUsageAsync(job.Id, new AddJobMaterialRequest(material.Id, 1m)));
    }

    [Fact]
    public async Task Stale_material_row_version_raises_a_concurrency_exception()
    {
        var world = TestWorld.Create();
        var material = world.AddMaterial(10m);

        await using var a = world.CreateContext();
        await using var b = world.CreateContext();
        var ma = await a.Materials.SingleAsync(m => m.Id == material.Id);
        var mb = await b.Materials.SingleAsync(m => m.Id == material.Id);

        ma.QuantityOnHand -= 1;
        await a.SaveChangesAsync();

        mb.QuantityOnHand -= 1; // based on a stale snapshot
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => b.SaveChangesAsync());
    }

    [Fact]
    public async Task Concurrent_deductions_never_lose_updates()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1", JobStatus.InProgress);
        const int workers = 8;
        var material = world.AddMaterial(workers);

        // Every worker uses its own DbContext (as separate HTTP requests would).
        var results = await Task.WhenAll(Enumerable.Range(0, workers).Select(_ => Task.Run(async () =>
        {
            var service = NewService(world);
            return await service.RecordJobUsageAsync(job.Id, new AddJobMaterialRequest(material.Id, 1m));
        })));

        Assert.Equal(workers, results.Length);

        await using var db = world.CreateContext();
        Assert.Equal(0m, (await db.Materials.SingleAsync()).QuantityOnHand);
        Assert.Equal(workers, await db.JobMaterials.CountAsync());
    }

    [Fact]
    public async Task Concurrent_deductions_never_oversell_stock()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1", JobStatus.InProgress);
        const int stock = 5, workers = 10;
        var material = world.AddMaterial(stock);

        var outcomes = await Task.WhenAll(Enumerable.Range(0, workers).Select(_ => Task.Run(async () =>
        {
            try
            {
                await NewService(world).RecordJobUsageAsync(job.Id, new AddJobMaterialRequest(material.Id, 1m));
                return true;
            }
            catch (ConflictException)
            {
                return false;
            }
        })));

        Assert.Equal(stock, outcomes.Count(o => o));
        Assert.Equal(workers - stock, outcomes.Count(o => !o));

        await using var db = world.CreateContext();
        Assert.Equal(0m, (await db.Materials.SingleAsync()).QuantityOnHand);
        Assert.Equal(stock, await db.JobMaterials.CountAsync());
    }
}
