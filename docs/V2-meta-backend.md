# Meta OAuth backend — development implementation

## Delivered

- Vercel Node 24 function: `GET/POST /api/meta?action=...`, no external npm dependencies.
- App ID 2044415312932575, business login configuration 1417296747187746, system-user token flow.
- `status`, `start`, `callback`, `assets`, `select`, `verify`, `disconnect` actions. Only callback is an unauthenticated OAuth return; all configured account actions verify Supabase identity and an active admin profile. Marketing and anonymous users cannot manage credentials.
- Fixed HTTPS callback origin; browser writes require exact Origin, authorization bearer and correct host. No caller-supplied redirect or provider URL is accepted.
- Random OAuth state plus HttpOnly/Secure/SameSite=Lax browser nonce; hashed state stored for ten minutes; atomic consumption blocks replay. Starting another connection or disconnecting changes revision and invalidates old callbacks.
- Code exchange and token introspection stay on server; app ID, system-user type, permission set and actual expiration checked. No automatic long-lived-user-token exchange is attempted for system-user tokens.
- AES-256-GCM credential encryption with random IV and authenticated scope. Ciphertext is accessible only to service_role. New tables have RLS, no browser grants, no browser policies. The resulting advisor INFO about no policies is intentional: browsers must never read these tables.
- Asset discovery handles introspection's granular Page IDs or paginated accounts; pagination never follows provider-supplied URLs. Admin explicitly chooses a Page linked to @melatimasresidence. Facebook display names alone are not used as proof of identity.
- Connection verification reads account metadata. Local disconnect clears saved tokens and invalidates outstanding authorization; it does not revoke other Meta integrations or erase analytics.
- Pengaturan panel: status, connect/reconnect, asset selection, verify and disconnect; buttons enable only after complete server setup. Manual weekly reports remain unchanged.

## Not delivered / not yet verified live

This phase does **not** synchronize analytics, calculate weekly reach, read DMs/ad spend, or add a scheduled import. `connected` means the admin selected the authorized assets, not that statistics have been imported. `verify` reports `statistics_synced:false`. No publishing, comments, advertising or messages endpoints exist.

Actual Meta OAuth, granted assets, available statistics metrics, Vercel-protected callback navigation and signed-in desktop/mobile browser flows still require owner credentials and interactive testing. Meta documentation endpoints returned rate-limit/access errors; the OAuth implementation needs live provider acceptance before activation. Do not call this production-ready.

## Hosting setup

All integration actions are hard-disabled outside `VERCEL_ENV=preview`; database scope is `development`. Do not remove this guard merely to merge code. Production requires separate credential scope and security review.

Stable branch callback (registered exactly, including query):

`https://melatimasleads-git-feature-v2-crm-devel-7b8c22-zarifin8891-spec.vercel.app/api/meta?action=callback`

Vercel environment variables are scoped to **Preview and feature/v2-crm-development-20261029 only**:

| Variable | Setup |
|---|---|
| SUPABASE_URL | Existing Melati Mas project URL, configured |
| META_CALLBACK_URL | Stable branch callback above, configured |
| META_GRAPH_VERSION | v26.0, configured; pin and validate in Meta app |
| META_ENABLED | false until owner finishes secrets/callback |
| META_TOKEN_ENCRYPTION_KEY | Cryptographically generated 32-byte Base64 secret, provisioned server-side; never committed |
| META_APP_SECRET | Owner enters App Secret directly in Vercel as Secret |
| SUPABASE_SERVICE_ROLE_KEY | Owner enters existing project's service_role server key directly in Vercel as Secret |

Never send either owner secret in chat, screenshots or Git. The service role bypasses database RLS, so keep branch code trusted and all endpoint authorization checks intact. Do not rotate this database key as part of setup. Do not use the publishable browser key in its place.

After secrets: register callback under Facebook Login for Business settings, enable `META_ENABLED=true` for this branch and redeploy Preview. Open the **stable branch alias**, sign into Vercel if required, then sign into CRM as active admin. Open Pengaturan → Koneksi Statistik Meta → Hubungkan Meta. After consent return, select and verify the intended Page/Instagram. App administrators/testers and Meta access-level restrictions still apply. Do not disable deployment protection to make OAuth work; inspect any sign-in interruption first.

## Database migration

Applied migration `mmr_v2_meta_oauth_backend`. SQL source: db/meta-backend.sql. Two new server-only tables and two service-only SECURITY INVOKER functions; no existing tables/constraints/data are modified. No real provider token has been saved. Tests use rollback.

## Validation

- Node integration tests with mock Supabase/Meta: encryption/tamper, preview-only config, login/admin/inactive checks, CSRF origin, callback host, single-use state, browser mismatch, cancellation, missing permissions, explicit asset match, pagination host safety, expiry/revocation, token erasure, stale revision and granular system-user asset discovery.
- Real database transaction tests: correct/wrong browser, replay, expired state, stale revision, anon/authenticated privilege denials. Rolled back.
- Syntax checks for new JS/MJS.
- Deployment smoke test must be recorded after push. OAuth live tests remain pending owner secret configuration.

## References

- https://www.postman.com/meta/instagram/request/0vuw3vk/get-access-tokens-of-pages-you-manage
- https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
- https://github.com/meta/facebook-ios-sdk/blob/main/CHANGELOG.md
- https://supabase.com/docs/guides/api/securing-your-api
- https://vercel.com/docs/functions/runtimes/node-js
