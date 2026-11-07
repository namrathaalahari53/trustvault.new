using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TrustVault.Api.Data;
using TrustVault.Api.Models;

namespace TrustVault.Api.Services;

public record AuditChainVerificationResult(bool IsValid, int TotalRecords, long? FirstInvalidId, string LatestCheckpointHash);

public interface IAuditWriter
{
    Task WriteAsync(Guid actorId, Guid? documentId, string action, string result, string? reason, string? actorEmail = null, string? documentName = null, string? ipAddress = null);
    Task<AuditChainVerificationResult> VerifyChainAsync();
}

public class AuditWriter(TrustVaultDb db, IConfiguration config) : IAuditWriter
{
    public async Task WriteAsync(Guid actorId, Guid? documentId, string action, string result, string? reason, string? actorEmail = null, string? documentName = null, string? ipAddress = null)
    {
        var secret = config["Audit:HmacKey"];
        if (string.IsNullOrWhiteSpace(secret)) throw new InvalidOperationException("Audit HMAC key is required.");
        var key = Convert.FromBase64String(secret);
        var previous = await db.AuditEvents.OrderByDescending(x => x.Id).Select(x => x.EntryHash).FirstOrDefaultAsync() ?? "GENESIS";
        var created = DateTime.UtcNow;
        var correlationId = Guid.NewGuid().ToString("N")[..12];
        var payload = $"{actorId}|{documentId}|{action}|{result}|{reason}|{created:O}|{previous}";
        var hash = Convert.ToHexString(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(payload)));
        db.AuditEvents.Add(new AuditEvent
        {
            CorrelationId = correlationId,
            ActorId = actorId,
            ActorEmail = actorEmail ?? "",
            DocumentId = documentId,
            DocumentName = documentName,
            Action = action,
            Result = result,
            Reason = reason,
            IpAddress = ipAddress,
            CreatedAt = created,
            PreviousHash = previous,
            EntryHash = hash
        });
        await db.SaveChangesAsync();
    }

    public async Task<AuditChainVerificationResult> VerifyChainAsync()
    {
        var secret = config["Audit:HmacKey"] ?? throw new InvalidOperationException("Audit HMAC key is required.");
        var key = Convert.FromBase64String(secret);
        var events = await db.AuditEvents.OrderBy(x => x.Id).AsNoTracking().ToListAsync();
        var expectedPrev = "GENESIS";
        foreach (var e in events)
        {
            if (e.PreviousHash != expectedPrev)
                return new AuditChainVerificationResult(false, events.Count, e.Id, expectedPrev);
            var payload = $"{e.ActorId}|{e.DocumentId}|{e.Action}|{e.Result}|{e.Reason}|{e.CreatedAt:O}|{e.PreviousHash}";
            var computed = Convert.ToHexString(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(payload)));
            if (!string.Equals(computed, e.EntryHash, StringComparison.OrdinalIgnoreCase))
                return new AuditChainVerificationResult(false, events.Count, e.Id, e.EntryHash);
            expectedPrev = e.EntryHash;
        }
        return new AuditChainVerificationResult(true, events.Count, null, expectedPrev);
    }
}
