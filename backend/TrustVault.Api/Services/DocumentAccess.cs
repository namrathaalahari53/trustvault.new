using Microsoft.EntityFrameworkCore;
using TrustVault.Api.Data;
using TrustVault.Api.Models;

namespace TrustVault.Api.Services;

public interface IDocumentAccess
{
    Task<bool> CanReadAsync(Document document, Guid userId);
    Task<bool> CanEditAsync(Document document, Guid userId);
    Task<string> GetAccessLevelAsync(Document document, Guid userId);
}

public class DocumentAccess(TrustVaultDb db) : IDocumentAccess
{
    public async Task<bool> CanReadAsync(Document d, Guid uid)
    {
        if (d.IsDeleted) return false;
        if (d.OwnerId == uid) return true;
        var now = DateTime.UtcNow;
        return await db.Permissions.AnyAsync(p =>
            p.DocumentId == d.Id &&
            p.UserId == uid &&
            p.IsActive &&
            (p.ExpiresAt == null || p.ExpiresAt > now) &&
            (p.Access == "Read" || p.Access == "Edit"));
    }

    public async Task<bool> CanEditAsync(Document d, Guid uid)
    {
        if (d.IsDeleted) return false;
        if (d.OwnerId == uid) return true;
        var now = DateTime.UtcNow;
        return await db.Permissions.AnyAsync(p =>
            p.DocumentId == d.Id &&
            p.UserId == uid &&
            p.IsActive &&
            (p.ExpiresAt == null || p.ExpiresAt > now) &&
            p.Access == "Edit");
    }

    public async Task<string> GetAccessLevelAsync(Document d, Guid uid)
    {
        if (d.OwnerId == uid) return "Owner";
        var now = DateTime.UtcNow;
        var perm = await db.Permissions.FirstOrDefaultAsync(p =>
            p.DocumentId == d.Id &&
            p.UserId == uid &&
            p.IsActive &&
            (p.ExpiresAt == null || p.ExpiresAt > now));
        return perm?.Access ?? "None";
    }
}
