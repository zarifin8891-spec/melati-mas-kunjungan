create table public.mmr_v2_meta_weekly (
 scope text not null check (scope='development'),
 asset_id text not null check (asset_id ~ '^[0-9]+$'),
 platform text not null check (platform in ('Facebook','Instagram')),
 metric text not null,
 start_date date not null,
 end_date date not null check (end_date=start_date+6),
 value bigint not null check (value>=0),
 timezone text not null check (timezone='America/Los_Angeles'),
 checked_at timestamptz not null,
 primary key (scope,asset_id,metric,start_date)
);
alter table public.mmr_v2_meta_weekly enable row level security;
revoke all on public.mmr_v2_meta_weekly from anon,authenticated;
grant select on public.mmr_v2_meta_weekly to authenticated;
grant select,insert,update on public.mmr_v2_meta_weekly to service_role;
create policy active_read on public.mmr_v2_meta_weekly for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing'))
);