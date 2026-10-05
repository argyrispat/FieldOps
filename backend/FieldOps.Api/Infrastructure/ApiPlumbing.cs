using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using FieldOps.Application.Common;
using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure.Auth;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Api.Infrastructure;

/// <summary>Error envelope: { status, message, errors?: { field: [msgs] }, conflicts? }.</summary>
public record ApiError(
    int Status,
    string Message,
    IDictionary<string, string[]>? Errors = null,
    IReadOnlyList<ScheduleConflictDto>? Conflicts = null);

public static class Policies
{
    public const string Owner = "OwnerOnly";
    public const string Manager = "OwnerOrDispatcher";
}

/// <summary>The authenticated principal, read from the validated JWT. Never from request payloads.</summary>
public class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid UserId => ParseGuid(FieldOpsClaims.Subject) ?? Guid.Empty;

    public Guid CompanyId => ParseGuid(FieldOpsClaims.CompanyId) ?? Guid.Empty;

    public Guid? TechnicianId => ParseGuid(FieldOpsClaims.TechnicianId);

    public string? Email => Principal?.FindFirstValue(FieldOpsClaims.Email);

    public IReadOnlyCollection<string> Roles =>
        Principal?.FindAll(FieldOpsClaims.Role).Select(c => c.Value).ToArray() ?? [];

    public bool IsInRole(string role) => Roles.Contains(role);

    private Guid? ParseGuid(string claim) =>
        Guid.TryParse(Principal?.FindFirstValue(claim), out var id) ? id : null;
}

/// <summary>Runs FluentValidation validators for every action argument and raises a 400 in the standard error format.</summary>
public class ValidationFilter(IServiceProvider services) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var errors = new Dictionary<string, List<string>>();

        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;

            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (services.GetService(validatorType) is not IValidator validator) continue;

            var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            foreach (var failure in result.Errors)
            {
                var key = ErrorKeys.ToCamel(failure.PropertyName);
                if (!errors.TryGetValue(key, out var list)) errors[key] = list = [];
                if (!list.Contains(failure.ErrorMessage)) list.Add(failure.ErrorMessage);
            }
        }

        if (errors.Count > 0)
        {
            var dict = errors.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray());
            throw new Application.Common.ValidationException(dict, dict.Values.First()[0]);
        }

        await next();
    }
}

public static class ErrorKeys
{
    public static string ToCamel(string path)
    {
        if (string.IsNullOrEmpty(path)) return "request";
        var segments = path.TrimStart('$', '.').Split('.', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length == 0
            ? "request"
            : string.Join('.', segments.Select(s => char.ToLowerInvariant(s[0]) + s[1..]));
    }
}

public static class JsonConfig
{
    public static void Apply(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
        options.PropertyNameCaseInsensitive = true;
        options.Converters.Add(new JsonStringEnumConverter());
        options.Converters.Add(new UtcDateTimeConverter());
    }
}

/// <summary>Always serialises as UTC ("...Z") and normalises incoming offsets/unspecified values to UTC (Npgsql timestamptz requires it).</summary>
public class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetDateTime().ToUtc();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToUtc());
}

/// <summary>
/// Baseline security headers for the API. CSP is intentionally tight (JSON API, no HTML UI).
/// HSTS is only applied when the request arrived over HTTPS (typical behind a TLS-terminating proxy).
/// </summary>
public class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        headers["Cross-Origin-Resource-Policy"] = "same-site";
        // API responses are JSON/binary — disallow framing and unexpected content execution.
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

        if (context.Request.IsHttps)
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

        await next(context);
    }
}

public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger, IHostEnvironment env)
{
    private static readonly JsonSerializerOptions Json = CreateOptions();

    private static JsonSerializerOptions CreateOptions()
    {
        var o = new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
        JsonConfig.Apply(o);
        return o;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client went away; nothing to report.
            context.Response.StatusCode = 499;
        }
        catch (Exception ex)
        {
            if (context.Response.HasStarted)
            {
                logger.LogError(ex, "Unhandled exception after the response started.");
                throw;
            }

            var error = Map(ex);
            if (error.Status >= 500)
                logger.LogError(ex, "Unhandled exception while processing {Method} {Path}", context.Request.Method, context.Request.Path);
            else
                logger.LogInformation("Request failed with {Status}: {Message}", error.Status, error.Message);

            context.Response.Clear();
            context.Response.StatusCode = error.Status;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(error, Json));
        }
    }

    private ApiError Map(Exception ex) => ex switch
    {
        Application.Common.ValidationException v => new ApiError(400, v.Message, v.Errors.Count > 0 ? v.Errors : null),
        ConflictException c => new ApiError(409, c.Message, null, c.Conflicts is { Count: > 0 } ? c.Conflicts : null),
        AppException a => new ApiError(a.StatusCode, a.Message),
        DbUpdateConcurrencyException => new ApiError(409, "The record was modified by another request. Please reload and try again."),
        BadHttpRequestException b => new ApiError(b.StatusCode, b.StatusCode == 413 ? "The request body is too large." : "The request is malformed."),
        // Never return connection strings, stack traces, or token material outside Development.
        _ => new ApiError(500, env.IsDevelopment() ? SanitizeDevMessage(ex.Message) : "An unexpected error occurred.")
    };

    /// <summary>Development messages stay useful for debugging but strip common secret-shaped substrings.</summary>
    private static string SanitizeDevMessage(string message)
    {
        if (string.IsNullOrEmpty(message)) return "An unexpected error occurred.";
        var lower = message.ToLowerInvariant();
        if (lower.Contains("password=") || lower.Contains("pwd=") || (lower.Contains("jwt") && lower.Contains("key")))
            return "An unexpected error occurred. See server logs for details.";
        return message;
    }
}

public class UploadPhotoRequest
{
    public IFormFile? File { get; set; }
    public string? Caption { get; set; }
}

public static class RoleNames
{
    public static readonly string[] Managers = [AppRoles.Owner, AppRoles.Dispatcher];
}
