---
name: nestjs-cloudflare-r2-storage
description: Implements secure object storage in this NestJS application using the domain StoragePort abstraction, Cloudflare R2, the S3-compatible API, and the existing Multer upload module. Use when changing uploads, downloads, presigned URLs, R2 integration, object lifecycle, or migrating away from Cloudinary.
---

# NestJS File Storage: Cloudflare R2, StoragePort, and Multer

The application is migrating from Cloudinary to Cloudflare R2. Preserve the domain `StoragePort` abstraction under `src/core/storage` and integrate R2 through an infrastructure adapter. The upload transport currently uses Multer in `src/modules/upload`.

Do not introduce Cloudinary-specific behavior into new code. Do not let application/domain services depend directly on the AWS SDK or R2 endpoint. Cloudflare R2 exposes an S3-compatible API, but it is not AWS S3 in every operational detail: verify current Cloudflare R2 documentation and the installed SDK version before relying on provider-specific behavior.

## Required workflow
1. Inspect `src/core/storage`, the current `StoragePort`, the Cloudinary adapter being replaced, `src/modules/upload`, Multer configuration, package versions, configuration validation, and all call sites.
2. Identify the exact `StoragePort` contract and current metadata persisted in the database. Propose the smallest contract change needed for R2; do not redesign the entire storage domain without a requirement.
3. Trace upload/download/delete lifecycle: request validation, Multer handling, storage adapter call, R2 object operation, persisted metadata, response mapping, and cleanup.
4. Confirm whether Multer uses memory storage, disk storage, or a custom storage engine. Do not assume a temporary file exists.
5. Inspect the migration state: whether old Cloudinary assets must remain readable, be copied to R2, or be deleted. Do not delete or invalidate existing Cloudinary assets as part of an R2 implementation unless explicitly requested.
6. Implement provider-specific behavior only inside the R2 adapter and configuration layer.
7. Verify the exact installed AWS SDK v3 packages and APIs. Prefer the S3 client and command packages already used by the project; do not silently add dependencies or change versions.

## R2 configuration and client rules
- Use Cloudflare account ID, bucket name, access key ID, secret access key, and the account-specific S3 API endpoint from validated environment configuration.
- Keep credentials server-side only. Never expose R2 access keys or secret keys to browsers, mobile clients, logs, or API responses.
- Configure the S3 client with the R2 endpoint and the appropriate region setting required by the current Cloudflare R2/S3-compatible API documentation (commonly `auto`); verify rather than assuming.
- Use a dedicated least-privilege R2 API token scoped to only the required bucket and operations.
- Do not confuse the S3 API endpoint with a public custom domain or an `r2.dev` public development URL.
- Keep bucket names, endpoint, public base URL, and credentials in centralized configuration. Validate required values at startup.
- Do not hardcode account IDs, endpoints, bucket names, or credentials in source files.
- Reuse a long-lived client/provider rather than creating a new S3 client per request.
- Configure request timeouts, retry behavior, and connection reuse according to the installed SDK and runtime.

## Object key and metadata rules
- Generate object keys server-side using a stable, collision-resistant strategy. Never use raw user filenames as object keys or filesystem paths.
- Keep the original filename only as sanitized display metadata when required.
- Define a deliberate key layout, for example by feature/tenant/date/opaque-id, without exposing sensitive user data.
- Store the bucket/key and required metadata in the database. An object key is not proof of authorization.
- Persist content type, byte size, checksum/ETag where meaningful, owner, and upload status only as required by the domain.
- Do not assume an S3 ETag is always a content MD5, especially for multipart uploads or provider-specific behavior.
- Avoid putting secrets, access tokens, or unnecessary personal data in object keys or metadata.
- Treat user-controlled metadata and content-disposition filenames as untrusted; encode/sanitize them safely.

## Upload and Multer rules
- Enforce file-size limits at Multer and upstream proxy/API gateway boundaries where applicable.
- Do not trust filename extensions or client-provided MIME headers alone. Inspect file signatures/content where practical and compare detected type against an allow-list.
- Restrict allowed formats and consider image dimensions, page count, duration, archive expansion, and decompression limits where relevant.
- If Multer memory storage is used, enforce conservative file-size and concurrency limits to avoid memory exhaustion; stream to R2 where the architecture supports it.
- If disk storage is used, use a controlled temporary directory, non-user-controlled filenames, restrictive permissions, and cleanup on every success and failure path.
- Prefer streaming for large files; avoid buffering an entire large upload in application memory unless size limits make it safe.
- For large or resumable uploads, evaluate multipart upload support and define abort/cleanup behavior for incomplete multipart uploads.
- Validate upload authorization before accepting expensive work where possible.
- Do not allow clients to choose arbitrary bucket names, object keys, ACLs, or provider options.

## Presigned URL rules
- Use short-lived presigned URLs when clients should upload or download directly to/from R2.
- Presign only a server-generated bucket/key and only the required operation; constrain content type and other signed headers where supported.
- Use short expirations appropriate to the workflow. Do not treat a presigned URL as a permanent asset URL.
- Authorize the user before generating a download URL. Possession of an object key or URL must not bypass application authorization.
- Avoid logging presigned URLs because they are bearer credentials until expiry.
- Do not persist presigned URLs as canonical asset references; persist stable object identifiers and generate URLs when needed.
- If the application serves objects through its own API or custom domain instead, follow the existing access-control and caching design.
- Understand that the S3 API endpoint is for API operations; public delivery should use an intentionally configured custom domain or another approved delivery path. Do not expose private buckets accidentally.

## StoragePort and adapter design
- Application/domain services depend on `StoragePort`, not directly on Cloudflare R2, AWS SDK commands, or Multer.
- The R2 adapter implements the port and translates provider-specific errors into stable application-level errors.
- Keep SDK types, S3 commands, endpoint details, bucket configuration, and presigning implementation inside infrastructure.
- Do not leak `Bucket`, `Key`, `ETag`, `VersionId`, SDK response shapes, or S3 command types into domain contracts unless the domain explicitly requires provider-neutral equivalents.
- Model provider-neutral operations such as upload, delete, metadata lookup, and URL generation according to actual use cases.
- Avoid over-generalizing the port for hypothetical providers. Add capabilities only when a real use case needs them.
- Keep provider selection in dependency-injection/configuration wiring. Do not scatter `if provider === ...` branches across feature services.
- During migration, use an explicit compatibility/read strategy if existing Cloudinary assets must remain accessible. Do not silently reinterpret Cloudinary public IDs as R2 keys.

## Consistency and failure handling
- Object storage and PostgreSQL transactions are not one atomic transaction.
- Define the failure sequence for upload success followed by database failure. Use compensating object deletion or an explicit pending/orphan reconciliation process where appropriate.
- Define the reverse case for database metadata creation followed by upload failure; avoid exposing incomplete assets as ready.
- Make retries safe. Use stable object keys or upload IDs so retrying does not create uncontrolled duplicates.
- Distinguish missing objects, access denied, invalid requests, throttling, timeout, and transient provider failures.
- Use bounded retries with backoff for transient failures only; do not retry permanent validation or authorization failures.
- Define deletion semantics and whether soft deletion, delayed deletion, or immediate object deletion is required.
- Handle partial/multipart upload aborts and lifecycle cleanup deliberately.
- Do not assume R2 object operations and database writes are atomic.

## Cloudinary-to-R2 migration considerations
- Keep old Cloudinary assets readable until the migration policy explicitly retires them.
- If copying existing assets, preserve ownership, visibility, content type, relevant metadata, and stable application-level asset IDs.
- Record migration state and make copy jobs idempotent and resumable.
- Verify object size/checksum or another reliable integrity signal after copying; do not rely blindly on ETag as MD5.
- Update all consumers of Cloudinary URLs/transformation URLs. R2 does not automatically provide Cloudinary's image/video transformation features.
- If image transformations are still required, choose and document a separate transformation/delivery layer rather than assuming R2 replaces Cloudinary's media processing.
- Do not delete source assets until copy verification, application cutover, rollback window, and retention requirements are satisfied.
- Keep a rollback plan and measure missing/failed assets during migration.

## Verification
Test:
- Allowed and disallowed content types, spoofed MIME headers, oversized files, and malformed payloads.
- Upload, download URL generation, deletion, missing object, and unauthorized access.
- Expired and correctly scoped presigned URLs.
- R2 timeout, throttling, permission failure, and transient retry behavior.
- Database failure after successful upload and upload failure after metadata preparation.
- Temporary-file cleanup or memory behavior according to the configured Multer storage engine.
- Duplicate/retried uploads and multipart abort/cleanup if multipart upload is implemented.
- Migration compatibility for existing Cloudinary assets if dual-read or copy migration is required.

Use adapter fakes or isolated test buckets. Do not require production R2 credentials in ordinary unit tests.
