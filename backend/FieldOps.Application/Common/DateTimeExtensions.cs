namespace FieldOps.Application.Common;

public static class DateTimeExtensions
{
    /// <summary>Normalises any DateTime to UTC (unspecified values are treated as UTC).</summary>
    public static DateTime ToUtc(this DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };

    public static DateTime? ToUtc(this DateTime? value) => value?.ToUtc();
}
