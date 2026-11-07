# TrustVault Corporate API — Endpoint & Permission Matrix (`API.md`)

All `/api` routes except `/api/auth/login`, `/api/auth/bootstrap-admin`, `/api/system/health`, and `/api/system/ready` require a valid JWT bearer token (`Authorization: Bearer <token>`).

| Method | Route | Required Authorization | Audit Logged |
|---|---|---|---|
| `GET` | `/api/system/health` | Public | No |
| `GET` | `/api/system/ready` | Public | No |
| `POST` | `/api/auth/bootstrap-admin` | Public (One-time when no Admin exists) | Yes |
| `POST` | `/api/auth/login` | Public (5-attempt lockout protection) | Yes (`Success` / `Denied`) |
| `POST` | `/api/auth/change-password` | Authenticated (`14+` character policy) | Yes |
| `GET` | `/api/users/me` | Authenticated & Active | No |
| `PUT` | `/api/users/me` | Authenticated & Active | No |
| `GET` | `/api/admin/stats` | Global Role: `Admin` | No |
| `GET` | `/api/admin/users` | Global Role: `Admin` | No |
| `POST` | `/api/admin/users` | Global Role: `Admin` | Yes (`CreateUser`) |
| `PUT` | `/api/admin/users/{id}/status` | Global Role: `Admin` | Yes (`ActivateUser` / `DeactivateUser`) |
| `PUT` | `/api/admin/users/{id}/role` | Global Role: `Admin` | Yes (`ChangeUserRole`) |
| `GET` | `/api/admin/verify-audit-chain` | Global Role: `Admin` | Yes (`VerifyAuditChain`) |
| `GET` | `/api/folders` | Authenticated | No |
| `POST` | `/api/folders` | Authenticated | No |
| `DELETE` | `/api/folders/{id}` | Folder `Owner` | No |
| `GET` | `/api/documents` | Authenticated; returns only Owned or explicitly Shared documents | No |
| `POST` | `/api/documents` | Global Role: `Owner` or `Admin` | Yes (`Upload`) |
| `GET` | `/api/documents/{id}` | Document `Owner`, `Read`, or `Edit` grant + `Status == Clean` | Yes (`Read`) |
| `GET` | `/api/documents/{id}/preview` | Document `Owner`, `Read`, or `Edit` grant + `Status == Clean` | Yes (`Preview`) |
| `GET` | `/api/documents/{id}/download` | Document `Owner`, `Read`, or `Edit` grant + `Status == Clean` | Yes (`Download`) |
| `PUT` | `/api/documents/{id}` | Document `Owner` or `Edit` grant + `Status == Clean` | Yes (`Edit`) |
| `POST` | `/api/documents/{id}/versions` | Document `Owner` or `Edit` grant | Yes (`UploadVersion`) |
| `POST` | `/api/documents/{id}/retry-scan` | Document `Owner`, `Read`, or `Edit` grant | Yes (`RetryScan`) |
| `DELETE` | `/api/documents/{id}` | Document `Owner` only (Soft-delete) | Yes (`Delete`) |
| `POST` | `/api/documents/{id}/restore` | Document `Owner` only | Yes (`Restore`) |
| `GET` | `/api/documents/{id}/permissions` | Document `Owner`, `Read`, or `Edit` grant | No |
| `POST` | `/api/documents/{id}/permissions` | Document `Owner` only | Yes (`GrantPermission`) |
| `DELETE` | `/api/documents/{id}/permissions/{userId}` | Document `Owner` only (Immediate revocation) | Yes (`RevokePermission`) |
| `GET` | `/api/notifications` | Authenticated (Scoped to current user) | No |
| `POST` | `/api/notifications/read-all` | Authenticated | No |
| `GET` | `/api/audit` | `Admin` sees all; others see events for owned/shared documents | No |
