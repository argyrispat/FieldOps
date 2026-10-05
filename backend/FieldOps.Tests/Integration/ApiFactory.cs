using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FieldOps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FieldOps.Tests.Integration;

/// <summary>Boots the real API (JWT, Identity, middleware, controllers) on an InMemory database.</summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = "fieldops-it-" + Guid.NewGuid();
    private readonly string _uploadRoot = Path.Combine(Path.GetTempPath(), "fieldops-it-" + Guid.NewGuid().ToString("N"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "integration-test-signing-key-which-is-long-enough-0123456789",
                ["Jwt:Issuer"] = "FieldOps.Tests",
                ["Jwt:Audience"] = "FieldOps.Tests",
                ["ConnectionStrings:DefaultConnection"] = "Host=unused;Database=unused",
                ["RateLimiting:Enabled"] = "false",
                ["Database:MigrateOnStartup"] = "false",
                ["Database:SeedDemoData"] = "false",
                ["FileStorage:RootPath"] = _uploadRoot,
                ["FileStorage:MaxBytes"] = "1048576"
            });
        });

        builder.ConfigureServices(services =>
        {
            foreach (var descriptor in services
                         .Where(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>) || d.ServiceType == typeof(DbContextOptions))
                         .ToList())
                services.Remove(descriptor);

            services.AddDbContext<AppDbContext>(o => o
                .UseInMemoryDatabase(_dbName)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { if (Directory.Exists(_uploadRoot)) Directory.Delete(_uploadRoot, true); } catch { /* best effort */ }
    }
}

public static class Http
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public static HttpClient WithToken(this HttpClient client, string token)
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>(Json));

    public static string Str(this JsonElement e, string name) => e.GetProperty(name).GetString()!;
}
