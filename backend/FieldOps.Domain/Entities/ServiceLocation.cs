using FieldOps.Domain.Common;

namespace FieldOps.Domain.Entities;

public class ServiceLocation : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Notes { get; set; }
    public bool IsPrimary { get; set; }

    public ICollection<Job> Jobs { get; set; } = [];
    public ICollection<Equipment> Equipment { get; set; } = [];
}
