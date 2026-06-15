using System.Text.Json;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.Dashboard.Commands;

/// <summary>
/// Handler for <see cref="SaveDashboardLayoutCommand"/>.
/// Serializes the layout tiles and custom items to JSON and upserts the user's active layout.
/// Station IDs in the layout are display configuration only; data is scoped to the user at read time.
/// </summary>
internal sealed class SaveDashboardLayoutCommandHandler
    : IRequestHandler<SaveDashboardLayoutCommand, DashboardLayoutDto>
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IDashboardLayoutStore _layoutStore;

    /// <summary>Initializes the handler.</summary>
    public SaveDashboardLayoutCommandHandler(
        ICurrentUserService currentUserService,
        IDashboardLayoutStore layoutStore)
    {
        _currentUserService = currentUserService;
        _layoutStore = layoutStore;
    }

    /// <inheritdoc />
    public async Task<DashboardLayoutDto> Handle(
        SaveDashboardLayoutCommand request,
        CancellationToken cancellationToken)
    {
        var subject = _currentUserService.RequireAuthenticatedUser();

        var payload = new DashboardLayoutPayloadDto
        {
            LayoutMode = request.LayoutMode,
            Tiles = request.Tiles,
            CustomItems = request.CustomItems,
        };
        var layoutJson = JsonSerializer.Serialize(payload, DashboardLayoutSerializationOptions.Instance);
        var saved = await _layoutStore.UpsertActiveAsync(subject, layoutJson, cancellationToken)
            .ConfigureAwait(false);

        return new DashboardLayoutDto
        {
            Id = saved.Id,
            Name = saved.Name,
            LayoutMode = request.LayoutMode,
            Tiles = request.Tiles,
            CustomItems = request.CustomItems,
            UpdatedAtUtc = saved.UpdatedAtUtc,
        };
    }
}
