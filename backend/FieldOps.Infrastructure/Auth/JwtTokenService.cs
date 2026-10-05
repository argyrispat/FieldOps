using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FieldOps.Application.Interfaces;
using FieldOps.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FieldOps.Infrastructure.Auth;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = "FieldOps";
    public string Audience { get; set; } = "FieldOps";
    public int AccessTokenMinutes { get; set; } = 60;
    public int RefreshTokenDays { get; set; } = 7;
}

/// <summary>Custom claim names (kept short; the API disables inbound claim mapping).</summary>
public static class FieldOpsClaims
{
    public const string Subject = "sub";
    public const string Role = "role";
    public const string CompanyId = "companyId";
    public const string TechnicianId = "technicianId";
    public const string Name = "name";
    public const string Email = "email";
}

public class JwtTokenService(IOptions<JwtOptions> options) : ITokenService
{
    private readonly JwtOptions _options = options.Value;

    public int RefreshTokenDays => _options.RefreshTokenDays;

    public AccessTokenResult CreateAccessToken(ApplicationUser user, IEnumerable<string> roles, Guid? technicianId)
    {
        var claims = new List<Claim>
        {
            new(FieldOpsClaims.Subject, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(FieldOpsClaims.Email, user.Email ?? string.Empty),
            new(FieldOpsClaims.Name, user.FullName),
            new(FieldOpsClaims.CompanyId, user.CompanyId.ToString())
        };

        if (technicianId.HasValue)
            claims.Add(new Claim(FieldOpsClaims.TechnicianId, technicianId.Value.ToString()));

        claims.AddRange(roles.Select(r => new Claim(FieldOpsClaims.Role, r)));

        var expires = DateTime.UtcNow.AddMinutes(_options.AccessTokenMinutes);
        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: new SigningCredentials(CreateKey(_options.Key), SecurityAlgorithms.HmacSha256));

        return new AccessTokenResult(new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    public string GenerateRefreshToken() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));

    public string HashToken(string rawToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

    public static SymmetricSecurityKey CreateKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetByteCount(key) < 32)
            throw new InvalidOperationException("Jwt:Key must be configured and at least 32 characters long.");

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    }
}
