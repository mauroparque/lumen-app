# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.0.0] - 2026-02-20

### Added

- **RBAC Firestore rules** with role-based access control — `admin`, `professional`, and `staff` roles with scoped permissions (SEC-01)
- **Allowlist-based onboarding** replacing previous auto-admin provisioning — only pre-approved emails can register (SEC-02)
- **Server-side Turnstile validation** via `validateTurnstile` Cloud Function — bot protection verified before Firebase Auth login (SEC-03)
- **Strict Content Security Policy** — removed `unsafe-eval`, whitelisted Firebase/Turnstile domains (SEC-04)
- Caching headers in `firebase.json` for static assets
- `AllowedEmail` type and centralized collection routes in `src/lib/routes.ts`
- Allowlist seed script (`scripts/seed-allowlist.ts`) for bootstrapping staff emails in Firestore
- `.env.example` documenting all required environment variables

### Fixed

- Declared `TURNSTILE_SECRET` in Cloud Function `secrets` option — critical for runtime secret access
- Clarified staff Firestore rules — replaced broad `write+create` with explicit `create`, `update`, `delete`
- Moved `getFunctions()` call to module level in `AuthScreen` — was re-initialized on every form submit
- Removed `firebase-admin` from frontend `devDependencies` — belongs only in `functions/` and seed scripts
- Cleaned `index.html` — removed mock globals, added `preconnect` hints, corrected meta tags
- Seed script auto-detects `projectId` from service account credentials
- Relax `notes` Firestore read rule to `isAuthenticated()` — previous rule caused `permission-denied` on app load and Notes view ([a088f08](https://github.com/mauroparque/lumen-app-v2/commit/a088f08))
- Add `createdByUid: user.uid` to note creation payload — previous field stored `displayName` instead of UID, so ownership check never matched ([a088f08](https://github.com/mauroparque/lumen-app-v2/commit/a088f08))
- Guarantee non-null `createdBy` using `user.email ?? user.uid` — `displayName` and `email` are nullable in Firebase ([705152a](https://github.com/mauroparque/lumen-app-v2/commit/705152a))
- Preserve `createdBy`/`createdByUid` on note update — ownership fields set only on creation to prevent edits from overwriting authorship ([705152a](https://github.com/mauroparque/lumen-app-v2/commit/705152a))

### Security

- Removed 25 npm vulnerabilities in `functions/` by dropping unused `firebase-functions-test`
- Upgraded `axios`, `fast-xml-parser`, `jws`, `qs` to patched versions (CVE fixes via `npm audit fix`)
- Eliminated `unsafe-eval` from CSP — all scripts require nonce-based authorization
- Server-side Turnstile validation prevents bot and replay attacks on the authentication flow

[Unreleased]: https://github.com/mauroparque/lumen-app-v2/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mauroparque/lumen-app-v2/releases/tag/v1.0.0
