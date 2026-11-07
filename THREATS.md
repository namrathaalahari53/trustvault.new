# TrustVault — Comprehensive Threat Model (`THREATS.md`)

This document analyzes the 16 mandatory security threat categories for the TrustVault Corporate Zero-Trust Document Platform, detailing attack vectors, server-side mitigations, automated verification tests, and residual risk.

---

## 1. Broken Access Control
- **What it means:** Users act outside their intended global role (`Admin`, `Owner`, `Viewer`) or per-document permission (`Owner`, `Edit`, `Read`).
- **Exploit scenario:** A `Viewer` calls `PUT /api/documents/{id}` or `POST /api/admin/users` directly, bypassing the Angular UI.
- **How TrustVault prevents it:** Every API endpoint enforces server-side JWT authentication and queries `DocumentAccess` (`CanReadAsync`, `CanEditAsync`) or `[Authorize(Roles = "Admin")]` against live database state.
- **Automated test:** `SEC-01`, `SEC-02`, `ADM-12`, `EDIT-03`.
- **Accepted residual risk:** Compromised valid user credentials until token expiry (20 minutes) or account deactivation.

## 2. Insecure Direct Object Reference (IDOR)
- **What it means:** Accessing or modifying another user's document or permission record by guessing or substituting its GUID in the URL.
- **Exploit scenario:** An authenticated user iterates `GET /api/documents/{guessed-guid}` or `GET /api/documents/{guessed-guid}/download`.
- **How TrustVault prevents it:** Every document lookup verifies ownership (`d.OwnerId == userId`) or an active, non-expired grant in `Permissions`. Unauthorized lookups return `404 Not Found` (preventing resource enumeration) and write a `Denied` audit event.
- **Automated test:** `SEC-05`, `READ-04`, `READ-07`, `FILE-06`.
- **Accepted residual risk:** None on document routes.

## 3. Privilege Escalation
- **What it means:** A lower-privileged user elevates their global role to `Admin` or `Owner`, or grants themselves `Edit` access to a document.
- **Exploit scenario:** A `Viewer` or `Editor` calls `POST /api/documents/{id}/permissions` or `PUT /api/admin/users/{id}/role`.
- **How TrustVault prevents it:** Only the document `Owner` can grant or revoke document permissions (`d.OwnerId == UserId(p)`), and only `Admin` can create users or change global roles.
- **Automated test:** `PERM-07`, `PERM-08`, `ADM-11`.
- **Accepted residual risk:** Insider threat from a provisioned `Admin` account (mitigated by separating Admin audit access from confidential document ownership).

## 4. JWT Theft & Replay
- **What it means:** Stolen bearer tokens used by an attacker to impersonate a user.
- **Exploit scenario:** XSS or network interception captures a bearer token.
- **How TrustVault prevents it:** Tokens are short-lived (20 minutes), signed with 384-bit HMAC-SHA256 keys, validated with strict issuer/audience/lifetime checks (`ClockSkew = 30s`), and checked against active user status (`IsActive`) on protected requests.
- **Automated test:** `AUTH-08`, `AUTH-09`, `AUTH-10`.
- **Accepted residual risk:** Active token window prior to expiration if not paired with token revocation lists in distributed deployments.

## 5. SQL Injection
- **What it means:** Untrusted user input alters backend database queries.
- **Exploit scenario:** Supplying `' OR 1=1 --` in login email, search filters, or document names.
- **How TrustVault prevents it:** All database queries use parameterized statements (EF Core LINQ in .NET 10 and prepared statements in SQLite/PostgreSQL). No raw string concatenation is used in SQL.
- **Automated test:** `SEARCH-10`.
- **Accepted residual risk:** None.

## 6. Cross-Site Scripting (XSS)
- **What it means:** Injecting malicious scripts via filenames, descriptions, or user names.
- **Exploit scenario:** Uploading `<script>alert(1)</script>.pdf` or setting description to `<img onerror=...>`.
- **How TrustVault prevents it:** Angular's template binding and explicit HTML entity escaping (`escapeHtml`) encode all untrusted values; downloads force `Content-Disposition: attachment`.
- **Automated test:** `DOC-17`, `SEARCH-07`.
- **Accepted residual risk:** Browser PDF viewer vulnerabilities if user opens downloaded file locally.

## 7. Cross-Site Request Forgery (CSRF)
- **What it means:** A malicious third-party site triggers authenticated requests in the user's browser.
- **Exploit scenario:** Cross-origin form post to `/api/documents/{id}/permissions`.
- **How TrustVault prevents it:** API authentication uses explicit `Authorization: Bearer <token>` headers stored in `sessionStorage` (never ambient cookies) and strict CORS origin allowlisting (`Frontend:Origin`).
- **Automated test:** `SEC-03`, `AUTH-09`.
- **Accepted residual risk:** None while using header-based bearer tokens.

## 8. Malicious / Spoofed File Uploads
- **What it means:** Uploading executables or scripts disguised with `.pdf` or `.png` extensions.
- **Exploit scenario:** Renaming `payload.exe` to `invoice.pdf`.
- **How TrustVault prevents it:** `FileSignatureValidator` inspects magic bytes (`%PDF`, `\x89PNG`, `\xFF\xD8\xFF`, `PK\x03\x04`) in addition to extension allowlisting and 20 MB size limits. Spoofed files are marked `Rejected`.
- **Automated test:** `DOC-06`, `DOC-07`, `DOC-08`, `DOC-19`.
- **Accepted residual risk:** Polyglot files that pass both magic-byte and ClamAV checks.

## 9. Malware Uploads & Scanner Outages
- **What it means:** Uploading virus-infected documents or exploiting scanner downtime to share unscanned files.
- **Exploit scenario:** Uploading an EICAR/malware payload, or downloading a file while ClamAV is offline.
- **How TrustVault prevents it:** Files are scanned via ClamAV `INSTREAM` and signature inspection. Malware is marked `Rejected` (quarantined). Scanner outages fail closed (`ScanFailed`), blocking Read/Preview/Download/Edit until **Retry Scan** (`POST /api/documents/{id}/retry-scan`) succeeds.
- **Automated test:** `SEC-10`, `DOC-09`, `DOC-13`, `READ-10`, `EDIT-15`, `FILE-11`.
- **Accepted residual risk:** Zero-day malware undetected by current ClamAV virus definitions.

## 10. Unauthorized Downloads
- **What it means:** Downloading confidential files without permission or after access is revoked.
- **Exploit scenario:** Reusing a saved `/api/documents/{id}/download` URL after revocation.
- **How TrustVault prevents it:** `GET /api/documents/{id}/download` re-verifies `CanReadAsync` and `Status == "Clean"` on every single request before opening the private file stream.
- **Automated test:** `SEC-03`, `SEC-04`, `FILE-04`, `FILE-05`.
- **Accepted residual risk:** Users who legitimately downloaded a file while authorized retain their local copy.

## 11. Audit Log Tampering
- **What it means:** Modifying or deleting audit events to hide unauthorized actions.
- **Exploit scenario:** An attacker attempts to alter or delete rows in `AuditEvents`.
- **How TrustVault prevents it:** Every `AuditEvent` is cryptographically chained (`PreviousHash` -> `EntryHash`) using a server-side `Audit:HmacKey` (`HMAC-SHA256`). Any modified or deleted row breaks the chain, which is immediately detected by `GET /api/admin/verify-audit-chain`. No API route permits updating or deleting audit records.
- **Automated test:** `SEC-08`, `SEC-09`, `AUD-12`, `AUD-13`.
- **Accepted residual risk:** Full host/database compromise where the attacker also steals the external `AUDIT_HMAC_KEY` and rewrites the entire chain from `GENESIS`.

## 12. Brute-Force Authentication Attacks
- **What it means:** Repeated password guessing against `/api/auth/login`.
- **Exploit scenario:** Automated credential stuffing against `admin@example.local`.
- **How TrustVault prevents it:** Accounts track `FailedLoginAttempts` and automatically lock (`LockedUntil` for 10 minutes, returning `429 Too Many Requests`) after 5 consecutive failures, logging `Login Denied` in the audit trail.
- **Automated test:** `AUTH-02`, `AUTH-15`.
- **Accepted residual risk:** Distributed slow brute-force attacks below the lockout threshold.

## 13. Denial of Service (DoS) via Large Uploads
- **What it means:** Exhausting disk or memory with huge uploads.
- **Exploit scenario:** Uploading multi-gigabyte streams to `/api/documents`.
- **How TrustVault prevents it:** Request bodies and multipart streams are strictly capped (`20 MB` file limit), rejecting oversized payloads immediately with `400 Bad Request`.
- **Automated test:** `DOC-05`, `DOC-20`.
- **Accepted residual risk:** Application-layer DDoS requiring upstream WAF/reverse-proxy rate limiting.

## 14. Path Traversal
- **What it means:** Escaping the storage directory via `../../` in filenames or storage keys.
- **Exploit scenario:** Uploading `../../appsettings.json` or requesting a manipulated storage key.
- **How TrustVault prevents it:** `Path.GetFileName` strips all directory segments from uploaded names, and physical files are stored using a 32-character hex GUID (`id.ToString("N")`) verified by `PrivateFileStore.Resolve`.
- **Automated test:** `DOC-16`, `FILE-07`, `FILE-12`.
- **Accepted residual risk:** None.

## 15. Insecure Direct Storage Access
- **What it means:** Fetching uploaded files directly from a public static web folder.
- **Exploit scenario:** Requesting `http://localhost:4200/private-storage/<key>`.
- **How TrustVault prevents it:** `private-storage` is located outside `wwwroot` and the frontend static root; files can only be streamed through the authenticated, authorized `/api/documents/{id}/download` endpoint.
- **Automated test:** `SEC-07`, `READ-13`, `FILE-07`.
- **Accepted residual risk:** None.

## 16. Permission-Revocation Race Conditions
- **What it means:** A user continues accessing or editing a document after the owner revokes their permission because permissions were cached in a JWT or frontend state.
- **Exploit scenario:** Owner revokes `Edit` access while Editor has the workspace open; Editor clicks Save.
- **How TrustVault prevents it:** Document permissions are never stored in JWT claims; every Read, Preview, Download, and Edit request queries the live `Permissions` table (`IsActive == true`). Revocation takes effect on the very next HTTP request.
- **Automated test:** `SEC-04`, `SEC-11`, `PERM-10`, `EDIT-06`.
- **Accepted residual risk:** In-flight HTTP download stream that started milliseconds before revocation completed.
