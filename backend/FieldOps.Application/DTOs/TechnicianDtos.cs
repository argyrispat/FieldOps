using FieldOps.Application.Common;

namespace FieldOps.Application.DTOs;

public record TechnicianDto(
    Guid Id,
    Guid UserId,
    string FirstName,
    string LastName,
    string FullName,
    string? Email,
    string? Phone,
    string? Specialty,
    bool IsActive,
    string? Notes);

/// <summary>Either supply <see cref="UserId"/> of an existing company user, or the fields required to create one.</summary>
public record CreateTechnicianRequest(
    Guid? UserId,
    string? FirstName,
    string? LastName,
    string? Email,
    string? Password,
    string? Phone,
    string? Specialty,
    string? Notes);

public record UpdateTechnicianRequest(
    string? FirstName,
    string? LastName,
    string? Phone,
    string? Specialty,
    bool? IsActive,
    string? Notes);

public class TechnicianQuery : PagedQuery
{
    public bool? IsActive { get; set; }
}
