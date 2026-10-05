using FieldOps.Application.Interfaces;
using FieldOps.Domain.Entities;
using FieldOps.Infrastructure.Auth;
using FieldOps.Infrastructure.Persistence;
using FieldOps.Infrastructure.Reports;
using FieldOps.Infrastructure.Seeding;
using FieldOps.Infrastructure.Services;
using FieldOps.Infrastructure.Storage;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FieldOps.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Registers persistence, identity, auth and domain services. The host must also register
    /// <see cref="ICurrentUser"/> (scoped) - the API does so from the HTTP context.
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<FileStorageOptions>(configuration.GetSection(FileStorageOptions.SectionName));

        services.AddScoped<ITenantContext, TenantContext>();

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var connection = PostgresConnectionString.Normalize(
                configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured."));
            options.UseNpgsql(connection, npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
        });

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = false;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<AppDbContext>();

        services.AddSingleton<ITokenService, JwtTokenService>();
        services.AddSingleton<IFileStorage, LocalFileStorage>();
        services.AddSingleton<IReportService, QuestPdfReportService>();

        services.AddScoped<IdentityProvisioner>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<ITechnicianService, TechnicianService>();
        services.AddScoped<IJobService, JobService>();
        services.AddScoped<IMaterialService, MaterialService>();
        services.AddScoped<IEquipmentService, EquipmentService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<ISearchService, SearchService>();
        services.AddScoped<ICompanyService, CompanyService>();
        services.AddScoped<DataSeeder>();

        return services;
    }
}
