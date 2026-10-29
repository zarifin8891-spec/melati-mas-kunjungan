begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where active and role='admin' limit 1),true);
set local role authenticated;
do $test$
declare lid uuid;book uuid:=gen_random_uuid();c bigint;d jsonb;begin
 select count(*) into c from public.mmr_v2_legacy_map;
 if c<>61 then raise exception 'expected 61 legacy mappings';end if;
 if (select count(distinct lead_id) from public.mmr_v2_legacy_map)<>c then raise exception 'duplicate mapped lead';end if;
 if (select count(*) from public.mmr_v2_all_visits where origin='legacy')<>c then raise exception 'unified visit count mismatch';end if;
 select lead_id into lid from public.mmr_v2_legacy_map where source_snapshot->>'status'='Closing/Booking' limit 1;
 if not exists(select 1 from public.mmr_v2_pipeline where id=lid and pipeline_status='Booking (riwayat)' and needs_followup_schedule) then raise exception 'historical closing stage missing';end if;
 update public.mmr_v2_leads set status='Batal' where id=lid;
 if not exists(select 1 from public.mmr_v2_pipeline where id=lid and pipeline_status='Batal') then raise exception 'historical status overrides cancellation';end if;
 update public.mmr_v2_leads set status='Sudah survei' where id=lid;
 insert into public.mmr_v2_bookings(id,lead_id,tanggal,unit,pembayaran,next_followup,created_by) values(book,lid,current_date,'TEST-MERGE-'||book::text,'KPR',current_date+1,auth.uid());
 if not exists(select 1 from public.mmr_v2_pipeline where id=lid and pipeline_status='Booking' and not needs_followup_schedule) then raise exception 'legacy visit not accepted for real booking';end if;
 update public.mmr_v2_bookings set status='Batal',alasan_batal='TEST rollback',next_followup=current_date+2 where id=book;
 if not exists(select 1 from public.mmr_v2_pipeline where id=lid and pipeline_status='Sudah survei') then raise exception 'cancelled booking resurrected historical stage';end if;
 select id into lid from public.mmr_v2_pipeline where needs_followup_schedule and pipeline_status='Sudah survei' limit 1;
 insert into public.mmr_v2_followups(lead_id,tanggal,metode,hasil,next_followup,created_by) values(lid,current_date,'WhatsApp','TEST rollback scheduling',current_date+1,auth.uid());
 if exists(select 1 from public.mmr_v2_pipeline where id=lid and needs_followup_schedule) then raise exception 'missing schedule flag did not clear';end if;
end $test$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin if exists(select 1 from public.mmr_v2_all_visits) or exists(select 1 from public.mmr_v2_legacy_map) then raise exception 'unknown profile could read history';end if;end $$;
reset role;
rollback;
select jsonb_build_object('test','PASS: 61 unique mappings, unified visits, historical booking state, cancellation priority, real booking from legacy visit, real follow-up scheduling, RLS; fixtures rolled back','source_rows',(select count(*) from public.kunjungan_konsumen),'map_rows',(select count(*) from public.mmr_v2_legacy_map),'lead_rows',(select count(*) from public.mmr_v2_leads),'new_booking_rows',(select count(*) from public.mmr_v2_bookings),'snapshot_mismatches',(select count(*) from public.mmr_v2_legacy_map m join public.kunjungan_konsumen s on s.id=m.legacy_id where m.source_snapshot<>to_jsonb(s))) verification;
