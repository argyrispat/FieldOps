using FieldOps.Application.Interfaces;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace FieldOps.Tests.TestSupport;

public class TestCurrentUser : ICurrentUser
{
    public bool IsAuthenticated { get; set; } = true;
    public Guid UserId { get; set; }
    public Guid CompanyId { get; set; }
    public string? Email { get; set; } = "test@example.test";
    public Guid? TechnicianId { get; set; }
    public IReadOnlyCollection<string> Roles { get; set; } = [AppRoles.Owner];

    public bool IsInRole(string role) => Roles.Contains(role);
}

/// <summary>A tiny seeded tenant on a shared InMemory database; each call to <see cref="CreateContext"/> is an independent unit of work.</summary>
public sealed class TestWorld
{
    private readonly DbContextOptions<AppDbContext> _options;

    public Guid CompanyId { get; } = Guid.NewGuid();
    public Guid OwnerUserId { get; } = Guid.NewGuid();
    public Guid TechUserId { get; } = Guid.NewGuid();
    public Guid TechnicianId { get; } = Guid.NewGuid();
    public Guid CustomerId { get; } = Guid.NewGuid();
    public Guid LocationId { get; } = Guid.NewGuid();

    public TestWorld()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("fieldops-" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
    }

    public AppDbContext CreateContext(Guid? tenant = null) =>
        new(_options, new FixedTenantContext(tenant ?? CompanyId));

    public TestCurrentUser Owner() => new()
    {
        UserId = OwnerUserId, CompanyId = CompanyId, Roles = [AppRoles.Owner]
    };

    public TestCurrentUser Technician() => new()
    {
        UserId = TechUserId, CompanyId = CompanyId, TechnicianId = TechnicianId, Roles = [AppRoles.Technician]
    };

    public static TestWorld Create(bool allowConflicts = true)
    {
        var w = new TestWorld();
        using var db = new AppDbContext(w._options, new FixedTenantContext(null));

        db.Companies.Add(new Company { Id = w.CompanyId, Name = "Test Co", AllowSchedulingConflicts = allowConflicts });
        db.Users.Add(new ApplicationUser
        {
            Id = w.OwnerUserId, CompanyId = w.CompanyId, FirstName = "Olive", LastName = "Owner",
            UserName = "owner@test.test", Email = "owner@test.test"
        });
        var techUser = new ApplicationUser
        {
            Id = w.TechUserId, CompanyId = w.CompanyId, FirstName = "Tim", LastName = "Tech",
            UserName = "tech@test.test", Email = "tech@test.test"
        };
        db.Users.Add(techUser);
        db.Technicians.Add(new Technician { Id = w.TechnicianId, CompanyId = w.CompanyId, UserId = w.TechUserId });
        db.Customers.Add(new Customer { Id = w.CustomerId, CompanyId = w.CompanyId, FirstName = "Cathy", LastName = "Customer" });
        db.ServiceLocations.Add(new ServiceLocation
        {
            Id = w.LocationId, CompanyId = w.CompanyId, CustomerId = w.CustomerId, Name = "Main", Address = "1 Test St", IsPrimary = true
        });
        db.SaveChanges();
        return w;
    }

    public Job AddJob(
        string number, JobStatus status = JobStatus.New, Guid? technicianId = null,
        DateTime? start = null, DateTime? end = null)
    {
        using var db = CreateContext();
        var job = new Job
        {
            CompanyId = CompanyId, JobNumber = number, CustomerId = CustomerId, ServiceLocationId = LocationId,
            Title = $"Job {number}", Status = status, TechnicianId = technicianId,
            ScheduledStart = start, ScheduledEnd = end
        };
        db.Jobs.Add(job);
        db.SaveChanges();
        return job;
    }

    public Material AddMaterial(decimal quantity, decimal unitCost = 2m, string name = "Widget")
    {
        using var db = CreateContext();
        var material = new Material { CompanyId = CompanyId, Name = name, QuantityOnHand = quantity, MinimumQuantity = 1, UnitCost = unitCost };
        db.Materials.Add(material);
        db.SaveChanges();
        return material;
    }
}
