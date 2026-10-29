begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where active and role='marketing' limit 1),true);
select set_config('mmr.social_test_lead',gen_random_uuid()::text,true);
set local role authenticated;
do $test$
declare a uuid:=current_setting('mmr.social_test_lead')::uuid; b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();book uuid:=gen_random_uuid(); d jsonb;blocked boolean;start_date date:='1901-01-07';
begin
 insert into public.mmr_v2_leads(id,tanggal_masuk,nama,telepon,sumber,sales,next_followup,created_by) values(a,start_date+1,'TEST analytics','081234567890','Instagram','TEST',start_date+6,auth.uid()),(b,start_date+2,'TEST paid','081234567891','Iklan Meta','TEST',start_date+6,auth.uid()),(c,start_date+3,'TEST organic','081234567892','Instagram','TEST',start_date+6,auth.uid());
 insert into public.mmr_v2_visits(lead_id,tanggal,sales,unit,minat,keberatan,next_followup,created_by) values(a,start_date+2,'TEST','TEST','Tinggi','Harga',start_date+6,auth.uid()),(a,start_date+3,'TEST','TEST','Tinggi','Harga',start_date+6,auth.uid());
 insert into public.mmr_v2_bookings(id,lead_id,tanggal,unit,pembayaran,next_followup,created_by) values(book,a,start_date+4,'TEST-'||a::text,'KPR',start_date+6,auth.uid());
 insert into public.mmr_v2_akad(booking_id,tanggal,nomor_referensi,created_by) values(book,start_date+5,'TEST analytics',auth.uid());
 insert into public.mmr_v2_social(minggu,platform,posting,reach,engagement,klik,dm,biaya,created_by) values(start_date,'Instagram',3,1000,100,10,5,300,auth.uid());
 insert into public.mmr_v2_leads(tanggal_masuk,nama,telepon,sumber,sales,next_followup,created_by) values(start_date-20,'TEST outside cohort','081234567893','Referral','TEST OUTSIDE',start_date+6,auth.uid());
 d:=public.mmr_v2_dashboard(start_date,start_date+6);
 if (d#>>'{kpi,leads}')::int<>3 or (d#>>'{kpi,visits}')::int<>2 or (d#>>'{kpi,surveyed}')::int<>1 or (d#>>'{kpi,booking}')::int<>1 or (d#>>'{kpi,akad}')::int<>1 or (d#>>'{kpi,cpl}')::numeric<>100 then raise exception 'cohort/visit/closing/CPL mismatch: %',d->'kpi';end if;
 if not exists(select 1 from jsonb_array_elements(d->'sales') x where x->>'sales'='TEST OUTSIDE' and (x->>'leads')::int=0 and (x->>'overdue')::int=1) then raise exception 'sales overdue outside cohort missing';end if;
 if (d#>>'{social,0,leads}')::int<>2 or (d#>>'{social,0,cpl}')::numeric<>150 or (d#>>'{social,0,engagement_rate}')::numeric<>0.1 then raise exception 'organic attribution/weighted rate mismatch';end if;
 if not exists(select 1 from public.mmr_v2_social_metrics where minggu=start_date and platform='Instagram' and organic_leads=2) then raise exception 'social row metrics mismatch';end if;
 blocked:=false;begin insert into public.mmr_v2_social(minggu,platform,created_by) values(start_date,'Instagram',auth.uid());exception when unique_violation then blocked:=true;end;if not blocked then raise exception 'duplicate weekly row allowed';end if;
 blocked:=false;begin insert into public.mmr_v2_social(minggu,platform,posting,created_by) values(start_date,'TikTok',-1,auth.uid());exception when check_violation then blocked:=true;end;if not blocked then raise exception 'negative posting allowed';end if;
 blocked:=false;begin insert into public.mmr_v2_social(minggu,platform,created_by) values(start_date+1,'TikTok',auth.uid());exception when check_violation then blocked:=true;end;if not blocked then raise exception 'non-Monday week allowed';end if;
 d:=public.mmr_v2_dashboard('1801-01-01','1801-01-01');if (d#>'{kpi,cpl}')<>'null'::jsonb or (d#>>'{kpi,leads}')::int<>0 then raise exception 'zero denominator mismatch';end if;
 blocked:=false;begin perform public.mmr_v2_dashboard(start_date+1,start_date);exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'invalid period allowed';end if;
end $test$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
 begin perform public.mmr_v2_dashboard('1901-01-07','1901-01-13');raise exception 'unknown profile analytics allowed';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.mmr_v2_social_metrics) then raise exception 'unknown profile social read allowed';end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.mmr_v2_dashboard('1901-01-07','1901-01-13');raise exception 'anon RPC allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select jsonb_build_object('result','PASS: cohort vs visits, inclusive booking/akad, paid vs organic attribution, global/organic CPL, engagement rate, zero denominator, duplicate week/platform, Monday/negative checks, role restrictions; fixtures rolled back','social_rows',(select count(*) from public.mmr_v2_social),'legacy_visits',(select count(*) from public.kunjungan_konsumen)) verification;
