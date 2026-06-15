using System.Text.Json;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.Interfaces;
using FluentValidation;
using FluentValidation.Results;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Handles <see cref="UpdateSettingsDeviceCommand"/> by applying patch updates to the owned station.
/// </summary>
public sealed class UpdateSettingsDeviceCommandHandler(
    IUserStationStore stationStore,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateSettingsDeviceCommand>
{
    /// <inheritdoc />
    public async Task Handle(UpdateSettingsDeviceCommand request, CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();

        var station = await stationStore.GetOwnedStationByMacAsync(
            subject,
            request.MacAddress,
            cancellationToken).ConfigureAwait(false)
            ?? throw new AmbientApiNotFoundException();

        if (request.Nickname != null)
        {
            station.Nickname = string.IsNullOrEmpty(request.Nickname) ? null : request.Nickname;
        }

        if (request.IsPrimary.HasValue)
        {
            // Prevent demoting the last primary station — the user must promote another one first.
            if (!request.IsPrimary.Value && station.IsPrimary)
            {
                var all = await stationStore.GetOwnedStationsAsync(subject, cancellationToken).ConfigureAwait(false);
                if (!all.Any(s => s.IsPrimary && !string.Equals(s.MacAddress, station.MacAddress, StringComparison.Ordinal)))
                {
                    throw new ValidationException(
                        [new ValidationFailure(nameof(request.IsPrimary), "Cannot demote the only primary station. Set another station as primary first.")]);
                }
            }

            station.IsPrimary = request.IsPrimary.Value;
        }

        if (request.DisplayOnDashboard.HasValue)
        {
            station.DisplayOnDashboard = request.DisplayOnDashboard.Value;
        }

        if (request.SelectedMetricKeys != null)
        {
            station.SelectedMetricKeysJson = request.SelectedMetricKeys.Count == 0
                ? null
                : JsonSerializer.Serialize(request.SelectedMetricKeys);
        }

        await stationStore.SaveAsync(station, cancellationToken).ConfigureAwait(false);
    }
}
