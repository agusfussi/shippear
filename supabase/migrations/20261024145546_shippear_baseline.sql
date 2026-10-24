-- Baseline aplicada en Supabase. Reproducir SOLO en una base vacía.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 role text not null default 'seller' check (role in ('seller','supervisor','admin')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create function private.current_role() returns text language sql stable security definer set search_path='' as $$
 select p.role from public.profiles p where p.id=(select auth.uid()) and p.active
$$;
create function private.is_manager() returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(private.current_role() in ('supervisor','admin'),false)
$$;
create function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''));
 return new;
end $$;
create trigger shippear_signup after insert on auth.users for each row execute function private.on_signup();

create table public.business_formats (
 code text primary key, name text not null, description text not null default ''
);
create table public.products (
 id uuid primary key default gen_random_uuid(), sku text not null unique,
 name text not null, brand text not null default 'La Virginia', category text not null,
 presentation text not null, tier text not null check(tier in ('basic','standard','premium')),
 units_per_case integer check(units_per_case>0), active boolean not null default true,
 is_demo boolean not null default false, created_at timestamptz not null default now()
);
create table public.assortment_rules (
 id uuid primary key default gen_random_uuid(),
 format_code text not null references public.business_formats(code),
 product_id uuid not null references public.products(id),
 audience_segment text not null check(audience_segment in ('value','mainstream','premium','any')),
 required boolean not null default false, priority integer not null check(priority between 1 and 100),
 rationale text not null, is_demo boolean not null default false,
 unique(format_code,product_id,audience_segment)
);
create index assortment_product_idx on public.assortment_rules(product_id);

create table public.stores (
 id uuid primary key default gen_random_uuid(), external_code text unique,
 name text not null check(length(trim(name))>0), address text, city text not null default 'Rosario',
 latitude double precision check(latitude between -90 and 90),
 longitude double precision check(longitude between -180 and 180),
 location extensions.geometry(Point,4326) generated always as
 (case when latitude is not null and longitude is not null then extensions.st_setsrid(extensions.st_makepoint(longitude,latitude),4326) end) stored,
 declared_format text references public.business_formats(code),
 assigned_to uuid references public.profiles(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 notes text, is_demo boolean not null default false, created_at timestamptz not null default now(),
 check((latitude is null)=(longitude is null))
);
create index stores_geo_idx on public.stores using gist(location);
create index stores_assigned_idx on public.stores(assigned_to);
create index stores_creator_idx on public.stores(created_by);
create index stores_format_idx on public.stores(declared_format);
create function private.can_access_store(store_uuid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (select private.current_role()) is not null and exists(
 select 1 from public.stores s where s.id=store_uuid and (s.assigned_to=(select auth.uid()) or private.is_manager()))
$$;

create table public.visits (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
 seller_id uuid not null default auth.uid() references public.profiles(id),
 client_request_id uuid not null default gen_random_uuid(),
 visited_at timestamptz not null default now(), notes text,
 created_at timestamptz not null default now(), unique(seller_id,client_request_id)
);
create index visits_store_time_idx on public.visits(store_id,visited_at desc,id);
create function private.can_access_visit(visit_uuid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.visits v where v.id=visit_uuid and private.can_access_store(v.store_id))
$$;
create function private.can_submit_visit(visit_uuid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.visits v where v.id=visit_uuid and private.can_access_store(v.store_id)
 and (v.seller_id=(select auth.uid()) or private.is_manager()))
$$;
create index visits_seller_idx on public.visits(seller_id);
create table public.media_assets (
 id uuid primary key default gen_random_uuid(), visit_id uuid not null references public.visits(id),
 uploaded_by uuid not null default auth.uid() references public.profiles(id),
 bucket_id text not null default 'visit-evidence' check(bucket_id='visit-evidence'),
 object_path text not null unique, mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','video/mp4','audio/mpeg','audio/mp4','audio/webm')),
 byte_size bigint not null check(byte_size>0 and byte_size<=52428800),
 captured_at timestamptz, created_at timestamptz not null default now(),
 unique(id,visit_id), check(split_part(object_path,'/',1)=visit_id::text)
);
create index media_visit_idx on public.media_assets(visit_id);
create index media_uploader_idx on public.media_assets(uploaded_by);
create table public.chat_messages (
 id uuid primary key default gen_random_uuid(), visit_id uuid not null references public.visits(id),
 author_id uuid references public.profiles(id) default auth.uid(),
 role text not null check(role in ('user','assistant')), content text not null check(length(content) between 1 and 20000),
 client_request_id uuid not null default gen_random_uuid(), created_at timestamptz not null default now(),
 unique(visit_id,client_request_id)
);
create index chat_visit_time_idx on public.chat_messages(visit_id,created_at);
create index chat_author_idx on public.chat_messages(author_id);

create table public.analyses (
 id uuid primary key default gen_random_uuid(), visit_id uuid not null references public.visits(id),
 request_key uuid not null, model text not null, prompt_version text not null, catalog_version text not null,
 format_code text references public.business_formats(code),
 audience_segment text not null check(audience_segment in ('value','mainstream','premium','unknown')),
 confidence numeric not null check(confidence between 0 and 1),
 estimated_area_m2 numeric check(estimated_area_m2>0), shelf_meters numeric check(shelf_meters>=0),
 checkout_count integer check(checkout_count>=0), summary text not null,
 limitations text not null, raw_output jsonb not null check(jsonb_typeof(raw_output)='object'),
 created_at timestamptz not null default now(), unique(visit_id,request_key), unique(id,visit_id)
);
create index analyses_visit_time_idx on public.analyses(visit_id,created_at desc);
create index analyses_format_idx on public.analyses(format_code);
create table public.analysis_reviews (
 analysis_id uuid primary key references public.analyses(id),
 reviewer_id uuid not null default auth.uid() references public.profiles(id),
 decision text not null check(decision in ('accepted','rejected')), notes text,
 created_at timestamptz not null default now()
);
create index reviews_reviewer_idx on public.analysis_reviews(reviewer_id);
create table public.profile_signals (
 id uuid primary key default gen_random_uuid(), analysis_id uuid not null,
 visit_id uuid not null, media_id uuid, category text not null, signal text not null,
 interpretation text not null, confidence numeric not null check(confidence between 0 and 1),
 source text not null check(source in ('photo','video','audio','seller_report')),
 foreign key(analysis_id,visit_id) references public.analyses(id,visit_id),
 foreign key(media_id,visit_id) references public.media_assets(id,visit_id),
 check(source='seller_report' or media_id is not null)
);
create index signals_analysis_idx on public.profile_signals(analysis_id,visit_id);
create index signals_media_idx on public.profile_signals(media_id,visit_id);
create index signals_visit_idx on public.profile_signals(visit_id);
create table public.product_observations (
 id uuid primary key default gen_random_uuid(), analysis_id uuid not null, visit_id uuid not null,
 media_id uuid, product_id uuid references public.products(id),
 brand text not null, category text not null, label text not null,
 presence text not null check(presence in ('present','not_visible','confirmed_absent','unknown')),
 quantity numeric check(quantity>=0), quantity_unit text,
 quantity_basis text not null default 'unknown' check(quantity_basis in ('visible_estimate','seller_count','unknown')),
 facings integer check(facings>=0), price numeric check(price>=0), currency text not null default 'ARS' check(currency='ARS'),
 promotion text, evidence text not null, confidence numeric not null check(confidence between 0 and 1),
 foreign key(analysis_id,visit_id) references public.analyses(id,visit_id),
 foreign key(media_id,visit_id) references public.media_assets(id,visit_id),
 check((quantity_basis='unknown' and quantity is null) or (quantity_basis<>'unknown' and quantity is not null and quantity_unit is not null)),
 check(presence<>'confirmed_absent' or quantity_basis='seller_count')
);
create index observations_analysis_idx on public.product_observations(analysis_id,visit_id);
create index observations_visit_idx on public.product_observations(visit_id);
create index observations_media_idx on public.product_observations(media_id,visit_id);
create index observations_product_idx on public.product_observations(product_id);
create table public.recommendation_items (
 id uuid primary key default gen_random_uuid(), analysis_id uuid not null references public.analyses(id),
 product_id uuid not null references public.products(id),
 priority integer not null check(priority between 1 and 3), rationale text not null, sales_pitch text not null,
 gap_status text not null check(gap_status in ('confirmed_missing','not_visible','present','unknown')),
 suggested_quantity integer check(suggested_quantity>0), quantity_unit text,
 check(suggested_quantity is null or quantity_unit is not null),
 unique(analysis_id,priority), unique(analysis_id,product_id)
);
create index recommendations_product_idx on public.recommendation_items(product_id);
-- Ventas reales opcionales; las recomendaciones nunca se contabilizan como ventas.
create table public.sales_facts (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
 product_id uuid not null references public.products(id), sold_at date not null,
 quantity integer not null check(quantity>0), net_amount numeric check(net_amount>=0),
 external_line_id text not null unique, is_demo boolean not null default false
);
create index sales_store_date_idx on public.sales_facts(store_id,sold_at);
create index sales_product_idx on public.sales_facts(product_id);

-- RLS: clientes pueden leer según cartera; salidas de IA sólo las escribe el backend.
do $$ declare t text; begin
 foreach t in array array['profiles','business_formats','products','assortment_rules','stores','visits','media_assets','chat_messages','analyses','analysis_reviews','profile_signals','product_observations','recommendation_items','sales_facts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on table public.%I from anon, authenticated',t);
 execute format('grant select on table public.%I to authenticated',t);
 execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;
create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_manager()));
do $$ declare t text; begin
 foreach t in array array['business_formats','products','assortment_rules'] loop
 execute format('create policy catalog_read on public.%I for select to authenticated using ((select private.current_role()) is not null)',t);
 end loop;
end $$;
create policy stores_read on public.stores for select to authenticated using(private.can_access_store(id));
create policy stores_create on public.stores for insert to authenticated with check(
 (select private.current_role()) is not null and created_by=(select auth.uid()) and (assigned_to=(select auth.uid()) or (select private.is_manager())));
create policy stores_manage on public.stores for update to authenticated using((select private.is_manager())) with check((select private.is_manager()));
grant insert,update on public.stores to authenticated;
create policy visits_read on public.visits for select to authenticated using(private.can_access_store(store_id));
create policy visits_create on public.visits for insert to authenticated with check(private.can_access_store(store_id) and seller_id=(select auth.uid()));
grant insert on public.visits to authenticated;
create policy media_read on public.media_assets for select to authenticated using(private.can_access_visit(visit_id));
create policy media_create on public.media_assets for insert to authenticated with check(private.can_submit_visit(visit_id) and uploaded_by=(select auth.uid())
 and exists(select 1 from storage.objects o where o.bucket_id=media_assets.bucket_id and o.name=media_assets.object_path));
grant insert on public.media_assets to authenticated;
create policy chat_read on public.chat_messages for select to authenticated using(private.can_access_visit(visit_id));
create policy chat_create on public.chat_messages for insert to authenticated with check(role='user' and author_id=(select auth.uid()) and private.can_submit_visit(visit_id));
grant insert on public.chat_messages to authenticated;
create policy analyses_read on public.analyses for select to authenticated using(private.can_access_visit(visit_id));
create policy reviews_read on public.analysis_reviews for select to authenticated using(exists(select 1 from public.analyses a where a.id=analysis_id));
create policy reviews_create on public.analysis_reviews for insert to authenticated with check(reviewer_id=(select auth.uid()) and exists(select 1 from public.analyses a where a.id=analysis_id and private.can_submit_visit(a.visit_id)));
grant insert on public.analysis_reviews to authenticated;
create policy signals_read on public.profile_signals for select to authenticated using(private.can_access_visit(visit_id));
create policy observations_read on public.product_observations for select to authenticated using(private.can_access_visit(visit_id));
create policy recommendations_read on public.recommendation_items for select to authenticated using(exists(select 1 from public.analyses a where a.id=analysis_id));
create policy sales_read on public.sales_facts for select to authenticated using(private.can_access_store(store_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('visit-evidence','visit-evidence',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','audio/mpeg','audio/mp4','audio/webm']);
create function private.can_access_object(object_name text, for_upload boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.visits v where v.id::text=split_part(object_name,'/',1)
 and case when for_upload then private.can_submit_visit(v.id) else private.can_access_visit(v.id) end)
$$;
create policy shippear_evidence_read on storage.objects for select to authenticated using(bucket_id='visit-evidence' and private.can_access_object(name,false));
create policy shippear_evidence_insert on storage.objects for insert to authenticated with check(bucket_id='visit-evidence' and private.can_access_object(name,true));
-- Archivos inmutables: nuevas capturas usan nuevos UUID; no hay upsert ni borrado desde móvil.

create view public.store_latest_profiles with(security_invoker=true) as
select distinct on(v.store_id) v.store_id,v.id visit_id,v.visited_at,a.id analysis_id,
 a.format_code,a.audience_segment,a.confidence,a.summary,a.limitations,a.checkout_count,a.shelf_meters,a.estimated_area_m2,
 r.created_at reviewed_at
from public.visits v join public.analyses a on a.visit_id=v.id
join public.analysis_reviews r on r.analysis_id=a.id and r.decision='accepted'
order by v.store_id,v.visited_at desc,v.created_at desc,a.created_at desc,a.id desc;
grant select on public.store_latest_profiles to authenticated,service_role;
revoke all on public.store_latest_profiles from anon;

-- Todas las funciones auxiliares tienen permisos explícitos y search_path fijo.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.current_role(),private.is_manager(),private.can_access_store(uuid),private.can_access_visit(uuid),private.can_submit_visit(uuid),private.can_access_object(text,boolean) to authenticated,service_role;


-- Ejecutar después de schema.sql.
-- Ingesta atómica de una salida estructurada del modelo. Sólo backend confiable.
create function public.record_analysis(p_visit_id uuid,p_request_key uuid,p_payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare a_id uuid; previous_payload jsonb; x jsonb;
begin
 if jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'signals') is distinct from 'array'
 or jsonb_typeof(p_payload->'observations') is distinct from 'array'
 or jsonb_typeof(p_payload->'recommendations') is distinct from 'array' then
 raise exception 'Invalid structured analysis arrays' using errcode='22023'; end if;
 if jsonb_array_length(p_payload->'signals')<1 or jsonb_array_length(p_payload->'signals')>100
 or jsonb_array_length(p_payload->'recommendations')>3 or jsonb_array_length(p_payload->'observations')>300 then
 raise exception 'Analysis exceeds item limits or lacks signals' using errcode='22023'; end if;
 -- Serializa reintentos de una visita; evita resultados parciales y duplicados concurrentes.
 perform 1 from public.visits where id=p_visit_id for update;
 if not found then raise exception 'Visit not found' using errcode='23503'; end if;
 select id,raw_output into a_id,previous_payload from public.analyses where visit_id=p_visit_id and request_key=p_request_key;
 if found then
 if previous_payload<>p_payload then raise exception 'Idempotency key reused with different payload' using errcode='22023'; end if;
 return a_id; end if;
 insert into public.analyses(visit_id,request_key,model,prompt_version,catalog_version,format_code,audience_segment,confidence,
 estimated_area_m2,shelf_meters,checkout_count,summary,limitations,raw_output)
 values(p_visit_id,p_request_key,p_payload->>'model',p_payload->>'prompt_version',p_payload->>'catalog_version',
 p_payload->>'format_code',p_payload->>'audience_segment',(p_payload->>'confidence')::numeric,
 (p_payload->>'estimated_area_m2')::numeric,(p_payload->>'shelf_meters')::numeric,(p_payload->>'checkout_count')::integer,
 p_payload->>'summary',p_payload->>'limitations',p_payload) returning id into a_id;
 for x in select value from jsonb_array_elements(p_payload->'signals') loop
 insert into public.profile_signals(analysis_id,visit_id,media_id,category,signal,interpretation,confidence,source)
 values(a_id,p_visit_id,(x->>'media_id')::uuid,x->>'category',x->>'signal',x->>'interpretation',(x->>'confidence')::numeric,x->>'source');
 end loop;
 for x in select value from jsonb_array_elements(p_payload->'observations') loop
 insert into public.product_observations(analysis_id,visit_id,media_id,product_id,brand,category,label,presence,
 quantity,quantity_unit,quantity_basis,facings,price,promotion,evidence,confidence)
 values(a_id,p_visit_id,(x->>'media_id')::uuid,(x->>'product_id')::uuid,x->>'brand',x->>'category',x->>'label',x->>'presence',
 (x->>'quantity')::numeric,x->>'quantity_unit',coalesce(x->>'quantity_basis','unknown'),(x->>'facings')::integer,
 (x->>'price')::numeric,x->>'promotion',x->>'evidence',(x->>'confidence')::numeric);
 end loop;
 for x in select value from jsonb_array_elements(p_payload->'recommendations') loop
 insert into public.recommendation_items(analysis_id,product_id,priority,rationale,sales_pitch,gap_status,suggested_quantity,quantity_unit)
 values(a_id,(x->>'product_id')::uuid,(x->>'priority')::integer,x->>'rationale',x->>'sales_pitch',x->>'gap_status',
 (x->>'suggested_quantity')::integer,x->>'quantity_unit');
 end loop;
 return a_id;
end $$;
revoke all on function public.record_analysis(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_analysis(uuid,uuid,jsonb) to service_role;

create function public.stores_in_bounds(p_west double precision,p_south double precision,p_east double precision,p_north double precision,
 p_format text default null,p_segment text default null,p_demo boolean default null,p_limit integer default 500)
returns table(store_id uuid,name text,latitude double precision,longitude double precision,is_demo boolean,
 format_code text,audience_segment text,confidence numeric,last_visit_at timestamptz,analysis_id uuid,
 top_offers jsonb,days_since_visit integer)
language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.is_manager() then raise exception 'Supervisor or admin required' using errcode='42501'; end if;
 if p_west is null or p_east is null or p_south is null or p_north is null or
 not(p_west between -180 and 180 and p_east between -180 and 180 and p_south between -90 and 90 and p_north between -90 and 90)
 or p_west>p_east or p_south>p_north or p_limit is null or p_limit not between 1 and 1000 then
 raise exception 'Invalid bounds or limit' using errcode='22023'; end if;
 return query select s.id,s.name,s.latitude,s.longitude,s.is_demo,coalesce(lp.format_code,s.declared_format),lp.audience_segment,
 lp.confidence,lv.visited_at,lp.analysis_id,coalesce(offers.items,'[]'::jsonb),extract(day from now()-lv.visited_at)::integer
 from public.stores s left join public.store_latest_profiles lp on lp.store_id=s.id
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

create function public.store_brief(p_store_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('store',to_jsonb(s)-'location','profile',to_jsonb(lp),
 'signals',coalesce((select jsonb_agg(to_jsonb(z)) from public.profile_signals z where z.analysis_id=lp.analysis_id),'[]'::jsonb),
 'observations',coalesce((select jsonb_agg(to_jsonb(o)) from public.product_observations o where o.analysis_id=lp.analysis_id),'[]'::jsonb),
 'recommendations',coalesce((select jsonb_agg(to_jsonb(r) order by r.priority) from public.recommendation_items r where r.analysis_id=lp.analysis_id),'[]'::jsonb),
 'suggested_order',coalesce((select string_agg(p.name||' · '||coalesce(r.suggested_quantity::text||' '||r.quantity_unit,'cantidad a confirmar'),E'\n' order by r.priority)
 from public.recommendation_items r join public.products p on p.id=r.product_id where r.analysis_id=lp.analysis_id),''))
 from public.stores s left join public.store_latest_profiles lp on lp.store_id=s.id where s.id=p_store_id
$$;
revoke all on function public.store_brief(uuid) from public,anon;
grant execute on function public.store_brief(uuid) to authenticated,service_role;

create view public.product_sales_ranking with(security_invoker=true) as
select sf.product_id,p.name,p.tier,sf.is_demo,sum(sf.quantity) units_sold,sum(sf.net_amount) net_amount,
 count(distinct sf.store_id) stores_count,min(sf.sold_at) from_date,max(sf.sold_at) to_date
from public.sales_facts sf join public.products p on p.id=sf.product_id
where (select private.is_manager()) group by sf.product_id,p.name,p.tier,sf.is_demo;
revoke all on public.product_sales_ranking from anon,authenticated;
grant select on public.product_sales_ranking to authenticated,service_role;
