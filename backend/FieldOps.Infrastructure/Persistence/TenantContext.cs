using FieldOps.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Storage;

namespace FieldOps.Infrastructure.Persistence;

/// <summary>Tenant derived from the authenticated user. Null when unauthenticated.</summary>
public sealed class TenantContext(ICurrentUser currentUser) : ITenantContext
{
    public Guid? CompanyId => currentUser.IsAuthenticated && currentUser.CompanyId != Guid.Empty ? currentUser.CompanyId : null;
}

/// <summary>No tenant (design-time, ad-hoc tooling).</summary>
public sealed class NullTenantContext : ITenantContext
{
    public Guid? CompanyId => null;
}

/// <summary>Fixed tenant, useful for background work and tests.</summary>
public sealed class FixedTenantContext(Guid? companyId) : ITenantContext
{
    public Guid? CompanyId { get; } = companyId;
}

/// <summary>Used by `dotnet ef` so migrations can be generated without a running host or database.</summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                         ?? "Host=localhost;Port=5432;Database=fieldops;Username=fieldops;Password=fieldops_dev_password";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connection, o => o.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName))
            .Options;

        return new AppDbContext(options, new NullTenantContext());
    }
}

/// <summary>
/// Starts a database transaction when the provider supports it (PostgreSQL) and is a no-op otherwise
/// (InMemory), so the same service code runs in production and unit tests.
/// </summary>
public sealed class OptionalTransaction : IAsyncDisposable
{
    private readonly IDbContextTransaction? _transaction;

    private OptionalTransaction(IDbContextTransaction? transaction) => _transaction = transaction;

    public static async Task<OptionalTransaction> BeginAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (!db.Database.IsRelational() || db.Database.CurrentTransaction is not null)
            return new OptionalTransaction(null);

        return new OptionalTransaction(await db.Database.BeginTransactionAsync(ct));
    }

    public Task CommitAsync(CancellationToken ct = default) =>
        _transaction is null ? Task.CompletedTask : _transaction.CommitAsync(ct);

    public ValueTask DisposeAsync() => _transaction?.DisposeAsync() ?? ValueTask.CompletedTask;
}
