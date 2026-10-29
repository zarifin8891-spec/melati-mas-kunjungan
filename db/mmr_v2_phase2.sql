-- Additive phase 2. Existing constraints and stored lead statuses are preserved.
create table public.mmr_v2_visits (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.mmr_v2_leads(id) on delete restrict,
 tanggal date not null, sales text not null check(length(trim(sales))>0), unit text not null check(length(trim(unit))>0),
 minat text not null check(minat in ('Tinggi','Sedang','Rendah')),
 keberatan text not null default '', tindak_lanjut text not null default '', next_followup date not null,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 check(next_followup>=tanggal)
);
create table public.mmr_v2_bookings (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.mmr_v2_leads(id) on delete restrict,
 tanggal date not null, unit text not null check(length(trim(unit))>0),
 unit_key text generated always as (upper(regexp_replace(trim(unit),'[[:space:]]+','','g'))) stored,
 pembayaran text not null check(pembayaran in ('KPR','Cash Keras','Cash Bertahap')),
 nominal_booking numeric(18,2) not null default 0 check(nominal_booking>=0),
 catatan text not null default '', next_followup date not null,
 status text not null default 'Booking' check(status in ('Booking','Akad','Batal')),
 alasan_batal text, cancelled_at timestamptz, cancelled_by uuid references auth.users(id) on delete set null,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(next_followup>=tanggal),check(status<>'Batal' or length(trim(alasan_batal))>0)
);
create unique index mmr_booking_active_lead on public.mmr_v2_bookings(lead_id) where status<>'Batal';
create unique index mmr_booking_active_unit on public.mmr_v2_bookings(unit_key) where status<>'Batal';
create table public.mmr_v2_akad (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.mmr_v2_bookings(id) on delete restrict,
 tanggal date not null, nomor_referensi text not null check(length(trim(nomor_referensi))>0), catatan text not null default '',
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index mmr_visits_lead on public.mmr_v2_visits(lead_id,tanggal desc);
create index mmr_visits_created_by on public.mmr_v2_visits(created_by);
create index mmr_visits_date on public.mmr_v2_visits(tanggal desc,created_at desc);
create index mmr_bookings_lead on public.mmr_v2_bookings(lead_id);
create index mmr_bookings_created_by on public.mmr_v2_bookings(created_by);
create index mmr_bookings_cancelled_by on public.mmr_v2_bookings(cancelled_by);
create index mmr_bookings_date on public.mmr_v2_bookings(tanggal desc,created_at desc);
create index mmr_akad_created_by on public.mmr_v2_akad(created_by);
create index mmr_akad_date on public.mmr_v2_akad(tanggal);
-- Explicit grants with active-profile RLS; events are append-only.
alter table public.mmr_v2_visits enable row level security;
alter table public.mmr_v2_bookings enable row level security;
alter table public.mmr_v2_akad enable row level security;
revoke all on public.mmr_v2_visits,public.mmr_v2_bookings,public.mmr_v2_akad from anon,authenticated;
grant select,insert on public.mmr_v2_visits,public.mmr_v2_bookings,public.mmr_v2_akad to authenticated;
grant update(status,alasan_batal,next_followup,cancelled_at,cancelled_by) on public.mmr_v2_bookings to authenticated;
grant all on public.mmr_v2_visits,public.mmr_v2_bookings,public.mmr_v2_akad to service_role;
do $$ declare t text; begin
 foreach t in array array['mmr_v2_visits','mmr_v2_bookings','mmr_v2_akad'] loop
 execute format('create policy active_read on public.%I for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in (''admin'',''marketing'')))',t);
 execute format('create policy active_add on public.%I for insert to authenticated with check (created_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in (''admin'',''marketing'')))',t);
 end loop;
end $$;
-- Active marketing needs UPDATE for the Akad insertion trigger; validation restricts transitions.
create policy active_booking_update on public.mmr_v2_bookings for update to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing'))) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing')));
create function public.mmr_v2_stage_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.status is distinct from old.status and exists(select 1 from public.mmr_v2_bookings b where b.lead_id=new.id and b.status<>'Batal') then raise exception 'Status closing mengikuti Booking/Akad aktif. Batalkan booking melalui administrator terlebih dahulu.'; end if;
 if new.status='Sudah survei' and (tg_op='INSERT' or new.status is distinct from old.status) and not exists(select 1 from public.mmr_v2_visits v where v.lead_id=new.id) then raise exception 'Catat kunjungan lokasi terlebih dahulu.'; end if;
 return new;
end $$;
revoke all on function public.mmr_v2_stage_guard() from public;
create trigger mmr_stage_guard before insert or update on public.mmr_v2_leads for each row execute function public.mmr_v2_stage_guard();
create function public.mmr_v2_visit_event() returns trigger language plpgsql security invoker set search_path='' as $$
declare l public.mmr_v2_leads; begin
 select * into l from public.mmr_v2_leads where id=new.lead_id for update;
 if not found or (l.status='Batal' or exists(select 1 from public.mmr_v2_bookings b where b.lead_id=l.id and b.status='Akad')) then raise exception 'Lead tidak aktif atau sudah akad.'; end if;
 if new.tanggal<l.tanggal_masuk then raise exception 'Tanggal kunjungan mendahului tanggal masuk lead.'; end if;
 update public.mmr_v2_leads set status=case when exists(select 1 from public.mmr_v2_bookings b where b.lead_id=new.lead_id and b.status<>'Batal') then status else 'Sudah survei' end,next_followup=new.next_followup where id=new.lead_id;
 return new;
end $$;
revoke all on function public.mmr_v2_visit_event() from public;
create trigger mmr_visit_event after insert on public.mmr_v2_visits for each row execute function public.mmr_v2_visit_event();
create function public.mmr_v2_booking_validate() returns trigger language plpgsql security invoker set search_path='' as $$
declare l public.mmr_v2_leads; begin
 select * into l from public.mmr_v2_leads where id=new.lead_id for update;
 if tg_op='INSERT' then
  if not found or (l.status='Batal' or exists(select 1 from public.mmr_v2_bookings b where b.lead_id=l.id and b.status<>'Batal')) or new.status<>'Booking' then raise exception 'Lead tidak tersedia untuk booking.'; end if;
  if not exists(select 1 from public.mmr_v2_visits v where v.lead_id=new.lead_id and v.tanggal<=new.tanggal) then raise exception 'Booking memerlukan kunjungan pada/sebelum tanggal booking.'; end if;
  new.alasan_batal=null;new.cancelled_at=null;new.cancelled_by=null;
 else
  if old.status<>'Booking' then raise exception 'Booking sudah final atau telah dibatalkan.'; end if;
  if new.status='Akad' then
   if not exists(select 1 from public.mmr_v2_akad a where a.booking_id=new.id) then raise exception 'Catat akad melalui form Akad.'; end if;
  elsif new.status='Batal' then
   if not public.is_admin() then raise exception 'Pembatalan booking hanya untuk administrator aktif.'; end if;
   if exists(select 1 from public.mmr_v2_akad a where a.booking_id=new.id) then raise exception 'Booking sudah memiliki akad.'; end if;
   if coalesce(length(trim(new.alasan_batal)),0)=0 then raise exception 'Alasan pembatalan wajib diisi.'; end if;
   new.cancelled_at=clock_timestamp();new.cancelled_by=auth.uid();
  else raise exception 'Gunakan form pembatalan atau form akad.';
  end if;
 end if;
 new.updated_at=clock_timestamp();return new;
end $$;
revoke all on function public.mmr_v2_booking_validate() from public;
create trigger mmr_booking_validate before insert or update on public.mmr_v2_bookings for each row execute function public.mmr_v2_booking_validate();
create function public.mmr_v2_booking_event() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.mmr_v2_leads set next_followup=case when new.status='Akad' then next_followup else new.next_followup end where id=new.lead_id;
 return new;
end $$;
revoke all on function public.mmr_v2_booking_event() from public;
create trigger mmr_booking_event after insert or update on public.mmr_v2_bookings for each row execute function public.mmr_v2_booking_event();
create function public.mmr_v2_akad_event() returns trigger language plpgsql security invoker set search_path='' as $$
declare b public.mmr_v2_bookings; begin
 select * into b from public.mmr_v2_bookings where id=new.booking_id for update;
 if not found or b.status<>'Booking' then raise exception 'Akad memerlukan booking aktif.'; end if;
 if new.tanggal<b.tanggal then raise exception 'Tanggal akad mendahului tanggal booking.'; end if;
 update public.mmr_v2_bookings set status='Akad' where id=new.booking_id;
 return new;
end $$;
revoke all on function public.mmr_v2_akad_event() from public;
create trigger mmr_akad_event after insert on public.mmr_v2_akad for each row execute function public.mmr_v2_akad_event();
create function public.mmr_v2_followup_closing_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare l public.mmr_v2_leads; begin
 select * into l from public.mmr_v2_leads where id=new.lead_id for update;
 if not found or new.tanggal<l.tanggal_masuk or exists(select 1 from public.mmr_v2_bookings b where b.lead_id=l.id and b.status='Akad') then raise exception 'Lead sudah akad atau tanggal kontak tidak valid.'; end if;
 return new;
end $$;
revoke all on function public.mmr_v2_followup_closing_guard() from public;
create trigger mmr_followup_closing_guard before insert on public.mmr_v2_followups for each row execute function public.mmr_v2_followup_closing_guard();
create view public.mmr_v2_pipeline with(security_invoker=true) as
 select l.*,coalesce(b.status,l.status) as pipeline_status,b.id as active_booking_id from public.mmr_v2_leads l left join public.mmr_v2_bookings b on b.lead_id=l.id and b.status<>'Batal';
revoke all on public.mmr_v2_pipeline from anon,authenticated;
grant select on public.mmr_v2_pipeline to authenticated,service_role;
