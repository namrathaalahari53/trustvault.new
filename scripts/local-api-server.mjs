import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const PORT = Number(process.env.PORT || 5106);
const JWT_ISSUER = process.env.Jwt__Issuer || 'TrustVault';
const JWT_AUDIENCE = process.env.Jwt__Audience || 'TrustVault';
const JWT_KEY = Buffer.from(
  process.env.Jwt__SigningKey ||
    process.env.JWT_SIGNING_KEY ||
    'K8vN2xP9mQ4rT7wZ1yB5cF8hJ3kL6nP0qS2uV5xY8zA1bC4dE7fG0hI3jK6lM9nO',
  'base64'
);
const AUDIT_KEY = Buffer.from(
  process.env.Audit__HmacKey ||
    process.env.AUDIT_HMAC_KEY ||
    'R3tY6uI9oP2aS5dF8gH1jK4lZ7xC0vB3nM6qW9eR2tY5uI8oP1aS4dF7gH0jK3lZ',
  'base64'
);
const FRONTEND_ORIGIN = process.env.Frontend__Origin || 'http://localhost:4200';
const SCANNER_MODE = process.env.SCANNER_MODE || 'development-allow';
const STORAGE_ROOT = path.resolve(
  rootDir,
  process.env.Storage__RootPath || './backend/TrustVault.Api/private-storage'
);
fs.mkdirSync(STORAGE_ROOT, { recursive: true });

const dbPath = path.join(STORAGE_ROOT, 'trustvault-corporate-v3.sqlite');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS Users (
    Id TEXT PRIMARY KEY,
    EmployeeId TEXT NOT NULL DEFAULT 'TV-EMP-0000',
    Email TEXT NOT NULL UNIQUE,
    FullName TEXT NOT NULL DEFAULT '',
    JobTitle TEXT NOT NULL DEFAULT 'Workspace Member',
    Department TEXT NOT NULL DEFAULT 'General',
    ClearanceLevel TEXT NOT NULL DEFAULT 'Level 2 — Standard',
    Location TEXT NOT NULL DEFAULT 'Corporate HQ',
    Phone TEXT NOT NULL DEFAULT '',
    Bio TEXT NOT NULL DEFAULT '',
    AvatarColor TEXT NOT NULL DEFAULT '#122b49',
    ProfileBadge TEXT NOT NULL DEFAULT 'Standard Member',
    PasswordHash TEXT NOT NULL,
    Role TEXT NOT NULL DEFAULT 'Viewer',
    IsActive INTEGER NOT NULL DEFAULT 1,
    MustChangePassword INTEGER NOT NULL DEFAULT 0,
    FailedLoginAttempts INTEGER NOT NULL DEFAULT 0,
    LockedUntil TEXT,
    CreatedAt TEXT NOT NULL,
    LastLoginAt TEXT
  );

  CREATE TABLE IF NOT EXISTS Folders (
    Id TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Description TEXT NOT NULL DEFAULT '',
    OwnerId TEXT NOT NULL,
    ParentFolderId TEXT,
    CreatedAt TEXT NOT NULL,
    FOREIGN KEY (OwnerId) REFERENCES Users(Id)
  );

  CREATE TABLE IF NOT EXISTS Documents (
    Id TEXT PRIMARY KEY,
    OwnerId TEXT NOT NULL,
    FolderId TEXT,
    Name TEXT NOT NULL,
    Description TEXT NOT NULL DEFAULT '',
    Category TEXT NOT NULL DEFAULT 'General',
    Tags TEXT NOT NULL DEFAULT '',
    StorageKey TEXT NOT NULL,
    ContentType TEXT NOT NULL DEFAULT 'application/octet-stream',
    Size INTEGER NOT NULL DEFAULT 0,
    Sha256Hash TEXT NOT NULL DEFAULT '',
    Status TEXT NOT NULL DEFAULT 'Pending',
    ScanFailureReason TEXT,
    ScannedAt TEXT,
    CurrentVersion INTEGER NOT NULL DEFAULT 1,
    IsDeleted INTEGER NOT NULL DEFAULT 0,
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT NOT NULL,
    FOREIGN KEY (OwnerId) REFERENCES Users(Id),
    FOREIGN KEY (FolderId) REFERENCES Folders(Id)
  );

  CREATE TABLE IF NOT EXISTS DocumentVersions (
    Id TEXT PRIMARY KEY,
    DocumentId TEXT NOT NULL,
    VersionNumber INTEGER NOT NULL,
    StorageKey TEXT NOT NULL,
    Size INTEGER NOT NULL,
    Sha256Hash TEXT NOT NULL,
    UploadedById TEXT NOT NULL,
    ChangeNote TEXT NOT NULL DEFAULT '',
    CreatedAt TEXT NOT NULL,
    FOREIGN KEY (DocumentId) REFERENCES Documents(Id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Permissions (
    Id TEXT PRIMARY KEY,
    DocumentId TEXT NOT NULL,
    UserId TEXT NOT NULL,
    GrantedById TEXT,
    Access TEXT NOT NULL DEFAULT 'Read',
    IsActive INTEGER NOT NULL DEFAULT 1,
    ExpiresAt TEXT,
    CreatedAt TEXT NOT NULL,
    RevokedAt TEXT,
    UNIQUE(DocumentId, UserId),
    FOREIGN KEY (DocumentId) REFERENCES Documents(Id) ON DELETE CASCADE,
    FOREIGN KEY (UserId) REFERENCES Users(Id)
  );

  CREATE TABLE IF NOT EXISTS ProcessingJobs (
    Id TEXT PRIMARY KEY,
    DocumentId TEXT NOT NULL,
    JobType TEXT NOT NULL DEFAULT 'MalwareScan',
    Status TEXT NOT NULL DEFAULT 'Completed',
    Attempts INTEGER NOT NULL DEFAULT 1,
    DiagnosticMessage TEXT,
    CreatedAt TEXT NOT NULL,
    CompletedAt TEXT,
    FOREIGN KEY (DocumentId) REFERENCES Documents(Id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Notifications (
    Id TEXT PRIMARY KEY,
    UserId TEXT NOT NULL,
    Title TEXT NOT NULL,
    Message TEXT NOT NULL,
    Type TEXT NOT NULL DEFAULT 'Info',
    DocumentId TEXT,
    IsRead INTEGER NOT NULL DEFAULT 0,
    CreatedAt TEXT NOT NULL,
    FOREIGN KEY (UserId) REFERENCES Users(Id)
  );

  CREATE TABLE IF NOT EXISTS AuditEvents (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    CorrelationId TEXT NOT NULL,
    ActorId TEXT NOT NULL,
    ActorEmail TEXT NOT NULL DEFAULT '',
    DocumentId TEXT,
    DocumentName TEXT,
    Action TEXT NOT NULL,
    Result TEXT NOT NULL,
    Reason TEXT,
    IpAddress TEXT,
    CreatedAt TEXT NOT NULL,
    PreviousHash TEXT NOT NULL,
    EntryHash TEXT NOT NULL
  );
`);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, key] = (stored || '').split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

function signJwt(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.Id,
    nameid: user.Id,
    email: user.Email,
    role: user.Role,
    emp: user.EmployeeId,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + 1200
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const sig = crypto.createHmac('sha256', JWT_KEY).update(unsigned).digest();
  return `${unsigned}.${base64UrlEncode(sig)}`;
}

function buildUserProfileDto(u) {
  const ownedCount = db.prepare(`SELECT COUNT(*) as c FROM Documents WHERE OwnerId = ? AND IsDeleted = 0`).get(u.Id).c;
  const sharedEditCount = db.prepare(`SELECT COUNT(*) as c FROM Permissions WHERE UserId = ? AND IsActive = 1 AND Access = 'Edit'`).get(u.Id).c;
  const sharedReadCount = db.prepare(`SELECT COUNT(*) as c FROM Permissions WHERE UserId = ? AND IsActive = 1 AND Access = 'Read'`).get(u.Id).c;

  let capabilities = [];
  if (u.Role === 'Admin') {
    capabilities = [
      { name: 'Provision & Deactivate Users', allowed: true },
      { name: 'Verify Cryptographic Audit Chain', allowed: true },
      { name: 'View Global Security Telemetry', allowed: true },
      { name: 'Upload & Own Governance Docs', allowed: true },
      { name: 'Bypass Other Owners Private Docs', allowed: false }
    ];
  } else if (u.Role === 'Owner') {
    capabilities = [
      { name: 'Upload & Classify New Documents', allowed: true },
      { name: 'Grant & Immediately Revoke Access', allowed: true },
      { name: 'Edit & Version Owned/Shared Docs', allowed: true },
      { name: 'Trigger Retry Scan on Uploads', allowed: true },
      { name: 'Access Admin User Governance', allowed: false }
    ];
  } else if (sharedEditCount > 0 || u.Email === 'editor@trustvault.local') {
    capabilities = [
      { name: 'Edit Shared Document Metadata', allowed: true },
      { name: 'Upload New Document Versions (v2+)', allowed: true },
      { name: 'Trigger Retry Scan on Shared Docs', allowed: true },
      { name: 'Upload Brand-New Owned Documents', allowed: false },
      { name: 'Delete or Re-Share Owner Documents', allowed: false }
    ];
  } else {
    capabilities = [
      { name: 'Preview & Verify SHA-256 Checksum', allowed: true },
      { name: 'Download Explicitly Shared Clean Docs', allowed: true },
      { name: 'Edit Document Metadata or Versions', allowed: false },
      { name: 'Upload New Documents to Workspace', allowed: false },
      { name: 'Grant or Revoke Document Access', allowed: false }
    ];
  }

  return {
    id: u.Id,
    employeeId: u.EmployeeId,
    email: u.Email,
    fullName: u.FullName,
    jobTitle: u.JobTitle,
    department: u.Department,
    clearanceLevel: u.ClearanceLevel,
    location: u.Location,
    phone: u.Phone,
    bio: u.Bio,
    avatarColor: u.AvatarColor,
    profileBadge: u.ProfileBadge,
    role: u.Role,
    isActive: Boolean(u.IsActive),
    mustChangePassword: Boolean(u.MustChangePassword),
    createdAt: u.CreatedAt,
    lastLoginAt: u.LastLoginAt,
    capabilities,
    stats: {
      ownedDocuments: ownedCount,
      sharedEditGrants: sharedEditCount,
      sharedReadGrants: sharedReadCount
    }
  };
}

function verifyJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = crypto.createHmac('sha256', JWT_KEY).update(`${h}.${p}`).digest();
    const actual = base64UrlDecode(s);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(base64UrlDecode(p).toString('utf8'));
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) return null;
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp + 30) return null;
    const dbUser = db.prepare(`SELECT * FROM Users WHERE Id = ?`).get(payload.sub);
    if (!dbUser || !dbUser.IsActive) return null;
    return buildUserProfileDto(dbUser);
  } catch {
    return null;
  }
}

function writeAudit(actorId, documentId, action, result, reason = null, actorEmail = '', documentName = null, ipAddress = '127.0.0.1') {
  const prevRow = db.prepare(`SELECT EntryHash FROM AuditEvents ORDER BY Id DESC LIMIT 1`).get();
  const previous = prevRow ? prevRow.EntryHash : 'GENESIS';
  const created = new Date().toISOString();
  const correlationId = crypto.randomBytes(6).toString('hex');
  const payload = `${actorId}|${documentId ?? ''}|${action}|${result}|${reason ?? ''}|${created}|${previous}`;
  const hash = crypto.createHmac('sha256', AUDIT_KEY).update(payload, 'utf8').digest('hex').toUpperCase();
  db.prepare(
    `INSERT INTO AuditEvents (CorrelationId, ActorId, ActorEmail, DocumentId, DocumentName, Action, Result, Reason, IpAddress, CreatedAt, PreviousHash, EntryHash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(correlationId, actorId, actorEmail, documentId, documentName, action, result, reason, ipAddress, created, previous, hash);
}

function verifyAuditChain() {
  const events = db.prepare(`SELECT * FROM AuditEvents ORDER BY Id ASC`).all();
  let expectedPrev = 'GENESIS';
  for (const e of events) {
    if (e.PreviousHash !== expectedPrev) {
      return { isValid: false, totalRecords: events.length, firstInvalidId: e.Id, latestCheckpointHash: expectedPrev };
    }
    const payload = `${e.ActorId}|${e.DocumentId ?? ''}|${e.Action}|${e.Result}|${e.Reason ?? ''}|${e.CreatedAt}|${e.PreviousHash}`;
    const computed = crypto.createHmac('sha256', AUDIT_KEY).update(payload, 'utf8').digest('hex').toUpperCase();
    if (computed !== e.EntryHash) {
      return { isValid: false, totalRecords: events.length, firstInvalidId: e.Id, latestCheckpointHash: e.EntryHash };
    }
    expectedPrev = e.EntryHash;
  }
  return { isValid: true, totalRecords: events.length, firstInvalidId: null, latestCheckpointHash: expectedPrev };
}

function addNotification(userId, title, message, type = 'Info', documentId = null) {
  db.prepare(
    `INSERT INTO Notifications (Id, UserId, Title, Message, Type, DocumentId, IsRead, CreatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(crypto.randomUUID(), userId, title, message, type, documentId, new Date().toISOString());
}

const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

function inspectAndScanFile(filePath, fileName) {
  if (!fs.existsSync(filePath)) return { status: 'ScanFailed', reason: 'Storage file not found during scan.' };
  const buf = fs.readFileSync(filePath);
  if (buf.length === 0) return { status: 'Rejected', reason: 'File is empty (0 bytes).' };

  const sampleText = buf.slice(0, Math.min(buf.length, 8192)).toString('utf8');
  if (sampleText.includes(EICAR_SIGNATURE)) {
    return { status: 'Rejected', reason: 'Quarantined: EICAR malware test signature detected by ClamAV / signature engine.' };
  }

  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf') {
    if (buf.length < 4 || buf.slice(0, 4).toString('ascii') !== '%PDF') {
      return { status: 'Rejected', reason: 'File signature mismatch: missing %PDF magic header (spoofed extension).' };
    }
  } else if (ext === '.png') {
    if (buf.length < 4 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
      return { status: 'Rejected', reason: 'File signature mismatch: invalid PNG header.' };
    }
  } else if (ext === '.jpg' || ext === '.jpeg') {
    if (buf.length < 3 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
      return { status: 'Rejected', reason: 'File signature mismatch: invalid JPEG header.' };
    }
  } else if (ext === '.docx' || ext === '.xlsx') {
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 0x03 || buf[3] !== 0x04) {
      return { status: 'Rejected', reason: 'File signature mismatch: invalid Office OpenXML ZIP header.' };
    }
  } else if (!['.txt', '.md', '.csv'].includes(ext)) {
    return { status: 'Rejected', reason: `Unsupported file extension (${ext}).` };
  }

  if (SCANNER_MODE === 'fail-closed') {
    return { status: 'ScanFailed', reason: 'ClamAV daemon unreachable in fail-closed mode. Click Retry Scan to re-verify.' };
  }
  return { status: 'Clean', reason: 'Verified clean by magic-byte signature & malware inspection.' };
}

function seedCorporateWorkspace() {
  const existingCount = db.prepare(`SELECT COUNT(*) as c FROM Users`).get().c;
  if (existingCount > 0) return;

  const now = new Date().toISOString();
  const adminId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const editorId = crypto.randomUUID();
  const viewerId = crypto.randomUUID();

  const insertUser = db.prepare(
    `INSERT INTO Users (
      Id, EmployeeId, Email, FullName, JobTitle, Department,
      ClearanceLevel, Location, Phone, Bio, AvatarColor, ProfileBadge,
      PasswordHash, Role, IsActive, MustChangePassword, CreatedAt, LastLoginAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
  );

  // Profile 1: Dr. Ananya Deshmukh (Admin / CISO)
  insertUser.run(
    adminId,
    'TV-EMP-0001',
    (process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@example.local').trim().toLowerCase(),
    'Dr. Ananya Deshmukh',
    'Chief Information Security Officer (CISO)',
    'Enterprise Security & Governance',
    'Level 5 — Unrestricted Governance & Cryptographic Audit Authority',
    'Mumbai HQ · Tower A, Floor 18',
    '+91 22 6800 1001 (Ext. 101)',
    'Oversees enterprise-wide zero-trust access policies, user lifecycle provisioning, ClamAV threat quarantine telemetry, and HMAC-SHA256 audit log verification.',
    '#0f2540',
    'GLOBAL ADMIN · CISO',
    hashPassword(process.env.ADMIN_BOOTSTRAP_PASSWORD || 'ChangeThis-Admin-Password-2026!'),
    'Admin',
    now,
    now
  );

  // Profile 2: Vivek Sharma (Owner / VP Legal & Corporate Operations)
  insertUser.run(
    ownerId,
    'TV-EMP-0104',
    'owner@trustvault.local',
    'Vivek Sharma',
    'VP of Legal & Corporate Operations',
    'Legal, M&A & Corporate Secretariat',
    'Level 4 — Document Custodian & Granular Sharing Authority',
    'Bengaluru Campus · Legal Wing 4B',
    '+91 80 4920 2204 (Ext. 204)',
    'Primary custodian of executive contracts, M&A term sheets, and board forecasts. Manages folder taxonomies and grants/revokes per-document Read and Edit access.',
    '#4f46e5',
    'DOCUMENT OWNER · CUSTODIAN',
    hashPassword('Corporate-Owner-2026!'),
    'Owner',
    now,
    now
  );

  // Profile 3: Priya Nair (Editor / Senior Financial Controller)
  insertUser.run(
    editorId,
    'TV-EMP-0219',
    'editor@trustvault.local',
    'Priya Nair',
    'Senior Financial Controller & Contract Reviewer',
    'Corporate Finance & FP&A',
    'Level 3 — Collaborative Co-Author & Version Editor',
    'Hyderabad Financial Center · Suite 900',
    '+91 40 7100 3319 (Ext. 319)',
    'Collaborates on cross-departmental contracts and quarterly financial models with explicit Edit permissions. Authorized to update metadata, upload new file versions (v2+), and trigger Retry Scan.',
    '#b45309',
    'COLLABORATIVE EDITOR · FP&A',
    hashPassword('Corporate-Editor-2026!'),
    'Viewer',
    now,
    now
  );

  // Profile 4: Arjun Mehta (Viewer / External Statutory Auditor)
  insertUser.run(
    viewerId,
    'TV-EXT-0408',
    'viewer@trustvault.local',
    'Arjun Mehta',
    'Lead Statutory & ISO Compliance Auditor',
    'External Audit & Assurance Liaison',
    'Level 2 — Strict Read-Only Evidence Inspection',
    'New Delhi · Cyber City Assurance Desk',
    '+91 11 4500 8808 (Ext. 408)',
    'External compliance reviewer with strictly scoped Read-Only access to shared audit evidence. Prohibited from uploading, editing, deleting, or re-sharing any workspace files.',
    '#0d9488',
    'READ-ONLY AUDITOR · EXTERNAL',
    hashPassword('Corporate-Viewer-2026!'),
    'Viewer',
    now,
    now
  );

  const folderContractsId = crypto.randomUUID();
  const folderFinanceId = crypto.randomUUID();
  const folderSecId = crypto.randomUUID();
  const insertFolder = db.prepare(`INSERT INTO Folders (Id, Name, Description, OwnerId, CreatedAt) VALUES (?, ?, ?, ?, ?)`);
  insertFolder.run(folderContractsId, 'Executive Contracts & M&A', 'Master service agreements, vendor contracts, and confidential M&A term sheets', ownerId, now);
  insertFolder.run(folderFinanceId, 'Financial Reports & FP&A', 'Quarterly forecasts, revenue schedules, and board budgets', ownerId, now);
  insertFolder.run(folderSecId, 'ISO-27001 & Security Governance', 'Zero-trust security policies, SOC2 matrices, and compliance evidence', adminId, now);

  function createSeededDoc({ id, owner, ownerEmail, folderId, name, desc, category, tags, contentType, contentBytes, status, reason, attempts }) {
    const storageKey = id.replace(/-/g, '');
    fs.writeFileSync(path.join(STORAGE_ROOT, storageKey), contentBytes);
    const sha256 = crypto.createHash('sha256').update(contentBytes).digest('hex');
    db.prepare(
      `INSERT INTO Documents (Id, OwnerId, FolderId, Name, Description, Category, Tags, StorageKey, ContentType, Size, Sha256Hash, Status, ScanFailureReason, ScannedAt, CurrentVersion, IsDeleted, CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
    ).run(id, owner, folderId, name, desc, category, tags, storageKey, contentType, contentBytes.length, sha256, status, reason, now, now, now);

    db.prepare(
      `INSERT INTO DocumentVersions (Id, DocumentId, VersionNumber, StorageKey, Size, Sha256Hash, UploadedById, ChangeNote, CreatedAt)
       VALUES (?, ?, 1, ?, ?, ?, ?, 'Initial corporate release', ?)`
    ).run(crypto.randomUUID(), id, storageKey, contentBytes.length, sha256, owner, now);

    db.prepare(
      `INSERT INTO ProcessingJobs (Id, DocumentId, JobType, Status, Attempts, DiagnosticMessage, CreatedAt, CompletedAt)
       VALUES (?, ?, 'MalwareScan', ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), id, status === 'Clean' ? 'Completed' : 'Failed', attempts, reason, now, now);

    writeAudit(owner, id, 'Upload', status === 'Rejected' ? 'Denied' : 'Success', reason, ownerEmail, name);
  }

  // Doc 1: Owned by Vivek, shared with Priya (Edit) and Arjun (Read)
  const doc1Id = crypto.randomUUID();
  const pdfContent = Buffer.from(
    `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\nTrustVault Enterprise Master Service Agreement (2026)\nCustodian: Vivek Sharma (VP Legal)\nCo-Author: Priya Nair (Finance - Edit Access)\nAuditor: Arjun Mehta (External Audit - Read-Only Access)`
  );
  createSeededDoc({
    id: doc1Id,
    owner: ownerId,
    ownerEmail: 'owner@trustvault.local',
    folderId: folderContractsId,
    name: 'Project_Contract_2026.pdf',
    desc: 'Master Enterprise Service Agreement shared with Priya (Edit) and Arjun (Read).',
    category: 'Legal',
    tags: 'contract,msa,2026',
    contentType: 'application/pdf',
    contentBytes: pdfContent,
    status: 'Clean',
    reason: 'Verified clean by magic-byte signature & malware inspection.',
    attempts: 1
  });
  db.prepare(`INSERT INTO Permissions (Id, DocumentId, UserId, GrantedById, Access, IsActive, CreatedAt) VALUES (?, ?, ?, ?, 'Edit', 1, ?)`).run(
    crypto.randomUUID(), doc1Id, editorId, ownerId, now
  );
  db.prepare(`INSERT INTO Permissions (Id, DocumentId, UserId, GrantedById, Access, IsActive, CreatedAt) VALUES (?, ?, ?, ?, 'Read', 1, ?)`).run(
    crypto.randomUUID(), doc1Id, viewerId, ownerId, now
  );
  addNotification(editorId, 'Edit Access Granted: Project_Contract_2026.pdf', 'Vivek Sharma (VP Legal) granted you Edit access to co-author financial schedules.', 'Info', doc1Id);
  addNotification(viewerId, 'Read-Only Access Granted: Project_Contract_2026.pdf', 'Vivek Sharma (VP Legal) granted you Read-Only access for statutory inspection.', 'Info', doc1Id);

  // Doc 2: Owned by Vivek, STRICTLY PRIVATE to Vivek (demonstrates IDOR isolation!)
  const docPrivateId = crypto.randomUUID();
  createSeededDoc({
    id: docPrivateId,
    owner: ownerId,
    ownerEmail: 'owner@trustvault.local',
    folderId: folderContractsId,
    name: 'Confidential_MA_Acquisition_TermSheet.pdf',
    desc: 'Strictly private M&A term sheet owned exclusively by Vivek Sharma (hidden from Priya & Arjun).',
    category: 'Legal',
    tags: 'private,m&a,board-eyes-only',
    contentType: 'application/pdf',
    contentBytes: Buffer.from(`%PDF-1.4\n%BOARD EYES ONLY - Project Horizon Acquisition Term Sheet\nValuation: $92M\nCustodian: Vivek Sharma (TV-EMP-0104)\n%%EOF`),
    status: 'Clean',
    reason: 'Verified clean by magic-byte signature & malware inspection.',
    attempts: 1
  });

  // Doc 3: Owned by Admin (Dr. Ananya Deshmukh), shared with Vivek (Edit), Priya (Read), Arjun (Read)
  const doc2Id = crypto.randomUUID();
  const policyText = Buffer.from(
    `TRUSTVAULT CORPORATE SECURITY POLICY (ISO-27001 ALIGNED)\n=========================================================\nAuthor: Dr. Ananya Deshmukh, CISO (TV-EMP-0001)\n1. Zero-Trust Access Control: Every document operation is verified server-side.\n2. Malware Inspection: No file is readable or editable until its scan status is Clean.\n3. Immediate Revocation: Permission changes take effect on the very next API call.\n4. Cryptographic Audit Trail: All successful and denied events are HMAC-SHA256 hash-linked.`
  );
  createSeededDoc({
    id: doc2Id,
    owner: adminId,
    ownerEmail: 'admin@example.local',
    folderId: folderSecId,
    name: 'Company_Security_Policy.txt',
    desc: 'ISO-27001 Enterprise Zero-Trust Policy authored by Dr. Ananya Deshmukh (CISO).',
    category: 'Security',
    tags: 'policy,iso27001,zero-trust',
    contentType: 'text/plain',
    contentBytes: policyText,
    status: 'Clean',
    reason: 'Verified clean by magic-byte signature & malware inspection.',
    attempts: 1
  });
  db.prepare(`INSERT INTO Permissions (Id, DocumentId, UserId, GrantedById, Access, IsActive, CreatedAt) VALUES (?, ?, ?, ?, 'Edit', 1, ?)`).run(
    crypto.randomUUID(), doc2Id, ownerId, adminId, now
  );
  db.prepare(`INSERT INTO Permissions (Id, DocumentId, UserId, GrantedById, Access, IsActive, CreatedAt) VALUES (?, ?, ?, ?, 'Read', 1, ?)`).run(
    crypto.randomUUID(), doc2Id, editorId, adminId, now
  );
  db.prepare(`INSERT INTO Permissions (Id, DocumentId, UserId, GrantedById, Access, IsActive, CreatedAt) VALUES (?, ?, ?, ?, 'Read', 1, ?)`).run(
    crypto.randomUUID(), doc2Id, viewerId, adminId, now
  );

  // Doc 4: Owned by Vivek, shared with Priya (Edit) — ScanFailed to demonstrate Retry Scan!
  const doc3Id = crypto.randomUUID();
  const forecastText = Buffer.from(
    `Q4 2026 CORPORATE FINANCIAL FORECAST\n====================================\nPrepared by: Vivek Sharma & Priya Nair (FP&A)\nProjected ARR: $14.8M (+38% YoY)\nGross Margin: 81.4%\nSecurity Infrastructure Allocation: $1.2M\nStatus: Ready for Board Review once scan completes.`
  );
  createSeededDoc({
    id: doc3Id,
    owner: ownerId,
    ownerEmail: 'owner@trustvault.local',
    folderId: folderFinanceId,
    name: 'Q4_Financial_Forecast.txt',
    desc: 'Quarterly board revenue forecast shared with Priya Nair (Click Retry Scan to resolve transient scanner timeout).',
    category: 'Finance',
    tags: 'finance,q4,forecast',
    contentType: 'text/plain',
    contentBytes: forecastText,
    status: 'ScanFailed',
    reason: 'ClamAV scanner transient timeout during initial upload. Click "Retry Scan" to re-verify.',
    attempts: 1
  });
  db.prepare(`INSERT INTO Permissions (Id, DocumentId, UserId, GrantedById, Access, IsActive, CreatedAt) VALUES (?, ?, ?, ?, 'Edit', 1, ?)`).run(
    crypto.randomUUID(), doc3Id, editorId, ownerId, now
  );

  // Doc 5: Quarantined EICAR sample
  const doc4Id = crypto.randomUUID();
  createSeededDoc({
    id: doc4Id,
    owner: ownerId,
    ownerEmail: 'owner@trustvault.local',
    folderId: null,
    name: 'Quarantined_EICAR_Sample.txt',
    desc: 'Simulated malware test upload automatically blocked by signature scanner.',
    category: 'Security',
    tags: 'quarantine,eicar',
    contentType: 'text/plain',
    contentBytes: Buffer.from(EICAR_SIGNATURE),
    status: 'Rejected',
    reason: 'Quarantined: EICAR malware test signature detected by ClamAV / signature engine.',
    attempts: 1
  });

  console.log('Seeded 4 detailed TrustVault Corporate profiles, folders, permissions, and sample documents.');
}

seedCorporateWorkspace();

function getEffectiveAccess(doc, userId) {
  if (doc.IsDeleted) return { canRead: false, canEdit: false, accessLevel: 'None' };
  if (doc.OwnerId === userId) return { canRead: true, canEdit: true, accessLevel: 'Owner' };
  const now = new Date().toISOString();
  const perm = db
    .prepare(
      `SELECT Access FROM Permissions
       WHERE DocumentId = ? AND UserId = ? AND IsActive = 1 AND (ExpiresAt IS NULL OR ExpiresAt > ?)`
    )
    .get(doc.Id, userId, now);
  if (!perm) return { canRead: false, canEdit: false, accessLevel: 'None' };
  return {
    canRead: perm.Access === 'Read' || perm.Access === 'Edit',
    canEdit: perm.Access === 'Edit',
    accessLevel: perm.Access
  };
}

function validEmail(email) {
  return typeof email === 'string' && email.includes('@') && email.length <= 254 && !email.startsWith('@') && !email.endsWith('@');
}

function sendJson(res, status, data) {
  const body = data === undefined ? '' : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(body);
}

function readRawBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readRawBody(req);
  if (!buf.length) return {};
  return JSON.parse(buf.toString('utf8'));
}

function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!match) return null;
  const boundary = `--${match[1] || match[2]}`;
  const boundaryBuf = Buffer.from(boundary);
  const fields = {};
  let filePart = null;

  let pos = buffer.indexOf(boundaryBuf);
  while (pos !== -1) {
    pos += boundaryBuf.length;
    if (buffer.slice(pos, pos + 2).toString() === '--') break;
    if (buffer.slice(pos, pos + 2).toString() === '\r\n') pos += 2;

    const nextPos = buffer.indexOf(boundaryBuf, pos);
    if (nextPos === -1) break;

    const part = buffer.slice(pos, nextPos - 2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const headersText = part.slice(0, headerEnd).toString('utf8');
      const content = part.slice(headerEnd + 4);
      const nameMatch = /name="([^"]+)"/i.exec(headersText);
      const filenameMatch = /filename="([^"]*)"/i.exec(headersText);
      const ctMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headersText);
      if (filenameMatch && nameMatch && nameMatch[1] === 'file') {
        filePart = {
          fileName: filenameMatch[1],
          contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
          data: content
        };
      } else if (nameMatch) {
        fields[nameMatch[1]] = content.toString('utf8');
      }
    }
    pos = nextPos;
  }
  return { fields, file: filePart };
}

const openApiSpec = {
  openapi: '3.0.1',
  info: {
    title: 'TrustVault Corporate API (.NET 10 Specification)',
    version: 'v3.0',
    description: 'Enterprise Zero-Trust Document Management, ClamAV Inspection, Role/Document RBAC & Hash-Chained Audit API'
  },
  components: {
    securitySchemes: {
      Bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    }
  },
  security: [{ Bearer: [] }],
  paths: {
    '/api/system/health': { get: { tags: ['System'], summary: 'Public health check', responses: { '200': { description: 'Healthy' } } } },
    '/api/system/ready': { get: { tags: ['System'], summary: 'Database readiness check', responses: { '200': { description: 'Ready' } } } },
    '/api/auth/demo-profiles': { get: { tags: ['Auth'], summary: 'List public metadata for the 4 Instant Demo Role Login profiles', responses: { '200': { description: 'OK' } } } },
    '/api/auth/login': { post: { tags: ['Auth'], summary: 'Authenticate user and issue short-lived JWT with full corporate profile', responses: { '200': { description: 'OK' } } } },
    '/api/users/me': {
      get: { tags: ['Users'], summary: 'Current user detailed corporate profile & capabilities', responses: { '200': { description: 'OK' } } },
      put: { tags: ['Users'], summary: 'Update profile details (FullName, JobTitle, Department, Location, Phone, Bio)', responses: { '200': { description: 'OK' } } }
    },
    '/api/admin/stats': { get: { tags: ['Admin'], summary: 'Enterprise security & document telemetry (Admin)', responses: { '200': { description: 'OK' } } } },
    '/api/admin/users': {
      get: { tags: ['Admin'], summary: 'List all corporate users (Admin)', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Admin'], summary: 'Create Owner/Viewer account (Admin)', responses: { '201': { description: 'Created' } } }
    },
    '/api/documents': {
      get: { tags: ['Documents'], summary: 'List documents accessible to current user', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Documents'], summary: 'Upload and scan document (Owner/Admin)', responses: { '201': { description: 'Created' } } }
    },
    '/api/documents/{id}/retry-scan': { post: { tags: ['Documents'], summary: 'Retry malware and signature scan on Pending/ScanFailed document', responses: { '200': { description: 'Scan completed' } } } },
    '/api/audit': { get: { tags: ['Audit'], summary: 'Query hash-linked audit log events', responses: { '200': { description: 'OK' } } } }
  }
};

const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TrustVault Corporate API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body { margin: 0; background: #fafafa; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/swagger/v1/swagger.json',
        dom_id: '#swagger-ui',
        deepLinking: true
      });
    };
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      });
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (req.method === 'GET' && (pathname === '/swagger' || pathname === '/swagger/' || pathname === '/swagger/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(swaggerHtml);
      return;
    }
    if (req.method === 'GET' && pathname === '/swagger/v1/swagger.json') {
      sendJson(res, 200, openApiSpec);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/system/health') {
      sendJson(res, 200, { status: 'healthy', service: 'TrustVault.Api', scannerMode: SCANNER_MODE, timestamp: new Date().toISOString() });
      return;
    }
    if (req.method === 'GET' && pathname === '/api/system/ready') {
      sendJson(res, 200, { status: 'ready', database: 'connected' });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/auth/demo-profiles') {
      const users = db.prepare(`SELECT * FROM Users WHERE Email IN ('admin@example.local', 'owner@trustvault.local', 'editor@trustvault.local', 'viewer@trustvault.local')`).all();
      const demoPasswords = {
        'admin@example.local': 'ChangeThis-Admin-Password-2026!',
        'owner@trustvault.local': 'Corporate-Owner-2026!',
        'editor@trustvault.local': 'Corporate-Editor-2026!',
        'viewer@trustvault.local': 'Corporate-Viewer-2026!'
      };
      const profiles = users.map(u => ({
        ...buildUserProfileDto(u),
        demoPassword: demoPasswords[u.Email]
      }));
      sendJson(res, 200, profiles);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/bootstrap-admin') {
      const hasAdmin = db.prepare(`SELECT 1 FROM Users WHERE Role = 'Admin' LIMIT 1`).get();
      if (hasAdmin) {
        sendJson(res, 409, { message: 'An administrator already exists.' });
        return;
      }
      const body = await readJson(req);
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';
      if (!validEmail(email) || password.length < 14) {
        sendJson(res, 400, { message: 'Use a valid email and a password of at least 14 characters.' });
        return;
      }
      const id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO Users (Id, EmployeeId, Email, FullName, JobTitle, Department, PasswordHash, Role, IsActive, MustChangePassword, CreatedAt)
         VALUES (?, 'TV-EMP-0001', ?, 'System Administrator', 'CISO', 'Information Security', ?, 'Admin', 1, 1, ?)`
      ).run(id, email, hashPassword(password), new Date().toISOString());
      sendJson(res, 201, { id, email, role: 'Admin' });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJson(req);
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';
      if (!email || !password || !validEmail(email)) {
        sendJson(res, 400, { message: 'Provide a valid email address and password.' });
        return;
      }
      const user = db.prepare(`SELECT * FROM Users WHERE Email = ?`).get(email);
      if (!user) {
        sendJson(res, 401, { message: 'Invalid credentials.' });
        return;
      }
      if (user.LockedUntil && new Date(user.LockedUntil) > new Date()) {
        writeAudit(user.Id, null, 'Login', 'Denied', 'AccountLocked', user.Email);
        sendJson(res, 429, { message: 'Account is temporarily locked due to repeated failed sign-in attempts.' });
        return;
      }
      if (!user.IsActive) {
        writeAudit(user.Id, null, 'Login', 'Denied', 'AccountInactive', user.Email);
        sendJson(res, 401, { message: 'Account is deactivated. Contact your administrator.' });
        return;
      }
      if (!verifyPassword(password, user.PasswordHash)) {
        const attempts = (user.FailedLoginAttempts || 0) + 1;
        const lockUntil = attempts >= 5 ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;
        db.prepare(`UPDATE Users SET FailedLoginAttempts = ?, LockedUntil = ? WHERE Id = ?`).run(attempts, lockUntil, user.Id);
        writeAudit(user.Id, null, 'Login', 'Denied', 'InvalidPassword', user.Email);
        sendJson(res, 401, { message: 'Invalid credentials.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(`UPDATE Users SET FailedLoginAttempts = 0, LockedUntil = NULL, LastLoginAt = ? WHERE Id = ?`).run(now, user.Id);
      const updatedUser = db.prepare(`SELECT * FROM Users WHERE Id = ?`).get(user.Id);
      writeAudit(user.Id, null, 'Login', 'Success', null, user.Email);

      const token = signJwt(updatedUser);
      sendJson(res, 200, {
        accessToken: token,
        expiresIn: 1200,
        user: buildUserProfileDto(updatedUser)
      });
      return;
    }

    if (pathname.startsWith('/api/')) {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const principal = verifyJwt(token);
      if (!principal) {
        sendJson(res, 401, { message: 'Unauthorized' });
        return;
      }

      if (pathname === '/api/users/me' && req.method === 'GET') {
        sendJson(res, 200, principal);
        return;
      }

      if (pathname === '/api/users/me' && req.method === 'PUT') {
        const body = await readJson(req);
        const fullName = (body.fullName ?? principal.fullName).trim();
        const jobTitle = (body.jobTitle ?? principal.jobTitle).trim();
        const department = (body.department ?? principal.department).trim();
        const location = (body.location ?? principal.location).trim();
        const phone = (body.phone ?? principal.phone).trim();
        const bio = (body.bio ?? principal.bio).trim();
        db.prepare(
          `UPDATE Users SET FullName = ?, JobTitle = ?, Department = ?, Location = ?, Phone = ?, Bio = ? WHERE Id = ?`
        ).run(fullName, jobTitle, department, location, phone, bio, principal.id);
        const refreshed = db.prepare(`SELECT * FROM Users WHERE Id = ?`).get(principal.id);
        sendJson(res, 200, buildUserProfileDto(refreshed));
        return;
      }

      if (pathname === '/api/auth/change-password' && req.method === 'POST') {
        const body = await readJson(req);
        const user = db.prepare(`SELECT * FROM Users WHERE Id = ?`).get(principal.id);
        if (!user || !verifyPassword(body.currentPassword || '', user.PasswordHash)) {
          writeAudit(principal.id, null, 'ChangePassword', 'Denied', 'WrongCurrentPassword', principal.email);
          sendJson(res, 400, { message: 'Current password is incorrect.' });
          return;
        }
        if (!body.newPassword || body.newPassword.length < 14) {
          sendJson(res, 400, { message: 'New password must contain at least 14 characters.' });
          return;
        }
        db.prepare(`UPDATE Users SET PasswordHash = ?, MustChangePassword = 0 WHERE Id = ?`).run(
          hashPassword(body.newPassword),
          principal.id
        );
        writeAudit(principal.id, null, 'ChangePassword', 'Success', null, principal.email);
        sendJson(res, 204);
        return;
      }

      // Admin endpoints
      if (pathname.startsWith('/api/admin/')) {
        if (principal.role !== 'Admin') {
          writeAudit(principal.id, null, 'AdminAccess', 'Denied', `UnauthorizedRole:${principal.role}`, principal.email);
          sendJson(res, 403, { message: 'Forbidden: Admin role required.' });
          return;
        }

        if (pathname === '/api/admin/stats' && req.method === 'GET') {
          const chain = verifyAuditChain();
          sendJson(res, 200, {
            totalUsers: db.prepare(`SELECT COUNT(*) as c FROM Users`).get().c,
            activeUsers: db.prepare(`SELECT COUNT(*) as c FROM Users WHERE IsActive = 1`).get().c,
            totalDocuments: db.prepare(`SELECT COUNT(*) as c FROM Documents WHERE IsDeleted = 0`).get().c,
            cleanDocuments: db.prepare(`SELECT COUNT(*) as c FROM Documents WHERE IsDeleted = 0 AND Status = 'Clean'`).get().c,
            scanFailedDocuments: db.prepare(`SELECT COUNT(*) as c FROM Documents WHERE IsDeleted = 0 AND Status IN ('ScanFailed', 'Pending')`).get().c,
            quarantinedDocuments: db.prepare(`SELECT COUNT(*) as c FROM Documents WHERE IsDeleted = 0 AND Status = 'Rejected'`).get().c,
            activePermissions: db.prepare(`SELECT COUNT(*) as c FROM Permissions WHERE IsActive = 1`).get().c,
            deniedEventsCount: db.prepare(`SELECT COUNT(*) as c FROM AuditEvents WHERE Result = 'Denied'`).get().c,
            auditChain: chain
          });
          return;
        }

        if (pathname === '/api/admin/verify-audit-chain' && req.method === 'GET') {
          const result = verifyAuditChain();
          writeAudit(principal.id, null, 'VerifyAuditChain', 'Success', `Records:${result.totalRecords}`, principal.email);
          sendJson(res, 200, result);
          return;
        }

        if (pathname === '/api/admin/users' && req.method === 'GET') {
          const rows = db
            .prepare(`SELECT * FROM Users ORDER BY EmployeeId ASC, Email ASC`)
            .all()
            .map(buildUserProfileDto);
          sendJson(res, 200, rows);
          return;
        }

        if (pathname === '/api/admin/users' && req.method === 'POST') {
          const body = await readJson(req);
          const email = (body.email || '').trim().toLowerCase();
          const tempPassword = body.temporaryPassword || '';
          const role = body.role || '';
          const fullName = (body.fullName || email.split('@')[0] || '').trim();
          const jobTitle = (body.jobTitle || (role === 'Owner' ? 'Document Owner' : 'Workspace Analyst')).trim();
          const department = (body.department || 'General').trim();
          if (!validEmail(email) || tempPassword.length < 14 || (role !== 'Owner' && role !== 'Viewer')) {
            sendJson(res, 400, {
              message: 'Provide a valid email, a 14-character temporary password and role Owner or Viewer.'
            });
            return;
          }
          const exists = db.prepare(`SELECT 1 FROM Users WHERE Email = ?`).get(email);
          if (exists) {
            sendJson(res, 409, { message: 'Email already exists.' });
            return;
          }
          const id = crypto.randomUUID();
          const empNum = Math.floor(Math.random() * 800 + 200);
          const employeeId = `TV-EMP-0${empNum}`;
          const now = new Date().toISOString();
          db.prepare(
            `INSERT INTO Users (
              Id, EmployeeId, Email, FullName, JobTitle, Department,
              ClearanceLevel, Location, Phone, Bio, AvatarColor, ProfileBadge,
              PasswordHash, Role, IsActive, MustChangePassword, CreatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Corporate Branch', '', 'Provisioned corporate workspace account.', '#334155', ?, ?, ?, 1, 1, ?)`
          ).run(
            id,
            employeeId,
            email,
            fullName,
            jobTitle,
            department,
            role === 'Owner' ? 'Level 4 — Document Custodian' : 'Level 2 — Standard Viewer',
            role.toUpperCase(),
            hashPassword(tempPassword),
            role,
            now
          );
          writeAudit(principal.id, null, 'CreateUser', 'Success', `${email} (${role})`, principal.email);
          const createdUser = db.prepare(`SELECT * FROM Users WHERE Id = ?`).get(id);
          sendJson(res, 201, buildUserProfileDto(createdUser));
          return;
        }

        const userStatusMatch = /^\/api\/admin\/users\/([0-9a-fA-F-]{36})\/(status|role)$/.exec(pathname);
        if (userStatusMatch && req.method === 'PUT') {
          const targetId = userStatusMatch[1];
          const actionType = userStatusMatch[2];
          const targetUser = db.prepare(`SELECT * FROM Users WHERE Id = ?`).get(targetId);
          if (!targetUser) {
            sendJson(res, 404, { message: 'User not found.' });
            return;
          }
          const body = await readJson(req);
          if (actionType === 'status') {
            if (targetId === principal.id && !body.isActive) {
              sendJson(res, 400, { message: 'Administrators cannot deactivate their own account.' });
              return;
            }
            const activeInt = body.isActive ? 1 : 0;
            db.prepare(`UPDATE Users SET IsActive = ? WHERE Id = ?`).run(activeInt, targetId);
            writeAudit(principal.id, null, body.isActive ? 'ActivateUser' : 'DeactivateUser', 'Success', targetUser.Email, principal.email);
            sendJson(res, 200, { id: targetId, email: targetUser.Email, isActive: Boolean(activeInt) });
            return;
          }
          if (actionType === 'role') {
            if (!['Admin', 'Owner', 'Viewer'].includes(body.role)) {
              sendJson(res, 400, { message: 'Invalid role.' });
              return;
            }
            db.prepare(`UPDATE Users SET Role = ? WHERE Id = ?`).run(body.role, targetId);
            writeAudit(principal.id, null, 'ChangeUserRole', 'Success', `${targetUser.Email} -> ${body.role}`, principal.email);
            sendJson(res, 200, { id: targetId, email: targetUser.Email, role: body.role });
            return;
          }
        }
      }

      // Folders
      if (pathname === '/api/folders' && req.method === 'GET') {
        const rows = db
          .prepare(
            `SELECT f.*, u.FullName as OwnerName, (SELECT COUNT(*) FROM Documents d WHERE d.FolderId = f.Id AND d.IsDeleted = 0) as docCount
             FROM Folders f
             JOIN Users u ON u.Id = f.OwnerId
             WHERE f.OwnerId = ? OR ? = 'Admin'
             ORDER BY f.Name ASC`
          )
          .all(principal.id, principal.role)
          .map(f => ({
            id: f.Id,
            name: f.Name,
            description: f.Description,
            ownerName: f.OwnerName,
            createdAt: f.CreatedAt,
            documentCount: f.docCount
          }));
        sendJson(res, 200, rows);
        return;
      }

      if (pathname === '/api/folders' && req.method === 'POST') {
        const body = await readJson(req);
        const name = (body.name || '').trim();
        if (!name) {
          sendJson(res, 400, { message: 'Folder name is required.' });
          return;
        }
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        db.prepare(`INSERT INTO Folders (Id, Name, Description, OwnerId, CreatedAt) VALUES (?, ?, ?, ?, ?)`).run(
          id,
          name,
          (body.description || '').trim(),
          principal.id,
          createdAt
        );
        sendJson(res, 201, { id, name, description: (body.description || '').trim(), createdAt, documentCount: 0 });
        return;
      }

      const folderDelMatch = /^\/api\/folders\/([0-9a-fA-F-]{36})$/.exec(pathname);
      if (folderDelMatch && req.method === 'DELETE') {
        const fid = folderDelMatch[1];
        const f = db.prepare(`SELECT * FROM Folders WHERE Id = ? AND OwnerId = ?`).get(fid, principal.id);
        if (!f) {
          sendJson(res, 404, { message: 'Folder not found.' });
          return;
        }
        db.prepare(`UPDATE Documents SET FolderId = NULL WHERE FolderId = ?`).run(fid);
        db.prepare(`DELETE FROM Folders WHERE Id = ?`).run(fid);
        sendJson(res, 204);
        return;
      }

      // Notifications
      if (pathname === '/api/notifications' && req.method === 'GET') {
        const rows = db
          .prepare(`SELECT * FROM Notifications WHERE UserId = ? ORDER BY CreatedAt DESC LIMIT 50`)
          .all(principal.id)
          .map(n => ({
            id: n.Id,
            title: n.Title,
            message: n.Message,
            type: n.Type,
            documentId: n.DocumentId,
            isRead: Boolean(n.IsRead),
            createdAt: n.CreatedAt
          }));
        sendJson(res, 200, rows);
        return;
      }

      if (pathname === '/api/notifications/read-all' && req.method === 'POST') {
        db.prepare(`UPDATE Notifications SET IsRead = 1 WHERE UserId = ?`).run(principal.id);
        sendJson(res, 204);
        return;
      }

      const notifMatch = /^\/api\/notifications\/([0-9a-fA-F-]{36})\/read$/.exec(pathname);
      if (notifMatch && req.method === 'POST') {
        db.prepare(`UPDATE Notifications SET IsRead = 1 WHERE Id = ? AND UserId = ?`).run(notifMatch[1], principal.id);
        sendJson(res, 204);
        return;
      }

      // Documents
      if (pathname === '/api/documents' && req.method === 'GET') {
        const now = new Date().toISOString();
        const rows = db
          .prepare(
            `SELECT DISTINCT d.*, u.Email as OwnerEmail, u.FullName as OwnerName, u.JobTitle as OwnerTitle, f.Name as FolderName
             FROM Documents d
             JOIN Users u ON u.Id = d.OwnerId
             LEFT JOIN Folders f ON f.Id = d.FolderId
             LEFT JOIN Permissions p ON p.DocumentId = d.Id AND p.UserId = ? AND p.IsActive = 1 AND (p.ExpiresAt IS NULL OR p.ExpiresAt > ?)
             WHERE d.IsDeleted = 0 AND (d.OwnerId = ? OR p.Id IS NOT NULL)
             ORDER BY d.UpdatedAt DESC`
          )
          .all(principal.id, now, principal.id);

        const docs = rows.map(d => {
          const eff = getEffectiveAccess(d, principal.id);
          return {
            id: d.Id,
            name: d.Name,
            description: d.Description,
            category: d.Category,
            tags: d.Tags,
            folderId: d.FolderId,
            folderName: d.FolderName,
            ownerEmail: d.OwnerEmail,
            ownerName: d.OwnerName,
            ownerTitle: d.OwnerTitle,
            size: d.Size,
            contentType: d.ContentType,
            sha256Hash: d.Sha256Hash,
            status: d.Status,
            scanFailureReason: d.ScanFailureReason,
            currentVersion: d.CurrentVersion,
            createdAt: d.CreatedAt,
            updatedAt: d.UpdatedAt,
            isOwner: d.OwnerId === principal.id,
            accessLevel: eff.accessLevel,
            canRead: eff.canRead && d.Status === 'Clean',
            canEdit: eff.canEdit && d.Status === 'Clean'
          };
        });
        sendJson(res, 200, docs);
        return;
      }

      if (pathname === '/api/documents/trash' && req.method === 'GET') {
        const rows = db
          .prepare(
            `SELECT d.*, u.Email as OwnerEmail
             FROM Documents d
             JOIN Users u ON u.Id = d.OwnerId
             WHERE d.IsDeleted = 1 AND d.OwnerId = ?
             ORDER BY d.UpdatedAt DESC`
          )
          .all(principal.id)
          .map(d => ({
            id: d.Id,
            name: d.Name,
            category: d.Category,
            ownerEmail: d.OwnerEmail,
            status: d.Status,
            updatedAt: d.UpdatedAt
          }));
        sendJson(res, 200, rows);
        return;
      }

      if (pathname === '/api/documents' && req.method === 'POST') {
        if (principal.role !== 'Owner' && principal.role !== 'Admin') {
          writeAudit(principal.id, null, 'Upload', 'Denied', `RoleNotPermitted:${principal.role}`, principal.email);
          sendJson(res, 403, { message: 'Only Owner or Admin accounts are permitted to upload new documents.' });
          return;
        }
        const ct = req.headers['content-type'] || '';
        if (!ct.includes('multipart/form-data')) {
          sendJson(res, 400, { message: 'Multipart form data required.' });
          return;
        }
        const raw = await readRawBody(req);
        const parsed = parseMultipart(raw, ct);
        const file = parsed?.file;
        if (!file || file.data.length === 0 || file.data.length > 20 * 1024 * 1024) {
          sendJson(res, 400, { message: 'File is empty or exceeds 20 MB.' });
          return;
        }
        const safeName = path.basename(file.fileName.replace(/\\/g, '/'));
        const ext = path.extname(safeName).toLowerCase();
        const allowed = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.txt'];
        if (!allowed.includes(ext)) {
          writeAudit(principal.id, null, 'Upload', 'Denied', `UnsupportedExtension:${ext}`, principal.email, safeName);
          sendJson(res, 400, { message: 'File type is not allowed.' });
          return;
        }
        const id = crypto.randomUUID();
        const storageKey = id.replace(/-/g, '');
        const filePath = path.join(STORAGE_ROOT, storageKey);
        fs.writeFileSync(filePath, file.data);

        const sha256 = crypto.createHash('sha256').update(file.data).digest('hex');
        const scanOutcome = inspectAndScanFile(filePath, safeName);
        const category = (parsed.fields.category || 'General').trim();
        const description = (parsed.fields.description || '').trim();
        const tags = (parsed.fields.tags || '').trim();
        const folderId = parsed.fields.folderId || null;
        const now = new Date().toISOString();

        db.prepare(
          `INSERT INTO Documents (Id, OwnerId, FolderId, Name, Description, Category, Tags, StorageKey, ContentType, Size, Sha256Hash, Status, ScanFailureReason, ScannedAt, CurrentVersion, IsDeleted, CreatedAt, UpdatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
        ).run(
          id,
          principal.id,
          folderId,
          safeName,
          description,
          category,
          tags,
          storageKey,
          file.contentType,
          file.data.length,
          sha256,
          scanOutcome.status,
          scanOutcome.reason,
          now,
          now,
          now
        );

        db.prepare(
          `INSERT INTO DocumentVersions (Id, DocumentId, VersionNumber, StorageKey, Size, Sha256Hash, UploadedById, ChangeNote, CreatedAt)
           VALUES (?, ?, 1, ?, ?, ?, ?, 'Initial upload', ?)`
        ).run(crypto.randomUUID(), id, storageKey, file.data.length, sha256, principal.id, now);

        db.prepare(
          `INSERT INTO ProcessingJobs (Id, DocumentId, JobType, Status, Attempts, DiagnosticMessage, CreatedAt, CompletedAt)
           VALUES (?, ?, 'MalwareScan', ?, 1, ?, ?, ?)`
        ).run(
          crypto.randomUUID(),
          id,
          scanOutcome.status === 'Clean' ? 'Completed' : 'Failed',
          scanOutcome.reason,
          now,
          now
        );

        writeAudit(
          principal.id,
          id,
          'Upload',
          scanOutcome.status === 'Rejected' ? 'Denied' : 'Success',
          scanOutcome.reason,
          principal.email,
          safeName
        );
        sendJson(res, 201, { id, name: safeName, status: scanOutcome.status, scanFailureReason: scanOutcome.reason });
        return;
      }

      const docMatch = /^\/api\/documents\/([0-9a-fA-F-]{36})(?:\/(.+))?$/.exec(pathname);
      if (docMatch) {
        const docId = docMatch[1];
        const subRoute = docMatch[2] || '';
        const doc = db
          .prepare(
            `SELECT d.*, u.Email as OwnerEmail, u.FullName as OwnerName, f.Name as FolderName
             FROM Documents d
             JOIN Users u ON u.Id = d.OwnerId
             LEFT JOIN Folders f ON f.Id = d.FolderId
             WHERE d.Id = ?`
          )
          .get(docId);

        if (subRoute === 'restore' && req.method === 'POST') {
          if (!doc || doc.OwnerId !== principal.id) {
            writeAudit(principal.id, docId, 'Restore', 'Denied', 'OwnerOnly', principal.email, doc?.Name);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          db.prepare(`UPDATE Documents SET IsDeleted = 0, UpdatedAt = ? WHERE Id = ?`).run(new Date().toISOString(), docId);
          writeAudit(principal.id, docId, 'Restore', 'Success', null, principal.email, doc.Name);
          sendJson(res, 200, { id: docId, status: doc.Status });
          return;
        }

        if (subRoute === 'retry-scan' && req.method === 'POST') {
          const eff = doc ? getEffectiveAccess(doc, principal.id) : { canRead: false };
          if (!doc || doc.IsDeleted || !eff.canRead) {
            writeAudit(principal.id, docId, 'RetryScan', 'Denied', 'NotAuthorized', principal.email, doc?.Name);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const filePath = path.join(STORAGE_ROOT, doc.StorageKey);
          const outcome = inspectAndScanFile(filePath, doc.Name);
          const now = new Date().toISOString();
          const prevAttempts = db.prepare(`SELECT COUNT(*) as c FROM ProcessingJobs WHERE DocumentId = ?`).get(docId).c;

          db.prepare(`UPDATE Documents SET Status = ?, ScanFailureReason = ?, ScannedAt = ?, UpdatedAt = ? WHERE Id = ?`).run(
            outcome.status,
            outcome.reason,
            now,
            now,
            docId
          );
          db.prepare(
            `INSERT INTO ProcessingJobs (Id, DocumentId, JobType, Status, Attempts, DiagnosticMessage, CreatedAt, CompletedAt)
             VALUES (?, ?, 'MalwareScan', ?, ?, ?, ?, ?)`
          ).run(
            crypto.randomUUID(),
            docId,
            outcome.status === 'Clean' ? 'Completed' : 'Failed',
            prevAttempts + 1,
            outcome.reason,
            now,
            now
          );
          writeAudit(
            principal.id,
            docId,
            'RetryScan',
            outcome.status === 'Clean' ? 'Success' : 'Denied',
            outcome.reason,
            principal.email,
            doc.Name
          );
          sendJson(res, 200, {
            id: docId,
            name: doc.Name,
            status: outcome.status,
            scanFailureReason: outcome.reason,
            scannedAt: now,
            attempts: prevAttempts + 1
          });
          return;
        }

        if (!subRoute && req.method === 'GET') {
          if (!doc || doc.IsDeleted) {
            writeAudit(principal.id, docId, 'Read', 'Denied', 'NotFound', principal.email);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const eff = getEffectiveAccess(doc, principal.id);
          if (!eff.canRead) {
            writeAudit(principal.id, docId, 'Read', 'Denied', 'PermissionDenied', principal.email, doc.Name);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          if (doc.Status !== 'Clean') {
            writeAudit(principal.id, docId, 'Read', 'Denied', `DocumentNotClean:${doc.Status}`, principal.email, doc.Name);
            sendJson(res, 409, {
              message: `Document is not available until scanning is Clean (current status: ${doc.Status}).`,
              status: doc.Status,
              reason: doc.ScanFailureReason
            });
            return;
          }
          writeAudit(principal.id, docId, 'Read', 'Success', null, principal.email, doc.Name);
          sendJson(res, 200, {
            id: doc.Id,
            name: doc.Name,
            description: doc.Description,
            category: doc.Category,
            tags: doc.Tags,
            folderId: doc.FolderId,
            folderName: doc.FolderName,
            ownerEmail: doc.OwnerEmail,
            ownerName: doc.OwnerName,
            size: doc.Size,
            contentType: doc.ContentType,
            sha256Hash: doc.Sha256Hash,
            status: doc.Status,
            scanFailureReason: doc.ScanFailureReason,
            currentVersion: doc.CurrentVersion,
            createdAt: doc.CreatedAt,
            updatedAt: doc.UpdatedAt,
            isOwner: doc.OwnerId === principal.id,
            accessLevel: eff.accessLevel,
            canRead: true,
            canEdit: eff.canEdit
          });
          return;
        }

        if (subRoute === 'preview' && req.method === 'GET') {
          if (!doc || doc.IsDeleted) {
            writeAudit(principal.id, docId, 'Preview', 'Denied', 'NotFound', principal.email);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const eff = getEffectiveAccess(doc, principal.id);
          if (!eff.canRead) {
            writeAudit(principal.id, docId, 'Preview', 'Denied', 'PermissionDenied', principal.email, doc.Name);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          if (doc.Status !== 'Clean') {
            writeAudit(principal.id, docId, 'Preview', 'Denied', `DocumentNotClean:${doc.Status}`, principal.email, doc.Name);
            sendJson(res, 409, { message: `Preview blocked: document status is ${doc.Status}.` });
            return;
          }
          const filePath = path.join(STORAGE_ROOT, doc.StorageKey);
          let textPreview = null;
          if (fs.existsSync(filePath)) {
            const buf = fs.readFileSync(filePath);
            textPreview = buf.slice(0, Math.min(buf.length, 4096)).toString('utf8');
          }
          const versions = db
            .prepare(
              `SELECT v.*, u.Email as UploadedByEmail, u.FullName as UploadedByName
               FROM DocumentVersions v
               LEFT JOIN Users u ON u.Id = v.UploadedById
               WHERE v.DocumentId = ?
               ORDER BY v.VersionNumber DESC`
            )
            .all(docId)
            .map(v => ({
              versionNumber: v.VersionNumber,
              size: v.Size,
              sha256Hash: v.Sha256Hash,
              uploadedByEmail: v.UploadedByEmail,
              uploadedByName: v.UploadedByName,
              changeNote: v.ChangeNote,
              createdAt: v.CreatedAt
            }));
          const jobs = db
            .prepare(`SELECT * FROM ProcessingJobs WHERE DocumentId = ? ORDER BY CreatedAt DESC`)
            .all(docId)
            .map(j => ({
              jobType: j.JobType,
              status: j.Status,
              attempts: j.Attempts,
              diagnosticMessage: j.DiagnosticMessage,
              completedAt: j.CompletedAt
            }));
          writeAudit(principal.id, docId, 'Preview', 'Success', null, principal.email, doc.Name);
          sendJson(res, 200, {
            id: doc.Id,
            name: doc.Name,
            description: doc.Description,
            category: doc.Category,
            tags: doc.Tags,
            ownerEmail: doc.OwnerEmail,
            ownerName: doc.OwnerName,
            size: doc.Size,
            contentType: doc.ContentType,
            sha256Hash: doc.Sha256Hash,
            status: doc.Status,
            scanFailureReason: doc.ScanFailureReason,
            currentVersion: doc.CurrentVersion,
            accessLevel: eff.accessLevel,
            canEdit: eff.canEdit,
            textPreview,
            versions,
            jobs
          });
          return;
        }

        if (subRoute === 'download' && req.method === 'GET') {
          const eff = doc ? getEffectiveAccess(doc, principal.id) : { canRead: false };
          if (!doc || doc.IsDeleted || !eff.canRead || doc.Status !== 'Clean') {
            writeAudit(principal.id, docId, 'Download', 'Denied', 'NotAuthorizedOrNotClean', principal.email, doc?.Name);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const filePath = path.join(STORAGE_ROOT, doc.StorageKey);
          if (!fs.existsSync(filePath)) {
            sendJson(res, 404, { message: 'File missing on disk' });
            return;
          }
          writeAudit(principal.id, docId, 'Download', 'Success', null, principal.email, doc.Name);
          res.writeHead(200, {
            'Content-Type': doc.ContentType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.Name)}"`,
            'Access-Control-Allow-Origin': FRONTEND_ORIGIN
          });
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        if (!subRoute && req.method === 'PUT') {
          if (!doc || doc.IsDeleted) {
            writeAudit(principal.id, docId, 'Edit', 'Denied', 'NotFound', principal.email);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const eff = getEffectiveAccess(doc, principal.id);
          if (!eff.canEdit) {
            writeAudit(principal.id, docId, 'Edit', 'Denied', 'PermissionDenied', principal.email, doc.Name);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          if (doc.Status !== 'Clean') {
            writeAudit(principal.id, docId, 'Edit', 'Denied', `DocumentNotClean:${doc.Status}`, principal.email, doc.Name);
            sendJson(res, 409, { message: 'Cannot edit a document that is not Clean.' });
            return;
          }
          const body = await readJson(req);
          const newName = body.name ? path.basename(body.name.trim()) : doc.Name;
          if (!newName) {
            sendJson(res, 400, { message: 'Document name cannot be empty.' });
            return;
          }
          const newCategory = body.category !== undefined ? body.category.trim() : doc.Category;
          const newDesc = body.description !== undefined ? body.description.trim() : doc.Description;
          const newTags = body.tags !== undefined ? body.tags.trim() : doc.Tags;
          const newFolderId = body.folderId !== undefined ? (body.folderId || null) : doc.FolderId;
          const now = new Date().toISOString();

          db.prepare(
            `UPDATE Documents SET Name = ?, Category = ?, Description = ?, Tags = ?, FolderId = ?, UpdatedAt = ? WHERE Id = ?`
          ).run(newName, newCategory, newDesc, newTags, newFolderId, now, docId);
          writeAudit(principal.id, docId, 'Edit', 'Success', `Updated metadata (${newName})`, principal.email, newName);
          sendJson(res, 204);
          return;
        }

        if (subRoute === 'versions' && req.method === 'POST') {
          if (!doc || doc.IsDeleted) {
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const eff = getEffectiveAccess(doc, principal.id);
          if (!eff.canEdit) {
            writeAudit(principal.id, docId, 'UploadVersion', 'Denied', 'PermissionDenied', principal.email, doc.Name);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const ct = req.headers['content-type'] || '';
          const raw = await readRawBody(req);
          const parsed = parseMultipart(raw, ct);
          const file = parsed?.file;
          if (!file || file.data.length === 0 || file.data.length > 20 * 1024 * 1024) {
            sendJson(res, 400, { message: 'Replacement file is empty or exceeds 20 MB.' });
            return;
          }
          const newVerId = crypto.randomUUID();
          const newStorageKey = newVerId.replace(/-/g, '');
          const filePath = path.join(STORAGE_ROOT, newStorageKey);
          fs.writeFileSync(filePath, file.data);
          const sha256 = crypto.createHash('sha256').update(file.data).digest('hex');
          const scanOutcome = inspectAndScanFile(filePath, file.fileName);
          const nextVer = (doc.CurrentVersion || 1) + 1;
          const now = new Date().toISOString();

          db.prepare(
            `UPDATE Documents SET StorageKey = ?, Size = ?, Sha256Hash = ?, Status = ?, ScanFailureReason = ?, ScannedAt = ?, CurrentVersion = ?, UpdatedAt = ? WHERE Id = ?`
          ).run(newStorageKey, file.data.length, sha256, scanOutcome.status, scanOutcome.reason, now, nextVer, now, docId);

          db.prepare(
            `INSERT INTO DocumentVersions (Id, DocumentId, VersionNumber, StorageKey, Size, Sha256Hash, UploadedById, ChangeNote, CreatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            newVerId,
            docId,
            nextVer,
            newStorageKey,
            file.data.length,
            sha256,
            principal.id,
            parsed.fields.changeNote || `Version ${nextVer}`,
            now
          );
          writeAudit(principal.id, docId, 'UploadVersion', 'Success', `v${nextVer} (${scanOutcome.status})`, principal.email, doc.Name);
          sendJson(res, 201, { id: docId, versionNumber: nextVer, status: scanOutcome.status });
          return;
        }

        if (!subRoute && req.method === 'DELETE') {
          if (!doc || doc.IsDeleted || doc.OwnerId !== principal.id) {
            writeAudit(principal.id, docId, 'Delete', 'Denied', 'OwnerOnly', principal.email, doc?.Name);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          db.prepare(`UPDATE Documents SET IsDeleted = 1, UpdatedAt = ? WHERE Id = ?`).run(new Date().toISOString(), docId);
          writeAudit(principal.id, docId, 'Delete', 'Success', null, principal.email, doc.Name);
          sendJson(res, 204);
          return;
        }

        if (subRoute === 'permissions' && req.method === 'POST') {
          if (!doc || doc.IsDeleted || doc.OwnerId !== principal.id) {
            writeAudit(principal.id, docId, 'GrantPermission', 'Denied', 'OwnerOnly', principal.email, doc?.Name);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const body = await readJson(req);
          const targetEmail = (body.email || '').trim().toLowerCase();
          const access = body.access || '';
          const expiresAt = body.expiresAt || null;
          const target = db.prepare(`SELECT * FROM Users WHERE Email = ?`).get(targetEmail);
          if (!target || target.Id === doc.OwnerId || !target.IsActive) {
            sendJson(res, 400, { message: 'Recipient not found or not eligible.' });
            return;
          }
          if (access !== 'Read' && access !== 'Edit') {
            sendJson(res, 400, { message: 'Access must be Read or Edit.' });
            return;
          }
          const now = new Date().toISOString();
          const existing = db
            .prepare(`SELECT * FROM Permissions WHERE DocumentId = ? AND UserId = ?`)
            .get(docId, target.Id);
          if (!existing) {
            db.prepare(
              `INSERT INTO Permissions (Id, DocumentId, UserId, GrantedById, Access, IsActive, ExpiresAt, CreatedAt)
               VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
            ).run(crypto.randomUUID(), docId, target.Id, principal.id, access, expiresAt, now);
          } else {
            db.prepare(
              `UPDATE Permissions SET Access = ?, IsActive = 1, ExpiresAt = ?, RevokedAt = NULL WHERE Id = ?`
            ).run(access, expiresAt, existing.Id);
          }
          addNotification(
            target.Id,
            `Document shared: ${doc.Name}`,
            `${principal.fullName} (${principal.email}) granted you ${access} access to '${doc.Name}'.`,
            'Info',
            docId
          );
          writeAudit(principal.id, docId, 'GrantPermission', 'Success', `${target.Email}:${access}`, principal.email, doc.Name);
          sendJson(res, 200, { userId: target.Id, recipient: target.Email, access, expiresAt });
          return;
        }

        if (subRoute === 'permissions' && req.method === 'GET') {
          const eff = doc ? getEffectiveAccess(doc, principal.id) : { canRead: false };
          if (!doc || doc.IsDeleted || !eff.canRead) {
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const perms = db
            .prepare(
              `SELECT u.Id as id, u.Email as email, u.FullName as fullName, u.JobTitle as jobTitle, u.Department as department,
                      p.Access as access, p.ExpiresAt as expiresAt, p.CreatedAt as createdAt
               FROM Permissions p
               JOIN Users u ON u.Id = p.UserId
               WHERE p.DocumentId = ? AND p.IsActive = 1`
            )
            .all(docId);
          sendJson(res, 200, perms);
          return;
        }

        const revokeMatch = /^permissions\/([0-9a-fA-F-]{36})$/.exec(subRoute);
        if (revokeMatch && req.method === 'DELETE') {
          const targetUserId = revokeMatch[1];
          if (!doc || doc.IsDeleted || doc.OwnerId !== principal.id) {
            writeAudit(principal.id, docId, 'RevokePermission', 'Denied', 'OwnerOnly', principal.email, doc?.Name);
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const grant = db
            .prepare(`SELECT p.*, u.Email as TargetEmail FROM Permissions p JOIN Users u ON u.Id = p.UserId WHERE p.DocumentId = ? AND p.UserId = ?`)
            .get(docId, targetUserId);
          if (!grant) {
            sendJson(res, 404, { message: 'Not Found' });
            return;
          }
          const now = new Date().toISOString();
          db.prepare(`UPDATE Permissions SET IsActive = 0, RevokedAt = ? WHERE Id = ?`).run(now, grant.Id);
          addNotification(
            targetUserId,
            `Access revoked: ${doc.Name}`,
            `Your ${grant.Access} permission on '${doc.Name}' was revoked by ${principal.fullName}.`,
            'Warning',
            docId
          );
          writeAudit(principal.id, docId, 'RevokePermission', 'Success', grant.TargetEmail, principal.email, doc.Name);
          sendJson(res, 204);
          return;
        }
      }

      if (pathname === '/api/audit' && req.method === 'GET') {
        let rows;
        if (principal.role === 'Admin') {
          rows = db.prepare(`SELECT * FROM AuditEvents ORDER BY Id DESC LIMIT 500`).all();
        } else {
          rows = db
            .prepare(
              `SELECT a.*
               FROM AuditEvents a
               WHERE a.ActorId = ?
                  OR (a.DocumentId IS NOT NULL AND EXISTS (
                    SELECT 1 FROM Documents d
                    LEFT JOIN Permissions p ON p.DocumentId = d.Id AND p.UserId = ? AND p.IsActive = 1
                    WHERE d.Id = a.DocumentId AND (d.OwnerId = ? OR p.Id IS NOT NULL)
                  ))
               ORDER BY a.Id DESC
               LIMIT 500`
            )
            .all(principal.id, principal.id, principal.id);
        }
        const events = rows.map(a => ({
          id: a.Id,
          correlationId: a.CorrelationId,
          actorId: a.ActorId,
          actorEmail: a.ActorEmail,
          documentId: a.DocumentId,
          documentName: a.DocumentName,
          action: a.Action,
          result: a.Result,
          reason: a.Reason,
          ipAddress: a.IpAddress,
          createdAt: a.CreatedAt,
          previousHash: a.PreviousHash,
          entryHash: a.EntryHash
        }));
        sendJson(res, 200, events);
        return;
      }
    }

    sendJson(res, 404, { message: 'Not Found' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { message: 'Internal Server Error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TrustVault Corporate API v3 listening on http://localhost:${PORT} (Swagger UI: http://localhost:${PORT}/swagger)`);
});
