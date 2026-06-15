using AmbientWeather.Domain;
using Shouldly;

namespace AmbientWeather.UnitTests;

/// <summary>Smoke tests for project references and assembly loading.</summary>
public sealed class AssemblyReferenceTests
{
    [Fact]
    public void DomainAssemblyReferenceIsAccessible()
    {
        typeof(AssemblyReference).ShouldNotBeNull();
    }
}
