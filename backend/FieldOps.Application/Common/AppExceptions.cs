using FieldOps.Application.DTOs;

namespace FieldOps.Application.Common;

/// <summary>Base class for errors that map cleanly to an HTTP status code.</summary>
public abstract class AppException : Exception
{
    protected AppException(string message, int statusCode) : base(message)
    {
        StatusCode = statusCode;
    }

    public int StatusCode { get; }
}

public class NotFoundException : AppException
{
    public NotFoundException(string message) : base(message, 404) { }

    public NotFoundException(string entity, Guid id) : base($"{entity} was not found.", 404) { }
}

public class ValidationException : AppException
{
    public ValidationException(string message) : base(message, 400)
    {
        Errors = new Dictionary<string, string[]>();
    }

    public ValidationException(string field, string message) : base(message, 400)
    {
        Errors = new Dictionary<string, string[]> { [field] = [message] };
    }

    public ValidationException(IDictionary<string, string[]> errors, string message = "One or more validation errors occurred.")
        : base(message, 400)
    {
        Errors = errors;
    }

    public IDictionary<string, string[]> Errors { get; }
}

public class ConflictException : AppException
{
    public ConflictException(string message, IReadOnlyList<ScheduleConflictDto>? conflicts = null) : base(message, 409)
    {
        Conflicts = conflicts;
    }

    public IReadOnlyList<ScheduleConflictDto>? Conflicts { get; }
}

public class ForbiddenException : AppException
{
    public ForbiddenException(string message = "You do not have permission to perform this action.") : base(message, 403) { }
}

public class UnauthorizedException : AppException
{
    public UnauthorizedException(string message = "Authentication is required.") : base(message, 401) { }
}
