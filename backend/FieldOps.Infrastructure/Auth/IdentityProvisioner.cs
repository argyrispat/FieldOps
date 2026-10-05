using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Domain.Entities;
using FieldOps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Auth;

/// <summary>Shared helpers for creating users/roles and shaping <see cref="UserDto"/>s.</summary>
public class IdentityProvisioner(
    UserManager<ApplicationUser> userManager,
    RoleManager<IdentityRole<Guid>> roleManager,
    AppDbContext db)
{
    public async Task EnsureRoleAsync(string role)
    {
        if (await roleManager.RoleExistsAsync(role)) return;

        var result = await roleManager.CreateAsync(new IdentityRole<Guid>(role));
        // A concurrent request may have created the role in the meantime.
        if (!result.Succeeded && !await roleManager.RoleExistsAsync(role))
            throw new InvalidOperationException($"Could not create role {role}: {string.Join("; ", result.Errors.Select(e => e.Description))}");
    }

    public async Task<ApplicationUser> CreateUserAsync(
        Guid companyId, string firstName, string lastName, string email, string password, string role, string? phone = null)
    {
        var normalizedEmail = email.Trim();

        if (await userManager.FindByEmailAsync(normalizedEmail) is not null)
            throw new ConflictException("An account with this email already exists.");

        await EnsureRoleAsync(role);

        var user = new ApplicationUser
        {
            UserName = normalizedEmail,
            Email = normalizedEmail,
            EmailConfirmed = true,
            PhoneNumber = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim(),
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            CompanyId = companyId,
            IsActive = true
        };

        var result = await userManager.CreateAsync(user, password);
        ThrowIfFailed(result);

        ThrowIfFailed(await userManager.AddToRoleAsync(user, role));
        return user;
    }

    public async Task AddToRoleAsync(ApplicationUser user, string role)
    {
        await EnsureRoleAsync(role);
        if (!await userManager.IsInRoleAsync(user, role))
            ThrowIfFailed(await userManager.AddToRoleAsync(user, role));
    }

    public static void ThrowIfFailed(IdentityResult result)
    {
        if (result.Succeeded) return;

        var errors = new Dictionary<string, List<string>>();
        foreach (var error in result.Errors)
        {
            var key = error.Code.StartsWith("Password", StringComparison.Ordinal) ? "password"
                : error.Code.Contains("Email", StringComparison.Ordinal) || error.Code.Contains("UserName", StringComparison.Ordinal) ? "email"
                : "user";
            if (!errors.TryGetValue(key, out var list)) errors[key] = list = [];
            list.Add(error.Description);
        }

        throw new ValidationException(
            errors.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray()),
            string.Join(" ", result.Errors.Select(e => e.Description)));
    }

    public async Task<UserDto> ToDtoAsync(ApplicationUser user, string? companyName = null, CancellationToken ct = default)
    {
        var roles = await userManager.GetRolesAsync(user);
        var technicianId = await db.Technicians.IgnoreQueryFilters()
            .Where(t => t.UserId == user.Id)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(ct);

        companyName ??= await db.Companies.Where(c => c.Id == user.CompanyId).Select(c => c.Name).FirstOrDefaultAsync(ct) ?? string.Empty;

        return new UserDto(user.Id, user.Email ?? string.Empty, user.FirstName, user.LastName, user.FullName,
            user.IsActive, roles.ToList(), user.CompanyId, companyName, technicianId, user.CreatedAt);
    }
}
