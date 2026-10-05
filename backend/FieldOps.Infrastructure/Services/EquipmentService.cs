using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using FieldOps.Application.Mapping;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Services;

public class EquipmentService(AppDbContext db, ICurrentUser currentUser, IJobService jobs) : IEquipmentService
{
    private IQueryable<Equipment> WithRefs() => db.Equipment.Include(e => e.Customer).Include(e => e.ServiceLocation);

    public async Task<PagedResult<EquipmentDto>> ListAsync(EquipmentQuery query, CancellationToken ct = default)
    {
        IQueryable<Equipment> q = WithRefs().AsNoTracking();

        if (query.CustomerId.HasValue)
            q = q.Where(e => e.CustomerId == query.CustomerId.Value);

        if (query.NormalizedSearch is { } s)
        {
            q = q.Where(e =>
                e.Name.ToLower().Contains(s)
                || (e.Type != null && e.Type.ToLower().Contains(s))
                || (e.Manufacturer != null && e.Manufacturer.ToLower().Contains(s))
                || (e.Model != null && e.Model.ToLower().Contains(s))
                || (e.SerialNumber != null && e.SerialNumber.ToLower().Contains(s))
                || e.Customer.FirstName.ToLower().Contains(s)
                || e.Customer.LastName.ToLower().Contains(s)
                || (e.Customer.CompanyName != null && e.Customer.CompanyName.ToLower().Contains(s)));
        }

        var total = await q.CountAsync(ct);

        var desc = query.Descending;
        IOrderedQueryable<Equipment> ordered = (query.SortBy?.ToLowerInvariant()) switch
        {
            "type" => desc ? q.OrderByDescending(e => e.Type) : q.OrderBy(e => e.Type),
            "nextmaintenancedate" or "nextmaintenance" => desc
                ? q.OrderByDescending(e => e.NextMaintenanceDate)
                : q.OrderBy(e => e.NextMaintenanceDate == null).ThenBy(e => e.NextMaintenanceDate),
            "customer" or "customername" => desc
                ? q.OrderByDescending(e => e.Customer.LastName)
                : q.OrderBy(e => e.Customer.LastName),
            "createdat" => desc ? q.OrderByDescending(e => e.CreatedAt) : q.OrderBy(e => e.CreatedAt),
            _ => desc ? q.OrderByDescending(e => e.Name) : q.OrderBy(e => e.Name)
        };

        var items = await ordered.ThenBy(e => e.Id).Skip(query.Skip).Take(query.PageSize).ToListAsync(ct);
        return PagedResult<EquipmentDto>.Create(items.Select(e => e.ToDto()).ToList(), query.Page, query.PageSize, total);
    }

    public async Task<EquipmentDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var e = await WithRefs().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
                ?? throw new NotFoundException("Equipment", id);
        return e.ToDto();
    }

    public async Task<EquipmentDto> CreateAsync(SaveEquipmentRequest request, CancellationToken ct = default)
    {
        await ValidateAsync(request, ct);
        var equipment = new Equipment { CompanyId = currentUser.CompanyId };
        Apply(equipment, request);
        db.Equipment.Add(equipment);
        await db.SaveChangesAsync(ct);
        return await GetAsync(equipment.Id, ct);
    }

    public async Task<EquipmentDto> UpdateAsync(Guid id, SaveEquipmentRequest request, CancellationToken ct = default)
    {
        var equipment = await db.Equipment.FirstOrDefaultAsync(e => e.Id == id, ct)
                        ?? throw new NotFoundException("Equipment", id);
        await ValidateAsync(request, ct);
        Apply(equipment, request);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var equipment = await db.Equipment.FirstOrDefaultAsync(e => e.Id == id, ct)
                        ?? throw new NotFoundException("Equipment", id);
        db.Equipment.Remove(equipment); // jobs keep existing (FK set null), maintenance history cascades
        await db.SaveChangesAsync(ct);
    }

    public async Task<MaintenanceReminderSummaryDto> GetRemindersAsync(CancellationToken ct = default)
    {
        var today = DateTime.UtcNow.Date;
        var horizon = today.AddDays(31);

        var due = await WithRefs().AsNoTracking()
            .Where(e => e.NextMaintenanceDate != null && e.NextMaintenanceDate < horizon)
            .OrderBy(e => e.NextMaintenanceDate)
            .ToListAsync(ct);

        var reminders = due.Select(e =>
        {
            var next = e.NextMaintenanceDate!.Value;
            return new MaintenanceReminderDto(
                e.Id, e.Name, e.CustomerId, e.Customer.DisplayName, e.ServiceLocation?.Name,
                next, (int)(next.Date - today).TotalDays);
        }).ToList();

        return new MaintenanceReminderSummaryDto(
            reminders.Where(r => r.DaysUntilDue < 0).ToList(),
            reminders.Where(r => r.DaysUntilDue is >= 0 and <= 7).ToList(),
            reminders.Where(r => r.DaysUntilDue is > 7 and <= 30).ToList());
    }

    public async Task<JobDto> CreateMaintenanceJobAsync(Guid equipmentId, CancellationToken ct = default)
    {
        var equipment = await WithRefs().AsNoTracking().FirstOrDefaultAsync(e => e.Id == equipmentId, ct)
                        ?? throw new NotFoundException("Equipment", equipmentId);

        var locationId = equipment.ServiceLocationId;
        if (locationId is null)
        {
            locationId = await db.ServiceLocations
                .Where(l => l.CustomerId == equipment.CustomerId)
                .OrderByDescending(l => l.IsPrimary).ThenBy(l => l.CreatedAt)
                .Select(l => (Guid?)l.Id)
                .FirstOrDefaultAsync(ct);
        }

        if (locationId is null)
            throw new ValidationException("serviceLocationId", "Add a service location for this customer before creating a maintenance job.");

        var description = $"Scheduled maintenance for {equipment.Name}"
                          + (equipment.NextMaintenanceDate.HasValue ? $" (due {equipment.NextMaintenanceDate:yyyy-MM-dd})." : ".");

        return await jobs.CreateAsync(new SaveJobRequest(
            equipment.CustomerId,
            locationId.Value,
            equipment.Id,
            null,
            $"Maintenance: {equipment.Name}",
            description,
            JobPriority.Normal,
            60,
            null), ct);
    }

    private async Task ValidateAsync(SaveEquipmentRequest r, CancellationToken ct)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == r.CustomerId, ct))
            throw new ValidationException("customerId", "Customer was not found.");

        if (r.ServiceLocationId is { } locId
            && !await db.ServiceLocations.AnyAsync(l => l.Id == locId && l.CustomerId == r.CustomerId, ct))
            throw new ValidationException("serviceLocationId", "Service location was not found for this customer.");
    }

    private static void Apply(Equipment e, SaveEquipmentRequest r)
    {
        e.CustomerId = r.CustomerId;
        e.ServiceLocationId = r.ServiceLocationId;
        e.Name = r.Name.Trim();
        e.Type = CustomerService.Clean(r.Type);
        e.Manufacturer = CustomerService.Clean(r.Manufacturer);
        e.Model = CustomerService.Clean(r.Model);
        e.SerialNumber = CustomerService.Clean(r.SerialNumber);
        e.InstallationDate = r.InstallationDate.ToUtc();
        e.WarrantyExpiration = r.WarrantyExpiration.ToUtc();
        e.LastMaintenanceDate = r.LastMaintenanceDate.ToUtc();
        e.NextMaintenanceDate = r.NextMaintenanceDate.ToUtc();
        e.Notes = CustomerService.Clean(r.Notes);
    }
}
