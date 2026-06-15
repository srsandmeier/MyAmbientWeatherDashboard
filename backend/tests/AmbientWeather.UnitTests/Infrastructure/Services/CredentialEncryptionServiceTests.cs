using AmbientWeather.Infrastructure.Services;
using Microsoft.AspNetCore.DataProtection;
using Moq;
using Shouldly;
using System.Text;

namespace AmbientWeather.UnitTests.Infrastructure.Services;

public class CredentialEncryptionServiceTests
{
    private readonly Mock<IDataProtectionProvider> _providerMock;
    private readonly Mock<IDataProtector> _protectorMock;

    public CredentialEncryptionServiceTests()
    {
        _providerMock = new Mock<IDataProtectionProvider>();
        _protectorMock = new Mock<IDataProtector>();

        // Setup the provider to return the mock protector
        _providerMock.Setup(p => p.CreateProtector(It.IsAny<string>()))
                     .Returns(_protectorMock.Object);
    }

    [Fact]
    public void EncryptCallsProtectMethod()
    {
        // Arrange
        const string plainText = "secret-key";
        _protectorMock.Setup(p => p.Protect(It.IsAny<byte[]>()))
    .Returns((byte[] plaintextBytes) =>
    {
        // Return a mock encrypted byte array (e.g., just appending or converting)
        return Encoding.UTF8.GetBytes("mock-encrypted-data");
    });
        var service = new CredentialEncryptionService(_providerMock.Object);

        // Act
        var result = service.Encrypt(plainText);

        // Assert
        // Change "encrypted-key" to "bW9jay1lbmNyeXB0ZWQtZGF0YQ"
        result.ShouldBe("bW9jay1lbmNyeXB0ZWQtZGF0YQ");
        _protectorMock.Verify(p => p.Protect(It.IsAny<byte[]>()), Times.Once());
    }
}
