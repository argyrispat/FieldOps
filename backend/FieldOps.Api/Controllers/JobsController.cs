using FieldOps.Api.Infrastructure;
using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[ApiController]
[Route("api/jobs")]
public class JobsController(
    IJobService jobs,
    IMaterialService materials,
    ICompanyService companies,
    IReportService reports) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<JobDto>>> List([FromQuery] JobQuery query, CancellationToken ct) =>
        Ok(await jobs.ListAsync(query, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<JobDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await jobs.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<JobDto>> Create(SaveJobRequest request, CancellationToken ct)
    {
        var created = await jobs.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<JobDto>> Update(Guid id, SaveJobRequest request, CancellationToken ct) =>
        Ok(await jobs.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await jobs.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>
    /// Schedules (or reschedules) a job. Overlaps for the technician are reported as warnings (200) when the company
    /// allows scheduling conflicts, otherwise rejected with 409 and the list of conflicting jobs.
    /// </summary>
    [HttpPost("{id:guid}/schedule")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<ScheduleJobResponse>> Schedule(Guid id, ScheduleJobRequest request, CancellationToken ct) =>
        Ok(await jobs.ScheduleAsync(id, request, ct));

    [HttpPost("{id:guid}/start")]
    public async Task<ActionResult<JobDto>> Start(Guid id, CancellationToken ct) =>
        Ok(await jobs.StartAsync(id, ct));

    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<JobDto>> Complete(Guid id, CompleteJobRequest request, CancellationToken ct) =>
        Ok(await jobs.CompleteAsync(id, request, ct));

    [HttpPost("{id:guid}/hold")]
    public async Task<ActionResult<JobDto>> Hold(Guid id, [FromBody] ReasonRequest? request, CancellationToken ct) =>
        Ok(await jobs.HoldAsync(id, request, ct));

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<JobDto>> Cancel(Guid id, [FromBody] ReasonRequest? request, CancellationToken ct) =>
        Ok(await jobs.CancelAsync(id, request, ct));

    [HttpPost("{id:guid}/notes")]
    public async Task<ActionResult<JobNoteDto>> AddNote(Guid id, AddNoteRequest request, CancellationToken ct)
    {
        var note = await jobs.AddNoteAsync(id, request, ct);
        return StatusCode(StatusCodes.Status201Created, note);
    }

    [HttpPost("{id:guid}/photos")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<ActionResult<JobPhotoDto>> AddPhoto(Guid id, [FromForm] UploadPhotoRequest form, CancellationToken ct)
    {
        if (form.File is null || form.File.Length == 0)
            throw new Application.Common.ValidationException("file", "A file is required.");

        await using var stream = form.File.OpenReadStream();
        var photo = await jobs.AddPhotoAsync(id, stream, form.File.FileName, form.File.ContentType, form.File.Length, form.Caption, ct);
        return StatusCode(StatusCodes.Status201Created, photo);
    }

    [HttpGet("{jobId:guid}/photos/{photoId:guid}")]
    public async Task<IActionResult> GetPhoto(Guid jobId, Guid photoId, CancellationToken ct)
    {
        var photo = await jobs.GetPhotoAsync(jobId, photoId, ct);
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Cache-Control"] = "private, max-age=3600";
        return File(photo.Content, photo.ContentType);
    }

    /// <summary>Records material usage and atomically deducts inventory.</summary>
    [HttpPost("{id:guid}/materials")]
    public async Task<ActionResult<JobMaterialDto>> AddMaterial(Guid id, AddJobMaterialRequest request, CancellationToken ct)
    {
        var usage = await materials.RecordJobUsageAsync(id, request, ct);
        return StatusCode(StatusCodes.Status201Created, usage);
    }

    [HttpGet("{id:guid}/report")]
    [Produces("application/pdf")]
    public async Task<IActionResult> Report(Guid id, CancellationToken ct)
    {
        var job = await jobs.GetAsync(id, ct);
        var company = await companies.GetAsync(ct);
        var pdf = reports.GenerateJobReport(job, company);
        return File(pdf, "application/pdf", $"{job.JobNumber}-report.pdf");
    }
}

[ApiController]
[Route("api/schedule")]
[Authorize(Policy = Policies.Manager)]
public class ScheduleController(IJobService jobs) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JobDto>>> Get([FromQuery] ScheduleQuery query, CancellationToken ct) =>
        Ok(await jobs.GetScheduleAsync(query, ct));
}
