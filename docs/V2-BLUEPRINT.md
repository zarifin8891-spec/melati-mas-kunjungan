# Melati Mas Residence V2.0

Baseline: 3c7c4392d9e35f00bc568f0d7e056454fb1baf0d. Preserve navy #1F4E79 and approved vibrant Pie 3D category mapping.

## Verified database audit — 29 October 2026

Project xfujcoemuwopzstxzmir is ACTIVE_HEALTHY and accessible through the SiKoyekMaster account connection. Public tables: profiles, master_data, kunjungan_konsumen, web_app_pages. All have RLS enabled. Eight existing migrations were found; do not replay them. Other kavio schema objects coexist in this database and must remain outside this application's changes.

Existing roles are admin and marketing. Visit SELECT/UPDATE policies allow all authenticated users; INSERT accepts own created_by or null; DELETE requires is_admin(). Master writes require an active admin; reads allow authenticated users. Profiles allow own SELECT/UPDATE plus admin policies. Before expansion, inspect column grants and function definitions: own UPDATE may permit role/active changes unless separately restricted. Current visit policies do not themselves enforce active profile status. These are audit findings, not confirmed exploit tests. No production mutation or authentication attack test has been run.

Advisor warnings include mutable search_path and publicly executable SECURITY DEFINER functions. Review each function's purpose and grants before preparing additive security fixes. Do not blindly revoke the is_admin helper required by RLS.

## Workbook mapping

Petunjuk: workflow guidance and overdue follow-up rules. Pengaturan: source, stage, interest, sales, unit type, objection, platform. Leads: unique prospect, arrival date, contact, source/campaign, unit type, budget, stage, assigned sales, next follow-up, notes. Kunjungan: lead relation, visit date, accompanying sales, viewed unit, interest, objection, next action. MediaSosial: weekly platform metrics, spend, organic source leads, CPL, engagement rate. Dashboard: period cohort funnel, visit events, source/sales conversion, objections, interest, weekly trend and media performance.

Workbook example rows are not production data. Booking counts include Akad. Funnel survey counts distinct leads with at least one visit; visit KPI counts events. Follow-up overdue excludes Akad/Batal. Social organic attribution must not silently include paid Meta/TikTok sources. Zero lead denominator should show no applicable CPL rather than suggest free acquisition.

## Proposed additive model

leads 1:N lead_followups; leads 1:N site_visits; leads 1:N bookings; bookings 1:0..1 akad. Names are provisional until schema implementation review. Add social_performance with unique week/platform and separate V2 dropdown definitions: legacy master_data category CHECK currently accepts only pembayaran/sumber/status/penerima/pekerjaan. Do not insert new categories without a reviewed migration.

Retain legacy kunjungan_konsumen and its current interface. Build an explicit, idempotent legacy mapping with source record IDs and a preview of duplicate phone matches; never merge contacts by name alone. Do not fabricate visit interest, booking dates or akad dates from legacy status text. Preserve source values and flag ambiguous mappings for review. Use soft archive and audit events for new workflow records. Normalize WA for matching while retaining the original input.

## Delivery sequence

1. Complete grants/functions/Edge Function audit and capture actual row counts; inventory deployment source and authentication settings.
2. Prepare isolated development data environment and reviewed additive migrations; no production execution during blueprint stage.
3. Introduce reusable navy compact layout, scoped styles, explicit module loading, table overflow on phones and a single session/role authority. Retain approved charts.
4. Implement Leads and follow-up timeline/reminders, then linked site visits, then Booking/Akad with transactional transitions.
5. Add weekly social metrics and cohort dashboard. Keep lead cohort dates distinct from booking/akad event dates.
6. Verify admin/marketing/inactive/anonymous access through the actual API, legacy CRUD regression, duplicate/concurrent saves, invalid transitions, cohort counts, phone layouts and PWA updates. Review before production merge.

## Release gates

No destructive migration. No production merge before tests. No new permission scope inferred from a hidden UI control. Preserve existing business access while blocking role escalation and enforcing inactive status in reviewed server policies. Backup and restore rehearsal precede any legacy backfill. Development branch alone must not be assumed to provide database isolation.
