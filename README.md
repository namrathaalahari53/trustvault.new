# TrustVault Corporate — Zero-Trust Enterprise Document Management

A full-stack corporate document management and sharing platform built with **Angular 20**, **ASP.NET Core 10 Web API**, **PostgreSQL / SQLite**, **ClamAV + Magic-Byte Inspection**, and **HMAC-SHA256 Hash-Chained Audit Logging**.

---

## 1. Architecture & Responsibilities

```
Frontend (Angular 20 / Corporate SPA — Port 4200)
   │  Login · Dashboard · My Documents · Shared With Me · Folders · Trash · Audit · Notifications · Admin
   ▼  HTTPS / REST API (Bearer JWT)
Backend (ASP.NET Core 10 Web API / Local API Runtime — Port 5106)
   ├── Authentication & Lockout Protection (JWT + Scrypt/PBKDF2 + 5-attempt Lockout)
   ├── Two-Layer Authorization (Global Roles: Admin/Owner/Viewer + Document Grants: Owner/Edit/Read)
   ├── Document Services (Private Storage, Version History, Soft-Delete & Restore, Safe Preview)
   ├── Malware & Signature Pipeline (Magic-Byte Header Check + EICAR Detection + ClamAV INSTREAM + Retry Scan)
   └── Cryptographic Audit Service (Append-Only HMAC-SHA256 Hash Chain from GENESIS + Chain Verification)
```

---

## 2. Seeded Corporate Accounts (For Local Demo & Testing)

| Role | Email | Password | Capabilities |
|---|---|---|---|
| **Admin** | `admin@example.local` | `ChangeThis-Admin-Password-2026!` | User provisioning, account activation/deactivation, security monitoring, HMAC audit chain verification |
| **Owner (Vivek)** | `owner@trustvault.local` | `Corporate-Owner-2026!` | Uploads documents, manages folders, grants/revokes `Read` and `Edit` access |
| **Editor (Priya)** | `editor@trustvault.local` | `Corporate-Editor-2026!` | Reads, previews, downloads, edits metadata, uploads new versions (`v2`), and runs **Retry Scan** on shared documents |
| **Viewer (Arjun)** | `viewer@trustvault.local` | `Corporate-Viewer-2026!` | Previews and downloads documents explicitly shared with `Read` access; blocked from editing or uploading |

---

## 3. Resolution of the `Retry Scan` & `READ/EDIT` Glitch

1. **Root Cause Addressed:** Documents that experienced transient ClamAV timeouts remained in `ScanFailed` or `Pending` without a recovery endpoint, and shared users with `Edit` permission lacked effective `accessLevel` metadata (`Owner` / `Edit` / `Read`) and edit/versioning routes.
2. **Fix Implemented:**
   - Added `POST /api/documents/{id}/retry-scan` with full `DocumentProcessingJob` attempt tracking and magic-byte + malware verification.
   - Enforced strict server-side checks: documents must be `Clean` before `Read`, `Preview`, `Download`, or `Edit` is permitted (`409 Conflict` or `404 Not Found` otherwise).
   - Propagated `accessLevel`, `canRead`, and `canEdit` on document DTOs and added the **Edit Document & Upload New Version** modal for both `Owner` and `Edit`-granted users.

---

## 4. Running the Application Locally

### Start Frontend (`4200`) & Backend API (`5106`)
```powershell
node TrustVault/scripts/start-all.mjs
```
- **Frontend Workspace:** http://localhost:4200
- **Backend Swagger UI:** http://localhost:5106/swagger
- **Health Check:** http://localhost:5106/api/system/health

### Run Automated Release-Blocking Security Tests
```powershell
node TrustVault/scripts/run-security-tests.mjs
```

### Run with Docker Compose (.NET 10 + PostgreSQL 16 + ClamAV + Angular)
```bash
cp .env.example .env
docker compose up --build
```
