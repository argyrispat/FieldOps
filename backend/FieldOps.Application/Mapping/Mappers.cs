using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Domain.Common;
using FieldOps.Domain.Entities;

namespace FieldOps.Application.Mapping;

/// <summary>Entity -> DTO mapping. Callers are responsible for loading the needed navigations.</summary>
public static class Mappers
{
    public static ServiceLocationDto ToDto(this ServiceLocation l) =>
        new(l.Id, l.CustomerId, l.Name, l.Address, l.City, l.PostalCode, l.Notes, l.IsPrimary);

    public static CustomerDto ToDto(this Customer c, bool includeLocations = false, int jobCount = 0) => new()
    {
        Id = c.Id,
        FirstName = c.FirstName,
        LastName = c.LastName,
        CompanyName = c.CompanyName,
        DisplayName = c.DisplayName,
        Email = c.Email,
        Phone = c.Phone,
        Address = c.Address,
        City = c.City,
        PostalCode = c.PostalCode,
        Notes = c.Notes,
        Locations = includeLocations
            ? c.ServiceLocations.OrderByDescending(l => l.IsPrimary).ThenBy(l => l.Name).Select(l => l.ToDto()).ToList()
            : null,
        JobCount = jobCount,
        CreatedAt = c.CreatedAt
    };

    public static TechnicianDto ToDto(this Technician t) =>
        new(t.Id, t.UserId, t.User.FirstName, t.User.LastName, t.User.FullName, t.User.Email, t.User.PhoneNumber,
            t.Specialty, t.IsActive, t.Notes);

    public static MaterialDto ToDto(this Material m) =>
        new(m.Id, m.Name, m.Sku, m.Description, m.QuantityOnHand, m.MinimumQuantity, m.Unit, m.UnitCost, m.IsLowStock);

    public static EquipmentDto ToDto(this Equipment e) =>
        new(e.Id, e.CustomerId, e.Customer.DisplayName, e.ServiceLocationId, e.ServiceLocation?.Name, e.Name, e.Type,
            e.Manufacturer, e.Model, e.SerialNumber, e.InstallationDate, e.WarrantyExpiration, e.LastMaintenanceDate,
            e.NextMaintenanceDate, e.Notes);

    public static CompanyDto ToDto(this Company c) =>
        new(c.Id, c.Name, c.Email, c.Phone, c.Address, c.City, c.PostalCode, c.Website, c.AllowSchedulingConflicts);

    public static JobNoteDto ToDto(this JobNote n) =>
        new(n.Id, n.JobId, n.AuthorId, n.Author?.FullName ?? string.Empty, n.Text, n.CreatedAt);

    public static JobPhotoDto ToDto(this JobPhoto p) =>
        new(p.Id, p.JobId, p.FileName, p.ContentType, p.SizeBytes, p.Caption,
            $"/jobs/{p.JobId}/photos/{p.Id}", p.UploadedBy?.FullName ?? string.Empty, p.CreatedAt);

    public static JobMaterialDto ToDto(this JobMaterial m) =>
        new(m.Id, m.JobId, m.MaterialId, m.Material?.Name ?? string.Empty, m.Material?.Unit ?? string.Empty,
            m.Quantity, m.UnitCost, m.RecordedBy?.FullName ?? string.Empty, m.CreatedAt);

    /// <summary>
    /// Maps a job. Requires Customer, ServiceLocation, Technician.User and Equipment to be loaded. When
    /// <paramref name="detail"/> is true Notes (+Author), Photos (+UploadedBy) and MaterialsUsed (+Material, RecordedBy) must be loaded too.
    /// </summary>
    public static JobDto ToDto(this Job j, bool detail = false) => new()
    {
        Id = j.Id,
        JobNumber = j.JobNumber,
        Title = j.Title,
        Description = j.Description,
        Status = j.Status,
        Priority = j.Priority,
        CustomerId = j.CustomerId,
        CustomerName = j.Customer?.DisplayName ?? string.Empty,
        ServiceLocationId = j.ServiceLocationId,
        LocationName = j.ServiceLocation?.Name ?? string.Empty,
        LocationAddress = j.ServiceLocation is null
            ? null
            : string.Join(", ", new[] { j.ServiceLocation.Address, j.ServiceLocation.City }.Where(s => !string.IsNullOrWhiteSpace(s))),
        TechnicianId = j.TechnicianId,
        TechnicianName = j.Technician?.User?.FullName,
        EquipmentId = j.EquipmentId,
        EquipmentName = j.Equipment?.Name,
        ScheduledStart = j.ScheduledStart,
        ScheduledEnd = j.ScheduledEnd,
        EstimatedDurationMinutes = j.EstimatedDurationMinutes,
        ActualStart = j.ActualStart,
        ActualEnd = j.ActualEnd,
        WorkPerformed = j.WorkPerformed,
        LaborCost = j.LaborCost,
        MaterialsCost = j.MaterialsCost,
        InternalNotes = j.InternalNotes,
        AllowedTransitions = JobStatusTransitions.GetAllowed(j.Status).ToList(),
        Notes = detail ? j.Notes.OrderByDescending(n => n.CreatedAt).Select(n => n.ToDto()).ToList() : null,
        Photos = detail ? j.Photos.OrderBy(p => p.CreatedAt).Select(p => p.ToDto()).ToList() : null,
        MaterialsUsed = detail ? j.MaterialsUsed.OrderBy(m => m.CreatedAt).Select(m => m.ToDto()).ToList() : null,
        CreatedAt = j.CreatedAt,
        UpdatedAt = j.UpdatedAt
    };
}
