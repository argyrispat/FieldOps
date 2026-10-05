using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using FieldOps.Domain.Common;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.Services;

/// <summary>Pure scheduling-overlap logic (no persistence) so it can be unit tested in isolation.</summary>
public static class SchedulingConflictDetector
{
    public static bool Overlaps(DateTime aStart, DateTime aEnd, DateTime bStart, DateTime bEnd) =>
        aStart < bEnd && bStart < aEnd;

    /// <summary>Statuses that actually occupy a technician's time.</summary>
    public static bool OccupiesTechnician(JobStatus status) =>
        status is JobStatus.Scheduled or JobStatus.InProgress;

    public static IReadOnlyList<Job> FindConflicts(
        Guid technicianId,
        DateTime start,
        DateTime end,
        IEnumerable<Job> candidates,
        Guid? excludeJobId = null)
    {
        start = start.ToUtc();
        end = end.ToUtc();

        return candidates
            .Where(j => j.TechnicianId == technicianId
                        && (excludeJobId is null || j.Id != excludeJobId)
                        && OccupiesTechnician(j.Status)
                        && j.ScheduledStart.HasValue
                        && j.ScheduledEnd.HasValue
                        && Overlaps(start, end, j.ScheduledStart.Value.ToUtc(), j.ScheduledEnd.Value.ToUtc()))
            .OrderBy(j => j.ScheduledStart)
            .ToList();
    }

    public static ScheduleConflictDto ToDto(Job job)
    {
        var s = job.ScheduledStart!.Value.ToUtc();
        var e = job.ScheduledEnd!.Value.ToUtc();
        return new ScheduleConflictDto(
            job.Id,
            job.JobNumber,
            job.Title,
            s,
            e,
            $"{job.JobNumber} \"{job.Title}\" ({s:yyyy-MM-dd HH:mm} - {e:yyyy-MM-dd HH:mm} UTC) overlaps this appointment.");
    }
}

/// <summary>Pure inventory arithmetic used by the transactional deduction in the material service.</summary>
public static class InventoryRules
{
    public static decimal Deduct(decimal onHand, decimal quantity, string? materialName = null)
    {
        if (quantity <= 0)
            throw new ValidationException("quantity", "Quantity must be greater than zero.");

        if (onHand < quantity)
            throw new ConflictException(
                $"Insufficient stock{(materialName is null ? string.Empty : $" for {materialName}")}: {onHand} available, {quantity} requested.");

        return onHand - quantity;
    }

    public static decimal LineCost(decimal quantity, decimal unitCost) => Math.Round(quantity * unitCost, 2);
}

public static class JobRules
{
    /// <summary>Owners/Dispatchers may mutate any job; Technicians only jobs assigned to them.</summary>
    public static void EnsureCanMutate(ICurrentUser user, Job job)
    {
        if (user.IsManager()) return;

        if (user.IsInRole(AppRoles.Technician) && user.TechnicianId.HasValue && job.TechnicianId == user.TechnicianId)
            return;

        throw new ForbiddenException("You can only modify jobs that are assigned to you.");
    }

    /// <summary>
    /// Same assignment rule as mutate for technicians. Prevents reading another technician's jobs
    /// (or unassigned jobs) by ID within the same company.
    /// </summary>
    public static void EnsureCanView(ICurrentUser user, Job job)
    {
        if (user.IsManager()) return;

        if (user.IsInRole(AppRoles.Technician) && user.TechnicianId.HasValue && job.TechnicianId == user.TechnicianId)
            return;

        throw new ForbiddenException("You can only view jobs that are assigned to you.");
    }

    /// <summary>
    /// Validates the transition with <see cref="JobStatusTransitions.CanTransition"/> and throws a 409 when not allowed.
    /// Re-applying the current status is rejected unless <paramref name="allowSame"/> is set (e.g. rescheduling).
    /// </summary>
    public static void EnsureTransition(Job job, JobStatus target, bool allowSame = false)
    {
        if (job.Status == target && !allowSame)
            throw new ConflictException($"The job is already {target}.");

        if (!JobStatusTransitions.CanTransition(job.Status, target))
            throw new ConflictException($"A job that is {job.Status} cannot be moved to {target}.");
    }

    public static bool IsClosed(JobStatus status) => status is JobStatus.Completed or JobStatus.Cancelled;
}
