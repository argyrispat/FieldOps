namespace FieldOps.Application.DTOs;

public record RegisterRequest(string CompanyName, string FirstName, string LastName, string Email, string Password);

public record LoginRequest(string Email, string Password);

public record RefreshRequest(string RefreshToken);

public record LogoutRequest(string? RefreshToken);

public record UserDto(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string FullName,
    bool IsActive,
    IReadOnlyList<string> Roles,
    Guid CompanyId,
    string CompanyName,
    Guid? TechnicianId,
    DateTime CreatedAt);

public record AuthResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt, UserDto User);
