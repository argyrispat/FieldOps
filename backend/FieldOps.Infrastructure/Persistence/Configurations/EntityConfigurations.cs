using FieldOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FieldOps.Infrastructure.Persistence.Configurations;

public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> b)
    {
        b.ToTable("Companies");
        b.Property(x => x.Name).IsRequired().HasMaxLength(150);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Address).HasMaxLength(200);
        b.Property(x => x.City).HasMaxLength(100);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.Website).HasMaxLength(200);
    }
}

public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> b)
    {
        b.Property(x => x.FirstName).IsRequired().HasMaxLength(100);
        b.Property(x => x.LastName).IsRequired().HasMaxLength(100);
        b.Ignore(x => x.FullName);
        b.HasIndex(x => x.CompanyId);

        b.HasOne(x => x.Company)
            .WithMany(c => c.Users)
            .HasForeignKey(x => x.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.ToTable("RefreshTokens");
        b.HasKey(x => x.Id);
        b.Property(x => x.Token).IsRequired().HasMaxLength(128);
        b.Property(x => x.ReplacedByToken).HasMaxLength(128);
        b.Ignore(x => x.IsActive);
        b.HasIndex(x => x.Token).IsUnique();
        b.HasIndex(x => x.UserId);
        b.HasOne(x => x.User)
            .WithMany(u => u.RefreshTokens)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> b)
    {
        b.ToTable("Customers");
        b.Property(x => x.FirstName).IsRequired().HasMaxLength(100);
        b.Property(x => x.LastName).IsRequired().HasMaxLength(100);
        b.Property(x => x.CompanyName).HasMaxLength(150);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Address).HasMaxLength(200);
        b.Property(x => x.City).HasMaxLength(100);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.Notes).HasMaxLength(4000);
        b.Ignore(x => x.DisplayName);
        b.HasIndex(x => new { x.CompanyId, x.LastName, x.FirstName });

        b.HasOne(x => x.Company).WithMany(c => c.Customers).HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ServiceLocationConfiguration : IEntityTypeConfiguration<ServiceLocation>
{
    public void Configure(EntityTypeBuilder<ServiceLocation> b)
    {
        b.ToTable("ServiceLocations");
        b.Property(x => x.Name).IsRequired().HasMaxLength(150);
        b.Property(x => x.Address).IsRequired().HasMaxLength(200);
        b.Property(x => x.City).HasMaxLength(100);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.Notes).HasMaxLength(4000);
        b.HasIndex(x => x.CustomerId);

        b.HasOne(x => x.Customer).WithMany(c => c.ServiceLocations).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class TechnicianConfiguration : IEntityTypeConfiguration<Technician>
{
    public void Configure(EntityTypeBuilder<Technician> b)
    {
        b.ToTable("Technicians");
        b.Property(x => x.Specialty).HasMaxLength(150);
        b.Property(x => x.Notes).HasMaxLength(4000);
        b.HasIndex(x => x.UserId).IsUnique();
        b.HasIndex(x => new { x.CompanyId, x.IsActive });

        b.HasOne(x => x.Company).WithMany(c => c.Technicians).HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.User).WithOne(u => u.Technician).HasForeignKey<Technician>(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class MaterialConfiguration : IEntityTypeConfiguration<Material>
{
    public void Configure(EntityTypeBuilder<Material> b)
    {
        b.ToTable("Materials");
        b.Property(x => x.Name).IsRequired().HasMaxLength(150);
        b.Property(x => x.Sku).HasMaxLength(64);
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.Unit).IsRequired().HasMaxLength(20);
        b.Property(x => x.QuantityOnHand).HasPrecision(18, 3);
        b.Property(x => x.MinimumQuantity).HasPrecision(18, 3);
        b.Property(x => x.UnitCost).HasPrecision(18, 2);
        b.Ignore(x => x.IsLowStock);

        // Optimistic concurrency token; refreshed on every insert/update by AppDbContext (portable bytea token,
        // works on PostgreSQL and the InMemory provider alike).
        b.Property(x => x.RowVersion).IsConcurrencyToken();

        b.HasIndex(x => new { x.CompanyId, x.Name });
        b.HasIndex(x => new { x.CompanyId, x.Sku });

        b.HasOne(x => x.Company).WithMany(c => c.Materials).HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class EquipmentConfiguration : IEntityTypeConfiguration<Equipment>
{
    public void Configure(EntityTypeBuilder<Equipment> b)
    {
        b.ToTable("Equipment");
        b.Property(x => x.Name).IsRequired().HasMaxLength(150);
        b.Property(x => x.Type).HasMaxLength(100);
        b.Property(x => x.Manufacturer).HasMaxLength(100);
        b.Property(x => x.Model).HasMaxLength(100);
        b.Property(x => x.SerialNumber).HasMaxLength(100);
        b.Property(x => x.Notes).HasMaxLength(4000);
        b.HasIndex(x => x.CustomerId);
        b.HasIndex(x => x.NextMaintenanceDate);

        b.HasOne(x => x.Customer).WithMany(c => c.Equipment).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.ServiceLocation).WithMany(l => l.Equipment).HasForeignKey(x => x.ServiceLocationId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class MaintenanceRecordConfiguration : IEntityTypeConfiguration<MaintenanceRecord>
{
    public void Configure(EntityTypeBuilder<MaintenanceRecord> b)
    {
        b.ToTable("MaintenanceRecords");
        b.Property(x => x.Description).HasMaxLength(4000);
        b.HasIndex(x => x.EquipmentId);

        b.HasOne(x => x.Equipment).WithMany(e => e.MaintenanceRecords).HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Job).WithMany().HasForeignKey(x => x.JobId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.PerformedBy).WithMany().HasForeignKey(x => x.PerformedById).OnDelete(DeleteBehavior.SetNull);
    }
}

public class JobConfiguration : IEntityTypeConfiguration<Job>
{
    public void Configure(EntityTypeBuilder<Job> b)
    {
        b.ToTable("Jobs");
        b.Property(x => x.JobNumber).IsRequired().HasMaxLength(32);
        b.Property(x => x.Title).IsRequired().HasMaxLength(200);
        b.Property(x => x.Description).HasMaxLength(8000);
        b.Property(x => x.WorkPerformed).HasMaxLength(8000);
        b.Property(x => x.InternalNotes).HasMaxLength(8000);
        b.Property(x => x.LaborCost).HasPrecision(18, 2);
        b.Property(x => x.MaterialsCost).HasPrecision(18, 2);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Priority).HasConversion<int>();

        b.HasIndex(x => new { x.CompanyId, x.JobNumber }).IsUnique();
        b.HasIndex(x => x.JobNumber);
        b.HasIndex(x => x.CustomerId);
        b.HasIndex(x => x.TechnicianId);
        b.HasIndex(x => x.EquipmentId);
        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.ScheduledStart);
        b.HasIndex(x => new { x.CompanyId, x.Status });
        b.HasIndex(x => new { x.TechnicianId, x.ScheduledStart });

        b.HasOne(x => x.Company).WithMany(c => c.Jobs).HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Customer).WithMany(c => c.Jobs).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ServiceLocation).WithMany(l => l.Jobs).HasForeignKey(x => x.ServiceLocationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Technician).WithMany(t => t.Jobs).HasForeignKey(x => x.TechnicianId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Equipment).WithMany(e => e.Jobs).HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class JobNoteConfiguration : IEntityTypeConfiguration<JobNote>
{
    public void Configure(EntityTypeBuilder<JobNote> b)
    {
        b.ToTable("JobNotes");
        b.Property(x => x.Text).IsRequired().HasMaxLength(4000);
        b.HasIndex(x => x.JobId);
        b.HasOne(x => x.Job).WithMany(j => j.Notes).HasForeignKey(x => x.JobId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class JobPhotoConfiguration : IEntityTypeConfiguration<JobPhoto>
{
    public void Configure(EntityTypeBuilder<JobPhoto> b)
    {
        b.ToTable("JobPhotos");
        b.Property(x => x.FileName).IsRequired().HasMaxLength(260);
        b.Property(x => x.StoredFileName).IsRequired().HasMaxLength(260);
        b.Property(x => x.ContentType).IsRequired().HasMaxLength(100);
        b.Property(x => x.Caption).HasMaxLength(500);
        b.Property(x => x.RelativePath).IsRequired().HasMaxLength(500);
        b.HasIndex(x => x.JobId);
        b.HasOne(x => x.Job).WithMany(j => j.Photos).HasForeignKey(x => x.JobId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.UploadedBy).WithMany().HasForeignKey(x => x.UploadedById).OnDelete(DeleteBehavior.Restrict);
    }
}

public class JobMaterialConfiguration : IEntityTypeConfiguration<JobMaterial>
{
    public void Configure(EntityTypeBuilder<JobMaterial> b)
    {
        b.ToTable("JobMaterials");
        b.Property(x => x.Quantity).HasPrecision(18, 3);
        b.Property(x => x.UnitCost).HasPrecision(18, 2);
        b.HasIndex(x => x.JobId);
        b.HasIndex(x => x.MaterialId);
        b.HasOne(x => x.Job).WithMany(j => j.MaterialsUsed).HasForeignKey(x => x.JobId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Material).WithMany(m => m.JobUsages).HasForeignKey(x => x.MaterialId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.RecordedBy).WithMany().HasForeignKey(x => x.RecordedById).OnDelete(DeleteBehavior.Restrict);
    }
}
