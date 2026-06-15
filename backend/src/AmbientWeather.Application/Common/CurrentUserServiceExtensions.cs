using AmbientWeather.Application.Interfaces;

namespace AmbientWeather.Application.Common;

/// <summary>
/// Extension methods for <see cref="ICurrentUserService"/>.
/// </summary>
public static class CurrentUserServiceExtensions
{
    /// <summary>
    /// Returns the authenticated user's auth-provider subject, or throws
    /// <see cref="AuthenticatedUserRequiredException"/> when no authenticated user is present.
    /// </summary>
    /// <param name="currentUserService">The current user service.</param>
    /// <returns>The non-empty auth-provider subject claim.</returns>
    /// <exception cref="AuthenticatedUserRequiredException">
    /// Thrown when the request does not have an authenticated user.
    /// </exception>
    public static string RequireAuthenticatedUser(this ICurrentUserService currentUserService)
    {
        var subject = currentUserService.AuthProviderSubject;
        if (!currentUserService.IsAuthenticated || string.IsNullOrWhiteSpace(subject))
        {
            throw new AuthenticatedUserRequiredException();
        }

        return subject;
    }
}
