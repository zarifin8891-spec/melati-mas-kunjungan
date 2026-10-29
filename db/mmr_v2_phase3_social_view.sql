create index mmr_leads_source_date on public.mmr_v2_leads(sumber,tanggal_masuk);
create view public.mmr_v2_social_metrics with(security_invoker=true) as
select s.*,(select count(*) from public.mmr_v2_leads l where l.sumber=s.platform and l.tanggal_masuk>=s.minggu and l.tanggal_masuk<s.minggu+7) as organic_leads from public.mmr_v2_social s;
revoke all on public.mmr_v2_social_metrics from anon,authenticated;
grant select on public.mmr_v2_social_metrics to authenticated,service_role;
