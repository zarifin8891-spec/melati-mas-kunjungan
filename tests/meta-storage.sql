begin;
do $$
declare admin_id uuid; state_row public.mmr_v2_meta_states; n integer;
begin
 select id into admin_id from public.profiles where active and role='admin' limit 1;
 if admin_id is null then raise exception 'Test requires existing active admin'; end if;
 perform public.mmr_v2_meta_start(admin_id,'fixture-state','fixture-browser');
 select count(*) into n from public.mmr_v2_meta_consume('fixture-state','wrong-browser');
 if n<>0 then raise exception 'Wrong browser accepted'; end if;
 select count(*) into n from public.mmr_v2_meta_consume('fixture-state','fixture-browser');
 if n<>1 then raise exception 'Valid state not consumed'; end if;
 select count(*) into n from public.mmr_v2_meta_consume('fixture-state','fixture-browser');
 if n<>0 then raise exception 'State replay accepted'; end if;
 perform public.mmr_v2_meta_start(admin_id,'expired-state','browser');
 update public.mmr_v2_meta_states set expires_at=now()-interval '1 second' where state_hash='expired-state';
 select count(*) into n from public.mmr_v2_meta_consume('expired-state','browser');
 if n<>0 then raise exception 'Expired state accepted'; end if;
 perform public.mmr_v2_meta_start(admin_id,'stale-state','browser');
 update public.mmr_v2_meta_connections set revision=gen_random_uuid() where scope='development';
 select count(*) into n from public.mmr_v2_meta_consume('stale-state','browser');
 if n<>0 then raise exception 'Old connection state accepted'; end if;
end $$;
set local role authenticated;
do $$
begin
 begin perform * from public.mmr_v2_meta_connections;raise exception 'Browser read accepted';exception when insufficient_privilege then null;end;
 begin perform * from public.mmr_v2_meta_states;raise exception 'Browser state read accepted';exception when insufficient_privilege then null;end;
 begin perform public.mmr_v2_meta_consume('x','y');raise exception 'Browser RPC accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$
begin
 begin perform * from public.mmr_v2_meta_connections;raise exception 'Anon read accepted';exception when insufficient_privilege then null;end;
 begin perform public.mmr_v2_meta_start(gen_random_uuid(),'x','y');raise exception 'Anon RPC accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: state/browser/replay/expiry/revision and browser grants' as result;
rollback;
