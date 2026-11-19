alter table public.mmr_v2_leads
 add column instagram_account_id text,
 add column instagram_sender_id text;
alter table public.mmr_v2_leads add constraint mmr_v2_leads_instagram_identity_check check (
 (instagram_account_id is null and instagram_sender_id is null) or
 (instagram_account_id is not null and instagram_sender_id is not null and instagram_account_id ~ '^[0-9]+$' and instagram_sender_id ~ '^[0-9]+$')
);
create unique index mmr_v2_leads_instagram_sender_key on public.mmr_v2_leads(instagram_account_id,instagram_sender_id);
