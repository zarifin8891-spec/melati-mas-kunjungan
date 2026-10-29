-- Additive server-only OAuth storage. No consumer data is modified.
begin;
create table public.mmr_v2_meta_connections (
 scope text primary key check (scope = 'development'),
 revision uuid not null default gen_random_uuid(),
 credential text,
 connected_by uuid references public.profiles(id),
 expires_at timestamptz,
 permissions text[] not null default '{}',
 page_id text,
 page_name text,
 instagram_id text,
 instagram_username text,
 status text not null default 'not_connected' check (status in ('not_connected','awaiting_asset','connected','reconnect_required')),
 updated_at timestamptz not null default now()
);
create table public.mmr_v2_meta_states (
 state_hash text primary key,
 browser_hash text not null,
 scope text not null references public.mmr_v2_meta_connections(scope),
 revision uuid not null,
 admin_id uuid not null references public.profiles(id),
 expires_at timestamptz not null
);
alter table public.mmr_v2_meta_connections enable row level security;
alter table public.mmr_v2_meta_states enable row level security;
revoke all on public.mmr_v2_meta_connections, public.mmr_v2_meta_states from public, anon, authenticated;
grant select,insert,update,delete on public.mmr_v2_meta_connections, public.mmr_v2_meta_states to service_role;
create index mmr_v2_meta_states_expiry_idx on public.mmr_v2_meta_states(expires_at);
create index mmr_v2_meta_states_admin_idx on public.mmr_v2_meta_states(admin_id);

create function public.mmr_v2_meta_start(p_admin uuid,p_state text,p_browser text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare r uuid;
begin
 if not exists(select 1 from public.profiles where id=p_admin and active and role='admin') then raise exception 'Admin required'; end if;
 insert into public.mmr_v2_meta_connections(scope) values('development') on conflict do nothing;
 update public.mmr_v2_meta_connections set revision=gen_random_uuid(),updated_at=now() where scope='development' returning revision into r;
 delete from public.mmr_v2_meta_states where scope='development';
 insert into public.mmr_v2_meta_states values(p_state,p_browser,'development',r,p_admin,now()+interval '10 minutes');
 return r;
end $$;
create function public.mmr_v2_meta_consume(p_state text,p_browser text)
returns setof public.mmr_v2_meta_states language sql security invoker set search_path='' as $$
 delete from public.mmr_v2_meta_states s using public.mmr_v2_meta_connections c
 where s.state_hash=p_state and s.browser_hash=p_browser and s.expires_at>now()
 and s.scope=c.scope and s.revision=c.revision
 returning s.*;
$$;
revoke all on function public.mmr_v2_meta_start(uuid,text,text),public.mmr_v2_meta_consume(text,text) from public,anon,authenticated;
grant execute on function public.mmr_v2_meta_start(uuid,text,text),public.mmr_v2_meta_consume(text,text) to service_role;
commit;
