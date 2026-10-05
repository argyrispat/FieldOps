using FieldOps.Domain.Entities;

namespace FieldOps.Application.Interfaces;

public record StoredFile(string StoredFileName, string RelativePath, string ContentType, long SizeBytes);

public interface IFileStorage
{
    /// <summary>
    /// Validates (size, content type, extension, signature) and persists a file. Throws
    /// <see cref="Common.ValidationException"/> if the file is not acceptable.
    /// </summary>
    Task<StoredFile> SaveAsync(
        Guid companyId,
        Guid jobId,
        string originalFileName,
        string contentType,
        long length,
        Stream content,
        CancellationToken ct = default);

    Task<Stream> OpenReadAsync(string relativePath, CancellationToken ct = default);

    Task DeleteAsync(string relativePath, CancellationToken ct = default);
}

public record AccessTokenResult(string Token, DateTime ExpiresAt);

public interface ITokenService
{
    AccessTokenResult CreateAccessToken(ApplicationUser user, IEnumerable<string> roles, Guid? technicianId);

    /// <summary>Generates a new opaque refresh token (raw value returned to client).</summary>
    string GenerateRefreshToken();

    /// <summary>Deterministic hash used to store refresh tokens at rest.</summary>
    string HashToken(string rawToken);

    int RefreshTokenDays { get; }
}
