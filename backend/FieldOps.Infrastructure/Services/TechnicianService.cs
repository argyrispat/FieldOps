using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using FieldOps.Application.Mapping;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure.Auth;
using FieldOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Services;

public class TechnicianService(
    AppDbContext db,
    ICurrentUser currentUser,
    IdentityProvisioner provisioner) : ITechnicianService
{
    public async Task<PagedResult<TechnicianDto>> ListAsync(TechnicianQuery query, CancellationToken ct = default)
    {
        IQueryable<Technician> q = db.Technicians.AsNoTracking().Include(t => t.User);

        if (query.IsActive.HasValue)
            q = q.Where(t => t.IsActive == query.IsActive.Value);

        if (query.NormalizedSearch is { } s)
        {
            q = q.Where(t =>
                t.User.FirstName.ToLower().Contains(s)
                || t.User.LastName.ToLower().Contains(s)
                || (t.User.FirstName + " " + t.User.LastName).ToLower().Contains(s)
                || (t.User.Email != null && t.User.Email.ToLower().Contains(s))
                || (t.Specialty != null && t.Specialty.ToLower().Contains(s)));
        }

        var total = await q.CountAsync(ct);

        var desc = query.Descending;
        IOrderedQueryable<Technician> ordered = (query.SortBy?.ToLowerInvariant()) switch
        {
            "specialty" => desc ? q.OrderByDescending(t => t.Specialty) : q.OrderBy(t => t.Specialty),
            "createdat" => desc ? q.OrderByDescending(t => t.CreatedAt) : q.OrderBy(t => t.CreatedAt),
            _ => desc
                ? q.OrderByDescending(t => t.User.LastName).ThenByDescending(t => t.User.FirstName)
                : q.OrderBy(t => t.User.LastName).ThenBy(t => t.User.FirstName)
        };

        var items = await ordered.ThenBy(t => t.Id).Skip(query.Skip).Take(query.PageSize).ToListAsync(ct);
        return PagedResult<TechnicianDto>.Create(items.Select(t => t.ToDto()).ToList(), query.Page, query.PageSize, total);
    }

    public async Task<TechnicianDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var tech = await db.Technicians.AsNoTracking().Include(t => t.User).FirstOrDefaultAsync(t => t.Id == id, ct)
                   ?? throw new NotFoundException("Technician", id);
        return tech.ToDto();
    }

    public async Task<TechnicianDto> CreateAsync(CreateTechnicianRequest request, CancellationToken ct = default)
    {
        await using var tx = await OptionalTransaction.BeginAsync(db, ct);
        ApplicationUser user;

        if (request.UserId is { } userId)
        {
            // Promote an existing user of THIS company only.
            user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.CompanyId == currentUser.CompanyId, ct)
                   ?? throw new NotFoundException("User", userId);

            if (await db.Technicians.AnyAsync(t => t.UserId == userId, ct))
                throw new ConflictException("This user already has a technician profile.");

            await provisioner.AddToRoleAsync(user, AppRoles.Technician);
            if (!string.IsNullOrWhiteSpace(request.Phone)) user.PhoneNumber = request.Phone.Trim();
        }
        else
        {
            user = await provisioner.CreateUserAsync(
                currentUser.CompanyId, request.FirstName!, request.LastName!, request.Email!, request.Password!,
                AppRoles.Technician, request.Phone);
        }

        var technician = new Technician
        {
            CompanyId = currentUser.CompanyId,
            UserId = user.Id,
            Specialty = CustomerService.Clean(request.Specialty),
            Notes = CustomerService.Clean(request.Notes),
            IsActive = true
        };
        db.Technicians.Add(technician);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        technician.User = user;
        return technician.ToDto();
    }

    public async Task<TechnicianDto> UpdateAsync(Guid id, UpdateTechnicianRequest request, CancellationToken ct = default)
    {
        var tech = await db.Technicians.Include(t => t.User).FirstOrDefaultAsync(t => t.Id == id, ct)
                   ?? throw new NotFoundException("Technician", id);

        if (!string.IsNullOrWhiteSpace(request.FirstName)) tech.User.FirstName = request.FirstName.Trim();
        if (!string.IsNullOrWhiteSpace(request.LastName)) tech.User.LastName = request.LastName.Trim();
        if (request.Phone is not null) tech.User.PhoneNumber = CustomerService.Clean(request.Phone);
        tech.Specialty = CustomerService.Clean(request.Specialty);
        tech.Notes = CustomerService.Clean(request.Notes);

        if (request.IsActive is { } active)
        {
            tech.IsActive = active;
            tech.User.IsActive = active;
        }

        tech.User.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return tech.ToDto();
    }
}
