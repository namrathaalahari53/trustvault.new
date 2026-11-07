namespace TrustVault.Api.Models;

public class AppUser
{
    public Guid Id { get; set; }
    public string EmployeeId { get; set; } = "TV-EMP-0000";
    public string Email { get; set; } = "";
    public string FullName { get; set; } = "";
    public string JobTitle { get; set; } = "Workspace Member";
    public string Department { get; set; } = "General";
    public string ClearanceLevel { get; set; } = "Level 2 — Standard";
    public string Location { get; set; } = "Corporate HQ";
    public string Phone { get; set; } = "";
    public string Bio { get; set; } = "";
    public string AvatarColor { get; set; } = "#122b49";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "Viewer"; // Admin, Owner, Viewer
    public bool IsActive { get; set; } = true;
    public bool MustChangePassword { get; set; }
    public int FailedLoginAttempts { get; set; }
    public DateTime? LockedUntil { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public ICollection<Document> Documents { get; set; } = new List<Document>();
}

public class Folder
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public Guid OwnerId { get; set; }
    public AppUser Owner { get; set; } = null!;
    public Guid? ParentFolderId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Document> Documents { get; set; } = new List<Document>();
}

public class Document
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public AppUser Owner { get; set; } = null!;
    public Guid? FolderId { get; set; }
    public Folder? Folder { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Category { get; set; } = "General";
    public string Tags { get; set; } = "";
    public string StorageKey { get; set; } = "";
    public string ContentType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public string Sha256Hash { get; set; } = "";
    public string Status { get; set; } = "Pending"; // Pending, Scanning, Clean, Rejected, ScanFailed
    public string? ScanFailureReason { get; set; }
    public DateTime? ScannedAt { get; set; }
    public int CurrentVersion { get; set; } = 1;
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<DocumentPermission> Permissions { get; set; } = new List<DocumentPermission>();
    public ICollection<DocumentVersion> Versions { get; set; } = new List<DocumentVersion>();
    public ICollection<DocumentProcessingJob> ProcessingJobs { get; set; } = new List<DocumentProcessingJob>();
}

public class DocumentVersion
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }
    public Document Document { get; set; } = null!;
    public int VersionNumber { get; set; }
    public string StorageKey { get; set; } = "";
    public long Size { get; set; }
    public string Sha256Hash { get; set; } = "";
    public Guid UploadedById { get; set; }
    public string ChangeNote { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class DocumentPermission
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }
    public Document Document { get; set; } = null!;
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public Guid? GrantedById { get; set; }
    public string Access { get; set; } = "Read"; // Read, Edit
    public bool IsActive { get; set; } = true;
    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }
}

public class DocumentProcessingJob
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }
    public Document Document { get; set; } = null!;
    public string JobType { get; set; } = "MalwareScan";
    public string Status { get; set; } = "Completed";
    public int Attempts { get; set; } = 1;
    public string? DiagnosticMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}

public class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string Type { get; set; } = "Info";
    public Guid? DocumentId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AuditEvent
{
    public long Id { get; set; }
    public string CorrelationId { get; set; } = "";
    public Guid ActorId { get; set; }
    public string ActorEmail { get; set; } = "";
    public Guid? DocumentId { get; set; }
    public string? DocumentName { get; set; }
    public string Action { get; set; } = "";
    public string Result { get; set; } = "";
    public string? Reason { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string PreviousHash { get; set; } = "";
    public string EntryHash { get; set; } = "";
}
