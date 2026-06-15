using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Settings;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Handles <see cref="UpdateUserPreferencesCommand"/>.
/// </summary>
public sealed class UpdateUserPreferencesCommandHandler(
    IUserPreferencesStore preferencesStore,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateUserPreferencesCommand, UserPreferencesDto>
{
    /// <inheritdoc />
    public async Task<UserPreferencesDto> Handle(
        UpdateUserPreferencesCommand request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var prefs = await preferencesStore
            .GetOrCreateAsync(subject, currentUserService.Email, cancellationToken)
            .ConfigureAwait(false);

        prefs.TemperatureUnit = request.TemperatureUnit;
        prefs.SpeedUnit = request.SpeedUnit;
        prefs.PressureUnit = request.PressureUnit;
        prefs.RainfallUnit = request.RainfallUnit;
        prefs.DistanceUnit = request.DistanceUnit;
        prefs.Theme = request.Theme;
        prefs.DateFormat = request.DateFormat;
        prefs.TemperatureDecimals = request.TemperatureDecimals;
        prefs.DailyExtremaTimezone = request.DailyExtremaTimezone;
        prefs.UpdatedAtUtc = DateTime.UtcNow;

        await preferencesStore.SaveAsync(prefs, cancellationToken).ConfigureAwait(false);

        return UserPreferencesDto.From(prefs);
    }
}
