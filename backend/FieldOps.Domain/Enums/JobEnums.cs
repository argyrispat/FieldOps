namespace FieldOps.Domain.Enums;

public enum JobStatus
{
    New = 0,
    Scheduled = 1,
    InProgress = 2,
    OnHold = 3,
    Completed = 4,
    Cancelled = 5
}

public enum JobPriority
{
    Low = 0,
    Normal = 1,
    High = 2,
    Urgent = 3
}

public static class AppRoles
{
    public const string Owner = "Owner";
    public const string Dispatcher = "Dispatcher";
    public const string Technician = "Technician";

    public static readonly string[] All = [Owner, Dispatcher, Technician];
}
