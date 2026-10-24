-- El mapa muestra borradores claramente identificados; la ficha operativa usa sólo aceptados.
create view public.store_latest_analyses with(security_invoker=true) as
select distinct on(v.store_id) v.store_id,v.id visit_id,v.visited_at,a.id analysis_id,
a.format_code,a.audience_segment,a.confidence,a.summary,a.limitations,
coalesce(r.decision,'pending') review_status
from public.visits v join public.analyses a on a.visit_id=v.id
left join public.analysis_reviews r on r.analysis_id=a.id
order by v.store_id,v.visited_at desc,v.created_at desc,a.created_at desc,a.id desc;
revoke all on public.store_latest_analyses from anon,authenticated;
grant select on public.store_latest_analyses to authenticated,service_role;

drop function public.stores_in_bounds(double precision,double precision,double precision,double precision,text,text,boolean,integer);
create function public.stores_in_bounds(p_west double precision,p_south double precision,p_east double precision,p_north double precision,
 p_format text default null,p_segment text default null,p_demo boolean default null,p_limit integer default 500)
returns table(store_id uuid,name text,latitude double precision,longitude double precision,is_demo boolean,
 format_code text,audience_segment text,confidence numeric,last_visit_at timestamptz,analysis_id uuid,
 top_offers jsonb,days_since_visit integer,review_status text)
language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.is_manager() then raise exception 'Supervisor or admin required' using errcode='42501'; end if;
 if p_west is null or p_east is null or p_south is null or p_north is null or
 not(p_west between -180 and 180 and p_east between -180 and 180 and p_south between -90 and 90 and p_north between -90 and 90)
 or p_west>p_east or p_south>p_north or p_limit is null or p_limit not between 1 and 1000 then
 raise exception 'Invalid bounds or limit' using errcode='22023'; end if;
 return query select s.id,s.name,s.latitude,s.longitude,s.is_demo,coalesce(lp.format_code,s.declared_format),lp.audience_segment,
 lp.confidence,lv.visited_at,lp.analysis_id,coalesce(offers.items,'[]'::jsonb),extract(day from now()-lv.visited_at)::integer,lp.review_status
 from public.stores s left join public.store_latest_analyses lp on lp.store_id=s.id
 left join lateral(select v.visited_at from public.visits v where v.store_id=s.id order by v.visited_at desc limit 1) lv on true
 left join lateral(select jsonb_agg(jsonb_build_object('product_id',p.id,'name',p.name,'tier',p.tier,'priority',r.priority,
 'gap_status',r.gap_status,'sales_pitch',r.sales_pitch) order by r.priority) items
 from public.recommendation_items r join public.products p on p.id=r.product_id where r.analysis_id=lp.analysis_id) offers on true
 where s.location operator(extensions.&&) extensions.st_makeenvelope(p_west,p_south,p_east,p_north,4326)
 and(p_format is null or coalesce(lp.format_code,s.declared_format)=p_format)
 and(p_segment is null or lp.audience_segment=p_segment) and(p_demo is null or s.is_demo=p_demo)
 order by s.id limit p_limit;
end $$;
revoke all on function public.stores_in_bounds(double precision,double precision,double precision,double precision,text,text,boolean,integer) from public,anon;
grant execute on function public.stores_in_bounds(double precision,double precision,double precision,double precision,text,text,boolean,integer) to authenticated;
