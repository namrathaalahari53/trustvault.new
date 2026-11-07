using Microsoft.EntityFrameworkCore;
using TrustVault.Api.Models;

namespace TrustVault.Api.Data;

public class TrustVaultDb(DbContextOptions<TrustVaultDb> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Folder> Folders => Set<Folder>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<DocumentVersion> DocumentVersions => Set<DocumentVersion>();
    public DbSet<DocumentPermission> Permissions => Set<DocumentPermission>();
    public DbSet<DocumentProcessingJob> ProcessingJobs => Set<DocumentProcessingJob>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppUser>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Folder>().HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId);
        b.Entity<Document>().HasOne(x => x.Owner).WithMany(x => x.Documents).HasForeignKey(x => x.OwnerId);
        b.Entity<Document>().HasOne(x => x.Folder).WithMany(x => x.Documents).HasForeignKey(x => x.FolderId);
        b.Entity<DocumentVersion>().HasOne(x => x.Document).WithMany(x => x.Versions).HasForeignKey(x => x.DocumentId);
        b.Entity<DocumentPermission>().HasIndex(x => new { x.DocumentId, x.UserId }).IsUnique();
        b.Entity<DocumentPermission>().HasOne(x => x.Document).WithMany(x => x.Permissions).HasForeignKey(x => x.DocumentId);
        b.Entity<DocumentPermission>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);
        b.Entity<DocumentProcessingJob>().HasOne(x => x.Document).WithMany(x => x.ProcessingJobs).HasForeignKey(x => x.DocumentId);
        b.Entity<Notification>().HasIndex(x => new { x.UserId, x.IsRead });
        b.Entity<AuditEvent>().HasIndex(x => x.CreatedAt);
    }
}
