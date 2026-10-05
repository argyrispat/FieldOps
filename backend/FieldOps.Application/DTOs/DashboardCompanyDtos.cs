using FieldOps.Domain.Enums;

namespace FieldOps.Application.DTOs;

public record StatusCountDto(JobStatus Status, int Count);

public record DatePointDto(string Date, int Count);

public record TechnicianWorkloadDto(Guid TechnicianId, string TechnicianName, int ActiveJobs)
{
    /// <summary>Alias of <see cref="ActiveJobs"/> kept for client compatibility.</summary>
    public int JobCount => ActiveJobs;
}

public record DashboardDto
{
    public int JobsToday { get; init; }
    public int JobsInProgress { get; init; }
    public int JobsCompleted { get; init; }
    public int JobsOverdue { get; init; }
    public int UpcomingAppointments { get; init; }
    public int ActiveTechnicians { get; init; }
    public int CustomersCount { get; init; }
    public decimal CompletedRevenue { get; init; }
    public IReadOnlyList<StatusCountDto> JobsByStatus { get; init; } = [];
    public IReadOnlyList<DatePointDto> JobsOverTime { get; init; } = [];
    public IReadOnlyList<TechnicianWorkloadDto> TechnicianWorkload { get; init; } = [];
    public IReadOnlyList<JobDto> UpcomingJobs { get; init; } = [];

    // Aliases / extras used by the web client.
    public int TotalJobs { get; init; }
    public int OpenJobs { get; init; }
    public int CompletedThisMonth { get; init; }
    public int OverdueJobs => JobsOverdue;
    public int TotalCustomers => CustomersCount;
    public int LowStockMaterials { get; init; }
    public int OverdueMaintenance { get; init; }
}

public record SearchResultsDto(
    IReadOnlyList<CustomerDto> Customers,
    IReadOnlyList<JobDto> Jobs,
    IReadOnlyList<EquipmentDto> Equipment);

public record CompanyDto(
    Guid Id,
    string Name,
    string? Email,
    string? Phone,
    string? Address,
    string? City,
    string? PostalCode,
    string? Website,
    bool AllowSchedulingConflicts);

public record UpdateCompanyRequest(
    string Name,
    string? Email,
    string? Phone,
    string? Address,
    string? City,
    string? PostalCode,
    string? Website,
    bool? AllowSchedulingConflicts);

public record CreateUserRequest(
    string FirstName,
    string LastName,
    string Email,
    string Password,
    string Role,
    string? Specialty);
