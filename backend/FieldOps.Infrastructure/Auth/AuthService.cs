using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Auth;

public class AuthService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    ITokenService tokens,
    IdentityProvisioner provisioner,
    ICurrentUser currentUser) : IAuthService
{
    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        await using var tx = await OptionalTransaction.BeginAsync(db, ct);

        var company = new Company { Name = request.CompanyName.Trim() };
        db.Companies.Add(company);
        await db.SaveChangesAsync(ct);

        ApplicationUser user;
        try
        {
            user = await provisioner.CreateUserAsync(
                company.Id, request.FirstName, request.LastName, request.Email, request.Password, AppRoles.Owner);
        }
        catch
        {
            // Providers without transactions (InMemory) would otherwise keep the orphan company.
            db.Companies.Remove(company);
            await db.SaveChangesAsync(ct);
            throw;
        }

        var response = await IssueTokensAsync(user, ct);
        await tx.CommitAsync(ct);
        return response;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        const string invalid = "Invalid email or password.";

        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
            throw new UnauthorizedException(invalid);

        if (await userManager.IsLockedOutAsync(user))
            throw new UnauthorizedException("Account temporarily locked due to repeated failed sign-in attempts. Try again later.");

        if (!await userManager.CheckPasswordAsync(user, request.Password))
        {
            await userManager.AccessFailedAsync(user);
            throw new UnauthorizedException(invalid);
        }

        if (!user.IsActive)
            throw new UnauthorizedException("This account has been deactivated.");

        await userManager.ResetAccessFailedCountAsync(user);
        return await IssueTokensAsync(user, ct);
    }

    public async Task<AuthResponse> RefreshAsync(RefreshRequest request, CancellationToken ct = default)
    {
        var hash = tokens.HashToken(request.RefreshToken);
        var stored = await db.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.Token == hash, ct);

        if (stored is null)
            throw new UnauthorizedException("Invalid refresh token.");

        if (stored.RevokedAt is not null)
        {
            // A revoked token being replayed suggests theft: revoke the entire family for this user.
            var active = await db.RefreshTokens.Where(t => t.UserId == stored.UserId && t.RevokedAt == null).ToListAsync(ct);
            foreach (var t in active) t.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            throw new UnauthorizedException("Refresh token has been revoked.");
        }

        if (!stored.IsActive || !stored.User.IsActive)
            throw new UnauthorizedException("Refresh token has expired.");

        var raw = tokens.GenerateRefreshToken();
        stored.RevokedAt = DateTime.UtcNow;
        stored.ReplacedByToken = tokens.HashToken(raw);

        return await IssueTokensAsync(stored.User, ct, raw);
    }

    public async Task LogoutAsync(LogoutRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken)) return;

        var hash = tokens.HashToken(request.RefreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.Token == hash, ct);
        if (stored is { RevokedAt: null })
        {
            stored.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task<UserDto> GetCurrentUserAsync(CancellationToken ct = default)
    {
        if (!currentUser.IsAuthenticated)
            throw new UnauthorizedException();

        var user = await userManager.FindByIdAsync(currentUser.UserId.ToString());
        if (user is null || !user.IsActive)
            throw new UnauthorizedException();

        return await provisioner.ToDtoAsync(user, ct: ct);
    }

    private async Task<AuthResponse> IssueTokensAsync(ApplicationUser user, CancellationToken ct, string? rawRefresh = null)
    {
        var dto = await provisioner.ToDtoAsync(user, ct: ct);
        var access = tokens.CreateAccessToken(user, dto.Roles, dto.TechnicianId);

        rawRefresh ??= tokens.GenerateRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Token = tokens.HashToken(rawRefresh),
            ExpiresAt = DateTime.UtcNow.AddDays(tokens.RefreshTokenDays)
        });

        // Housekeeping: drop this user's long-dead tokens.
        var cutoff = DateTime.UtcNow.AddDays(-30);
        var stale = await db.RefreshTokens
            .Where(t => t.UserId == user.Id && (t.ExpiresAt < cutoff || (t.RevokedAt != null && t.RevokedAt < cutoff)))
            .ToListAsync(ct);
        db.RefreshTokens.RemoveRange(stale);

        await db.SaveChangesAsync(ct);
        return new AuthResponse(access.Token, rawRefresh, access.ExpiresAt, dto);
    }
}
