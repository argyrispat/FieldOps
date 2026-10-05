using FieldOps.Api.Infrastructure;
using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[ApiController]
[Route("api/materials")]
public class MaterialsController(IMaterialService materials) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<MaterialDto>>> List([FromQuery] MaterialQuery query, CancellationToken ct) =>
        Ok(await materials.ListAsync(query, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MaterialDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await materials.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<MaterialDto>> Create(SaveMaterialRequest request, CancellationToken ct)
    {
        var created = await materials.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<MaterialDto>> Update(Guid id, SaveMaterialRequest request, CancellationToken ct) =>
        Ok(await materials.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await materials.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/equipment")]
public class EquipmentController(IEquipmentService equipment) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<PagedResult<EquipmentDto>>> List([FromQuery] EquipmentQuery query, CancellationToken ct) =>
        Ok(await equipment.ListAsync(query, ct));

    [HttpGet("reminders")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<MaintenanceReminderSummaryDto>> Reminders(CancellationToken ct) =>
        Ok(await equipment.GetRemindersAsync(ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<EquipmentDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await equipment.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<EquipmentDto>> Create(SaveEquipmentRequest request, CancellationToken ct)
    {
        var created = await equipment.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<EquipmentDto>> Update(Guid id, SaveEquipmentRequest request, CancellationToken ct) =>
        Ok(await equipment.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await equipment.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/maintenance-job")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<JobDto>> CreateMaintenanceJob(Guid id, CancellationToken ct)
    {
        var job = await equipment.CreateMaintenanceJobAsync(id, ct);
        return StatusCode(StatusCodes.Status201Created, job);
    }
}

[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = Policies.Manager)]
public class DashboardController(IDashboardService dashboard) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get(CancellationToken ct) => Ok(await dashboard.GetAsync(ct));
}

[ApiController]
[Route("api/search")]
[Authorize(Policy = Policies.Manager)]
public class SearchController(ISearchService search) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<SearchResultsDto>> Search([FromQuery] string? q, CancellationToken ct) =>
        Ok(await search.SearchAsync(q, ct));
}

[ApiController]
[Route("api/company")]
public class CompanyController(ICompanyService company) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CompanyDto>> Get(CancellationToken ct) => Ok(await company.GetAsync(ct));

    [HttpPut]
    [Authorize(Policy = Policies.Owner)]
    public async Task<ActionResult<CompanyDto>> Update(UpdateCompanyRequest request, CancellationToken ct) =>
        Ok(await company.UpdateAsync(request, ct));
}

[ApiController]
[Route("api/users")]
[Authorize(Policy = Policies.Owner)]
public class UsersController(ICompanyService company) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> List(CancellationToken ct) =>
        Ok(await company.ListUsersAsync(ct));

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create(CreateUserRequest request, CancellationToken ct)
    {
        var user = await company.CreateUserAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, user);
    }
}
