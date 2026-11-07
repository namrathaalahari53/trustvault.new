# `PROMPTS.md` — TrustVault AI Development Log

## AI Tools Used
- GitHub Copilot
- Perplexity
- Google Antigravity Agent

---

## Entry 1 — 2026-11-01
- **Topic:** Initial project architecture & Sprint planning
- **Purpose:** Understand the full-stack security requirements and structure development into Agile sprints (Sprints 0–7).
- **AI contribution:** Suggested separation of responsibilities across ASP.NET Core 10, PostgreSQL/SQLite, ClamAV scanning, private file storage, and Angular 20.
- **Human verification:** Reviewed the architecture and ensured strict separation between authentication, authorization, and audit logging.

## Entry 2 — 2026-11-02
- **Topic:** Authentication, RBAC, and account lockout protection
- **Purpose:** Implement `Admin`, `Owner`, and `Viewer` global roles, 14+ character password policy, and brute-force lockout protection.
- **AI contribution:** Assisted with JWT bearer token issuance, scrypt/PBKDF2 password hashing, and account activation/deactivation endpoints.
- **Human verification:** Tested login, password rotation, account deactivation (`ADM-08`), and repeated failed login lockouts (`AUTH-15`).

## Entry 3 — 2026-11-03
- **Topic:** Document authorization, IDOR protection, and immediate revocation
- **Purpose:** Ensure users cannot read, preview, download, or modify documents without explicit ownership or active `Read`/`Edit` grants.
- **AI contribution:** Assisted in designing `DocumentAccess` checks and returning `404 Not Found` on unauthorized document lookups to prevent IDOR enumeration.
- **Human verification:** Verified that revoking a `Read` or `Edit` grant immediately blocks the next `GET /api/documents/{id}`, `GET /api/documents/{id}/download`, and `PUT /api/documents/{id}` call.

## Entry 4 — 2026-11-04
- **Topic:** HMAC-SHA256 hash-chained audit logging & chain verification
- **Purpose:** Record all successful and denied operations in a tamper-evident hash chain and verify integrity from `GENESIS`.
- **AI contribution:** Assisted with the `AuditWriter` HMAC-SHA256 payload chaining and the `/api/admin/verify-audit-chain` verification endpoint.
- **Human verification:** Verified that upload, read, preview, download, edit, delete, retry-scan, grant, revoke, and unauthorized denials produce linked audit records.

## Entry 5 — 2026-11-05
- **Topic:** Deployment, Docker Compose, and CI/CD
- **Purpose:** Configure reproducible container orchestration and automated security test verification.
- **AI contribution:** Assisted with Docker Compose healthchecks, environment variable templates, and GitHub Actions workflow setup.
- **Human verification:** Tested `/api/system/health` and `/api/system/ready` endpoints and validated zero hardcoded secrets in repository config.

## Entry 6 — 2026-11-06
- **Topic:** READ/EDIT & Retry Scan bug investigation and resolution
- **Purpose:** Resolve the issue where documents stuck in `ScanFailed` blocked authorized users and where shared `Edit` users lacked metadata/version edit capabilities.
- **AI contribution:** Identified missing `POST /api/documents/{id}/retry-scan` endpoint, magic-byte file signature inspection, EICAR malware quarantine detection, and effective `accessLevel` (`Owner`, `Edit`, `Read`) propagation to the UI.
- **Human verification:** Verified end-to-end Retry Scan transition from `ScanFailed` to `Clean`, shared Editor metadata/version updates, and EICAR quarantine enforcement.

---

## AI Limitations and Corrections
- AI-generated starter code required strengthening so that `Admin` audit access does not automatically expose every user's private documents unless explicitly shared or owned.
- Initial upload logic only checked file extensions; we added magic-byte header validation (`%PDF`, `PNG`, `JPEG`, `PK`) and EICAR signature inspection.
- Added explicit `POST /api/documents/{id}/retry-scan` and `DocumentProcessingJob` tracking so transient scanner failures can be safely retried without bypassing malware scanning.

**Conclusion:** AI served as an engineering accelerator. All authorization boundaries, cryptographic audit checks, and release-blocking security tests were independently verified.
