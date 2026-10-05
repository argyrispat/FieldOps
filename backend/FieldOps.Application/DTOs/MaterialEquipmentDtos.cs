using FieldOps.Application.Common;

namespace FieldOps.Application.DTOs;

public record MaterialDto(
    Guid Id,
    string Name,
    string? Sku,
    string? Description,
    decimal QuantityOnHand,
    decimal MinimumQuantity,
    string Unit,
    decimal UnitCost,
    bool IsLowStock);

public record SaveMaterialRequest(
    string Name,
    string? Sku,
    string? Description,
    string? Unit,
    decimal QuantityOnHand,
    decimal MinimumQuantity,
    decimal UnitCost);

public class MaterialQuery : PagedQuery
{
    public bool? LowStock { get; set; }
}

public record EquipmentDto(
    Guid Id,
    Guid CustomerId,
    string CustomerName,
    Guid? ServiceLocationId,
    string? LocationName,
    string Name,
    string? Type,
    string? Manufacturer,
    string? Model,
    string? SerialNumber,
    DateTime? InstallationDate,
    DateTime? WarrantyExpiration,
    DateTime? LastMaintenanceDate,
    DateTime? NextMaintenanceDate,
    string? Notes);

public record SaveEquipmentRequest(
    Guid CustomerId,
    Guid? ServiceLocationId,
    string Name,
    string? Type,
    string? Manufacturer,
    string? Model,
    string? SerialNumber,
    DateTime? InstallationDate,
    DateTime? WarrantyExpiration,
    DateTime? LastMaintenanceDate,
    DateTime? NextMaintenanceDate,
    string? Notes);

public class EquipmentQuery : PagedQuery
{
    public Guid? CustomerId { get; set; }
}

public record MaintenanceReminderDto(
    Guid EquipmentId,
    string EquipmentName,
    Guid CustomerId,
    string CustomerName,
    string? LocationName,
    DateTime NextMaintenanceDate,
    int DaysUntilDue);

public record MaintenanceReminderSummaryDto(
    IReadOnlyList<MaintenanceReminderDto> Overdue,
    IReadOnlyList<MaintenanceReminderDto> DueThisWeek,
    IReadOnlyList<MaintenanceReminderDto> DueThisMonth);
