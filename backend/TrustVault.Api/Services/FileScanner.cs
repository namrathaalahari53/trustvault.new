using System.Buffers.Binary;
using System.Net.Sockets;
using System.Text;

namespace TrustVault.Api.Services;

public record ScanOutcome(string Status, string? Reason);

public interface IFileScanner
{
    Task<ScanOutcome> ScanAsync(string path, string fileName);
}

public static class FileSignatureValidator
{
    private const string EicarSignature = @"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

    public static (bool IsValid, bool IsMalicious, string? Reason) InspectFile(string path, string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var bytes = File.ReadAllBytes(path);
        if (bytes.Length == 0) return (false, false, "File is empty.");

        var textSample = Encoding.UTF8.GetString(bytes, 0, Math.Min(bytes.Length, 8192));
        if (textSample.Contains(EicarSignature, StringComparison.Ordinal))
            return (true, true, "Quarantined: EICAR malware test signature detected.");

        return ext switch
        {
            ".pdf" => bytes.Length >= 4 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46
                ? (true, false, null)
                : (false, false, "File signature mismatch: invalid PDF header."),
            ".png" => bytes.Length >= 4 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47
                ? (true, false, null)
                : (false, false, "File signature mismatch: invalid PNG header."),
            ".jpg" or ".jpeg" => bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF
                ? (true, false, null)
                : (false, false, "File signature mismatch: invalid JPEG header."),
            ".docx" or ".xlsx" => bytes.Length >= 4 && bytes[0] == 0x50 && bytes[1] == 0x4B && bytes[2] == 0x03 && bytes[3] == 0x04
                ? (true, false, null)
                : (false, false, "File signature mismatch: invalid Office OpenXML container."),
            ".txt" or ".md" or ".csv" => (true, false, null),
            _ => (false, false, "Unsupported file extension.")
        };
    }
}

public sealed class DevelopmentFileScanner : IFileScanner
{
    public Task<ScanOutcome> ScanAsync(string path, string fileName)
    {
        var (isValid, isMalicious, reason) = FileSignatureValidator.InspectFile(path, fileName);
        if (isMalicious) return Task.FromResult(new ScanOutcome("Rejected", reason));
        if (!isValid) return Task.FromResult(new ScanOutcome("Rejected", reason));

        var mode = Environment.GetEnvironmentVariable("SCANNER_MODE") ?? "development-allow";
        return Task.FromResult(mode == "development-allow"
            ? new ScanOutcome("Clean", "Verified clean by signature and content scanner.")
            : new ScanOutcome("ScanFailed", "ClamAV daemon unreachable in fail-closed mode. Use Retry Scan once scanner is online."));
    }
}

public sealed class ClamAvFileScanner(string host, int port) : IFileScanner
{
    public async Task<ScanOutcome> ScanAsync(string path, string fileName)
    {
        var (isValid, isMalicious, reason) = FileSignatureValidator.InspectFile(path, fileName);
        if (isMalicious) return new ScanOutcome("Rejected", reason);
        if (!isValid) return new ScanOutcome("Rejected", reason);

        try
        {
            using var client = new TcpClient();
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(60));
            await client.ConnectAsync(host, port, timeout.Token);
            await using var network = client.GetStream();
            await network.WriteAsync("zINSTREAM\0"u8.ToArray(), timeout.Token);

            await using (var file = File.OpenRead(path))
            {
                var buffer = new byte[64 * 1024];
                int read;
                while ((read = await file.ReadAsync(buffer, timeout.Token)) > 0)
                {
                    var length = new byte[4];
                    BinaryPrimitives.WriteInt32BigEndian(length, read);
                    await network.WriteAsync(length, timeout.Token);
                    await network.WriteAsync(buffer.AsMemory(0, read), timeout.Token);
                }
            }

            await network.WriteAsync(new byte[4], timeout.Token);
            var response = new byte[4096];
            var count = await network.ReadAsync(response, timeout.Token);
            var result = Encoding.UTF8.GetString(response, 0, count);
            if (result.Contains("OK", StringComparison.Ordinal)) return new ScanOutcome("Clean", "ClamAV INSTREAM scan clean.");
            if (result.Contains("FOUND", StringComparison.Ordinal)) return new ScanOutcome("Rejected", $"ClamAV threat detected: {result.Trim()}");
            return new ScanOutcome("ScanFailed", "Unexpected ClamAV protocol response.");
        }
        catch (Exception ex)
        {
            return new ScanOutcome("ScanFailed", $"Scanner unavailable: {ex.Message}");
        }
    }
}
