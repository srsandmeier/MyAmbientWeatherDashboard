using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AmbientWeather.IntegrationTests.Auth;

/// <summary>
/// Test-only authentication handler. Reads <c>X-Test-User-Subject</c> from the request header
/// or <c>access_token</c> from the query string (for SignalR WebSocket/SSE auth tests)
/// and builds a synthetic <see cref="ClaimsPrincipal"/> so integration tests can exercise
/// authenticated endpoints without a real Auth0 token.
/// Returns <see cref="AuthenticateResult.NoResult"/> when the header is absent so that
/// unauthenticated-request tests still receive the expected 401 challenge.
/// </summary>
public sealed class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    /// <summary>Scheme name used to register and reference this handler.</summary>
    public const string SchemeName = "TestAuth";

    /// <summary>Request header that carries the synthetic user subject claim.</summary>
    public const string UserSubjectHeader = "X-Test-User-Subject";

    /// <summary>Optional request header that carries the synthetic user email claim.</summary>
    public const string UserEmailHeader = "X-Test-User-Email";

    /// <summary>
    /// When this header is present with any non-empty value, the principal is created
    /// WITHOUT a <see cref="ClaimTypes.NameIdentifier"/> claim. Used to test graceful
    /// handling of tokens that authenticate successfully but lack the expected claim.
    /// </summary>
    public const string OmitNameIdentifierHeader = "X-Test-Omit-Name-Identifier";

    /// <summary>
    /// When this header is present, the subject is stored as the raw <c>"sub"</c> claim
    /// instead of <see cref="ClaimTypes.NameIdentifier"/>. Simulates the behaviour of
    /// <c>JsonWebTokenHandler</c> (.NET 8+) which does not remap <c>sub</c> to the legacy
    /// long-form claim type.
    /// </summary>
    public const string UseRawSubClaimHeader = "X-Test-Use-Raw-Sub-Claim";

    /// <inheritdoc />
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var subject = Request.Headers.TryGetValue(UserSubjectHeader, out var subjectValues)
            ? subjectValues.FirstOrDefault()
            : Request.Query["access_token"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(subject))
            return Task.FromResult(AuthenticateResult.NoResult());

        var email = Request.Headers[UserEmailHeader].FirstOrDefault();
        var omitIdentifier = !string.IsNullOrEmpty(Request.Headers[OmitNameIdentifierHeader]);
        var useRawSub = !string.IsNullOrEmpty(Request.Headers[UseRawSubClaimHeader]);

        var claims = new List<Claim>();
        if (!omitIdentifier)
            claims.Add(new(useRawSub ? "sub" : ClaimTypes.NameIdentifier, subject));
        if (!string.IsNullOrWhiteSpace(email))
            claims.Add(new(ClaimTypes.Email, email));

        // Ensure the principal is non-null (authenticated) even without NameIdentifier.
        if (claims.Count == 0)
            claims.Add(new("test:sentinel", "authenticated"));

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
