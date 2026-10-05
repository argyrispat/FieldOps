using FieldOps.Domain.Common;

namespace FieldOps.Domain.Entities;

public class Material : TenantEntity
{
    public Company Company { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public string? Description { get; set; }
    public decimal QuantityOnHand { get; set; }
    public decimal MinimumQuantity { get; set; }
    public string Unit { get; set; } = "ea";
    public decimal UnitCost { get; set; }
    public byte[] RowVersion { get; set; } = [];

    public bool IsLowStock => QuantityOnHand <= MinimumQuantity;

    public ICollection<JobMaterial> JobUsages { get; set; } = [];
}
