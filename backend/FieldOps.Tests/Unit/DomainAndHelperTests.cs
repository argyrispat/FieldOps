using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Services;
using FieldOps.Application.Validators;
using FieldOps.Domain.Common;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Tests.Unit;

public class JobStatusTransitionsTests
{
    [Theory]
    [InlineData(JobStatus.New, JobStatus.Scheduled)]
    [InlineData(JobStatus.New, JobStatus.InProgress)]
    [InlineData(JobStatus.New, JobStatus.Cancelled)]
    [InlineData(JobStatus.Scheduled, JobStatus.InProgress)]
    [InlineData(JobStatus.Scheduled, JobStatus.OnHold)]
    [InlineData(JobStatus.InProgress, JobStatus.Completed)]
    [InlineData(JobStatus.InProgress, JobStatus.OnHold)]
    [InlineData(JobStatus.OnHold, JobStatus.Scheduled)]
    [InlineData(JobStatus.OnHold, JobStatus.InProgress)]
    [InlineData(JobStatus.Cancelled, JobStatus.New)]
    public void Allowed_transitions_are_accepted(JobStatus from, JobStatus to) =>
        Assert.True(JobStatusTransitions.CanTransition(from, to));

    [Theory]
    [InlineData(JobStatus.New, JobStatus.Completed)]
    [InlineData(JobStatus.New, JobStatus.OnHold)]
    [InlineData(JobStatus.Scheduled, JobStatus.Completed)]
    [InlineData(JobStatus.InProgress, JobStatus.Scheduled)]
    [InlineData(JobStatus.InProgress, JobStatus.New)]
    [InlineData(JobStatus.Completed, JobStatus.New)]
    [InlineData(JobStatus.Completed, JobStatus.InProgress)]
    [InlineData(JobStatus.Completed, JobStatus.Cancelled)]
    [InlineData(JobStatus.Cancelled, JobStatus.Completed)]
    [InlineData(JobStatus.Cancelled, JobStatus.InProgress)]
    public void Disallowed_transitions_are_rejected(JobStatus from, JobStatus to) =>
        Assert.False(JobStatusTransitions.CanTransition(from, to));

    [Fact]
    public void Completed_is_terminal() =>
        Assert.Empty(JobStatusTransitions.GetAllowed(JobStatus.Completed));

    [Fact]
    public void Rules_enforce_job_status_transitions_with_a_conflict()
    {
        var job = new Job { Status = JobStatus.New };
        var ex = Assert.Throws<ConflictException>(() => JobRules.EnsureTransition(job, JobStatus.Completed));
        Assert.Equal(409, ex.StatusCode);

        // Re-applying the same status is rejected unless explicitly allowed (rescheduling).
        job.Status = JobStatus.Scheduled;
        Assert.Throws<ConflictException>(() => JobRules.EnsureTransition(job, JobStatus.Scheduled));
        JobRules.EnsureTransition(job, JobStatus.Scheduled, allowSame: true);
    }
}

public class SchedulingConflictDetectorTests
{
    private static readonly DateTime Day = new(2030, 1, 15, 0, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Tech = Guid.NewGuid();

    private static Job J(int startHour, int endHour, JobStatus status = JobStatus.Scheduled, Guid? tech = null) => new()
    {
        TechnicianId = tech ?? Tech, Status = status, JobNumber = $"J{startHour}", Title = "t",
        ScheduledStart = Day.AddHours(startHour), ScheduledEnd = Day.AddHours(endHour)
    };

    [Theory]
    [InlineData(9, 11, 10, 12, true)]   // partial overlap
    [InlineData(9, 17, 10, 12, true)]   // containing
    [InlineData(10, 12, 9, 17, true)]   // contained
    [InlineData(9, 10, 10, 11, false)]  // back-to-back is fine
    [InlineData(9, 10, 11, 12, false)]  // disjoint
    public void Overlap_math(int aS, int aE, int bS, int bE, bool expected) =>
        Assert.Equal(expected, SchedulingConflictDetector.Overlaps(Day.AddHours(aS), Day.AddHours(aE), Day.AddHours(bS), Day.AddHours(bE)));

    [Fact]
    public void Finds_only_overlapping_active_jobs_of_the_same_technician()
    {
        var overlapping = J(9, 11);
        var back2back = J(11, 12);
        var cancelled = J(10, 11, JobStatus.Cancelled);
        var completed = J(10, 11, JobStatus.Completed);
        var otherTech = J(10, 11, tech: Guid.NewGuid());
        var unscheduled = new Job { TechnicianId = Tech, Status = JobStatus.Scheduled };
        var inProgress = J(10, 13, JobStatus.InProgress);

        var result = SchedulingConflictDetector.FindConflicts(
            Tech, Day.AddHours(10), Day.AddHours(11),
            [overlapping, back2back, cancelled, completed, otherTech, unscheduled, inProgress]);

        Assert.Equal(2, result.Count);
        Assert.Contains(overlapping, result);
        Assert.Contains(inProgress, result);
    }

    [Fact]
    public void Excludes_the_job_being_rescheduled()
    {
        var self = J(9, 11);
        var result = SchedulingConflictDetector.FindConflicts(Tech, Day.AddHours(9), Day.AddHours(10), [self], self.Id);
        Assert.Empty(result);
    }

    [Fact]
    public void Treats_unspecified_and_local_kinds_as_comparable_utc()
    {
        var existing = J(9, 11);
        var start = DateTime.SpecifyKind(Day.AddHours(10), DateTimeKind.Unspecified);
        var result = SchedulingConflictDetector.FindConflicts(Tech, start, start.AddHours(1), [existing]);
        Assert.Single(result);
    }
}

public class InventoryRulesTests
{
    [Fact]
    public void Deducts_stock() => Assert.Equal(7m, InventoryRules.Deduct(10m, 3m));

    [Fact]
    public void Allows_taking_exactly_all_stock() => Assert.Equal(0m, InventoryRules.Deduct(5m, 5m));

    [Fact]
    public void Rejects_overdraw_with_conflict()
    {
        var ex = Assert.Throws<ConflictException>(() => InventoryRules.Deduct(2m, 3m, "Pipe"));
        Assert.Contains("Pipe", ex.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Rejects_non_positive_quantity(int qty) =>
        Assert.Throws<ValidationException>(() => InventoryRules.Deduct(10m, qty));

    [Fact]
    public void Line_cost_is_rounded_to_cents() => Assert.Equal(3.33m, InventoryRules.LineCost(3m, 1.111m));
}

public class CustomerValidationTests
{
    private readonly SaveCustomerRequestValidator _validator = new();

    private static SaveCustomerRequest Valid() =>
        new("Jane", "Doe", null, "jane@example.com", "+1 555 1234", "1 Main St", "Town", "12345", null);

    [Fact]
    public void Valid_customer_passes() => Assert.True(_validator.Validate(Valid()).IsValid);

    [Fact]
    public void Names_are_required()
    {
        var result = _validator.Validate(Valid() with { FirstName = "", LastName = " " });
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SaveCustomerRequest.FirstName));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SaveCustomerRequest.LastName));
    }

    [Fact]
    public void Invalid_email_is_rejected() =>
        Assert.Contains(_validator.Validate(Valid() with { Email = "not-an-email" }).Errors, e => e.PropertyName == nameof(SaveCustomerRequest.Email));

    [Fact]
    public void Blank_optional_email_is_allowed() =>
        Assert.True(_validator.Validate(Valid() with { Email = "" }).IsValid);

    [Fact]
    public void Overlong_fields_are_rejected()
    {
        var result = _validator.Validate(Valid() with { FirstName = new string('a', 101), PostalCode = new string('1', 21) });
        Assert.False(result.IsValid);
        Assert.Equal(2, result.Errors.Count);
    }
}

public class RegisterValidationTests
{
    private readonly RegisterRequestValidator _validator = new();

    [Theory]
    [InlineData("short1A", false)]
    [InlineData("alllowercase1", false)]
    [InlineData("ALLUPPERCASE1", false)]
    [InlineData("NoDigitsHere", false)]
    [InlineData("Demo123!", true)]
    public void Password_policy(string password, bool valid) =>
        Assert.Equal(valid, _validator.Validate(new RegisterRequest("Acme", "A", "B", "a@b.com", password)).IsValid);

    [Fact]
    public void Requires_company_and_email()
    {
        var result = _validator.Validate(new RegisterRequest("", "A", "B", "nope", "Demo123!"));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(RegisterRequest.CompanyName));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(RegisterRequest.Email));
    }
}

public class JobValidationTests
{
    [Fact]
    public void Schedule_end_must_be_after_start()
    {
        var v = new ScheduleJobRequestValidator();
        var start = DateTime.UtcNow;
        Assert.False(v.Validate(new ScheduleJobRequest(Guid.NewGuid(), start, start, null)).IsValid);
        Assert.False(v.Validate(new ScheduleJobRequest(Guid.NewGuid(), start, start.AddHours(-1), null)).IsValid);
        Assert.True(v.Validate(new ScheduleJobRequest(Guid.NewGuid(), start, start.AddHours(1), null)).IsValid);
    }

    [Fact]
    public void Job_requires_title_and_references()
    {
        var v = new SaveJobRequestValidator();
        var result = v.Validate(new SaveJobRequest(Guid.Empty, Guid.Empty, null, null, "", null, null, null, null));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SaveJobRequest.Title));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SaveJobRequest.CustomerId));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SaveJobRequest.ServiceLocationId));
    }

    [Fact]
    public void Completion_requires_work_description_and_non_negative_costs()
    {
        var v = new CompleteJobRequestValidator();
        Assert.False(v.Validate(new CompleteJobRequest("", null, null)).IsValid);
        Assert.False(v.Validate(new CompleteJobRequest("done", -1m, null)).IsValid);
        Assert.True(v.Validate(new CompleteJobRequest("done", 10m, 5m)).IsValid);
    }
}
