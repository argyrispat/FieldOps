using FieldOps.Domain.Common;

namespace FieldOps.Domain.Entities;

public class Customer : TenantEntity
{
    public Company Company { get; set; } = null!;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? CompanyName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Notes { get; set; }

    public string DisplayName =>
        !string.IsNullOrWhiteSpace(CompanyName)
            ? CompanyName
            : $"{FirstName} {LastName}".Trim();

    public ICollection<ServiceLocation> ServiceLocations { get; set; } = [];
    public ICollection<Job> Jobs { get; set; } = [];
    public ICollection<Equipment> Equipment { get; set; } = [];
}
