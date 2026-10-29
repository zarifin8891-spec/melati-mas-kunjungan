-- Additive CRM phase 1; existing consumer records are not migrated or removed.
create table public.mmr_v2_leads (
 id uuid primary key default gen_random_uuid(),
 lead_no bigint generated always as identity unique,
 tanggal_masuk date not null,
 nama text not null check (length(trim(nama)) between 1 and 150),
 telepon text not null check(length(trim(telepon)) between 8 and 30),
 telepon_normalized text generated always as (case when regexp_replace(telepon,'[^0-9]','','g') like '0%' then '62'||substr(regexp_replace(telepon,'[^0-9]','','g'),2) else regexp_replace(telepon,'[^0-9]','','g') end) stored,
 sumber text not null check(length(trim(sumber))>0),
 kampanye text not null default '', tipe_unit text not null default '',
 budget numeric(18,2) not null default 0 check(budget>=0),
 status text not null default 'Lead baru' check(status in ('Lead baru','Dihubungi','Jadwal survei','Sudah survei','Batal')),
 sales text not null check(length(trim(sales))>0),
 next_followup date,
 catatan text not null default '',
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status='Batal' or next_followup is not null)
);
create index mmr_v2_leads_phone on public.mmr_v2_leads(telepon_normalized);
create index mmr_v2_leads_due on public.mmr_v2_leads(next_followup) where status<>'Batal';
create index mmr_v2_leads_created on public.mmr_v2_leads(created_at desc,id);
create index mmr_v2_leads_creator on public.mmr_v2_leads(created_by);
create table public.mmr_v2_followups (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.mmr_v2_leads(id) on delete restrict,
 tanggal date not null,
 metode text not null check(metode in ('WhatsApp','Telepon','Pertemuan','Lainnya')),
 hasil text not null check(length(trim(hasil))>0),
 next_followup date not null,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 check(next_followup>=tanggal)
);
create index mmr_v2_followups_lead on public.mmr_v2_followups(lead_id,created_at desc);
create index mmr_v2_followups_creator on public.mmr_v2_followups(created_by);
alter table public.mmr_v2_leads enable row level security;
alter table public.mmr_v2_followups enable row level security;
revoke all on public.mmr_v2_leads,public.mmr_v2_followups from anon,authenticated;
grant select,insert,update on public.mmr_v2_leads to authenticated;
grant select,insert on public.mmr_v2_followups to authenticated;
grant usage,select on sequence public.mmr_v2_leads_lead_no_seq to authenticated;
grant all on public.mmr_v2_leads,public.mmr_v2_followups to service_role;
grant usage,select on sequence public.mmr_v2_leads_lead_no_seq to service_role;
create policy mmr_leads_read on public.mmr_v2_leads for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing')));
create policy mmr_leads_add on public.mmr_v2_leads for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing')));
create policy mmr_leads_edit on public.mmr_v2_leads for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing'))) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing')));
create policy mmr_followups_read on public.mmr_v2_followups for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing')));
create policy mmr_followups_add on public.mmr_v2_followups for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing')));
create function public.mmr_v2_lead_stamp() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.id is distinct from old.id or new.lead_no is distinct from old.lead_no or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then raise exception 'Identitas lead tidak dapat diubah'; end if;
 new.updated_at=clock_timestamp(); return new;
end $$;
revoke all on function public.mmr_v2_lead_stamp() from public;
create trigger mmr_lead_stamp before update on public.mmr_v2_leads for each row execute function public.mmr_v2_lead_stamp();
create function public.mmr_v2_followup_schedule() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.mmr_v2_leads set next_followup=new.next_followup,status=case when status='Lead baru' then 'Dihubungi' else status end where id=new.lead_id and status<>'Batal';
 if not found then raise exception 'Lead tidak aktif atau tidak dapat diakses'; end if;
 return new;
end $$;
revoke all on function public.mmr_v2_followup_schedule() from public;
create trigger mmr_followup_schedule after insert on public.mmr_v2_followups for each row execute function public.mmr_v2_followup_schedule();
-- Preserve intended admin/marketing authority: own-profile updates must not grant admin.
create function public.mmr_v2_guard_profile_authority() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and not public.is_admin() and (new.id is distinct from old.id or new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email) then raise exception 'Hanya administrator aktif dapat mengubah hak akses'; end if;
 return new;
end $$;
revoke all on function public.mmr_v2_guard_profile_authority() from public;
create trigger mmr_guard_profile_authority before update on public.profiles for each row execute function public.mmr_v2_guard_profile_authority();
