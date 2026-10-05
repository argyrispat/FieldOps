using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure.Services;
using FieldOps.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace FieldOps.Tests.Unit;

public class JobServiceTests
{
    private static JobService NewService(TestWorld world, TestCurrentUser? user = null) =>
        new(world.CreateContext(), user ?? world.Owner(), new Mock<IFileStorage>().Object);

    private static readonly DateTime Day = new(2030, 3, 4, 0, 0, 0, DateTimeKind.Utc);

    private TestWorld WorldWithBookedTechnician(bool allowConflicts, out Domain.Entities.Job booked)
    {
        var world = TestWorld.Create(allowConflicts);
        booked = world.AddJob("J-1", JobStatus.Scheduled, world.TechnicianId, Day.AddHours(9), Day.AddHours(11));
        return world;
    }

    [Fact]
    public async Task Overlap_is_reported_as_warning_when_company_allows_conflicts()
    {
        var world = WorldWithBookedTechnician(allowConflicts: true, out var booked);
        var second = world.AddJob("J-2");

        var result = await NewService(world).ScheduleAsync(second.Id,
            new ScheduleJobRequest(world.TechnicianId, Day.AddHours(10), Day.AddHours(12), null));

        Assert.True(result.HasConflict);
        Assert.Equal(JobStatus.Scheduled, result.Status);
        var conflict = Assert.Single(result.Conflicts);
        Assert.Equal(booked.Id, conflict.JobId);
        Assert.Single(result.Warnings);
    }

    [Fact]
    public async Task Overlap_is_rejected_with_409_when_company_forbids_conflicts()
    {
        var world = WorldWithBookedTechnician(allowConflicts: false, out var booked);
        var second = world.AddJob("J-2");

        var ex = await Assert.ThrowsAsync<ConflictException>(() => NewService(world).ScheduleAsync(second.Id,
            new ScheduleJobRequest(world.TechnicianId, Day.AddHours(10), Day.AddHours(12), Force: true)));

        Assert.Equal(booked.Id, Assert.Single(ex.Conflicts!).JobId);

        await using var db = world.CreateContext();
        var unchanged = await db.Jobs.SingleAsync(j => j.Id == second.Id);
        Assert.Equal(JobStatus.New, unchanged.Status);
        Assert.Null(unchanged.ScheduledStart);
    }

    [Fact]
    public async Task Back_to_back_appointments_do_not_conflict()
    {
        var world = WorldWithBookedTechnician(allowConflicts: false, out _);
        var second = world.AddJob("J-2");

        var result = await NewService(world).ScheduleAsync(second.Id,
            new ScheduleJobRequest(world.TechnicianId, Day.AddHours(11), Day.AddHours(12), null));

        Assert.False(result.HasConflict);
        Assert.Empty(result.Conflicts);
    }

    [Fact]
    public async Task Rescheduling_a_job_does_not_conflict_with_itself()
    {
        var world = WorldWithBookedTechnician(allowConflicts: false, out var booked);

        var result = await NewService(world).ScheduleAsync(booked.Id,
            new ScheduleJobRequest(world.TechnicianId, Day.AddHours(10), Day.AddHours(12), null));

        Assert.False(result.HasConflict);
    }

    [Fact]
    public async Task Cannot_schedule_a_completed_job()
    {
        var world = TestWorld.Create();
        var done = world.AddJob("J-1", JobStatus.Completed);

        await Assert.ThrowsAsync<ConflictException>(() => NewService(world).ScheduleAsync(done.Id,
            new ScheduleJobRequest(world.TechnicianId, Day.AddHours(9), Day.AddHours(10), null)));
    }

    [Fact]
    public async Task Full_lifecycle_follows_status_transitions()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1", JobStatus.Scheduled, world.TechnicianId, Day.AddHours(9), Day.AddHours(10));
        var tech = NewService(world, world.Technician());

        var started = await tech.StartAsync(job.Id);
        Assert.Equal(JobStatus.InProgress, started.Status);
        Assert.NotNull(started.ActualStart);

        // Starting twice is an invalid transition.
        await Assert.ThrowsAsync<ConflictException>(() => NewService(world, world.Technician()).StartAsync(job.Id));

        var done = await NewService(world, world.Technician()).CompleteAsync(job.Id, new CompleteJobRequest("Fixed it", 80m, null));
        Assert.Equal(JobStatus.Completed, done.Status);
        Assert.Equal(80m, done.LaborCost);
        Assert.Equal(0m, done.MaterialsCost);
        Assert.NotNull(done.ActualEnd);

        // Terminal state.
        await Assert.ThrowsAsync<ConflictException>(() => NewService(world).CancelAsync(job.Id, null));
    }

    [Fact]
    public async Task Cannot_complete_a_job_that_was_never_started_or_scheduled()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1");

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewService(world).CompleteAsync(job.Id, new CompleteJobRequest("done", null, null)));
    }

    [Fact]
    public async Task Hold_with_reason_records_a_note()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1", JobStatus.Scheduled, world.TechnicianId, Day.AddHours(9), Day.AddHours(10));

        var held = await NewService(world).HoldAsync(job.Id, new ReasonRequest("Waiting for parts"));

        Assert.Equal(JobStatus.OnHold, held.Status);
        Assert.Contains(held.Notes!, n => n.Text.Contains("Waiting for parts"));
    }

    [Fact]
    public async Task Technicians_can_only_mutate_jobs_assigned_to_them()
    {
        var world = TestWorld.Create();
        var unassigned = world.AddJob("J-1", JobStatus.Scheduled, technicianId: null, start: Day.AddHours(9), end: Day.AddHours(10));

        await Assert.ThrowsAsync<ForbiddenException>(() => NewService(world, world.Technician()).StartAsync(unassigned.Id));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            NewService(world, world.Technician()).AddNoteAsync(unassigned.Id, new AddNoteRequest("hi")));
    }

    [Fact]
    public async Task Create_assigns_sequential_unique_job_numbers_per_company()
    {
        var world = TestWorld.Create();
        var service = NewService(world);
        var request = new SaveJobRequest(world.CustomerId, world.LocationId, null, null, "Fix sink", null, JobPriority.High, 60, null);

        var first = await service.CreateAsync(request);
        var second = await NewService(world).CreateAsync(request with { Title = "Fix door" });

        Assert.Equal("JOB-00001", first.JobNumber);
        Assert.Equal("JOB-00002", second.JobNumber);
        Assert.Equal(JobStatus.New, first.Status);
        Assert.Equal(JobPriority.High, first.Priority);
    }

    [Fact]
    public async Task Create_rejects_location_that_does_not_belong_to_the_customer()
    {
        var world = TestWorld.Create();
        var request = new SaveJobRequest(world.CustomerId, Guid.NewGuid(), null, null, "x", null, null, null, null);

        var ex = await Assert.ThrowsAsync<ValidationException>(() => NewService(world).CreateAsync(request));
        Assert.True(ex.Errors.ContainsKey("serviceLocationId"));
    }

    [Fact]
    public async Task Jobs_of_other_tenants_are_invisible()
    {
        var world = TestWorld.Create();
        var job = world.AddJob("J-1");

        var other = Guid.NewGuid();
        var service = new JobService(world.CreateContext(other),
            new TestCurrentUser { CompanyId = other, UserId = Guid.NewGuid() }, new Mock<IFileStorage>().Object);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(job.Id));
        var page = await service.ListAsync(new JobQuery());
        Assert.Equal(0, page.TotalCount);
    }
}
