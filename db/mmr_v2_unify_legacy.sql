-- Unified archive: preserve each source row exactly and map it once to a V2 lead.
-- No original row is deleted; no unrecorded unit, interest, follow-up, or Akad is fabricated.
create table public.mmr_v2_legacy_map (
 legacy_id uuid primary key,lead_id uuid not null unique references public.mmr_v2_leads(id) on delete restrict,
 source_snapshot jsonb not null,imported_at timestamptz not null default now()
);
alter table public.mmr_v2_legacy_map enable row level security;
revoke all on public.mmr_v2_legacy_map from anon,authenticated;
grant select on public.mmr_v2_legacy_map to authenticated;
grant all on public.mmr_v2_legacy_map to service_role;
create policy active_read on public.mmr_v2_legacy_map for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing')));
create view public.mmr_v2_all_visits with(security_invoker=true) as
 select v.id,v.lead_id,v.tanggal,v.sales,v.unit,v.minat,v.keberatan,v.tindak_lanjut,v.next_followup,v.created_by,v.created_at,l.nama lead_name,l.lead_no,l.sales lead_sales,'v2'::text origin
 from public.mmr_v2_visits v join public.mmr_v2_leads l on l.id=v.lead_id
 union all
 select m.legacy_id,m.lead_id,(m.source_snapshot->>'tanggal')::date,coalesce(nullif(trim(m.source_snapshot->>'penerima'),''),'Belum diisi'),null::text,null::text,null::text,m.source_snapshot->>'deskripsi',null::date,nullif(m.source_snapshot->>'created_by','')::uuid,coalesce((m.source_snapshot->>'created_at')::timestamptz,m.imported_at),l.nama,l.lead_no,l.sales,'legacy'::text
 from public.mmr_v2_legacy_map m join public.mmr_v2_leads l on l.id=m.lead_id;
revoke all on public.mmr_v2_all_visits from anon,authenticated;
grant select on public.mmr_v2_all_visits to authenticated,service_role;
create or replace view public.mmr_v2_pipeline with(security_invoker=true) as
 select l.*,coalesce(b.status,case when m.source_snapshot->>'status'='Closing/Booking' and not exists(select 1 from public.mmr_v2_bookings h where h.lead_id=l.id) then 'Booking (riwayat)' else l.status end) pipeline_status,b.id active_booking_id,
 m.legacy_id,m.source_snapshot->>'status' legacy_status,
 (m.legacy_id is not null and l.status<>'Batal' and b.status is distinct from 'Akad' and l.next_followup=(m.source_snapshot->>'tanggal')::date and not exists(select 1 from public.mmr_v2_followups f where f.lead_id=l.id) and not exists(select 1 from public.mmr_v2_visits v where v.lead_id=l.id) and not exists(select 1 from public.mmr_v2_bookings h where h.lead_id=l.id)) needs_followup_schedule
 from public.mmr_v2_leads l left join public.mmr_v2_bookings b on b.lead_id=l.id and b.status<>'Batal' left join public.mmr_v2_legacy_map m on m.lead_id=l.id;

create or replace function public.mmr_v2_stage_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.status is distinct from old.status and exists(select 1 from public.mmr_v2_bookings b where b.lead_id=new.id and b.status<>'Batal') then raise exception 'Status closing mengikuti Booking/Akad aktif. Batalkan booking melalui administrator terlebih dahulu.'; end if;
 if new.status='Sudah survei' and (tg_op='INSERT' or new.status is distinct from old.status) and not exists(select 1 from public.mmr_v2_all_visits v where v.lead_id=new.id) then raise exception 'Catat kunjungan lokasi terlebih dahulu.'; end if;
 return new;
end $$;

create or replace function public.mmr_v2_booking_validate() returns trigger language plpgsql security invoker set search_path='' as $$
declare l public.mmr_v2_leads; begin
 select * into l from public.mmr_v2_leads where id=new.lead_id for update;
 if tg_op='INSERT' then
  if not found or (l.status='Batal' or exists(select 1 from public.mmr_v2_bookings b where b.lead_id=l.id and b.status<>'Batal')) or new.status<>'Booking' then raise exception 'Lead tidak tersedia untuk booking.'; end if;
  if not exists(select 1 from public.mmr_v2_all_visits v where v.lead_id=new.lead_id and v.tanggal<=new.tanggal) then raise exception 'Booking memerlukan kunjungan pada/sebelum tanggal booking.'; end if;
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

create or replace function public.mmr_v2_lead_chronology() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status<>'Batal' and new.next_followup<new.tanggal_masuk then raise exception 'Jadwal follow-up mendahului tanggal masuk lead.';end if;
 if tg_op='UPDATE' and new.tanggal_masuk is distinct from old.tanggal_masuk then
  if exists(select 1 from public.mmr_v2_all_visits v where v.lead_id=new.id and v.tanggal<new.tanggal_masuk) or exists(select 1 from public.mmr_v2_followups f where f.lead_id=new.id and f.tanggal<new.tanggal_masuk) then raise exception 'Tanggal masuk melewati kunjungan atau follow-up yang sudah tercatat.';end if;
 end if;
 return new;
end $$;
