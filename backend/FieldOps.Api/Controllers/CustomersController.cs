using FieldOps.Api.Infrastructure;
using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[ApiController]
[Route("api/customers")]
public class CustomersController(ICustomerService customers) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<PagedResult<CustomerDto>>> List([FromQuery] CustomerQuery query, CancellationToken ct) =>
        Ok(await customers.ListAsync(query, ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<CustomerDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await customers.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<CustomerDto>> Create(SaveCustomerRequest request, CancellationToken ct)
    {
        var created = await customers.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<CustomerDto>> Update(Guid id, SaveCustomerRequest request, CancellationToken ct) =>
        Ok(await customers.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await customers.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpGet("{customerId:guid}/locations")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<IReadOnlyList<ServiceLocationDto>>> ListLocations(Guid customerId, CancellationToken ct) =>
        Ok(await customers.ListLocationsAsync(customerId, ct));

    [HttpPost("{customerId:guid}/locations")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<ServiceLocationDto>> AddLocation(Guid customerId, SaveServiceLocationRequest request, CancellationToken ct)
    {
        var created = await customers.AddLocationAsync(customerId, request, ct);
        return CreatedAtAction(nameof(ListLocations), new { customerId }, created);
    }

    [HttpPut("{customerId:guid}/locations/{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<ActionResult<ServiceLocationDto>> UpdateLocation(Guid customerId, Guid id, SaveServiceLocationRequest request, CancellationToken ct) =>
        Ok(await customers.UpdateLocationAsync(customerId, id, request, ct));

    [HttpDelete("{customerId:guid}/locations/{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    public async Task<IActionResult> DeleteLocation(Guid customerId, Guid id, CancellationToken ct)
    {
        await customers.DeleteLocationAsync(customerId, id, ct);
        return NoContent();
    }
}
