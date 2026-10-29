create or replace view public.mmr_v2_pipeline with(security_invoker=true) as
 select l.*,coalesce(b.status,case when m.source_snapshot->>'status'='Closing/Booking' and l.status<>'Batal' and not exists(select 1 from public.mmr_v2_bookings h where h.lead_id=l.id) then 'Booking (riwayat)' else l.status end) pipeline_status,b.id active_booking_id,
 m.legacy_id,m.source_snapshot->>'status' legacy_status,
 (m.legacy_id is not null and l.status<>'Batal' and b.status is distinct from 'Akad' and l.next_followup=(m.source_snapshot->>'tanggal')::date and not exists(select 1 from public.mmr_v2_followups f where f.lead_id=l.id) and not exists(select 1 from public.mmr_v2_visits v where v.lead_id=l.id) and not exists(select 1 from public.mmr_v2_bookings h where h.lead_id=l.id)) needs_followup_schedule
 from public.mmr_v2_leads l left join public.mmr_v2_bookings b on b.lead_id=l.id and b.status<>'Batal' left join public.mmr_v2_legacy_map m on m.lead_id=l.id;

create function public.mmr_v2_period_bounds() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role in ('admin','marketing')) then raise insufficient_privilege using message='Akun aktif diperlukan';end if;
 select jsonb_build_object('from',coalesce(min(d),(now() at time zone 'Asia/Jakarta')::date),'to',greatest(coalesce(max(d),(now() at time zone 'Asia/Jakarta')::date),(now() at time zone 'Asia/Jakarta')::date)) into result
 from(select tanggal_masuk d from public.mmr_v2_leads union all select tanggal from public.mmr_v2_all_visits union all select minggu from public.mmr_v2_social)dates;
 return result;
end $$;
revoke all on function public.mmr_v2_period_bounds() from public,anon;
grant execute on function public.mmr_v2_period_bounds() to authenticated;
