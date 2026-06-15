namespace AmbientWeather.Domain.Metrics;

/// <summary>
/// Unit family for a metric, used to select the user-preferred display unit.
/// </summary>
public enum MetricUnitFamily
{
    /// <summary>Temperature — °F or °C.</summary>
    Temperature,

    /// <summary>Relative humidity — always %.</summary>
    Humidity,

    /// <summary>Barometric pressure — inHg, hPa, or mbar.</summary>
    Pressure,

    /// <summary>Wind speed — mph, km/h, or m/s.</summary>
    WindSpeed,

    /// <summary>Precipitation accumulation — in or mm.</summary>
    Rainfall,

    /// <summary>Solar irradiance — always W/m².</summary>
    SolarRadiation,

    /// <summary>UV index — dimensionless integer.</summary>
    UvIndex,

    /// <summary>Wind direction — compass degrees (0–359), displayed as cardinal abbreviation.</summary>
    WindDirection,
}
