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

public class DashboardService(AppDbContext db) : IDashboardService
{
    private static readonly JobStatus[] OpenStatuses = [JobStatus.New, JobStatus.Scheduled, JobStatus.InProgress, JobStatus.OnHold];
    private static readonly JobStatus[] ActiveStatuses = [JobStatus.Scheduled, JobStatus.InProgress, JobStatus.OnHold];

    public async Task<DashboardDto> GetAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var todayStart = now.Date;
        var todayEnd = todayStart.AddDays(1);
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var seriesStart = todayStart.AddDays(-13);

        var jobs = db.Jobs.AsNoTracking();

        var statusCounts = await jobs.GroupBy(j => j.Status).Select(g => new { Status = g.Key, Count = g.Count() }).ToListAsync(ct);
        var byStatus = Enum.GetValues<JobStatus>()
            .Select(s => new StatusCountDto(s, statusCounts.FirstOrDefault(c => c.Status == s)?.Count ?? 0))
            .ToList();

        var jobsToday = await jobs.CountAsync(j => j.ScheduledStart != null && j.ScheduledStart >= todayStart
                                                    && j.ScheduledStart < todayEnd && j.Status != JobStatus.Cancelled, ct);
        var overdue = await jobs.CountAsync(j => j.ScheduledEnd != null && j.ScheduledEnd < now && OpenStatuses.Contains(j.Status), ct);
        var upcoming = await jobs.CountAsync(j => j.Status == JobStatus.Scheduled && j.ScheduledStart != null && j.ScheduledStart >= now, ct);
        var completedThisMonth = await jobs.CountAsync(j => j.Status == JobStatus.Completed
                                                             && (j.ActualEnd ?? j.UpdatedAt) >= monthStart, ct);

        var revenueRows = await jobs.Where(j => j.Status == JobStatus.Completed)
            .Select(j => new { j.LaborCost, j.MaterialsCost })
            .ToListAsync(ct);
        var revenue = revenueRows.Sum(r => (r.LaborCost ?? 0m) + (r.MaterialsCost ?? 0m));

        var points = await jobs
            .Where(j => (j.ScheduledStart ?? j.CreatedAt) >= seriesStart && (j.ScheduledStart ?? j.CreatedAt) < todayEnd
                        && j.Status != JobStatus.Cancelled)
            .Select(j => (j.ScheduledStart ?? j.CreatedAt))
            .ToListAsync(ct);
        var perDay = points.GroupBy(d => d.Date).ToDictionary(g => g.Key, g => g.Count());
        var overTime = Enumerable.Range(0, 14)
            .Select(i => seriesStart.AddDays(i))
            .Select(d => new DatePointDto(d.ToString("yyyy-MM-dd"), perDay.GetValueOrDefault(d.Date)))
            .ToList();

        var technicians = await db.Technicians.AsNoTracking().Include(t => t.User).Where(t => t.IsActive).ToListAsync(ct);
        var workloadCounts = await jobs
            .Where(j => j.TechnicianId != null && ActiveStatuses.Contains(j.Status))
            .GroupBy(j => j.TechnicianId!.Value)
            .Select(g => new { TechnicianId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var workload = technicians
            .Select(t => new TechnicianWorkloadDto(t.Id, t.User.FullName, workloadCounts.FirstOrDefault(c => c.TechnicianId == t.Id)?.Count ?? 0))
            .OrderByDescending(w => w.ActiveJobs).ThenBy(w => w.TechnicianName)
            .ToList();

        var upcomingJobs = await db.Jobs.AsNoTracking()
            .Include(j => j.Customer).Include(j => j.ServiceLocation)
            .Include(j => j.Technician).ThenInclude(t => t!.User)
            .Include(j => j.Equipment)
            .Where(j => (j.Status == JobStatus.Scheduled || j.Status == JobStatus.InProgress)
                        && j.ScheduledStart != null && j.ScheduledEnd >= now)
            .OrderBy(j => j.ScheduledStart)
            .Take(5)
            .ToListAsync(ct);

        return new DashboardDto
        {
            JobsToday = jobsToday,
            JobsInProgress = byStatus.First(s => s.Status == JobStatus.InProgress).Count,
            JobsCompleted = byStatus.First(s => s.Status == JobStatus.Completed).Count,
            JobsOverdue = overdue,
            UpcomingAppointments = upcoming,
            ActiveTechnicians = technicians.Count,
            CustomersCount = await db.Customers.CountAsync(ct),
            CompletedRevenue = revenue,
            JobsByStatus = byStatus,
            JobsOverTime = overTime,
            TechnicianWorkload = workload,
            UpcomingJobs = upcomingJobs.Select(j => j.ToDto()).ToList(),
            TotalJobs = byStatus.Sum(s => s.Count),
            OpenJobs = byStatus.Where(s => OpenStatuses.Contains(s.Status)).Sum(s => s.Count),
            CompletedThisMonth = completedThisMonth,
            LowStockMaterials = await db.Materials.CountAsync(m => m.QuantityOnHand <= m.MinimumQuantity, ct),
            OverdueMaintenance = await db.Equipment.CountAsync(e => e.NextMaintenanceDate != null && e.NextMaintenanceDate < now, ct)
        };
    }
}

public class SearchService(AppDbContext db) : ISearchService
{
    private const int Limit = 8;

    public async Task<SearchResultsDto> SearchAsync(string? query, CancellationToken ct = default)
    {
        var s = query?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(s))
            return new SearchResultsDto([], [], []);

        var customers = await db.Customers.AsNoTracking()
            .Where(c => c.FirstName.ToLower().Contains(s)
                        || c.LastName.ToLower().Contains(s)
                        || (c.FirstName + " " + c.LastName).ToLower().Contains(s)
                        || (c.CompanyName != null && c.CompanyName.ToLower().Contains(s))
                        || (c.Email != null && c.Email.ToLower().Contains(s))
                        || (c.Phone != null && c.Phone.ToLower().Contains(s)))
            .OrderBy(c => c.LastName).ThenBy(c => c.FirstName)
            .Take(Limit)
            .ToListAsync(ct);

        var jobs = await db.Jobs.AsNoTracking()
            .Include(j => j.Customer).Include(j => j.ServiceLocation)
            .Include(j => j.Technician).ThenInclude(t => t!.User)
            .Include(j => j.Equipment)
            .Where(j => j.JobNumber.ToLower().Contains(s)
                        || j.Title.ToLower().Contains(s)
                        || j.Customer.LastName.ToLower().Contains(s)
                        || j.Customer.FirstName.ToLower().Contains(s)
                        || (j.Customer.CompanyName != null && j.Customer.CompanyName.ToLower().Contains(s)))
            .OrderByDescending(j => j.CreatedAt)
            .Take(Limit)
            .ToListAsync(ct);

        var equipment = await db.Equipment.AsNoTracking()
            .Include(e => e.Customer).Include(e => e.ServiceLocation)
            .Where(e => e.Name.ToLower().Contains(s)
                        || (e.Model != null && e.Model.ToLower().Contains(s))
                        || (e.Manufacturer != null && e.Manufacturer.ToLower().Contains(s))
                        || (e.SerialNumber != null && e.SerialNumber.ToLower().Contains(s)))
            .OrderBy(e => e.Name)
            .Take(Limit)
            .ToListAsync(ct);

        return new SearchResultsDto(
            customers.Select(c => c.ToDto()).ToList(),
            jobs.Select(j => j.ToDto()).ToList(),
            equipment.Select(e => e.ToDto()).ToList());
    }
}

public class CompanyService(
    AppDbContext db,
    ICurrentUser currentUser,
    IdentityProvisioner provisioner) : ICompanyService
{
    public async Task<CompanyDto> GetAsync(CancellationToken ct = default) =>
        (await LoadAsync(ct)).ToDto();

    public async Task<CompanyDto> UpdateAsync(UpdateCompanyRequest request, CancellationToken ct = default)
    {
        var company = await LoadAsync(ct);
        company.Name = request.Name.Trim();
        company.Email = CustomerService.Clean(request.Email);
        company.Phone = CustomerService.Clean(request.Phone);
        company.Address = CustomerService.Clean(request.Address);
        company.City = CustomerService.Clean(request.City);
        company.PostalCode = CustomerService.Clean(request.PostalCode);
        company.Website = CustomerService.Clean(request.Website);
        if (request.AllowSchedulingConflicts.HasValue)
            company.AllowSchedulingConflicts = request.AllowSchedulingConflicts.Value;

        await db.SaveChangesAsync(ct);
        return company.ToDto();
    }

    public async Task<IReadOnlyList<UserDto>> ListUsersAsync(CancellationToken ct = default)
    {
        var company = await LoadAsync(ct);

        var users = await db.Users.AsNoTracking()
            .Where(u => u.CompanyId == company.Id)
            .OrderBy(u => u.LastName).ThenBy(u => u.FirstName)
            .ToListAsync(ct);

        var roleRows = await (from ur in db.UserRoles
                              join r in db.Roles on ur.RoleId equals r.Id
                              where users.Select(u => u.Id).Contains(ur.UserId)
                              select new { ur.UserId, RoleName = r.Name })
            .ToListAsync(ct);

        var technicians = await db.Technicians.AsNoTracking().ToDictionaryAsync(t => t.UserId, t => t.Id, ct);

        return users.Select(u => new UserDto(
                u.Id, u.Email ?? string.Empty, u.FirstName, u.LastName, u.FullName, u.IsActive,
                roleRows.Where(r => r.UserId == u.Id).Select(r => r.RoleName!).OrderBy(n => n).ToList(),
                u.CompanyId, company.Name,
                technicians.TryGetValue(u.Id, out var techId) ? techId : null,
                u.CreatedAt))
            .ToList();
    }

    public async Task<UserDto> CreateUserAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        var company = await LoadAsync(ct);

        await using var tx = await OptionalTransaction.BeginAsync(db, ct);

        var user = await provisioner.CreateUserAsync(
            company.Id, request.FirstName, request.LastName, request.Email, request.Password, request.Role);

        if (request.Role == AppRoles.Technician)
        {
            db.Technicians.Add(new Technician
            {
                CompanyId = company.Id,
                UserId = user.Id,
                Specialty = CustomerService.Clean(request.Specialty)
            });
            await db.SaveChangesAsync(ct);
        }

        await tx.CommitAsync(ct);
        return await provisioner.ToDtoAsync(user, company.Name, ct);
    }

    private async Task<Company> LoadAsync(CancellationToken ct) =>
        await db.Companies.FirstOrDefaultAsync(c => c.Id == currentUser.CompanyId, ct)
        ?? throw new NotFoundException("Company not found.");
}
