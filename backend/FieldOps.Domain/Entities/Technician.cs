using FieldOps.Domain.Common;

namespace FieldOps.Domain.Entities;

public class Technician : TenantEntity
{
    public Company Company { get; set; } = null!;
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public string? Specialty { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }

    public ICollection<Job> Jobs { get; set; } = [];
}
