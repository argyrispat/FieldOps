using FieldOps.Domain.Common;
using FieldOps.Domain.Enums;

namespace FieldOps.Domain.Entities;

public class Job : TenantEntity
{
    public Company Company { get; set; } = null!;
    public string JobNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public Guid ServiceLocationId { get; set; }
    public ServiceLocation ServiceLocation { get; set; } = null!;
    public Guid? TechnicianId { get; set; }
    public Technician? Technician { get; set; }
    public Guid? EquipmentId { get; set; }
    public Equipment? Equipment { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public JobPriority Priority { get; set; } = JobPriority.Normal;
    public JobStatus Status { get; set; } = JobStatus.New;
    public DateTime? ScheduledStart { get; set; }
    public DateTime? ScheduledEnd { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public string? WorkPerformed { get; set; }
    public decimal? LaborCost { get; set; }
    public decimal? MaterialsCost { get; set; }
    public string? InternalNotes { get; set; }

    public ICollection<JobNote> Notes { get; set; } = [];
    public ICollection<JobPhoto> Photos { get; set; } = [];
    public ICollection<JobMaterial> MaterialsUsed { get; set; } = [];
}

public class JobNote : TenantEntity
{
    public Guid JobId { get; set; }
    public Job Job { get; set; } = null!;
    public Guid AuthorId { get; set; }
    public ApplicationUser Author { get; set; } = null!;
    public string Text { get; set; } = string.Empty;
}

public class JobPhoto : TenantEntity
{
    public Guid JobId { get; set; }
    public Job Job { get; set; } = null!;
    public Guid UploadedById { get; set; }
    public ApplicationUser UploadedBy { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? Caption { get; set; }
    public string RelativePath { get; set; } = string.Empty;
}

public class JobMaterial : TenantEntity
{
    public Guid JobId { get; set; }
    public Job Job { get; set; } = null!;
    public Guid MaterialId { get; set; }
    public Material Material { get; set; } = null!;
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public Guid RecordedById { get; set; }
    public ApplicationUser RecordedBy { get; set; } = null!;
}
