using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using FieldOps.Application.Mapping;
using FieldOps.Domain.Entities;
using FieldOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Services;

public class CustomerService(AppDbContext db, ICurrentUser currentUser) : ICustomerService
{
    public async Task<PagedResult<CustomerDto>> ListAsync(CustomerQuery query, CancellationToken ct = default)
    {
        IQueryable<Customer> q = db.Customers.AsNoTracking();

        if (query.NormalizedSearch is { } s)
        {
            q = q.Where(c =>
                c.FirstName.ToLower().Contains(s)
                || c.LastName.ToLower().Contains(s)
                || (c.FirstName + " " + c.LastName).ToLower().Contains(s)
                || (c.CompanyName != null && c.CompanyName.ToLower().Contains(s))
                || (c.Email != null && c.Email.ToLower().Contains(s))
                || (c.Phone != null && c.Phone.ToLower().Contains(s))
                || (c.City != null && c.City.ToLower().Contains(s))
                || (c.Address != null && c.Address.ToLower().Contains(s)));
        }

        var total = await q.CountAsync(ct);

        var desc = query.Descending;
        IOrderedQueryable<Customer> ordered = (query.SortBy?.ToLowerInvariant()) switch
        {
            "createdat" => desc ? q.OrderByDescending(c => c.CreatedAt) : q.OrderBy(c => c.CreatedAt),
            "email" => desc ? q.OrderByDescending(c => c.Email) : q.OrderBy(c => c.Email),
            "city" => desc ? q.OrderByDescending(c => c.City) : q.OrderBy(c => c.City),
            "company" or "companyname" => desc ? q.OrderByDescending(c => c.CompanyName) : q.OrderBy(c => c.CompanyName),
            _ => desc
                ? q.OrderByDescending(c => c.LastName).ThenByDescending(c => c.FirstName)
                : q.OrderBy(c => c.LastName).ThenBy(c => c.FirstName)
        };

        var rows = await ordered.ThenBy(c => c.Id)
            .Skip(query.Skip).Take(query.PageSize)
            .Select(c => new { Customer = c, JobCount = c.Jobs.Count() })
            .ToListAsync(ct);

        return PagedResult<CustomerDto>.Create(
            rows.Select(r => r.Customer.ToDto(false, r.JobCount)).ToList(), query.Page, query.PageSize, total);
    }

    public async Task<CustomerDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var customer = await db.Customers.AsNoTracking()
            .Include(c => c.ServiceLocations)
            .FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException("Customer", id);

        var jobCount = await db.Jobs.CountAsync(j => j.CustomerId == id, ct);
        return customer.ToDto(true, jobCount);
    }

    public async Task<CustomerDto> CreateAsync(SaveCustomerRequest request, CancellationToken ct = default)
    {
        var customer = new Customer { CompanyId = currentUser.CompanyId };
        Apply(customer, request);
        db.Customers.Add(customer);

        // Give the customer a usable primary location straight away when an address is known.
        if (!string.IsNullOrWhiteSpace(customer.Address))
        {
            db.ServiceLocations.Add(new ServiceLocation
            {
                CompanyId = currentUser.CompanyId,
                CustomerId = customer.Id,
                Name = "Primary",
                Address = customer.Address!,
                City = customer.City,
                PostalCode = customer.PostalCode,
                IsPrimary = true
            });
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(customer.Id, ct);
    }

    public async Task<CustomerDto> UpdateAsync(Guid id, SaveCustomerRequest request, CancellationToken ct = default)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct)
                       ?? throw new NotFoundException("Customer", id);

        Apply(customer, request);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct)
                       ?? throw new NotFoundException("Customer", id);

        if (await db.Jobs.AnyAsync(j => j.CustomerId == id, ct))
            throw new ConflictException("This customer has jobs and cannot be deleted.");

        db.Customers.Remove(customer);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<ServiceLocationDto>> ListLocationsAsync(Guid customerId, CancellationToken ct = default)
    {
        await EnsureCustomerAsync(customerId, ct);
        var locations = await db.ServiceLocations.AsNoTracking()
            .Where(l => l.CustomerId == customerId)
            .OrderByDescending(l => l.IsPrimary).ThenBy(l => l.Name)
            .ToListAsync(ct);
        return locations.Select(l => l.ToDto()).ToList();
    }

    public async Task<ServiceLocationDto> AddLocationAsync(Guid customerId, SaveServiceLocationRequest request, CancellationToken ct = default)
    {
        await EnsureCustomerAsync(customerId, ct);

        var hasAny = await db.ServiceLocations.AnyAsync(l => l.CustomerId == customerId, ct);
        var location = new ServiceLocation { CompanyId = currentUser.CompanyId, CustomerId = customerId };
        ApplyLocation(location, request);
        location.IsPrimary = request.IsPrimary || !hasAny;

        if (location.IsPrimary)
            await ClearPrimaryAsync(customerId, null, ct);

        db.ServiceLocations.Add(location);
        await db.SaveChangesAsync(ct);
        return location.ToDto();
    }

    public async Task<ServiceLocationDto> UpdateLocationAsync(
        Guid customerId, Guid locationId, SaveServiceLocationRequest request, CancellationToken ct = default)
    {
        var location = await db.ServiceLocations.FirstOrDefaultAsync(l => l.Id == locationId && l.CustomerId == customerId, ct)
                       ?? throw new NotFoundException("Service location", locationId);

        ApplyLocation(location, request);

        if (request.IsPrimary)
        {
            await ClearPrimaryAsync(customerId, locationId, ct);
            location.IsPrimary = true;
        }
        else if (location.IsPrimary)
        {
            // A customer always keeps one primary location; un-flagging it is a no-op.
            location.IsPrimary = true;
        }

        await db.SaveChangesAsync(ct);
        return location.ToDto();
    }

    public async Task DeleteLocationAsync(Guid customerId, Guid locationId, CancellationToken ct = default)
    {
        var location = await db.ServiceLocations.FirstOrDefaultAsync(l => l.Id == locationId && l.CustomerId == customerId, ct)
                       ?? throw new NotFoundException("Service location", locationId);

        if (await db.Jobs.AnyAsync(j => j.ServiceLocationId == locationId, ct))
            throw new ConflictException("This location is used by jobs and cannot be deleted.");

        db.ServiceLocations.Remove(location);

        if (location.IsPrimary)
        {
            var next = await db.ServiceLocations
                .Where(l => l.CustomerId == customerId && l.Id != locationId)
                .OrderBy(l => l.CreatedAt)
                .FirstOrDefaultAsync(ct);
            if (next is not null) next.IsPrimary = true;
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task EnsureCustomerAsync(Guid customerId, CancellationToken ct)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == customerId, ct))
            throw new NotFoundException("Customer", customerId);
    }

    private async Task ClearPrimaryAsync(Guid customerId, Guid? exceptId, CancellationToken ct)
    {
        var others = await db.ServiceLocations
            .Where(l => l.CustomerId == customerId && l.IsPrimary && l.Id != exceptId)
            .ToListAsync(ct);
        foreach (var o in others) o.IsPrimary = false;
    }

    private static void Apply(Customer c, SaveCustomerRequest r)
    {
        c.FirstName = r.FirstName.Trim();
        c.LastName = r.LastName.Trim();
        c.CompanyName = Clean(r.CompanyName);
        c.Email = Clean(r.Email);
        c.Phone = Clean(r.Phone);
        c.Address = Clean(r.Address);
        c.City = Clean(r.City);
        c.PostalCode = Clean(r.PostalCode);
        c.Notes = Clean(r.Notes);
    }

    private static void ApplyLocation(ServiceLocation l, SaveServiceLocationRequest r)
    {
        l.Name = r.Name.Trim();
        l.Address = r.Address.Trim();
        l.City = Clean(r.City);
        l.PostalCode = Clean(r.PostalCode);
        l.Notes = Clean(r.Notes);
    }

    internal static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
