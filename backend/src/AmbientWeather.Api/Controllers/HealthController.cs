using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AmbientWeather.Api.Controllers;

/// <summary>Health check endpoints for liveness probes.</summary>
[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    /// <summary>Returns API liveness status.</summary>
    /// <returns>Health payload.</returns>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get() => Ok(new HealthResponse("healthy"));
}
