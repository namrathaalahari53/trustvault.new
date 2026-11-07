-- TrustVault Corporate — PostgreSQL 16 Relational Schema & Append-Only Audit Policy

CREATE TABLE IF NOT EXISTS "Users" (
    "Id" UUID PRIMARY KEY,
    "Email" VARCHAR(254) NOT NULL UNIQUE,
    "FullName" VARCHAR(160) NOT NULL DEFAULT '',
    "Department" VARCHAR(120) NOT NULL DEFAULT 'General',
    "PasswordHash" TEXT NOT NULL,
    "Role" VARCHAR(32) NOT NULL DEFAULT 'Viewer' CHECK ("Role" IN ('Admin', 'Owner', 'Viewer')),
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "MustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE,
    "FailedLoginAttempts" INT NOT NULL DEFAULT 0,
    "LockedUntil" TIMESTAMPTZ NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "LastLoginAt" TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS "Folders" (
    "Id" UUID PRIMARY KEY,
    "Name" VARCHAR(200) NOT NULL,
    "Description" TEXT NOT NULL DEFAULT '',
    "OwnerId" UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "ParentFolderId" UUID NULL REFERENCES "Folders"("Id") ON DELETE SET NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Documents" (
    "Id" UUID PRIMARY KEY,
    "OwnerId" UUID NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    "FolderId" UUID NULL REFERENCES "Folders"("Id") ON DELETE SET NULL,
    "Name" VARCHAR(255) NOT NULL,
    "Description" TEXT NOT NULL DEFAULT '',
    "Category" VARCHAR(100) NOT NULL DEFAULT 'General',
    "Tags" VARCHAR(500) NOT NULL DEFAULT '',
    "StorageKey" CHAR(32) NOT NULL UNIQUE,
    "ContentType" VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
    "Size" BIGINT NOT NULL CHECK ("Size" > 0 AND "Size" <= 20971520),
    "Sha256Hash" CHAR(64) NOT NULL,
    "Status" VARCHAR(32) NOT NULL DEFAULT 'Pending' CHECK ("Status" IN ('Pending', 'Scanning', 'Clean', 'Rejected', 'ScanFailed')),
    "ScanFailureReason" TEXT NULL,
    "ScannedAt" TIMESTAMPTZ NULL,
    "CurrentVersion" INT NOT NULL DEFAULT 1,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "DocumentVersions" (
    "Id" UUID PRIMARY KEY,
    "DocumentId" UUID NOT NULL REFERENCES "Documents"("Id") ON DELETE CASCADE,
    "VersionNumber" INT NOT NULL,
    "StorageKey" CHAR(32) NOT NULL,
    "Size" BIGINT NOT NULL,
    "Sha256Hash" CHAR(64) NOT NULL,
    "UploadedById" UUID NOT NULL REFERENCES "Users"("Id"),
    "ChangeNote" TEXT NOT NULL DEFAULT '',
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("DocumentId", "VersionNumber")
);

CREATE TABLE IF NOT EXISTS "Permissions" (
    "Id" UUID PRIMARY KEY,
    "DocumentId" UUID NOT NULL REFERENCES "Documents"("Id") ON DELETE CASCADE,
    "UserId" UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "GrantedById" UUID NULL REFERENCES "Users"("Id"),
    "Access" VARCHAR(16) NOT NULL CHECK ("Access" IN ('Read', 'Edit')),
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "ExpiresAt" TIMESTAMPTZ NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "RevokedAt" TIMESTAMPTZ NULL,
    UNIQUE ("DocumentId", "UserId")
);

CREATE TABLE IF NOT EXISTS "ProcessingJobs" (
    "Id" UUID PRIMARY KEY,
    "DocumentId" UUID NOT NULL REFERENCES "Documents"("Id") ON DELETE CASCADE,
    "JobType" VARCHAR(32) NOT NULL DEFAULT 'MalwareScan',
    "Status" VARCHAR(32) NOT NULL DEFAULT 'Completed',
    "Attempts" INT NOT NULL DEFAULT 1,
    "DiagnosticMessage" TEXT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "CompletedAt" TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS "Notifications" (
    "Id" UUID PRIMARY KEY,
    "UserId" UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "Title" VARCHAR(200) NOT NULL,
    "Message" TEXT NOT NULL,
    "Type" VARCHAR(32) NOT NULL DEFAULT 'Info',
    "DocumentId" UUID NULL REFERENCES "Documents"("Id") ON DELETE SET NULL,
    "IsRead" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AuditEvents" (
    "Id" BIGSERIAL PRIMARY KEY,
    "CorrelationId" VARCHAR(32) NOT NULL,
    "ActorId" UUID NOT NULL,
    "ActorEmail" VARCHAR(254) NOT NULL DEFAULT '',
    "DocumentId" UUID NULL,
    "DocumentName" VARCHAR(255) NULL,
    "Action" VARCHAR(64) NOT NULL,
    "Result" VARCHAR(32) NOT NULL CHECK ("Result" IN ('Success', 'Denied', 'Failed')),
    "Reason" TEXT NULL,
    "IpAddress" VARCHAR(64) NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "PreviousHash" VARCHAR(64) NOT NULL,
    "EntryHash" VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IX_AuditEvents_CreatedAt" ON "AuditEvents" ("CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS "IX_Permissions_Doc_User" ON "Permissions" ("DocumentId", "UserId") WHERE "IsActive" = TRUE;

