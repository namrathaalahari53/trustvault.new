using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TrustVault.Api.Data;
using TrustVault.Api.Models;
using TrustVault.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var connection = builder.Configuration.GetConnectionString("TrustVault")
    ?? throw new InvalidOperationException("ConnectionStrings:TrustVault is required.");
var jwtKeyText = builder.Configuration["Jwt:SigningKey"]
    ?? throw new InvalidOperationException("Jwt:SigningKey is required.");
var jwtKey = Convert.FromBase64String(jwtKeyText);
if (jwtKey.Length < 32) throw new InvalidOperationException("JWT signing key must contain at least 32 random bytes.");

builder.Services.AddDbContext<TrustVaultDb>(o => o.UseNpgsql(connection));
builder.Services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
builder.Services.AddScoped<IAuditWriter, AuditWriter>();
builder.Services.AddScoped<IDocumentAccess, DocumentAccess>();
builder.Services.AddSingleton<IFileScanner>(sp =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var mode = Environment.GetEnvironmentVariable("SCANNER_MODE") ?? "development-allow";
    if (mode == "clamav")
        return new ClamAvFileScanner(configuration["ClamAV:Host"] ?? "localhost",
            int.TryParse(configuration["ClamAV:Port"], out var port) ? port : 3310);
    return new DevelopmentFileScanner();
});
builder.Services.AddSingleton(new PrivateFileStore(builder.Configuration["Storage:RootPath"] ?? "./private-storage"));
builder.Services.AddCors(o => o.AddPolicy("frontend", p => p
    .WithOrigins(builder.Configuration["Frontend:Origin"] ?? "http://localhost:4200")
    .AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "TrustVault",
        ValidateAudience = true, ValidAudience = builder.Configuration["Jwt:Audience"] ?? "TrustVault",
        ValidateIssuerSigningKey = true, IssuerSigningKey = new SymmetricSecurityKey(jwtKey),
        ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(30)
    };
});
builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();

var app = builder.Build();
app.UseExceptionHandler();
app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseSwagger();
app.UseSwaggerUI();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TrustVaultDb>();
    await db.Database.EnsureCreatedAsync();
    var email = app.Configuration["AdminBootstrap:Email"];
    var password = app.Configuration["AdminBootstrap:Password"];
    if (!string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(password) &&
        !await db.Users.AnyAsync(u => u.Role == "Admin"))
    {
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>();
        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = email.Trim().ToLowerInvariant(),
            FullName = "System Administrator",
            Department = "Information Security",
            Role = "Admin",
            MustChangePassword = true
        };
        admin.PasswordHash = hasher.HashPassword(admin, password);
        db.Users.Add(admin);
        await db.SaveChangesAsync();
    }
}

app.MapGet("/api/system/health", () => Results.Ok(new { status = "healthy", service = "TrustVault.Api", timestamp = DateTime.UtcNow }));
app.MapGet("/api/system/ready", async (TrustVaultDb db) =>
    await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));

app.MapPost("/api/auth/bootstrap-admin", async (BootstrapRequest req, TrustVaultDb db, IPasswordHasher<AppUser> hasher) =>
{
    if (await db.Users.AnyAsync(u => u.Role == "Admin")) return Results.Conflict(new { message = "An administrator already exists." });
    if (!ValidEmail(req.Email) || req.Password.Length < 14) return Results.BadRequest(new { message = "Use a valid email and a password of at least 14 characters." });
    var user = new AppUser { Id = Guid.NewGuid(), Email = req.Email.Trim().ToLowerInvariant(), FullName = "System Administrator", Department = "Security", Role = "Admin", MustChangePassword = true };
    user.PasswordHash = hasher.HashPassword(user, req.Password);
    db.Users.Add(user); await db.SaveChangesAsync();
    return Results.Created("/api/users/me", new { user.Id, user.Email, user.Role });
});

app.MapPost("/api/auth/login", async (LoginRequest req, HttpContext http, TrustVaultDb db, IPasswordHasher<AppUser> hasher, IConfiguration cfg, IAuditWriter audit) =>
{
    if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password) || !ValidEmail(req.Email))
        return Results.BadRequest(new { message = "Valid email and password are required." });

    var user = await db.Users.SingleOrDefaultAsync(u => u.Email == req.Email.Trim().ToLower());
    if (user is null)
        return Results.Unauthorized();

    if (user.LockedUntil.HasValue && user.LockedUntil.Value > DateTime.UtcNow)
    {
        await audit.WriteAsync(user.Id, null, "Login", "Denied", "AccountTemporarilyLocked", user.Email, null, http.Connection.RemoteIpAddress?.ToString());
        return Results.StatusCode(429);
    }

    if (!user.IsActive)
    {
        await audit.WriteAsync(user.Id, null, "Login", "Denied", "AccountInactive", user.Email, null, http.Connection.RemoteIpAddress?.ToString());
        return Results.Unauthorized();
    }

    if (hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password) == PasswordVerificationResult.Failed)
    {
        user.FailedLoginAttempts++;
        if (user.FailedLoginAttempts >= 5) user.LockedUntil = DateTime.UtcNow.AddMinutes(10);
        await db.SaveChangesAsync();
        await audit.WriteAsync(user.Id, null, "Login", "Denied", "InvalidPassword", user.Email, null, http.Connection.RemoteIpAddress?.ToString());
        return Results.Unauthorized();
    }

    user.FailedLoginAttempts = 0;
    user.LockedUntil = null;
    user.LastLoginAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    await audit.WriteAsync(user.Id, null, "Login", "Success", null, user.Email, null, http.Connection.RemoteIpAddress?.ToString());

    var key = new SymmetricSecurityKey(Convert.FromBase64String(cfg["Jwt:SigningKey"]!));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim(ClaimTypes.Role, user.Role)
    };
    var token = new JwtSecurityToken(cfg["Jwt:Issuer"] ?? "TrustVault", cfg["Jwt:Audience"] ?? "TrustVault",
        claims, expires: DateTime.UtcNow.AddMinutes(20), signingCredentials: creds);
    return Results.Ok(new
    {
        accessToken = new JwtSecurityTokenHandler().WriteToken(token),
        expiresIn = 1200,
        user = new { user.Id, user.Email, user.FullName, user.Department, user.Role, user.MustChangePassword }
    });
});

var auth = app.MapGroup("/api").RequireAuthorization();

auth.MapGet("/users/me", async (ClaimsPrincipal p, TrustVaultDb db) =>
{
    var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == UserId(p));
    if (user is null || !user.IsActive) return Results.Unauthorized();
    return Results.Ok(new { id = user.Id, email = user.Email, fullName = user.FullName, department = user.Department, role = user.Role, mustChangePassword = user.MustChangePassword, lastLoginAt = user.LastLoginAt });
});

auth.MapPut("/users/me", async (UpdateProfileRequest req, ClaimsPrincipal p, TrustVaultDb db) =>
{
    var user = await db.Users.FindAsync(UserId(p));
    if (user is null) return Results.NotFound();
    user.FullName = req.FullName?.Trim() ?? user.FullName;
    user.Department = req.Department?.Trim() ?? user.Department;
    await db.SaveChangesAsync();
    return Results.Ok(new { id = user.Id, email = user.Email, fullName = user.FullName, department = user.Department, role = user.Role });
});

auth.MapPost("/auth/change-password", async (ChangePasswordRequest req, ClaimsPrincipal p, TrustVaultDb db, IPasswordHasher<AppUser> hasher, IAuditWriter audit) =>
{
    var user = await db.Users.FindAsync(UserId(p));
    if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, req.CurrentPassword) == PasswordVerificationResult.Failed)
    {
        await audit.WriteAsync(UserId(p), null, "ChangePassword", "Denied", "WrongCurrentPassword", UserEmail(p));
        return Results.BadRequest(new { message = "Current password is incorrect." });
    }
    if (req.NewPassword.Length < 14) return Results.BadRequest(new { message = "New password must contain at least 14 characters." });
    user.PasswordHash = hasher.HashPassword(user, req.NewPassword);
    user.MustChangePassword = false;
    await db.SaveChangesAsync();
    await audit.WriteAsync(user.Id, null, "ChangePassword", "Success", null, user.Email);
    return Results.NoContent();
});

// Admin endpoints
var adminGroup = auth.MapGroup("/admin").RequireAuthorization(new AuthorizeAttribute { Roles = "Admin" });

adminGroup.MapGet("/stats", async (TrustVaultDb db, IAuditWriter audit) =>
{
    var chain = await audit.VerifyChainAsync();
    return Results.Ok(new
    {
        totalUsers = await db.Users.CountAsync(),
        activeUsers = await db.Users.CountAsync(u => u.IsActive),
        totalDocuments = await db.Documents.CountAsync(d => !d.IsDeleted),
        cleanDocuments = await db.Documents.CountAsync(d => !d.IsDeleted && d.Status == "Clean"),
        scanFailedDocuments = await db.Documents.CountAsync(d => !d.IsDeleted && (d.Status == "ScanFailed" || d.Status == "Pending")),
        quarantinedDocuments = await db.Documents.CountAsync(d => !d.IsDeleted && d.Status == "Rejected"),
        activePermissions = await db.Permissions.CountAsync(p => p.IsActive),
        deniedEventsCount = await db.AuditEvents.CountAsync(a => a.Result == "Denied"),
        auditChain = new { isValid = chain.IsValid, totalRecords = chain.TotalRecords, latestCheckpointHash = chain.LatestCheckpointHash }
    });
});

adminGroup.MapPost("/users", async (CreateUserRequest req, ClaimsPrincipal p, TrustVaultDb db, IPasswordHasher<AppUser> hasher, IAuditWriter audit) =>
{
    var email = req.Email.Trim().ToLowerInvariant();
    if (!ValidEmail(email) || req.TemporaryPassword.Length < 14 || req.Role is not ("Owner" or "Viewer"))
        return Results.BadRequest(new { message = "Provide a valid email, a 14-character temporary password and role Owner or Viewer." });
    if (await db.Users.AnyAsync(u => u.Email == email)) return Results.Conflict(new { message = "Email already exists." });
    var user = new AppUser
    {
        Id = Guid.NewGuid(),
        Email = email,
        FullName = string.IsNullOrWhiteSpace(req.FullName) ? email.Split('@')[0] : req.FullName.Trim(),
        Department = string.IsNullOrWhiteSpace(req.Department) ? "General" : req.Department.Trim(),
        Role = req.Role,
        MustChangePassword = true
    };
    user.PasswordHash = hasher.HashPassword(user, req.TemporaryPassword);
    db.Users.Add(user);
    await db.SaveChangesAsync();
    await audit.WriteAsync(UserId(p), null, "CreateUser", "Success", $"Created {email} ({req.Role})", UserEmail(p));
    return Results.Created("/api/admin/users", new { user.Id, user.Email, user.FullName, user.Department, user.Role, user.IsActive, user.MustChangePassword });
});

adminGroup.MapGet("/users", async (TrustVaultDb db) =>
    Results.Ok(await db.Users.OrderBy(u => u.Email).Select(u => new { u.Id, u.Email, u.FullName, u.Department, u.Role, u.IsActive, u.MustChangePassword, u.CreatedAt, u.LastLoginAt }).ToListAsync()));

adminGroup.MapPut("/users/{id:guid}/status", async (Guid id, UpdateUserStatusRequest req, ClaimsPrincipal p, TrustVaultDb db, IAuditWriter audit) =>
{
    var user = await db.Users.FindAsync(id);
    if (user is null) return Results.NotFound();
    if (user.Id == UserId(p) && !req.IsActive) return Results.BadRequest(new { message = "Administrators cannot deactivate their own account." });
    user.IsActive = req.IsActive;
    await db.SaveChangesAsync();
    await audit.WriteAsync(UserId(p), null, req.IsActive ? "ActivateUser" : "DeactivateUser", "Success", user.Email, UserEmail(p));
    return Results.Ok(new { user.Id, user.Email, user.IsActive });
});

adminGroup.MapPut("/users/{id:guid}/role", async (Guid id, UpdateUserRoleRequest req, ClaimsPrincipal p, TrustVaultDb db, IAuditWriter audit) =>
{
    if (req.Role is not ("Admin" or "Owner" or "Viewer")) return Results.BadRequest(new { message = "Invalid role." });
    var user = await db.Users.FindAsync(id);
    if (user is null) return Results.NotFound();
    user.Role = req.Role;
    await db.SaveChangesAsync();
    await audit.WriteAsync(UserId(p), null, "ChangeUserRole", "Success", $"{user.Email} -> {req.Role}", UserEmail(p));
    return Results.Ok(new { user.Id, user.Email, user.Role });
});

adminGroup.MapGet("/verify-audit-chain", async (IAuditWriter audit) => Results.Ok(await audit.VerifyChainAsync()));

// Folders
auth.MapGet("/folders", async (ClaimsPrincipal p, TrustVaultDb db) =>
{
    var uid = UserId(p);
    var folders = await db.Folders.AsNoTracking()
        .Where(f => f.OwnerId == uid)
        .OrderBy(f => f.Name)
        .Select(f => new { f.Id, f.Name, f.Description, f.CreatedAt, documentCount = f.Documents.Count(d => !d.IsDeleted) })
        .ToListAsync();
    return Results.Ok(folders);
});

auth.MapPost("/folders", async (CreateFolderRequest req, ClaimsPrincipal p, TrustVaultDb db) =>
{
    if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { message = "Folder name is required." });
    var folder = new Folder { Id = Guid.NewGuid(), Name = req.Name.Trim(), Description = req.Description?.Trim() ?? "", OwnerId = UserId(p) };
    db.Folders.Add(folder);
    await db.SaveChangesAsync();
    return Results.Created($"/api/folders/{folder.Id}", new { folder.Id, folder.Name, folder.Description, folder.CreatedAt });
});

auth.MapDelete("/folders/{id:guid}", async (Guid id, ClaimsPrincipal p, TrustVaultDb db) =>
{
    var folder = await db.Folders.SingleOrDefaultAsync(f => f.Id == id && f.OwnerId == UserId(p));
    if (folder is null) return Results.NotFound();
    var docs = await db.Documents.Where(d => d.FolderId == id).ToListAsync();
    foreach (var d in docs) d.FolderId = null;
    db.Folders.Remove(folder);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Documents
auth.MapGet("/documents", async (ClaimsPrincipal p, TrustVaultDb db) =>
{
    var uid = UserId(p);
    var now = DateTime.UtcNow;
    var query = db.Documents.AsNoTracking().Include(d => d.Owner).Include(d => d.Folder).Include(d => d.Permissions)
        .Where(d => !d.IsDeleted && (d.OwnerId == uid || d.Permissions.Any(x => x.UserId == uid && x.IsActive && (x.ExpiresAt == null || x.ExpiresAt > now))));

    var rawDocs = await query.OrderByDescending(d => d.UpdatedAt).ToListAsync();
    var docs = rawDocs.Select(d =>
    {
        var isOwner = d.OwnerId == uid;
        var grant = d.Permissions.FirstOrDefault(x => x.UserId == uid && x.IsActive && (x.ExpiresAt == null || x.ExpiresAt > now));
        var accessLevel = isOwner ? "Owner" : (grant?.Access ?? "Read");
        return new DocumentDto(
            d.Id, d.Name, d.Description, d.Category, d.Tags, d.FolderId, d.Folder?.Name,
            d.Owner.Email, d.Size, d.ContentType, d.Status, d.ScanFailureReason, d.CurrentVersion,
            d.CreatedAt, d.UpdatedAt, isOwner, accessLevel,
            d.Status == "Clean", isOwner || accessLevel == "Edit"
        );
    }).ToList();
    return Results.Ok(docs);
});

auth.MapPost("/documents", async (HttpRequest request, ClaimsPrincipal p, TrustVaultDb db,
    PrivateFileStore store, IFileScanner scanner, IAuditWriter audit) =>
{
    var role = p.FindFirstValue(ClaimTypes.Role);
    if (role is not ("Owner" or "Admin"))
    {
        await audit.WriteAsync(UserId(p), null, "Upload", "Denied", "RoleNotPermitted", UserEmail(p));
        return Results.Forbid();
    }
    if (!request.HasFormContentType) return Results.BadRequest(new { message = "Multipart form data required." });
    var form = await request.ReadFormAsync();
    var file = form.Files.GetFile("file");
    if (file is null || file.Length == 0 || file.Length > 20 * 1024 * 1024)
        return Results.BadRequest(new { message = "File is empty or exceeds 20 MB." });

    var safeName = Path.GetFileName(file.FileName);
    var ext = Path.GetExtension(safeName).ToLowerInvariant();
    var allowed = new[] { ".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".txt" };
    if (!allowed.Contains(ext)) return Results.BadRequest(new { message = "File type is not allowed." });

    var id = Guid.NewGuid();
    var path = await store.SaveAsync(id, file.OpenReadStream());
    var bytes = await File.ReadAllBytesAsync(path);
    var sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    var scanOutcome = await scanner.ScanAsync(path, safeName);

    Guid? folderId = Guid.TryParse(form["folderId"].ToString(), out var fid) ? fid : null;
    var doc = new Document
    {
        Id = id,
        OwnerId = UserId(p),
        FolderId = folderId,
        Name = safeName,
        Description = form["description"].ToString(),
        Category = string.IsNullOrWhiteSpace(form["category"]) ? "General" : form["category"].ToString(),
        Tags = form["tags"].ToString(),
        StorageKey = id.ToString("N"),
        ContentType = file.ContentType,
        Size = file.Length,
        Sha256Hash = sha256,
        Status = scanOutcome.Status,
        ScanFailureReason = scanOutcome.Reason,
        ScannedAt = DateTime.UtcNow,
        CurrentVersion = 1
    };
    db.Documents.Add(doc);
    db.DocumentVersions.Add(new DocumentVersion
    {
        Id = Guid.NewGuid(),
        DocumentId = id,
        VersionNumber = 1,
        StorageKey = doc.StorageKey,
        Size = doc.Size,
        Sha256Hash = sha256,
        UploadedById = UserId(p),
        ChangeNote = "Initial upload"
    });
    db.ProcessingJobs.Add(new DocumentProcessingJob
    {
        Id = Guid.NewGuid(),
        DocumentId = id,
        JobType = "MalwareScan",
        Status = scanOutcome.Status == "Clean" ? "Completed" : "Failed",
        Attempts = 1,
        DiagnosticMessage = scanOutcome.Reason,
        CompletedAt = DateTime.UtcNow
    });
    await db.SaveChangesAsync();
    await audit.WriteAsync(UserId(p), id, "Upload", scanOutcome.Status == "Rejected" ? "Denied" : "Success", scanOutcome.Reason, UserEmail(p), safeName);
    return Results.Created($"/api/documents/{id}", new { id, doc.Name, doc.Status, doc.ScanFailureReason });
});

auth.MapPost("/documents/{id:guid}/retry-scan", async (Guid id, ClaimsPrincipal p, TrustVaultDb db, IDocumentAccess access, PrivateFileStore store, IFileScanner scanner, IAuditWriter audit) =>
{
    var d = await db.Documents.SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    if (d is null || !await access.CanReadAsync(d, UserId(p)))
    {
        await audit.WriteAsync(UserId(p), id, "RetryScan", "Denied", "NotFoundOrNoPermission", UserEmail(p));
        return Results.NotFound();
    }
    var filePath = Path.Combine(Path.GetFullPath(app.Configuration["Storage:RootPath"] ?? "./private-storage"), d.StorageKey);
    var outcome = await scanner.ScanAsync(filePath, d.Name);
    d.Status = outcome.Status;
    d.ScanFailureReason = outcome.Reason;
    d.ScannedAt = DateTime.UtcNow;
    d.UpdatedAt = DateTime.UtcNow;
    db.ProcessingJobs.Add(new DocumentProcessingJob
    {
        Id = Guid.NewGuid(),
        DocumentId = d.Id,
        JobType = "MalwareScan",
        Status = outcome.Status == "Clean" ? "Completed" : "Failed",
        Attempts = await db.ProcessingJobs.CountAsync(j => j.DocumentId == d.Id) + 1,
        DiagnosticMessage = outcome.Reason,
        CompletedAt = DateTime.UtcNow
    });
    await db.SaveChangesAsync();
    await audit.WriteAsync(UserId(p), d.Id, "RetryScan", outcome.Status == "Clean" ? "Success" : "Failed", outcome.Reason, UserEmail(p), d.Name);
    return Results.Ok(new { d.Id, d.Name, d.Status, d.ScanFailureReason, d.ScannedAt });
});

auth.MapGet("/documents/{id:guid}", async (Guid id, ClaimsPrincipal p, TrustVaultDb db, IDocumentAccess access, IAuditWriter audit) =>
{
    var d = await db.Documents.Include(x => x.Owner).Include(x => x.Folder).SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    if (d is null) { await audit.WriteAsync(UserId(p), id, "Read", "Denied", "NotFound", UserEmail(p)); return Results.NotFound(); }
    if (!await access.CanReadAsync(d, UserId(p))) { await audit.WriteAsync(UserId(p), id, "Read", "Denied", "PermissionDenied", UserEmail(p), d.Name); return Results.NotFound(); }
    if (d.Status != "Clean") { await audit.WriteAsync(UserId(p), id, "Read", "Denied", $"DocumentStatus:{d.Status}", UserEmail(p), d.Name); return Results.Conflict(new { message = $"Document is not available (status: {d.Status}).", status = d.Status, reason = d.ScanFailureReason }); }
    var level = await access.GetAccessLevelAsync(d, UserId(p));
    await audit.WriteAsync(UserId(p), id, "Read", "Success", null, UserEmail(p), d.Name);
    return Results.Ok(new DocumentDto(d.Id, d.Name, d.Description, d.Category, d.Tags, d.FolderId, d.Folder?.Name, d.Owner.Email, d.Size, d.ContentType, d.Status, d.ScanFailureReason, d.CurrentVersion, d.CreatedAt, d.UpdatedAt, d.OwnerId == UserId(p), level, true, d.OwnerId == UserId(p) || level == "Edit"));
});

auth.MapGet("/documents/{id:guid}/preview", async (Guid id, ClaimsPrincipal p, TrustVaultDb db, IDocumentAccess access, PrivateFileStore store, IAuditWriter audit) =>
{
    var d = await db.Documents.Include(x => x.Owner).Include(x => x.Versions).Include(x => x.ProcessingJobs).SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    if (d is null || !await access.CanReadAsync(d, UserId(p)))
    {
        await audit.WriteAsync(UserId(p), id, "Preview", "Denied", "NotAuthorized", UserEmail(p), d?.Name);
        return Results.NotFound();
    }
    if (d.Status != "Clean")
    {
        await audit.WriteAsync(UserId(p), id, "Preview", "Denied", $"DocumentNotClean:{d.Status}", UserEmail(p), d.Name);
        return Results.Conflict(new { message = $"Preview blocked until document scan is Clean (current: {d.Status})." });
    }
    string? textPreview = null;
    var ext = Path.GetExtension(d.Name).ToLowerInvariant();
    if (ext is ".txt" or ".md" or ".csv")
    {
        using var reader = new StreamReader(store.Open(d.StorageKey));
        var buf = new char[4096];
        var read = await reader.ReadAsync(buf, 0, buf.Length);
        textPreview = new string(buf, 0, read);
    }
    await audit.WriteAsync(UserId(p), id, "Preview", "Success", null, UserEmail(p), d.Name);
    var level = await access.GetAccessLevelAsync(d, UserId(p));
    return Results.Ok(new
    {
        d.Id, d.Name, d.Description, d.Category, d.Tags, d.ContentType, d.Size, d.Sha256Hash,
        d.Status, d.ScanFailureReason, d.CurrentVersion, ownerEmail = d.Owner.Email,
        accessLevel = level, canEdit = d.OwnerId == UserId(p) || level == "Edit",
        textPreview,
        versions = d.Versions.OrderByDescending(v => v.VersionNumber).Select(v => new { v.VersionNumber, v.Size, v.Sha256Hash, v.ChangeNote, v.CreatedAt }),
        jobs = d.ProcessingJobs.OrderByDescending(j => j.CreatedAt).Select(j => new { j.JobType, j.Status, j.Attempts, j.DiagnosticMessage, j.CompletedAt })
    });
});

auth.MapGet("/documents/{id:guid}/download", async (Guid id, ClaimsPrincipal p, TrustVaultDb db, IDocumentAccess access,
    PrivateFileStore store, IAuditWriter audit) =>
{
    var d = await db.Documents.SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    if (d is null || !await access.CanReadAsync(d, UserId(p)) || d.Status != "Clean")
    {
        await audit.WriteAsync(UserId(p), id, "Download", "Denied", "NotAuthorizedOrNotClean", UserEmail(p), d?.Name);
        return Results.NotFound();
    }
    var stream = store.Open(d.StorageKey);
    await audit.WriteAsync(UserId(p), id, "Download", "Success", null, UserEmail(p), d.Name);
    return Results.File(stream, d.ContentType, d.Name);
});

auth.MapPut("/documents/{id:guid}", async (Guid id, UpdateDocumentRequest req, ClaimsPrincipal p, TrustVaultDb db,
    IDocumentAccess access, IAuditWriter audit) =>
{
    var d = await db.Documents.SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    if (d is null || !await access.CanEditAsync(d, UserId(p)))
    {
        await audit.WriteAsync(UserId(p), id, "Edit", "Denied", "PermissionDenied", UserEmail(p), d?.Name);
        return Results.NotFound();
    }
    if (d.Status != "Clean")
    {
        await audit.WriteAsync(UserId(p), id, "Edit", "Denied", $"DocumentNotClean:{d.Status}", UserEmail(p), d.Name);
        return Results.Conflict(new { message = "Cannot edit a document that has not passed malware scanning." });
    }
    if (!string.IsNullOrWhiteSpace(req.Name)) d.Name = Path.GetFileName(req.Name.Trim());
    if (req.Category is not null) d.Category = req.Category.Trim();
    if (req.Description is not null) d.Description = req.Description.Trim();
    if (req.Tags is not null) d.Tags = req.Tags.Trim();
    if (req.FolderId.HasValue) d.FolderId = req.FolderId;
    d.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    await audit.WriteAsync(UserId(p), id, "Edit", "Success", $"Updated metadata ({d.Name})", UserEmail(p), d.Name);
    return Results.NoContent();
});

auth.MapDelete("/documents/{id:guid}", async (Guid id, ClaimsPrincipal p, TrustVaultDb db, PrivateFileStore store, IAuditWriter audit) =>
{
    var d = await db.Documents.SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    if (d is null || d.OwnerId != UserId(p))
    {
        await audit.WriteAsync(UserId(p), id, "Delete", "Denied", "OwnerOnly", UserEmail(p), d?.Name);
        return Results.NotFound();
    }
    d.IsDeleted = true;
    d.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    await audit.WriteAsync(UserId(p), id, "Delete", "Success", null, UserEmail(p), d.Name);
    return Results.NoContent();
});

auth.MapPost("/documents/{id:guid}/permissions", async (Guid id, GrantPermissionRequest req, ClaimsPrincipal p,
    TrustVaultDb db, IAuditWriter audit) =>
{
    var d = await db.Documents.SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    if (d is null || d.OwnerId != UserId(p))
    {
        await audit.WriteAsync(UserId(p), id, "GrantPermission", "Denied", "OwnerOnly", UserEmail(p), d?.Name);
        return Results.NotFound();
    }
    var target = await db.Users.SingleOrDefaultAsync(u => u.Email == req.Email.Trim().ToLower());
    if (target is null || target.Id == d.OwnerId || !target.IsActive)
        return Results.BadRequest(new { message = "Recipient not found or not eligible." });
    if (req.Access is not ("Read" or "Edit"))
        return Results.BadRequest(new { message = "Access must be Read or Edit." });

    var existing = await db.Permissions.SingleOrDefaultAsync(x => x.DocumentId == id && x.UserId == target.Id);
    if (existing is null)
        db.Permissions.Add(new DocumentPermission { Id = Guid.NewGuid(), DocumentId = id, UserId = target.Id, GrantedById = UserId(p), Access = req.Access, IsActive = true, ExpiresAt = req.ExpiresAt });
    else
    {
        existing.Access = req.Access;
        existing.IsActive = true;
        existing.ExpiresAt = req.ExpiresAt;
        existing.RevokedAt = null;
    }
    db.Notifications.Add(new Notification
    {
        Id = Guid.NewGuid(),
        UserId = target.Id,
        Title = $"Document shared: {d.Name}",
        Message = $"{UserEmail(p)} granted you {req.Access} access to '{d.Name}'.",
        Type = "Info",
        DocumentId = d.Id
    });
    await db.SaveChangesAsync();
    await audit.WriteAsync(UserId(p), id, "GrantPermission", "Success", $"{target.Email}:{req.Access}", UserEmail(p), d.Name);
    return Results.Ok(new { userId = target.Id, recipient = target.Email, access = req.Access, expiresAt = req.ExpiresAt });
});

auth.MapDelete("/documents/{id:guid}/permissions/{userId:guid}", async (Guid id, Guid userId, ClaimsPrincipal p, TrustVaultDb db, IAuditWriter audit) =>
{
    var d = await db.Documents.SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    if (d is null || d.OwnerId != UserId(p))
    {
        await audit.WriteAsync(UserId(p), id, "RevokePermission", "Denied", "OwnerOnly", UserEmail(p), d?.Name);
        return Results.NotFound();
    }
    var grant = await db.Permissions.Include(x => x.User).SingleOrDefaultAsync(x => x.DocumentId == id && x.UserId == userId);
    if (grant is null) return Results.NotFound();
    grant.IsActive = false;
    grant.RevokedAt = DateTime.UtcNow;
    db.Notifications.Add(new Notification
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Title = $"Access revoked: {d.Name}",
        Message = $"Your access to '{d.Name}' was revoked by the owner.",
        Type = "Warning",
        DocumentId = d.Id
    });
    await db.SaveChangesAsync();
    await audit.WriteAsync(UserId(p), id, "RevokePermission", "Success", grant.User?.Email, UserEmail(p), d.Name);
    return Results.NoContent();
});

auth.MapGet("/documents/{id:guid}/permissions", async (Guid id, ClaimsPrincipal p, TrustVaultDb db, IDocumentAccess access) =>
{
    var d = await db.Documents.SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
    if (d is null || (d.OwnerId != UserId(p) && !await access.CanReadAsync(d, UserId(p)))) return Results.NotFound();
    return Results.Ok(await db.Permissions.Where(x => x.DocumentId == id && x.IsActive)
        .Select(x => new { id = x.User.Id, email = x.User.Email, fullName = x.User.FullName, access = x.Access, expiresAt = x.ExpiresAt, createdAt = x.CreatedAt }).ToListAsync());
});

auth.MapGet("/notifications", async (ClaimsPrincipal p, TrustVaultDb db) =>
{
    var uid = UserId(p);
    var items = await db.Notifications.AsNoTracking().Where(n => n.UserId == uid)
        .OrderByDescending(n => n.CreatedAt).Take(50).ToListAsync();
    return Results.Ok(items);
});

auth.MapPost("/notifications/{id:guid}/read", async (Guid id, ClaimsPrincipal p, TrustVaultDb db) =>
{
    var n = await db.Notifications.SingleOrDefaultAsync(x => x.Id == id && x.UserId == UserId(p));
    if (n is null) return Results.NotFound();
    n.IsRead = true;
    await db.SaveChangesAsync();
    return Results.NoContent();
});

auth.MapGet("/audit", async (ClaimsPrincipal p, TrustVaultDb db) =>
{
    var uid = UserId(p); var role = p.FindFirstValue(ClaimTypes.Role);
    var events = db.AuditEvents.AsNoTracking();
    if (role != "Admin") events = events.Where(a => a.ActorId == uid || (a.DocumentId != null &&
        db.Documents.Any(d => d.Id == a.DocumentId && (d.OwnerId == uid || d.Permissions.Any(x => x.UserId == uid && x.IsActive)))));
    return Results.Ok(await events.OrderByDescending(a => a.CreatedAt).Take(500)
        .Select(a => new { a.Id, a.CorrelationId, a.ActorId, a.ActorEmail, a.DocumentId, a.DocumentName, a.Action, a.Result, a.Reason, a.CreatedAt, a.PreviousHash, a.EntryHash }).ToListAsync());
});

app.Run();

static Guid UserId(ClaimsPrincipal p) => Guid.Parse(p.FindFirstValue(ClaimTypes.NameIdentifier)!);
static string UserEmail(ClaimsPrincipal p) => p.FindFirstValue(ClaimTypes.Email) ?? "";
static bool ValidEmail(string email) => email.Contains('@') && email.Length <= 254;

public record LoginRequest(string Email, string Password);
public record BootstrapRequest(string Email, string Password);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record UpdateProfileRequest(string? FullName, string? Department);
public record CreateUserRequest(string Email, string TemporaryPassword, string Role, string? FullName = null, string? Department = null);
public record UpdateUserStatusRequest(bool IsActive);
public record UpdateUserRoleRequest(string Role);
public record CreateFolderRequest(string Name, string? Description = null);
public record GrantPermissionRequest(string Email, string Access, DateTime? ExpiresAt = null);
public record UpdateDocumentRequest(string? Name, string? Category, string? Description = null, string? Tags = null, Guid? FolderId = null);
public record DocumentDto(
    Guid Id, string Name, string Description, string Category, string Tags,
    Guid? FolderId, string? FolderName, string OwnerEmail, long Size, string ContentType,
    string Status, string? ScanFailureReason, int CurrentVersion,
    DateTime CreatedAt, DateTime UpdatedAt, bool IsOwner, string AccessLevel, bool CanRead, bool CanEdit
);
