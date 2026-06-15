using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace AmbientWeather.Api.Swagger;

/// <summary>
/// Adds the Bearer security requirement to operations on controllers or actions
/// decorated with <see cref="AuthorizeAttribute"/>.
/// Operations that only have <see cref="AllowAnonymousAttribute"/> are not affected.
/// </summary>
public sealed class AuthorizeCheckOperationFilter : IOperationFilter
{
    private static readonly OpenApiSecurityRequirement BearerRequirement = new()
    {
        { new OpenApiSecuritySchemeReference(referenceId: "Bearer", hostDocument: null, externalResource: null), [] },
    };

    /// <inheritdoc />
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var hasAuthorize = context.MethodInfo.DeclaringType?
            .GetCustomAttributes(true)
            .OfType<AuthorizeAttribute>()
            .Any() == true
            || context.MethodInfo
            .GetCustomAttributes(true)
            .OfType<AuthorizeAttribute>()
            .Any();

        var hasAllowAnonymous = context.MethodInfo
            .GetCustomAttributes(true)
            .OfType<AllowAnonymousAttribute>()
            .Any();

        if (hasAuthorize && !hasAllowAnonymous)
        {
            operation.Security ??= [];
            operation.Security.Add(BearerRequirement);
        }
    }
}
