using Microsoft.AspNetCore.Identity;

namespace FieldOps.Domain.Entities;

public class ApplicationUser : IdentityUser<Guid>
{
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Technician? Technician { get; set; }
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];

    public string FullName => $"{FirstName} {LastName}".Trim();
}
