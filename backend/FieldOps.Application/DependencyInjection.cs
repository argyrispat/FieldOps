using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace FieldOps.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<DTOs.RegisterRequest>(includeInternalTypes: true);
        return services;
    }
}
