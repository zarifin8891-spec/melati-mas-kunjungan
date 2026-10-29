# V2.0 phase 1 — Leads and Follow-up

Decision: continue existing Supabase project xfujcoemuwopzstxzmir. Legacy application retirement will occur after V2 acceptance. New tables use mmr_v2_ prefix. Existing visits are retained as historical data; no automatic backfill or deduplication has been performed.

Applied migration: mmr_v2_leads_followups_phase1 (script db/mmr_v2_phase1.sql). The migration creates only the new CRM tables/indexes/policies/functions plus an additive profile-authority guard trigger. The guard preserves admin management and stops non-admin updates to role, active, email and id. Do not replay this script; consult Supabase migration history first.

Implemented: lead creation/editing, unique generated lead number, duplicate normalized phone warning, source/campaign, budget, type, sales, status and next contact date; server pagination (50), search and overdue/today filters. Follow-up history is append-only; insertion and lead scheduling run in one transaction via trigger. Cancelled leads reject follow-ups. Concurrent stale lead edits return a conflict. Authenticated active admin/marketing users share CRM data, matching legacy team access; inactive/missing profiles and anonymous requests cannot access new CRM records. No hard delete action is provided.

Dashboard blue CSS and stable Pie 3D category colors are inherited unchanged. Required legacy enhancement scripts now load explicitly on first page load. PWA v25 caches only same-origin static shell resources, never Supabase requests.

Verification: all inline/new JavaScript syntax checks passed. Database transaction tests passed for lead insert/read/update, normalized phone, atomic scheduling, cancelled lead rejection, negative budget, profile role escalation rejection, missing/inactive profiles and anonymous access. Fixtures and temporary inactive status were rolled back. Baseline counts remained 61 visits, 23 master records, 3 profiles; zero CRM test records persisted. Table DELETE has no browser grant.

Browser UI test is included at tests/crm-phase1.cjs (requires Playwright; run from repository root). Local execution is currently blocked because no Chromium binary is installed and the browser download returned an invalid archive. Therefore browser interaction, visual mobile checks, full existing-login regression and real browser-to-Supabase saves remain pending. A Vercel READY state alone is not functional verification. Do not merge production until these checks pass.

Next phases: linked site visits and verified legacy mapping; booking/akad transactions; editable V2 master lists and weekly social metrics; cohort funnel dashboard. Stage choices currently stop at Sudah survei/Batal to avoid fabricating booking/akad events.
