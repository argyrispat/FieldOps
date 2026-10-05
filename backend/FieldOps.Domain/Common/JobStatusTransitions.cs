using FieldOps.Domain.Enums;

namespace FieldOps.Domain.Common;

public static class JobStatusTransitions
{
    private static readonly Dictionary<JobStatus, HashSet<JobStatus>> Allowed = new()
    {
        [JobStatus.New] = [JobStatus.Scheduled, JobStatus.InProgress, JobStatus.Cancelled],
        [JobStatus.Scheduled] = [JobStatus.InProgress, JobStatus.OnHold, JobStatus.Cancelled, JobStatus.New],
        [JobStatus.InProgress] = [JobStatus.OnHold, JobStatus.Completed, JobStatus.Cancelled],
        [JobStatus.OnHold] = [JobStatus.Scheduled, JobStatus.InProgress, JobStatus.Cancelled],
        [JobStatus.Completed] = [],
        [JobStatus.Cancelled] = [JobStatus.New]
    };

    public static bool CanTransition(JobStatus from, JobStatus to)
    {
        if (from == to) return true;
        return Allowed.TryGetValue(from, out var set) && set.Contains(to);
    }

    public static IReadOnlyCollection<JobStatus> GetAllowed(JobStatus from) =>
        Allowed.TryGetValue(from, out var set) ? set.ToList() : [];
}
