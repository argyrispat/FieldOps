using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using FieldOps.Application.Mapping;
using FieldOps.Application.Services;
using FieldOps.Domain.Entities;
using FieldOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Services;

public class MaterialService(AppDbContext db, ICurrentUser currentUser) : IMaterialService
{
    /// <summary>How many times a deduction is retried after losing an optimistic-concurrency race.</summary>
    public const int MaxConcurrencyRetries = 15;

    public async Task<PagedResult<MaterialDto>> ListAsync(MaterialQuery query, CancellationToken ct = default)
    {
        IQueryable<Material> q = db.Materials.AsNoTracking();

        if (query.LowStock == true)
            q = q.Where(m => m.QuantityOnHand <= m.MinimumQuantity);

        if (query.NormalizedSearch is { } s)
        {
            q = q.Where(m =>
                m.Name.ToLower().Contains(s)
                || (m.Sku != null && m.Sku.ToLower().Contains(s))
                || (m.Description != null && m.Description.ToLower().Contains(s)));
        }

        var total = await q.CountAsync(ct);

        var desc = query.Descending;
        IOrderedQueryable<Material> ordered = (query.SortBy?.ToLowerInvariant()) switch
        {
            "sku" => desc ? q.OrderByDescending(m => m.Sku) : q.OrderBy(m => m.Sku),
            "quantityonhand" or "quantity" => desc ? q.OrderByDescending(m => m.QuantityOnHand) : q.OrderBy(m => m.QuantityOnHand),
            "unitcost" => desc ? q.OrderByDescending(m => m.UnitCost) : q.OrderBy(m => m.UnitCost),
            "createdat" => desc ? q.OrderByDescending(m => m.CreatedAt) : q.OrderBy(m => m.CreatedAt),
            _ => desc ? q.OrderByDescending(m => m.Name) : q.OrderBy(m => m.Name)
        };

        var items = await ordered.ThenBy(m => m.Id).Skip(query.Skip).Take(query.PageSize).ToListAsync(ct);
        return PagedResult<MaterialDto>.Create(items.Select(m => m.ToDto()).ToList(), query.Page, query.PageSize, total);
    }

    public async Task<MaterialDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var material = await db.Materials.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id, ct)
                       ?? throw new NotFoundException("Material", id);
        return material.ToDto();
    }

    public async Task<MaterialDto> CreateAsync(SaveMaterialRequest request, CancellationToken ct = default)
    {
        var material = new Material { CompanyId = currentUser.CompanyId };
        Apply(material, request);
        db.Materials.Add(material);
        await db.SaveChangesAsync(ct);
        return material.ToDto();
    }

    public async Task<MaterialDto> UpdateAsync(Guid id, SaveMaterialRequest request, CancellationToken ct = default)
    {
        var material = await db.Materials.FirstOrDefaultAsync(m => m.Id == id, ct)
                       ?? throw new NotFoundException("Material", id);

        Apply(material, request);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("This material was modified by someone else. Reload and try again.");
        }

        return material.ToDto();
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var material = await db.Materials.FirstOrDefaultAsync(m => m.Id == id, ct)
                       ?? throw new NotFoundException("Material", id);

        if (await db.JobMaterials.AnyAsync(m => m.MaterialId == id, ct))
            throw new ConflictException("This material has been used on jobs and cannot be deleted.");

        db.Materials.Remove(material);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Records usage and deducts stock. Everything happens in one transaction; the material row carries an
    /// optimistic concurrency token so two concurrent deductions can never both succeed against the same stock
    /// snapshot. The loser reloads fresh state and retries (or fails with "insufficient stock").
    /// </summary>
    public async Task<JobMaterialDto> RecordJobUsageAsync(Guid jobId, AddJobMaterialRequest request, CancellationToken ct = default)
    {
        for (var attempt = 1; ; attempt++)
        {
            await using var tx = await OptionalTransaction.BeginAsync(db, ct);

            var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == jobId, ct)
                      ?? throw new NotFoundException("Job", jobId);
            JobRules.EnsureCanMutate(currentUser, job);

            if (JobRules.IsClosed(job.Status))
                throw new ConflictException($"Materials cannot be added to a {job.Status} job.");

            var material = await db.Materials.FirstOrDefaultAsync(m => m.Id == request.MaterialId, ct)
                           ?? throw new ValidationException("materialId", "Material was not found.");

            material.QuantityOnHand = InventoryRules.Deduct(material.QuantityOnHand, request.Quantity, material.Name);

            // Step 1: claim the stock on its own. The row-version token makes this UPDATE succeed only if nobody
            // else touched the material since we read it. (Kept separate so a lost race never leaves partial writes,
            // even on providers without transactions.)
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxConcurrencyRetries)
            {
                // Lost the race: another request changed this material. Drop all tracked state and re-read.
                db.ChangeTracker.Clear();
                continue;
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new ConflictException("Inventory is being updated by other requests. Please try again.");
            }

            // Step 2: record the usage inside the same transaction.
            var recorder = await db.Users.FirstAsync(u => u.Id == currentUser.UserId, ct);
            var usage = new JobMaterial
            {
                CompanyId = job.CompanyId,
                JobId = job.Id,
                MaterialId = material.Id,
                Material = material,
                Quantity = request.Quantity,
                UnitCost = material.UnitCost,
                RecordedById = recorder.Id,
                RecordedBy = recorder
            };
            db.JobMaterials.Add(usage);

            var existingCost = (await db.JobMaterials.Where(m => m.JobId == jobId).Select(m => new { m.Quantity, m.UnitCost }).ToListAsync(ct))
                .Sum(m => InventoryRules.LineCost(m.Quantity, m.UnitCost));
            job.MaterialsCost = existingCost + InventoryRules.LineCost(usage.Quantity, usage.UnitCost);

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return usage.ToDto();
        }
    }

    private static void Apply(Material m, SaveMaterialRequest r)
    {
        m.Name = r.Name.Trim();
        m.Sku = CustomerService.Clean(r.Sku);
        m.Description = CustomerService.Clean(r.Description);
        m.Unit = string.IsNullOrWhiteSpace(r.Unit) ? "ea" : r.Unit.Trim();
        m.QuantityOnHand = r.QuantityOnHand;
        m.MinimumQuantity = r.MinimumQuantity;
        m.UnitCost = r.UnitCost;
    }
}
