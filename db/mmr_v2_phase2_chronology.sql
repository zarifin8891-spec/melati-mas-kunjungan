create function public.mmr_v2_lead_chronology() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status<>'Batal' and new.next_followup<new.tanggal_masuk then raise exception 'Jadwal follow-up mendahului tanggal masuk lead.';end if;
 if tg_op='UPDATE' and new.tanggal_masuk is distinct from old.tanggal_masuk then
  if exists(select 1 from public.mmr_v2_visits v where v.lead_id=new.id and v.tanggal<new.tanggal_masuk) or exists(select 1 from public.mmr_v2_followups f where f.lead_id=new.id and f.tanggal<new.tanggal_masuk) then raise exception 'Tanggal masuk melewati kunjungan atau follow-up yang sudah tercatat.';end if;
 end if;
 return new;
end $$;
revoke all on function public.mmr_v2_lead_chronology() from public;
create trigger mmr_lead_chronology before insert or update on public.mmr_v2_leads for each row execute function public.mmr_v2_lead_chronology();
