using FieldOps.Application.Common;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.DTOs;

public record JobNoteDto(Guid Id, Guid JobId, Guid AuthorId, string AuthorName, string Text, DateTime CreatedAt);

public record JobPhotoDto(
    Guid Id,
    Guid JobId,
    string FileName,
    string ContentType,
    long SizeBytes,
    string? Caption,
    string Url,
    string UploadedByName,
    DateTime CreatedAt);

public record JobMaterialDto(
    Guid Id,
    Guid JobId,
    Guid MaterialId,
    string MaterialName,
    string Unit,
    decimal Quantity,
    decimal UnitCost,
    string RecordedByName,
    DateTime CreatedAt);

public record JobDto
{
    public Guid Id { get; init; }
    public string JobNumber { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public JobStatus Status { get; init; }
    public JobPriority Priority { get; init; }
    public Guid CustomerId { get; init; }
    public string CustomerName { get; init; } = string.Empty;
    public Guid ServiceLocationId { get; init; }
    public string LocationName { get; init; } = string.Empty;
    public string? LocationAddress { get; init; }
    public Guid? TechnicianId { get; init; }
    public string? TechnicianName { get; init; }
    public Guid? EquipmentId { get; init; }
    public string? EquipmentName { get; init; }
    public DateTime? ScheduledStart { get; init; }
    public DateTime? ScheduledEnd { get; init; }
    public int? EstimatedDurationMinutes { get; init; }
    public DateTime? ActualStart { get; init; }
    public DateTime? ActualEnd { get; init; }
    public string? WorkPerformed { get; init; }
    public decimal? LaborCost { get; init; }
    public decimal? MaterialsCost { get; init; }
    public string? InternalNotes { get; init; }
    public IReadOnlyList<JobStatus> AllowedTransitions { get; init; } = [];
    public bool HasConflict { get; init; }

    /// <summary>Detail-only collections (null in list responses).</summary>
    public IReadOnlyList<JobNoteDto>? Notes { get; init; }
    public IReadOnlyList<JobPhotoDto>? Photos { get; init; }
    public IReadOnlyList<JobMaterialDto>? MaterialsUsed { get; init; }

    /// <summary>Alias of <see cref="MaterialsUsed"/> kept for client compatibility.</summary>
    public IReadOnlyList<JobMaterialDto>? Materials => MaterialsUsed;

    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public record ScheduleConflictDto(
    Guid JobId,
    string JobNumber,
    string Title,
    DateTime ScheduledStart,
    DateTime ScheduledEnd,
    string Message);

/// <summary>A job with scheduling feedback flattened alongside the job fields.</summary>
public record ScheduleJobResponse : JobDto
{
    public ScheduleJobResponse(JobDto job) : base(job) { }

    public IReadOnlyList<string> Warnings { get; init; } = [];
    public IReadOnlyList<ScheduleConflictDto> Conflicts { get; init; } = [];
}

public record SaveJobRequest(
    Guid CustomerId,
    Guid ServiceLocationId,
    Guid? EquipmentId,
    Guid? TechnicianId,
    string Title,
    string? Description,
    JobPriority? Priority,
    int? EstimatedDurationMinutes,
    string? InternalNotes);

public record ScheduleJobRequest(Guid? TechnicianId, DateTime ScheduledStart, DateTime ScheduledEnd, bool? Force);

public record CompleteJobRequest(string WorkPerformed, decimal? LaborCost, decimal? MaterialsCost);

public record ReasonRequest(string? Reason);

public record AddNoteRequest(string Text);

public record AddJobMaterialRequest(Guid MaterialId, decimal Quantity);

public class JobQuery : PagedQuery
{
    public JobStatus? Status { get; set; }
    public JobPriority? Priority { get; set; }
    public Guid? TechnicianId { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? EquipmentId { get; set; }
}

public class ScheduleQuery
{
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public Guid? TechnicianId { get; set; }
}

public record PhotoContent(Stream Content, string ContentType, string FileName);
