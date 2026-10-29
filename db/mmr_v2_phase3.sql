-- Additive weekly social metrics and RLS-aware aggregate dashboard.
create table public.mmr_v2_social (
 id uuid primary key default gen_random_uuid(), minggu date not null check(extract(isodow from minggu)=1),
 platform text not null check(platform in ('Instagram','TikTok','Threads','Facebook','YouTube')),
 posting integer not null default 0 check(posting>=0), reach bigint not null default 0 check(reach>=0),
 engagement bigint not null default 0 check(engagement>=0), klik bigint not null default 0 check(klik>=0), dm bigint not null default 0 check(dm>=0),
 biaya numeric(18,2) not null default 0 check(biaya>=0),
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(minggu,platform)
);
create index mmr_social_created_by on public.mmr_v2_social(created_by);
create index mmr_leads_intake_date on public.mmr_v2_leads(tanggal_masuk);
alter table public.mmr_v2_social enable row level security;
revoke all on public.mmr_v2_social from anon,authenticated;
grant select,insert,update on public.mmr_v2_social to authenticated;
grant all on public.mmr_v2_social to service_role;
create policy active_read on public.mmr_v2_social for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing')));
create policy active_add on public.mmr_v2_social for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing')));
create policy active_edit on public.mmr_v2_social for update to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing'))) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','marketing')));
create function public.mmr_v2_social_stamp() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.id is distinct from old.id or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then raise exception 'Identitas catatan tidak dapat diubah';end if;
 new.updated_at=clock_timestamp();return new;
end $$;
revoke all on function public.mmr_v2_social_stamp() from public;
create trigger mmr_social_stamp before update on public.mmr_v2_social for each row execute function public.mmr_v2_social_stamp();
create function public.mmr_v2_dashboard(p_from date,p_to date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if p_from is null or p_to is null or p_to<p_from then raise exception 'Periode tidak valid';end if;
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role in ('admin','marketing')) then raise insufficient_privilege using message='Akun aktif diperlukan';end if;
 with cohort as materialized (
  select l.*,exists(select 1 from public.mmr_v2_visits v where v.lead_id=l.id) surveyed from public.mmr_v2_pipeline l where l.tanggal_masuk between p_from and p_to
 ), visits_p as materialized(select * from public.mmr_v2_visits where tanggal between p_from and p_to),
 social_p as materialized(select s.*,(select count(*) from public.mmr_v2_leads l where l.sumber=s.platform and l.tanggal_masuk>=s.minggu and l.tanggal_masuk<s.minggu+7) organic_leads from public.mmr_v2_social s where s.minggu between p_from and p_to),
 k as(select count(*) leads,count(*) filter(where surveyed) surveyed,count(*) filter(where pipeline_status in ('Booking','Akad')) booking,count(*) filter(where pipeline_status='Akad') akad,count(*) filter(where pipeline_status='Batal') batal,count(*) filter(where pipeline_status='Lead baru') baru from cohort)
 select jsonb_build_object(
 'kpi',(select to_jsonb(x) from(select k.*, (select count(*) from visits_p) visits,(select coalesce(sum(biaya),0) from social_p) biaya,(select count(*) from public.mmr_v2_pipeline where pipeline_status not in ('Akad','Batal') and next_followup<(now() at time zone 'Asia/Jakarta')::date) overdue,case when k.leads=0 then null else (select coalesce(sum(biaya),0) from social_p)/k.leads end cpl from k)x),
 'sources',coalesce((select jsonb_agg(to_jsonb(x) order by x.leads desc,x.sumber) from(select sumber,count(*) leads,count(*) filter(where surveyed) survei,count(*) filter(where pipeline_status in ('Booking','Akad')) booking,count(*) filter(where pipeline_status='Akad') akad from cohort group by sumber)x),'[]'::jsonb),
 'statuses',coalesce((select jsonb_agg(jsonb_build_array(pipeline_status,n) order by n desc,pipeline_status) from(select pipeline_status,count(*) n from cohort group by pipeline_status)x),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(jsonb_build_array(pembayaran,n) order by n desc,pembayaran) from(select b.pembayaran,count(*) n from public.mmr_v2_bookings b join cohort c on c.id=b.lead_id where b.status<>'Batal' group by b.pembayaran)x),'[]'::jsonb),
 'sales',coalesce((select jsonb_agg(to_jsonb(x) order by x.leads desc,x.sales) from(select names.sales,(select count(*) from cohort c where c.sales=names.sales) leads,(select count(*) from visits_p v where v.sales=names.sales) visits,(select count(*) from cohort c where c.sales=names.sales and c.pipeline_status in ('Booking','Akad')) booking,(select count(*) from cohort c where c.sales=names.sales and c.pipeline_status='Akad') akad,(select count(*) from public.mmr_v2_pipeline c where c.sales=names.sales and c.pipeline_status not in ('Akad','Batal') and c.next_followup<(now() at time zone 'Asia/Jakarta')::date) overdue from(select sales from cohort union select sales from visits_p)names)x),'[]'::jsonb),
 'objections',coalesce((select jsonb_agg(to_jsonb(x) order by x.n desc,x.label) from(select coalesce(nullif(keberatan,''),'Tidak diisi') label,count(*) n from visits_p group by coalesce(nullif(keberatan,''),'Tidak diisi'))x),'[]'::jsonb),
 'interests',coalesce((select jsonb_agg(to_jsonb(x) order by x.n desc,x.label) from(select minat label,count(*) n from visits_p group by minat)x),'[]'::jsonb),
 'weeks',coalesce((select jsonb_agg(to_jsonb(x) order by x.minggu) from(select p_from+i*7 minggu,(select count(*) from public.mmr_v2_leads l where l.tanggal_masuk>=p_from+i*7 and l.tanggal_masuk<p_from+(i+1)*7) leads,(select count(*) from public.mmr_v2_visits v where v.tanggal>=p_from+i*7 and v.tanggal<p_from+(i+1)*7) visits from generate_series(0,7)i)x),'[]'::jsonb),
 'social',coalesce((select jsonb_agg(to_jsonb(x) order by x.platform) from(select platform,sum(posting) posting,sum(reach) reach,sum(engagement) engagement,sum(klik) klik,sum(dm) dm,sum(organic_leads) leads,sum(biaya) biaya,case when sum(organic_leads)=0 then null else sum(biaya)/sum(organic_leads) end cpl,case when sum(reach)=0 then null else sum(engagement)::numeric/sum(reach) end engagement_rate from social_p group by platform)x),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.mmr_v2_dashboard(date,date) from public,anon;
grant execute on function public.mmr_v2_dashboard(date,date) to authenticated;
