using FieldOps.Application.Interfaces;
using FieldOps.Domain.Common;
using FieldOps.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Persistence;

public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    private readonly ITenantContext _tenant;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenant) : base(options)
    {
        _tenant = tenant;
    }

    /// <summary>Evaluated per context instance by EF query filters. Null => no tenant => tenant data is invisible.</summary>
    private Guid? CurrentCompanyId => _tenant.CompanyId;

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<ServiceLocation> ServiceLocations => Set<ServiceLocation>();
    public DbSet<Technician> Technicians => Set<Technician>();
    public DbSet<Job> Jobs => Set<Job>();
    public DbSet<JobNote> JobNotes => Set<JobNote>();
    public DbSet<JobPhoto> JobPhotos => Set<JobPhoto>();
    public DbSet<JobMaterial> JobMaterials => Set<JobMaterial>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Equipment> Equipment => Set<Equipment>();
    public DbSet<MaintenanceRecord> MaintenanceRecords => Set<MaintenanceRecord>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Multi-tenancy: global query filter + CompanyId index + FK to Company on every tenant entity.
        foreach (var entityType in builder.Model.GetEntityTypes()
                     .Where(t => typeof(TenantEntity).IsAssignableFrom(t.ClrType))
                     .ToList())
        {
            var method = typeof(AppDbContext)
                .GetMethod(nameof(ConfigureTenantEntity), System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!
                .MakeGenericMethod(entityType.ClrType);
            method.Invoke(this, [builder]);
        }
    }

    private void ConfigureTenantEntity<T>(ModelBuilder builder) where T : TenantEntity
    {
        builder.Entity<T>(b =>
        {
            b.HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
            b.HasIndex(e => e.CompanyId);

            // Entities with an explicit Company navigation configure the relationship themselves.
            if (b.Metadata.FindNavigation(nameof(Customer.Company)) is null)
                b.HasOne<Company>().WithMany().HasForeignKey(e => e.CompanyId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ApplyAudit();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        ApplyAudit();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void ApplyAudit()
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is BaseEntity baseEntity)
            {
                if (entry.State == EntityState.Added)
                {
                    if (baseEntity.CreatedAt == default) baseEntity.CreatedAt = now;
                    baseEntity.UpdatedAt = now;
                }
                else if (entry.State == EntityState.Modified)
                {
                    baseEntity.UpdatedAt = now;
                }
            }

            // Tenant safety net: never persist a tenant row without a company.
            if (entry is { State: EntityState.Added, Entity: TenantEntity tenantEntity } && tenantEntity.CompanyId == Guid.Empty)
            {
                tenantEntity.CompanyId = _tenant.CompanyId
                    ?? throw new InvalidOperationException($"{entry.Entity.GetType().Name} has no CompanyId and no tenant is in scope.");
            }

            // Optimistic concurrency token for inventory rows (portable across Npgsql / InMemory).
            if (entry.Entity is Material material && (entry.State == EntityState.Added || entry.State == EntityState.Modified))
            {
                material.RowVersion = Guid.NewGuid().ToByteArray();
            }
        }
    }
}
