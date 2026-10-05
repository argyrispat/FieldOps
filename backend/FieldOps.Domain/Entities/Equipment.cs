using FieldOps.Domain.Common;

namespace FieldOps.Domain.Entities;

public class Equipment : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public Guid? ServiceLocationId { get; set; }
    public ServiceLocation? ServiceLocation { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Type { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? SerialNumber { get; set; }
    public DateTime? InstallationDate { get; set; }
    public DateTime? WarrantyExpiration { get; set; }
    public DateTime? LastMaintenanceDate { get; set; }
    public DateTime? NextMaintenanceDate { get; set; }
    public string? Notes { get; set; }

    public ICollection<MaintenanceRecord> MaintenanceRecords { get; set; } = [];
    public ICollection<Job> Jobs { get; set; } = [];
}

public class MaintenanceRecord : TenantEntity
{
    public Guid EquipmentId { get; set; }
    public Equipment Equipment { get; set; } = null!;
    public Guid? JobId { get; set; }
    public Job? Job { get; set; }
    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;
    public string? Description { get; set; }
    public Guid? PerformedById { get; set; }
    public ApplicationUser? PerformedBy { get; set; }
}
