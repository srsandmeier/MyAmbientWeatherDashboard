using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Domain.Neighbors;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Aggregates sensor readings from a collection of nearby public stations into a single
/// representative reading.
/// </summary>
public interface INeighborAggregationService
{
    /// <summary>
    /// Computes the mean value for each sensor field across all stations that report that
    /// field. Stations with null values for a given field are excluded from its average.
    /// </summary>
    /// <param name="stations">The discovered nearby stations to aggregate.</param>
    /// <param name="minStations">
    /// The minimum station count threshold. Sets
    /// <see cref="AggregatedNeighborReadingDto.IsBelowMinStations"/> when the actual
    /// contributing count falls below this value.
    /// </param>
    AggregatedNeighborReadingDto Aggregate(
        IReadOnlyList<NeighborStation> stations,
        int minStations);
}
