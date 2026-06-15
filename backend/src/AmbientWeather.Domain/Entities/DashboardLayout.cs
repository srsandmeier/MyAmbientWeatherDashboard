namespace AmbientWeather.Domain.Entities;

/// <summary>
/// Saved dashboard layout for a user.
/// </summary>
public sealed class DashboardLayout
{
    /// <summary>
    /// Layout identifier.
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// User that owns this layout.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// User-facing layout name.
    /// </summary>
    public string Name { get; set; } = "Default";

    /// <summary>
    /// Whether this layout is the user's active layout.
    /// </summary>
    public bool IsActive { get; set; }

    /// <summary>
    /// Serialized react-grid-layout JSON.
    /// </summary>
    public string LayoutJson { get; set; } = "[]";

    /// <summary>
    /// UTC timestamp when the layout was last updated.
    /// </summary>
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// User that owns this layout.
    /// </summary>
    public AppUser? User { get; set; }
}
