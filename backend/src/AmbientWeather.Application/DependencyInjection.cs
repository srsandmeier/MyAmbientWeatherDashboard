using AmbientWeather.Application.Common.Behaviours;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace AmbientWeather.Application;

/// <summary>
/// Dependency injection registration for the Application layer.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Registers MediatR handlers, validators, and pipeline behaviors.
    /// </summary>
    /// <param name="services">The service collection to register with.</param>
    /// <returns>The updated service collection.</returns>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(AssemblyReference).Assembly));

        services.AddValidatorsFromAssembly(typeof(AssemblyReference).Assembly);

        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

        return services;
    }
}
