using FieldOps.Domain.Common;

namespace FieldOps.Domain.Entities;

public class Company : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Website { get; set; }
    public bool AllowSchedulingConflicts { get; set; } = true;
    public int NextJobSequence { get; set; } = 1;

    public ICollection<ApplicationUser> Users { get; set; } = [];
    public ICollection<Customer> Customers { get; set; } = [];
    public ICollection<Technician> Technicians { get; set; } = [];
    public ICollection<Job> Jobs { get; set; } = [];
    public ICollection<Material> Materials { get; set; } = [];
}
