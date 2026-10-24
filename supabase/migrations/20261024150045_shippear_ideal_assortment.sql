-- Surtido ideal reproducible desde reglas explícitas; no depende de texto libre del modelo.
create function public.ideal_assortment(p_store_id uuid)
returns table(product_id uuid,sku text,name text,tier text,required boolean,priority integer,
 rationale text,presence text,is_demo boolean,based_on_reviewed_profile boolean)
language sql stable security invoker set search_path='' as $$
 with context as (
 select s.id,coalesce(lp.format_code,s.declared_format) format_code,lp.audience_segment,lp.analysis_id
 from public.stores s left join public.store_latest_profiles lp on lp.store_id=s.id where s.id=p_store_id
 ), selected_rules as (
 select distinct on(r.product_id) r.*,c.analysis_id from context c join public.assortment_rules r on r.format_code=c.format_code
 where r.audience_segment='any' or r.audience_segment=c.audience_segment
 order by r.product_id,(r.audience_segment<>'any') desc,r.priority
 )
 select p.id,p.sku,p.name,p.tier,r.required,r.priority,r.rationale,
 coalesce((select case when bool_or(o.presence='present') then 'present'
 when bool_or(o.presence='confirmed_absent') then 'confirmed_absent'
 when bool_or(o.presence='not_visible') then 'not_visible' else 'unknown' end
 from public.product_observations o where o.analysis_id=r.analysis_id and o.product_id=p.id),'unknown'),
 (p.is_demo or r.is_demo),r.analysis_id is not null
 from selected_rules r join public.products p on p.id=r.product_id and p.active order by r.priority,p.sku
$$;
revoke all on function public.ideal_assortment(uuid) from public,anon;
grant execute on function public.ideal_assortment(uuid) to authenticated,service_role;

create or replace function public.store_brief(p_store_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('store',to_jsonb(s)-'location','profile',to_jsonb(lp),
 'ideal_assortment',coalesce((select jsonb_agg(to_jsonb(i) order by i.priority) from public.ideal_assortment(s.id) i),'[]'::jsonb),
 'signals',coalesce((select jsonb_agg(to_jsonb(z)) from public.profile_signals z where z.analysis_id=lp.analysis_id),'[]'::jsonb),
 'observations',coalesce((select jsonb_agg(to_jsonb(o)) from public.product_observations o where o.analysis_id=lp.analysis_id),'[]'::jsonb),
 'recommendations',coalesce((select jsonb_agg(to_jsonb(r) order by r.priority) from public.recommendation_items r where r.analysis_id=lp.analysis_id),'[]'::jsonb),
 'suggested_order',coalesce((select string_agg(p.name||' · '||coalesce(r.suggested_quantity::text||' '||r.quantity_unit,'cantidad a confirmar'),E'\n' order by r.priority)
 from public.recommendation_items r join public.products p on p.id=r.product_id where r.analysis_id=lp.analysis_id),''))
 from public.stores s left join public.store_latest_profiles lp on lp.store_id=s.id where s.id=p_store_id
$$;
-- Una ausencia confirmada por conteo tiene cero unidades; nunca una estimación visual positiva.
alter table public.product_observations add constraint confirmed_absent_zero check(presence<>'confirmed_absent' or quantity=0);
