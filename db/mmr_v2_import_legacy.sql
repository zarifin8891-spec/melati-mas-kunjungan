do $$
declare r public.kunjungan_konsumen; lid uuid; expected bigint;begin
 select count(*) into expected from public.kunjungan_konsumen;
 for r in select * from public.kunjungan_konsumen s where not exists(select 1 from public.mmr_v2_legacy_map m where m.legacy_id=s.id) order by tanggal,id loop
  lid=gen_random_uuid();
  insert into public.mmr_v2_leads(id,tanggal_masuk,nama,telepon,sumber,sales,next_followup,catatan,created_by,created_at)
  values(lid,r.tanggal,trim(r.nama),case when length(trim(coalesce(r.telepon,''))) between 8 and 30 then trim(r.telepon) else 'Belum diisi' end,coalesce(nullif(trim(r.sumber),''),'Belum diisi'),coalesce(nullif(trim(r.penerima),''),'Belum diisi'),r.tanggal,
   concat_ws(E'\n','Status awal: '||coalesce(r.status,'Belum diisi'),'Metode bayar: '||coalesce(r.pembayaran,'Belum diisi'),'Alamat: '||coalesce(r.alamat,''),'Pekerjaan: '||coalesce(r.pekerjaan,''),r.deskripsi),r.created_by,coalesce(r.created_at,now()));
  insert into public.mmr_v2_legacy_map(legacy_id,lead_id,source_snapshot) values(r.id,lid,to_jsonb(r));
  update public.mmr_v2_leads set status=case when r.status='Tidak lanjut/Cari perumahan lain' then 'Batal' else 'Sudah survei' end where id=lid;
 end loop;
 if (select count(*) from public.mmr_v2_legacy_map m join public.kunjungan_konsumen s on s.id=m.legacy_id)<>expected then raise exception 'Tidak semua data sumber terpetakan';end if;
 if exists(select 1 from public.mmr_v2_legacy_map m join public.kunjungan_konsumen s on s.id=m.legacy_id where m.source_snapshot<>to_jsonb(s)) then raise exception 'Snapshot sumber tidak sesuai';end if;
 if exists(select 1 from public.mmr_v2_legacy_map m where not exists(select 1 from public.mmr_v2_all_visits v where v.id=m.legacy_id and v.lead_id=m.lead_id)) then raise exception 'Kunjungan riwayat hilang';end if;
end $$;
