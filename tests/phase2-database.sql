begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where active and role='marketing' limit 1),true);
select set_config('mmr.test_admin',(select id::text from public.profiles where active and role='admin' limit 1),true);
select set_config('mmr.test_a',gen_random_uuid()::text,true),set_config('mmr.test_b',gen_random_uuid()::text,true),set_config('mmr.test_booking',gen_random_uuid()::text,true),set_config('mmr.test_cancel',gen_random_uuid()::text,true);
set local role authenticated;
do $test$
declare a uuid:=current_setting('mmr.test_a')::uuid;b uuid:=current_setting('mmr.test_b')::uuid;book uuid:=current_setting('mmr.test_booking')::uuid;bc uuid:=current_setting('mmr.test_cancel')::uuid;blocked boolean;u text:='TEST-'||a::text;
begin
 insert into public.mmr_v2_leads(id,tanggal_masuk,nama,telepon,sumber,sales,next_followup,created_by) values(a,current_date,'TEST rollback A','081234567890','Walk-in','TEST',current_date,auth.uid()),(b,current_date,'TEST rollback B','081234567891','Walk-in','TEST',current_date,auth.uid());
 blocked:=false;begin insert into public.mmr_v2_bookings(lead_id,tanggal,unit,pembayaran,next_followup,created_by) values(a,current_date,u,'KPR',current_date,auth.uid());exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'booking without visit allowed';end if;
 blocked:=false;begin insert into public.mmr_v2_visits(lead_id,tanggal,sales,unit,minat,next_followup,created_by) values(a,current_date-1,'TEST','TEST','Sedang',current_date,auth.uid());exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'visit before lead allowed';end if;
 insert into public.mmr_v2_visits(lead_id,tanggal,sales,unit,minat,next_followup,created_by) values(a,current_date,'TEST','TEST','Tinggi',current_date+1,auth.uid()),(b,current_date,'TEST','TEST','Sedang',current_date+1,auth.uid());
 blocked:=false;begin update public.mmr_v2_leads set tanggal_masuk=current_date+2,next_followup=current_date+3 where id=a;exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'lead date moved beyond visit';end if;
 blocked:=false;begin update public.mmr_v2_leads set next_followup=current_date-1 where id=a;exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'followup before intake allowed';end if;
 if not exists(select 1 from public.mmr_v2_pipeline where id=a and pipeline_status='Sudah survei') then raise exception 'visit stage failed';end if;
 insert into public.mmr_v2_bookings(id,lead_id,tanggal,unit,pembayaran,nominal_booking,next_followup,created_by) values(book,a,current_date,'  '||u||'  ','KPR',1000000,current_date+2,auth.uid());
 if not exists(select 1 from public.mmr_v2_pipeline where id=a and pipeline_status='Booking') then raise exception 'booking pipeline failed';end if;
 blocked:=false;begin insert into public.mmr_v2_bookings(lead_id,tanggal,unit,pembayaran,next_followup,created_by) values(b,current_date,lower(u),'KPR',current_date,auth.uid());exception when unique_violation then blocked:=true;end;if not blocked then raise exception 'duplicate unit allowed';end if;
 blocked:=false;begin insert into public.mmr_v2_bookings(lead_id,tanggal,unit,pembayaran,next_followup,created_by) values(a,current_date,u||'-2','KPR',current_date,auth.uid());exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'duplicate lead booking allowed';end if;
 blocked:=false;begin update public.mmr_v2_leads set status='Batal' where id=a;exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'active booking lead cancelled directly';end if;
 blocked:=false;begin update public.mmr_v2_bookings set status='Akad' where id=book;exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'akad without event allowed';end if;
 blocked:=false;begin update public.mmr_v2_bookings set status='Batal',alasan_batal='TEST' where id=book;exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'marketing cancellation allowed';end if;
 blocked:=false;begin insert into public.mmr_v2_akad(booking_id,tanggal,nomor_referensi,created_by) values(book,current_date-1,'TEST',auth.uid());exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'akad before booking allowed';end if;
 insert into public.mmr_v2_akad(booking_id,tanggal,nomor_referensi,created_by) values(book,current_date,'TEST',auth.uid());
 if not exists(select 1 from public.mmr_v2_pipeline where id=a and pipeline_status='Akad') then raise exception 'akad pipeline failed';end if;
 blocked:=false;begin insert into public.mmr_v2_followups(lead_id,tanggal,metode,hasil,next_followup,created_by) values(a,current_date,'WhatsApp','TEST',current_date+3,auth.uid());exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'followup after akad allowed';end if;
 blocked:=false;begin insert into public.mmr_v2_visits(lead_id,tanggal,sales,unit,minat,next_followup,created_by) values(a,current_date,'TEST','TEST','Tinggi',current_date+3,auth.uid());exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'visit after akad allowed';end if;
 blocked:=false;begin insert into public.mmr_v2_akad(booking_id,tanggal,nomor_referensi,created_by) values(book,current_date,'TEST duplicate',auth.uid());exception when unique_violation then blocked:=true;end;if not blocked then raise exception 'duplicate akad allowed';end if;
 insert into public.mmr_v2_bookings(id,lead_id,tanggal,unit,pembayaran,next_followup,created_by) values(bc,b,current_date,u||'-C','Cash Keras',current_date+2,auth.uid());
end $test$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('mmr.test_admin'),true);
set local role authenticated;
do $test$
declare bc uuid:=current_setting('mmr.test_cancel')::uuid;b uuid:=current_setting('mmr.test_b')::uuid;blocked boolean;
begin
 blocked:=false;begin update public.mmr_v2_bookings set status='Batal',alasan_batal='' where id=bc;exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'empty cancellation reason allowed';end if;
 update public.mmr_v2_bookings set status='Batal',alasan_batal='TEST rollback cancellation',next_followup=current_date+3 where id=bc;
 if not exists(select 1 from public.mmr_v2_bookings where id=bc and cancelled_by=auth.uid() and cancelled_at is not null) then raise exception 'cancel actor failed';end if;
 if not exists(select 1 from public.mmr_v2_pipeline where id=b and pipeline_status='Sudah survei' and next_followup=current_date+3) then raise exception 'cancel stage failed';end if;
 insert into public.mmr_v2_bookings(lead_id,tanggal,unit,pembayaran,next_followup,created_by) select b,current_date,unit,'Cash Keras',current_date+4,auth.uid() from public.mmr_v2_bookings where id=bc;
end $test$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $test$ begin
 if exists(select 1 from public.mmr_v2_pipeline) or exists(select 1 from public.mmr_v2_visits) or exists(select 1 from public.mmr_v2_bookings) or exists(select 1 from public.mmr_v2_akad) then raise exception 'unknown profile could read pipeline';end if;
end $test$;
reset role;
set local role anon;
do $test$ begin
 begin perform count(*) from public.mmr_v2_pipeline;raise exception 'anonymous pipeline allowed';exception when insufficient_privilege then null;end;
end $test$;
reset role;
rollback;
select jsonb_build_object('result','PASS: visit, booking, akad, duplicate units/leads, dates, cancellation roles, derived stages, anonymous/unknown profile; rolled back','legacy_visits',(select count(*) from public.kunjungan_konsumen),'leads',(select count(*) from public.mmr_v2_leads),'visits',(select count(*) from public.mmr_v2_visits),'bookings',(select count(*) from public.mmr_v2_bookings),'akad',(select count(*) from public.mmr_v2_akad)) as verification;
