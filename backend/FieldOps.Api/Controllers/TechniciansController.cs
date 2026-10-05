using FieldOps.Api.Infrastructure;
using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[ApiController]
[Route("api/technicians")]
public class TechniciansController(ITechnicianService technicians) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<PagedResult<TechnicianDto>>> List([FromQuery] TechnicianQuery query, CancellationToken ct) =>
        Ok(await technicians.ListAsync(query, ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<TechnicianDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await technicians.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<TechnicianDto>> Create(CreateTechnicianRequest request, CancellationToken ct)
    {
        var created = await technicians.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<TechnicianDto>> Update(Guid id, UpdateTechnicianRequest request, CancellationToken ct) =>
        Ok(await technicians.UpdateAsync(id, request, ct));
}
