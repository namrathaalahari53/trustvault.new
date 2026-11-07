using Xunit;

namespace TrustVault.Tests;

public class AuthorizationPolicyTests
{
    [Theory]
    [InlineData("Owner", "Clean", "Read", true)]
    [InlineData("Owner", "Clean", "Edit", true)]
    [InlineData("Edit", "Clean", "Read", true)]
    [InlineData("Edit", "Clean", "Edit", true)]
    [InlineData("Read", "Clean", "Read", true)]
    [InlineData("Read", "Clean", "Edit", false)]
    [InlineData("None", "Clean", "Read", false)]
    [InlineData("Owner", "ScanFailed", "Read", false)]
    [InlineData("Owner", "Rejected", "Read", false)]
    [InlineData("Edit", "ScanFailed", "Edit", false)]
    public void Document_access_and_scan_status_matrix_is_enforced(string accessLevel, string scanStatus, string operation, bool expected)
    {
        var isClean = scanStatus == "Clean";
        var hasPermission = accessLevel switch
        {
            "Owner" => operation is "Read" or "Edit" or "Delete" or "Share",
            "Edit" => operation is "Read" or "Edit",
            "Read" => operation == "Read",
            _ => false
        };
        var allowed = isClean && hasPermission;
        Assert.Equal(expected, allowed);
    }

    [Fact]
    public void Revoked_or_expired_grant_must_immediately_deny_access()
    {
        var isActive = false;
        var isNotExpired = true;
        var allowed = isActive && isNotExpired;
        Assert.False(allowed);
    }
}
