using AspNetCoreRateLimit;
using FieldOps.Api.Infrastructure;
using FieldOps.Application;
using FieldOps.Application.Interfaces;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure;
using FieldOps.Infrastructure.Auth;
using FieldOps.Infrastructure.Persistence;
using FieldOps.Infrastructure.Seeding;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;

// ---------------------------------------------------------------- services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(configuration);

builder.Services
    .AddControllers(options =>
    {
        options.Filters.Add<ValidationFilter>();
        // FluentValidation owns validation; don't let MVC invent [Required] for non-nullable reference types.
        options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
    })
    .AddJsonOptions(o => JsonConfig.Apply(o.JsonSerializerOptions))
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = ctx =>
        {
            var errors = ctx.ModelState
                .Where(e => e.Value is { Errors.Count: > 0 })
                .ToDictionary(
                    e => ErrorKeys.ToCamel(e.Key),
                    e => e.Value!.Errors.Select(x => string.IsNullOrWhiteSpace(x.ErrorMessage) ? "The value is invalid." : x.ErrorMessage).ToArray());
            var message = errors.Values.FirstOrDefault()?.FirstOrDefault() ?? "The request is invalid.";
            return new BadRequestObjectResult(new ApiError(400, message, errors));
        };
    });

builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = 25 * 1024 * 1024);

// Authentication: JWT bearer. Options are bound lazily from IOptions<JwtOptions>.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer();

builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((options, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;
        options.MapInboundClaims = false;
        // Require HTTPS metadata in non-development environments when the API is published behind TLS.
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing");
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = JwtTokenService.CreateKey(jwt.Key),
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = FieldOpsClaims.Name,
            RoleClaimType = FieldOpsClaims.Role
        };
        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new ApiError(401, "Authentication is required or your session has expired."));
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new ApiError(403, "You do not have permission to perform this action."));
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(Policies.Owner, p => p.RequireRole(AppRoles.Owner));
    options.AddPolicy(Policies.Manager, p => p.RequireRole(AppRoles.Owner, AppRoles.Dispatcher));
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// CORS from configuration (comma separated string or JSON array).
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = ReadOrigins(configuration);
        if (origins.Length > 0)
            policy.WithOrigins(origins);

        policy.AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("Content-Disposition");
    });
});

// Light rate limiting (per IP). Can be disabled with RateLimiting:Enabled=false.
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(configuration.GetSection("IpRateLimiting"));
builder.Services.Configure<IpRateLimitPolicies>(configuration.GetSection("IpRateLimitPolicies"));
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "FieldOps API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT access token: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

// ---------------------------------------------------------------- pipeline
var app = builder.Build();

// Fail fast on a missing / weak signing key.
var jwtSettings = app.Services.GetRequiredService<IOptions<JwtOptions>>().Value;
JwtTokenService.CreateKey(jwtSettings.Key);
if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing")
    && jwtSettings.Key.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("Jwt:Key still contains the placeholder value. Provide a real secret via configuration.");

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

app.UseWhen(
    _ => configuration.GetValue("RateLimiting:Enabled", true),
    branch => branch.UseIpRateLimiting());

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();
app.MapControllers();

if (configuration.GetValue("RateLimiting:Enabled", true))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<IIpPolicyStore>().SeedAsync();
}

await InitialiseDatabaseAsync(app);

app.Run();

static string[] ReadOrigins(IConfiguration configuration)
{
    var raw = configuration["Cors:Origins"];
    var origins = !string.IsNullOrWhiteSpace(raw)
        ? raw.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        : configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
    return origins.Select(o => o.TrimEnd('/')).Where(o => o.Length > 0).ToArray();
}

static async Task InitialiseDatabaseAsync(WebApplication app)
{
    var config = app.Configuration;
    var isDev = app.Environment.IsDevelopment();
    var migrate = config.GetValue("Database:MigrateOnStartup", isDev);
    var seed = config.GetValue("Database:SeedDemoData", isDev);
    if (!migrate && !seed) return;

    var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");

    for (var attempt = 1; ; attempt++)
    {
        try
        {
            using var scope = app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            if (migrate)
                await db.Database.MigrateAsync();

            if (seed)
                await scope.ServiceProvider.GetRequiredService<DataSeeder>().SeedAsync();

            return;
        }
        catch (Exception ex) when (attempt < 10)
        {
            logger.LogWarning(ex, "Database initialisation failed (attempt {Attempt}/10); retrying in 3s...", attempt);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

/// <summary>Exposed for WebApplicationFactory-based integration tests.</summary>
public partial class Program;
