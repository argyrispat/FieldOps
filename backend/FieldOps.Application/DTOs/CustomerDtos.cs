using FieldOps.Application.Common;

namespace FieldOps.Application.DTOs;

public record ServiceLocationDto(
    Guid Id,
    Guid CustomerId,
    string Name,
    string Address,
    string? City,
    string? PostalCode,
    string? Notes,
    bool IsPrimary);

public record CustomerDto
{
    public Guid Id { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? CompanyName { get; init; }
    public string DisplayName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? PostalCode { get; init; }
    public string? Notes { get; init; }

    /// <summary>Populated for detail responses only.</summary>
    public IReadOnlyList<ServiceLocationDto>? Locations { get; init; }

    /// <summary>Alias of <see cref="Locations"/> kept for client compatibility.</summary>
    public IReadOnlyList<ServiceLocationDto>? ServiceLocations => Locations;

    public int JobCount { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record SaveCustomerRequest(
    string FirstName,
    string LastName,
    string? CompanyName,
    string? Email,
    string? Phone,
    string? Address,
    string? City,
    string? PostalCode,
    string? Notes);

public record SaveServiceLocationRequest(
    string Name,
    string Address,
    string? City,
    string? PostalCode,
    string? Notes,
    bool IsPrimary);

public class CustomerQuery : PagedQuery;
