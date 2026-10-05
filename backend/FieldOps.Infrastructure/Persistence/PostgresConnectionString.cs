namespace FieldOps.Infrastructure.Persistence;

/// <summary>
/// Normalises connection strings for Npgsql. Render and similar hosts often provide
/// <c>postgresql://</c> URIs; <see cref="Npgsql.NpgsqlConnectionStringBuilder"/> expects key=value form.
/// </summary>
public static class PostgresConnectionString
{
    public static string Normalize(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("ConnectionStrings:DefaultConnection is empty.");

        var raw = connectionString.Trim().Trim('"');

        if (!raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return raw;

        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri))
            throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not a valid PostgreSQL URI.");

        var userInfo = uri.UserInfo.Split(':', 2);
        var username = Uri.UnescapeDataString(userInfo[0]);
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
        var database = uri.AbsolutePath.Trim('/');
        var port = uri.Port > 0 ? uri.Port : 5432;

        var sslMode = "Prefer";
        var query = uri.Query.TrimStart('?');
        if (!string.IsNullOrEmpty(query))
        {
            foreach (var part in query.Split('&', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var kv = part.Split('=', 2);
                if (kv.Length == 2
                    && kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase))
                {
                    sslMode = kv[1] switch
                    {
                        "disable" => "Disable",
                        "allow" => "Allow",
                        "prefer" => "Prefer",
                        "require" => "Require",
                        "verify-ca" => "VerifyCA",
                        "verify-full" => "VerifyFull",
                        _ => "Require",
                    };
                }
            }
        }

        // Render Postgres expects SSL even on the private network.
        if (uri.Host.Contains("render.com", StringComparison.OrdinalIgnoreCase)
            || uri.Host.StartsWith("dpg-", StringComparison.OrdinalIgnoreCase))
            sslMode = "Require";

        return $"Host={uri.Host};Port={port};Database={database};Username={username};Password={password};SSL Mode={sslMode}";
    }
}
