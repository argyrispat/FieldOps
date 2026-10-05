using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using FieldOps.Application.Mapping;
using FieldOps.Application.Services;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Services;

public class JobService(AppDbContext db, ICurrentUser currentUser, IFileStorage storage) : IJobService
{
    private const int MaxNumberRetries = 5;

    /// <summary>Job with the navigations needed for a flat <see cref="JobDto"/>.</summary>
    private IQueryable<Job> WithSummary() => db.Jobs
        .Include(j => j.Customer)
        .Include(j => j.ServiceLocation)
        .Include(j => j.Technician).ThenInclude(t => t!.User)
        .Include(j => j.Equipment);

    /// <summary>Job with everything needed for a detailed <see cref="JobDto"/>.</summary>
    private IQueryable<Job> WithDetail() => WithSummary()
        .Include(j => j.Notes).ThenInclude(n => n.Author)
        .Include(j => j.Photos).ThenInclude(p => p.UploadedBy)
        .Include(j => j.MaterialsUsed).ThenInclude(m => m.Material)
        .Include(j => j.MaterialsUsed).ThenInclude(m => m.RecordedBy)
        .AsSplitQuery();

    private async Task<Job> LoadDetailAsync(Guid id, CancellationToken ct) =>
        await WithDetail().FirstOrDefaultAsync(j => j.Id == id, ct) ?? throw new NotFoundException("Job", id);

    // ---------------------------------------------------------------- queries

    public async Task<PagedResult<JobDto>> ListAsync(JobQuery query, CancellationToken ct = default)
    {
        IQueryable<Job> q = WithSummary().AsNoTracking();

        // Technicians may only list their own assignments (ignore client-supplied technicianId filters).
        if (currentUser.IsInRole(AppRoles.Technician) && !currentUser.IsManager())
        {
            if (!currentUser.TechnicianId.HasValue)
                return PagedResult<JobDto>.Create([], query.Page, query.PageSize, 0);
            q = q.Where(j => j.TechnicianId == currentUser.TechnicianId.Value);
        }
        else
        {
            if (query.TechnicianId.HasValue) q = q.Where(j => j.TechnicianId == query.TechnicianId.Value);
        }

        if (query.Status.HasValue) q = q.Where(j => j.Status == query.Status.Value);
        if (query.Priority.HasValue) q = q.Where(j => j.Priority == query.Priority.Value);
        if (query.CustomerId.HasValue) q = q.Where(j => j.CustomerId == query.CustomerId.Value);
        if (query.EquipmentId.HasValue) q = q.Where(j => j.EquipmentId == query.EquipmentId.Value);

        if (query.NormalizedSearch is { } s)
        {
            q = q.Where(j =>
                j.JobNumber.ToLower().Contains(s)
                || j.Title.ToLower().Contains(s)
                || (j.Description != null && j.Description.ToLower().Contains(s))
                || j.Customer.FirstName.ToLower().Contains(s)
                || j.Customer.LastName.ToLower().Contains(s)
                || (j.Customer.CompanyName != null && j.Customer.CompanyName.ToLower().Contains(s))
                || j.ServiceLocation.Name.ToLower().Contains(s)
                || (j.Technician != null && (j.Technician.User.FirstName + " " + j.Technician.User.LastName).ToLower().Contains(s)));
        }

        var total = await q.CountAsync(ct);

        var desc = query.Descending;
        IOrderedQueryable<Job> ordered = (query.SortBy?.ToLowerInvariant()) switch
        {
            "jobnumber" => desc ? q.OrderByDescending(j => j.JobNumber) : q.OrderBy(j => j.JobNumber),
            "title" => desc ? q.OrderByDescending(j => j.Title) : q.OrderBy(j => j.Title),
            "status" => desc ? q.OrderByDescending(j => j.Status) : q.OrderBy(j => j.Status),
            "priority" => desc ? q.OrderByDescending(j => j.Priority) : q.OrderBy(j => j.Priority),
            "scheduledstart" => desc
                ? q.OrderByDescending(j => j.ScheduledStart.HasValue).ThenByDescending(j => j.ScheduledStart)
                : q.OrderByDescending(j => j.ScheduledStart.HasValue).ThenBy(j => j.ScheduledStart),
            "customer" or "customername" => desc
                ? q.OrderByDescending(j => j.Customer.LastName).ThenByDescending(j => j.Customer.FirstName)
                : q.OrderBy(j => j.Customer.LastName).ThenBy(j => j.Customer.FirstName),
            "updatedat" => desc ? q.OrderByDescending(j => j.UpdatedAt) : q.OrderBy(j => j.UpdatedAt),
            "createdat" => desc ? q.OrderByDescending(j => j.CreatedAt) : q.OrderBy(j => j.CreatedAt),
            _ => string.IsNullOrWhiteSpace(query.SortBy) && !desc
                ? q.OrderByDescending(j => j.CreatedAt)
                : desc ? q.OrderByDescending(j => j.CreatedAt) : q.OrderBy(j => j.CreatedAt)
        };

        var items = await ordered.ThenBy(j => j.Id).Skip(query.Skip).Take(query.PageSize).ToListAsync(ct);
        return PagedResult<JobDto>.Create(items.Select(j => j.ToDto()).ToList(), query.Page, query.PageSize, total);
    }

    public async Task<IReadOnlyList<JobDto>> GetScheduleAsync(ScheduleQuery query, CancellationToken ct = default)
    {
        IQueryable<Job> q = WithSummary().AsNoTracking()
            .Where(j => j.ScheduledStart != null && j.ScheduledEnd != null && j.Status != JobStatus.Cancelled);

        if (query.From.HasValue)
        {
            var from = query.From.Value.ToUtc();
            q = q.Where(j => j.ScheduledEnd > from);
        }

        if (query.To.HasValue)
        {
            var to = query.To.Value.ToUtc();
            q = q.Where(j => j.ScheduledStart < to);
        }

        if (currentUser.IsInRole(AppRoles.Technician) && !currentUser.IsManager())
        {
            if (!currentUser.TechnicianId.HasValue)
                return [];
            q = q.Where(j => j.TechnicianId == currentUser.TechnicianId.Value);
        }
        else if (query.TechnicianId.HasValue)
        {
            q = q.Where(j => j.TechnicianId == query.TechnicianId.Value);
        }

        var items = await q.OrderBy(j => j.ScheduledStart).ThenBy(j => j.Id).Take(2000).ToListAsync(ct);
        return items.Select(j => j.ToDto()).ToList();
    }

    public async Task<JobDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var job = await WithDetail().AsNoTracking().FirstOrDefaultAsync(j => j.Id == id, ct)
                  ?? throw new NotFoundException("Job", id);
        JobRules.EnsureCanView(currentUser, job);
        return job.ToDto(true);
    }

    // ---------------------------------------------------------------- create / update / delete

    public async Task<JobDto> CreateAsync(SaveJobRequest request, CancellationToken ct = default)
    {
        await ValidateReferencesAsync(request, ct);

        Guid jobId = Guid.Empty;
        for (var attempt = 1; ; attempt++)
        {
            var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == currentUser.CompanyId, ct)
                          ?? throw new NotFoundException("Company not found.");

            var job = new Job
            {
                CompanyId = company.Id,
                JobNumber = $"JOB-{company.NextJobSequence:D5}",
                Status = JobStatus.New
            };
            company.NextJobSequence++;
            ApplyJobFields(job, request, isNew: true);
            db.Jobs.Add(job);
            jobId = job.Id;

            try
            {
                await db.SaveChangesAsync(ct);
                break;
            }
            catch (DbUpdateException) when (attempt < MaxNumberRetries)
            {
                // Most likely a (CompanyId, JobNumber) collision with a concurrent create: reload sequence and retry.
                db.ChangeTracker.Clear();
            }
        }

        return await GetAsync(jobId, ct);
    }

    public async Task<JobDto> UpdateAsync(Guid id, SaveJobRequest request, CancellationToken ct = default)
    {
        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == id, ct) ?? throw new NotFoundException("Job", id);

        if (JobRules.IsClosed(job.Status))
            throw new ConflictException($"A {job.Status} job can no longer be edited.");

        await ValidateReferencesAsync(request, ct);

        var technicianChanged = request.TechnicianId != job.TechnicianId;
        ApplyJobFields(job, request, isNew: false);

        if (technicianChanged && job.TechnicianId.HasValue && job.ScheduledStart.HasValue && job.ScheduledEnd.HasValue
            && SchedulingConflictDetector.OccupiesTechnician(job.Status))
        {
            var (conflicts, _) = await FindConflictsAsync(job.TechnicianId.Value, job.ScheduledStart.Value, job.ScheduledEnd.Value, job.Id, ct);
            if (conflicts.Count > 0 && !await ConflictsAllowedAsync(ct))
                throw new ConflictException("The technician already has an overlapping appointment.", conflicts);
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var job = await db.Jobs
            .Include(j => j.Photos)
            .Include(j => j.MaterialsUsed)
            .FirstOrDefaultAsync(j => j.Id == id, ct)
            ?? throw new NotFoundException("Job", id);

        if (job.Status is JobStatus.InProgress or JobStatus.Completed)
            throw new ConflictException($"A {job.Status} job cannot be deleted. Cancel it instead.");

        if (job.MaterialsUsed.Count > 0)
            throw new ConflictException("This job has recorded material usage and cannot be deleted. Cancel it instead.");

        var files = job.Photos.Select(p => p.RelativePath).ToList();
        db.Jobs.Remove(job);
        await db.SaveChangesAsync(ct);

        foreach (var file in files)
        {
            try { await storage.DeleteAsync(file, ct); }
            catch { /* orphaned file cleanup is best-effort */ }
        }
    }

    // ---------------------------------------------------------------- workflow

    public async Task<ScheduleJobResponse> ScheduleAsync(Guid id, ScheduleJobRequest request, CancellationToken ct = default)
    {
        var job = await LoadDetailAsync(id, ct);
        JobRules.EnsureCanMutate(currentUser, job);
        JobRules.EnsureTransition(job, JobStatus.Scheduled, allowSame: true);

        var start = request.ScheduledStart.ToUtc();
        var end = request.ScheduledEnd.ToUtc();
        if (end <= start)
            throw new ValidationException("scheduledEnd", "Scheduled end must be after scheduled start.");

        var technicianId = request.TechnicianId ?? job.TechnicianId;
        Technician? technician = null;
        if (technicianId.HasValue)
        {
            technician = await db.Technicians.Include(t => t.User).FirstOrDefaultAsync(t => t.Id == technicianId.Value, ct)
                         ?? throw new ValidationException("technicianId", "Technician was not found.");
            if (!technician.IsActive)
                throw new ValidationException("technicianId", "Technician is not active.");
        }

        IReadOnlyList<ScheduleConflictDto> conflicts = [];
        if (technician is not null)
        {
            (conflicts, _) = await FindConflictsAsync(technician.Id, start, end, job.Id, ct);
            if (conflicts.Count > 0 && !await ConflictsAllowedAsync(ct))
                throw new ConflictException(
                    "The technician already has an overlapping appointment in that time slot.", conflicts);
        }

        if (technician is not null)
        {
            job.TechnicianId = technician.Id;
            job.Technician = technician;
        }

        job.ScheduledStart = start;
        job.ScheduledEnd = end;
        job.Status = JobStatus.Scheduled;
        job.EstimatedDurationMinutes ??= (int)Math.Max(1, (end - start).TotalMinutes);

        await db.SaveChangesAsync(ct);

        var dto = job.ToDto(true) with { HasConflict = conflicts.Count > 0 };
        return new ScheduleJobResponse(dto)
        {
            Warnings = conflicts.Select(c => c.Message).ToList(),
            Conflicts = conflicts
        };
    }

    public async Task<JobDto> StartAsync(Guid id, CancellationToken ct = default)
    {
        var job = await LoadDetailAsync(id, ct);
        JobRules.EnsureCanMutate(currentUser, job);
        JobRules.EnsureTransition(job, JobStatus.InProgress);

        job.Status = JobStatus.InProgress;
        job.ActualStart ??= DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return job.ToDto(true);
    }

    public async Task<JobDto> CompleteAsync(Guid id, CompleteJobRequest request, CancellationToken ct = default)
    {
        var job = await LoadDetailAsync(id, ct);
        JobRules.EnsureCanMutate(currentUser, job);
        JobRules.EnsureTransition(job, JobStatus.Completed);

        var now = DateTime.UtcNow;
        job.Status = JobStatus.Completed;
        job.ActualStart ??= now;
        job.ActualEnd = now;
        job.WorkPerformed = request.WorkPerformed.Trim();
        if (request.LaborCost.HasValue) job.LaborCost = request.LaborCost.Value;
        job.MaterialsCost = request.MaterialsCost
                            ?? job.MaterialsUsed.Sum(m => InventoryRules.LineCost(m.Quantity, m.UnitCost));

        if (job.EquipmentId is { } equipmentId)
            await RecordMaintenanceAsync(job, equipmentId, now, ct);

        await db.SaveChangesAsync(ct);
        return job.ToDto(true);
    }

    public Task<JobDto> HoldAsync(Guid id, ReasonRequest? request, CancellationToken ct = default) =>
        ChangeStatusWithReasonAsync(id, JobStatus.OnHold, "Job put on hold", request?.Reason, ct);

    public Task<JobDto> CancelAsync(Guid id, ReasonRequest? request, CancellationToken ct = default) =>
        ChangeStatusWithReasonAsync(id, JobStatus.Cancelled, "Job cancelled", request?.Reason, ct);

    private async Task<JobDto> ChangeStatusWithReasonAsync(
        Guid id, JobStatus target, string prefix, string? reason, CancellationToken ct)
    {
        var job = await LoadDetailAsync(id, ct);
        JobRules.EnsureCanMutate(currentUser, job);
        JobRules.EnsureTransition(job, target);

        job.Status = target;

        if (!string.IsNullOrWhiteSpace(reason))
        {
            var author = await db.Users.FirstAsync(u => u.Id == currentUser.UserId, ct);
            // Add through the DbSet (not job.Notes): entities with client-generated keys that are only reachable
            // via a navigation would otherwise be tracked as Modified instead of Added.
            db.JobNotes.Add(new JobNote
            {
                CompanyId = job.CompanyId,
                JobId = job.Id,
                Job = job,
                AuthorId = author.Id,
                Author = author,
                Text = $"{prefix}: {reason.Trim()}"
            });
        }

        await db.SaveChangesAsync(ct);
        return job.ToDto(true);
    }

    // ---------------------------------------------------------------- notes / photos

    public async Task<JobNoteDto> AddNoteAsync(Guid id, AddNoteRequest request, CancellationToken ct = default)
    {
        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == id, ct) ?? throw new NotFoundException("Job", id);
        JobRules.EnsureCanMutate(currentUser, job);

        var author = await db.Users.FirstAsync(u => u.Id == currentUser.UserId, ct);
        var note = new JobNote
        {
            CompanyId = job.CompanyId,
            JobId = job.Id,
            AuthorId = author.Id,
            Author = author,
            Text = request.Text.Trim()
        };
        db.JobNotes.Add(note);
        await db.SaveChangesAsync(ct);
        return note.ToDto();
    }

    public async Task<JobPhotoDto> AddPhotoAsync(
        Guid id, Stream content, string fileName, string contentType, long length, string? caption, CancellationToken ct = default)
    {
        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == id, ct) ?? throw new NotFoundException("Job", id);
        JobRules.EnsureCanMutate(currentUser, job);

        var stored = await storage.SaveAsync(job.CompanyId, job.Id, fileName, contentType, length, content, ct);

        var uploader = await db.Users.FirstAsync(u => u.Id == currentUser.UserId, ct);
        var photo = new JobPhoto
        {
            CompanyId = job.CompanyId,
            JobId = job.Id,
            UploadedById = uploader.Id,
            UploadedBy = uploader,
            FileName = Path.GetFileName(fileName),
            StoredFileName = stored.StoredFileName,
            ContentType = stored.ContentType,
            SizeBytes = stored.SizeBytes,
            Caption = CustomerService.Clean(caption),
            RelativePath = stored.RelativePath
        };

        try
        {
            db.JobPhotos.Add(photo);
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            await storage.DeleteAsync(stored.RelativePath, CancellationToken.None);
            throw;
        }

        return photo.ToDto();
    }

    public async Task<PhotoContent> GetPhotoAsync(Guid jobId, Guid photoId, CancellationToken ct = default)
    {
        var job = await db.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == jobId, ct)
                  ?? throw new NotFoundException("Job", jobId);
        JobRules.EnsureCanView(currentUser, job);

        var photo = await db.JobPhotos.AsNoTracking().FirstOrDefaultAsync(p => p.Id == photoId && p.JobId == jobId, ct)
                    ?? throw new NotFoundException("Photo", photoId);

        var stream = await storage.OpenReadAsync(photo.RelativePath, ct);
        return new PhotoContent(stream, photo.ContentType, photo.FileName);
    }

    // ---------------------------------------------------------------- helpers

    private async Task ValidateReferencesAsync(SaveJobRequest request, CancellationToken ct)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == request.CustomerId, ct))
            throw new ValidationException("customerId", "Customer was not found.");

        if (!await db.ServiceLocations.AnyAsync(l => l.Id == request.ServiceLocationId && l.CustomerId == request.CustomerId, ct))
            throw new ValidationException("serviceLocationId", "Service location was not found for this customer.");

        if (request.EquipmentId is { } equipmentId
            && !await db.Equipment.AnyAsync(e => e.Id == equipmentId && e.CustomerId == request.CustomerId, ct))
            throw new ValidationException("equipmentId", "Equipment was not found for this customer.");

        if (request.TechnicianId is { } technicianId)
        {
            var tech = await db.Technicians.AsNoTracking().FirstOrDefaultAsync(t => t.Id == technicianId, ct);
            if (tech is null) throw new ValidationException("technicianId", "Technician was not found.");
            if (!tech.IsActive) throw new ValidationException("technicianId", "Technician is not active.");
        }
    }

    private static void ApplyJobFields(Job job, SaveJobRequest r, bool isNew)
    {
        job.CustomerId = r.CustomerId;
        job.ServiceLocationId = r.ServiceLocationId;
        job.EquipmentId = r.EquipmentId;
        job.TechnicianId = r.TechnicianId;
        job.Title = r.Title.Trim();
        job.Description = CustomerService.Clean(r.Description);
        job.InternalNotes = CustomerService.Clean(r.InternalNotes);
        job.EstimatedDurationMinutes = r.EstimatedDurationMinutes;
        if (r.Priority.HasValue) job.Priority = r.Priority.Value;
        else if (isNew) job.Priority = JobPriority.Normal;
    }

    private async Task<(IReadOnlyList<ScheduleConflictDto> Conflicts, IReadOnlyList<Job> Jobs)> FindConflictsAsync(
        Guid technicianId, DateTime start, DateTime end, Guid excludeJobId, CancellationToken ct)
    {
        start = start.ToUtc();
        end = end.ToUtc();

        // Coarse filter in SQL, exact rules in the shared pure helper.
        var candidates = await db.Jobs.AsNoTracking()
            .Where(j => j.TechnicianId == technicianId
                        && j.Id != excludeJobId
                        && j.ScheduledStart != null && j.ScheduledEnd != null
                        && j.ScheduledStart < end && j.ScheduledEnd > start
                        && (j.Status == JobStatus.Scheduled || j.Status == JobStatus.InProgress))
            .ToListAsync(ct);

        var conflicts = SchedulingConflictDetector.FindConflicts(technicianId, start, end, candidates, excludeJobId);
        return (conflicts.Select(SchedulingConflictDetector.ToDto).ToList(), conflicts);
    }

    private async Task<bool> ConflictsAllowedAsync(CancellationToken ct) =>
        await db.Companies.Where(c => c.Id == currentUser.CompanyId).Select(c => c.AllowSchedulingConflicts).FirstOrDefaultAsync(ct);

    private async Task RecordMaintenanceAsync(Job job, Guid equipmentId, DateTime now, CancellationToken ct)
    {
        var equipment = await db.Equipment.FirstOrDefaultAsync(e => e.Id == equipmentId, ct);
        if (equipment is null) return;

        db.MaintenanceRecords.Add(new MaintenanceRecord
        {
            CompanyId = job.CompanyId,
            EquipmentId = equipment.Id,
            JobId = job.Id,
            PerformedAt = now,
            Description = job.WorkPerformed,
            PerformedById = currentUser.UserId
        });

        // Roll the next maintenance date forward using the previous service interval (default: yearly).
        if (equipment.NextMaintenanceDate.HasValue)
        {
            var interval = equipment.LastMaintenanceDate.HasValue
                ? equipment.NextMaintenanceDate.Value - equipment.LastMaintenanceDate.Value
                : TimeSpan.Zero;
            if (interval <= TimeSpan.Zero) interval = TimeSpan.FromDays(365);
            equipment.NextMaintenanceDate = now + interval;
        }

        equipment.LastMaintenanceDate = now;
    }
}
