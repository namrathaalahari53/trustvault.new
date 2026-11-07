# Beginner Guide

## What happens when a user signs in?

1. Angular sends email and password to `/api/auth/login`.
2. The API checks the password hash in PostgreSQL.
3. The API returns a short-lived JWT.
4. Angular sends that token in the Authorization header on later API calls.
5. The backend validates the token before processing protected requests.

## What happens when a document is shared?

1. The owner enters a member's email and selects Read or Edit.
2. The backend checks that the signed-in user owns the document.
3. The backend finds the recipient account.
4. A permission record is inserted or updated.
5. An audit event records the grant.
6. On each later request, the backend checks the current permission record again.

## Why is checking permissions on every request important?

A user may save a download URL or keep a browser tab open. If permission is revoked, the next API request must check the database again and deny access. Hiding a button in Angular is not security.

## Why are files stored outside the frontend folder?

Files in a public web folder may be downloaded by anyone who knows the URL. TrustVault stores files in a private server directory and streams them only after backend authorization.

## What does Clean mean?

A file is available only after the scanner reports it clean. If the scanner is unavailable, the application must fail closed and keep the document inaccessible.

## HTTP status codes

- 200: Request succeeded.
- 201: Resource created.
- 204: Request succeeded without response content.
- 400: Input is invalid.
- 401: User is not authenticated.
- 403: User is authenticated but lacks permission.
- 404: Resource not found (also used to hide some unauthorized resources).
- 409: Resource state conflict.
- 500: Unexpected server error.
