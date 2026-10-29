# Meta integration preparation — 29 October 2026

## Confirmed targets

- Instagram Professional: @melatimasresidence.
- Facebook: Melati Mas Residence Cibodas, https://www.facebook.com/melatimas.residence/ (user supplied).
- User confirms both appear together in Meta Business Suite.
- TikTok: @melatimasresidence, separate future authorization.

These confirmations identify intended assets; they do not establish API authorization or numeric asset IDs. Current runtime has no OAuth endpoint, stored provider token, synchronization job, or live statistics access. Manual weekly entry remains available.

## Implementation blueprint

Use Instagram API with Facebook Login to discover linked Page and Instagram assets through one Meta authorization flow. Keep existing Supabase app login independent. Restrict connecting/disconnecting and choosing assets to an active application admin, checked server side using the profiles table.

1. Create a Meta developer app with Page/Instagram access and configure its supported business login flow. Record App ID and supported Graph API version. Provision App Secret only in secure backend settings.
2. Choose a stable development callback URL before configuring Meta valid OAuth redirect URIs. Do not derive redirect origins from untrusted requests or rotating preview hostnames. Verify deployment protection compatibility.
3. Implement server start/callback routes. Store short-lived, random, single-use OAuth state bound to the initiating authenticated admin and exact redirect. Reject missing, expired, reused, or mismatched state. Exchange codes server side; never return tokens in browser URLs or log them.
4. Fetch authorized assets, paginate results, and let the admin confirm the intended Page/Instagram IDs. Do not automatically bind the first returned Page or match display names alone.
5. Keep provider credentials encrypted and inaccessible to browser roles. Expose only connection status and nonsecret asset metadata. Validate authorization again for manual sync and disconnect. On revoked/expired consent, mark reconnection required and retain historical analytics.
6. Add an idempotent fetch worker, rate-limit handling, retry/backoff, and safe error reporting. Pin a supported API version after testing app permissions and current metric availability.
7. Store imported measurements separately from manual mmr_v2_social entries. Each metric records provider, asset ID, API metric name/version, period start/end, aggregation semantics, timezone, fetched_at and availability. Unique keys prevent duplicate imports. Never overwrite manual reports silently or sum daily unique reach as weekly unique reach.
8. Compare a completed week against Meta Business Suite before enabling dashboard use; show data source and last successful synchronization. Unsupported metrics remain unavailable, never fabricated zero. DM counts and advertising spend are separate scope decisions.

## Access preparation

Owner must create/access their developer app using the Facebook administrator account and retain app ownership. App ID is public; App Secret, access tokens, password and OTP must never be requested in chat or committed. App review, business verification, tester roles, and permission availability must be evaluated from the actual app dashboard before expanding beyond internal testing. Do not promise access approval.

## Validation gate

Test admin/marketing/anonymous access, OAuth cancellation and invalid/replayed state, asset mismatch, expired/revoked tokens, pagination, duplicate sync, unsupported metrics, timezone boundaries and preservation of manual rows. No production enablement until these checks and authenticated browser tests pass.

## References

- Official Meta Instagram API collection: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- Meta developer apps: https://developers.facebook.com/apps/

No database migration or OAuth deployment is included in this preparation change.
