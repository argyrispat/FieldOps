using FieldOps.Domain.Enums;

namespace FieldOps.Application.Interfaces;

/// <summary>The authenticated principal. Tenant identity is ALWAYS taken from here, never from client input.</summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    Guid UserId { get; }
    Guid CompanyId { get; }
    string? Email { get; }
    Guid? TechnicianId { get; }
    IReadOnlyCollection<string> Roles { get; }

    bool IsInRole(string role);
}

public static class CurrentUserExtensions
{
    /// <summary>Owner or Dispatcher.</summary>
    public static bool IsManager(this ICurrentUser user) =>
        user.IsInRole(AppRoles.Owner) || user.IsInRole(AppRoles.Dispatcher);
}

/// <summary>Resolves the tenant used by EF global query filters. Null when no tenant is in scope (seeding, migrations, anonymous).</summary>
public interface ITenantContext
{
    Guid? CompanyId { get; }
}
