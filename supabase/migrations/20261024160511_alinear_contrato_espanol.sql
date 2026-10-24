-- Contrato del equipo aprobado por Lauti. Conserva el prototipo sin exponerlo por la API.
create schema if not exists legacy_shippear;
revoke all on schema legacy_shippear from public,anon,authenticated;
grant usage on schema legacy_shippear to service_role;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated,service_role;

do $$ declare item record; tab text; begin
 foreach tab in array array['business_formats','products','assortment_rules','stores','visits','media_assets','chat_messages','analyses','analysis_reviews','profile_signals','product_observations','recommendation_items','sales_facts'] loop
 if to_regclass('public.'||tab) is not null then execute format('alter table public.%I set schema legacy_shippear',tab); end if;
 end loop;
 foreach tab in array array['store_latest_profiles','store_latest_analyses','product_sales_ranking'] loop
 if to_regclass('public.'||tab) is not null then execute format('alter view public.%I set schema legacy_shippear',tab); end if;
 end loop;
 for item in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('record_analysis','stores_in_bounds','store_brief','ideal_assortment') loop
 execute format('alter function %s set schema legacy_shippear',item.signature);
 end loop;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name') then
 alter table public.profiles rename column display_name to nombre;
 alter table public.profiles rename column role to rol;
 alter table public.profiles rename column active to activo;
 alter table public.profiles drop constraint if exists profiles_role_check;
 update public.profiles set rol=case when rol='seller' then 'vendedor' else 'admin' end;
 end if;
end $$;
revoke all on all tables in schema legacy_shippear from public,anon,authenticated;
revoke all on all functions in schema legacy_shippear from public,anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nombre text not null default '',rol text not null default 'vendedor',activo boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.profiles alter column rol set default 'vendedor';
alter table public.profiles add constraint profiles_rol_check check(rol in ('vendedor','admin'));
create or replace function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,nombre) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end $$;
drop trigger if exists shippear_signup on auth.users;
create trigger shippear_signup after insert on auth.users for each row execute function private.on_signup();
insert into public.profiles(id,nombre) select id,coalesce(raw_user_meta_data->>'full_name','') from auth.users on conflict(id) do nothing;

create function private.rol_actual() returns text language sql stable security definer set search_path='' as $$
 select rol from public.profiles where id=(select auth.uid()) and activo
$$;
create function private.es_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(private.rol_actual()='admin',false)
$$;
create table public.comercios (
 id uuid primary key default gen_random_uuid(),nombre text not null check(length(trim(nombre)) between 1 and 200),
 direccion text,lat double precision check(lat between -90 and 90),lng double precision check(lng between -180 and 180),
 creado_por uuid default auth.uid() references public.profiles(id),vendedor_asignado uuid references public.profiles(id),
 es_demo boolean not null default false,notas text,created_at timestamptz not null default now(),check((lat is null)=(lng is null))
);
create index comercios_creador_idx on public.comercios(creado_por);
create index comercios_vendedor_idx on public.comercios(vendedor_asignado);
create index comercios_coordenadas_idx on public.comercios(lat,lng);
create table public.visitas (
 id uuid primary key default gen_random_uuid(),comercio_id uuid not null references public.comercios(id),
 vendedor_id uuid default auth.uid() references public.profiles(id),client_request_id uuid not null default gen_random_uuid(),
 notas text,fecha_visita timestamptz not null default now(),created_at timestamptz not null default now(),
 unique(vendedor_id,client_request_id)
);
create index visitas_comercio_fecha_idx on public.visitas(comercio_id,fecha_visita desc);
create index visitas_vendedor_idx on public.visitas(vendedor_id);
create function private.puede_ver_visita(visita_uuid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (select private.rol_actual()) is not null and exists(
 select 1 from public.visitas v where v.id=visita_uuid and(v.vendedor_id=(select auth.uid()) or private.es_admin()))
$$;
create table public.fotos (
 id uuid primary key default gen_random_uuid(),visita_id uuid not null references public.visitas(id),
 tipo text not null check(tipo in ('fachada','gondola','extra')),storage_path text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 byte_size bigint not null check(byte_size>0 and byte_size<=10485760),
 created_at timestamptz not null default now(),check(split_part(storage_path,'/',2)=visita_id::text)
);
create index fotos_visita_idx on public.fotos(visita_id);
create table public.productos_lv (
 id uuid primary key default gen_random_uuid(),sku text unique,nombre text not null unique,categoria text not null,presentacion text not null,
 formatos_objetivo text[] not null default '{}',nse_objetivo text[] not null default '{}',
 gama text not null default 'estandar' check(gama in ('basico','estandar','premium')),
 activo boolean not null default true,es_demo boolean not null default false
);
create table public.fichas (
 id uuid primary key default gen_random_uuid(),visita_id uuid not null unique references public.visitas(id),
 formato text not null check(formato in ('almacen','autoservicio','kiosco','despensa','cafeteria','otro')),
 nse text not null check(nse in ('bajo','medio','alto')),categoria text not null check(categoria in ('basico','estandar','premium')),
 data jsonb not null check(jsonb_typeof(data)='object'),modelo text not null,prompt_version text not null,
 request_id uuid not null,created_at timestamptz not null default now(),
 check(not(nse='alto' and categoria='basico') and not(nse='bajo' and categoria='premium')),
 check(formato=data#>>'{formato,tipo}' and nse=data#>>'{nse,nivel}' and categoria=data#>>'{categoria,valor}')
);
create index fichas_categoria_idx on public.fichas(categoria);
create table public.mensajes (
 id uuid primary key default gen_random_uuid(),visita_id uuid not null references public.visitas(id),
 rol text not null check(rol in ('user','assistant')),contenido text not null check(length(contenido) between 1 and 20000),
 request_id uuid not null default gen_random_uuid(),created_at timestamptz not null default now(),unique(visita_id,rol,request_id)
);
create index mensajes_visita_fecha_idx on public.mensajes(visita_id,created_at);

-- Copia de los datos sintéticos; jamás se eliminan las tablas originales.
do $$ begin
 if to_regclass('legacy_shippear.stores') is not null then
 insert into public.comercios(id,nombre,direccion,lat,lng,creado_por,vendedor_asignado,es_demo,notas,created_at)
 select id,name,address,latitude,longitude,created_by,assigned_to,is_demo,notes,created_at from legacy_shippear.stores;
 insert into public.visitas(id,comercio_id,vendedor_id,client_request_id,notas,fecha_visita,created_at)
 select id,store_id,seller_id,client_request_id,notes,visited_at,created_at from legacy_shippear.visits;
 insert into public.productos_lv(id,sku,nombre,categoria,presentacion,formatos_objetivo,nse_objetivo,gama,activo,es_demo)
 select p.id,p.sku,p.name,p.category,p.presentation,
 coalesce((select array_agg(distinct case when r.format_code='supermercado' then 'otro' else r.format_code end) from legacy_shippear.assortment_rules r where r.product_id=p.id),'{}'),
 case p.tier when 'basic' then array['bajo','medio'] when 'premium' then array['medio','alto'] else array['medio'] end,
 case p.tier when 'basic' then 'basico' when 'premium' then 'premium' else 'estandar' end,p.active,p.is_demo from legacy_shippear.products p;
 insert into public.fichas(id,visita_id,formato,nse,categoria,data,modelo,prompt_version,request_id,created_at)
 select a.id,a.visit_id,case when a.format_code in ('almacen','autoservicio','kiosco','despensa','cafeteria') then a.format_code else 'otro' end,
 case a.audience_segment when 'value' then 'bajo' when 'premium' then 'alto' else 'medio' end,
 case a.audience_segment when 'value' then 'basico' when 'premium' then 'premium' else 'estandar' end,
 jsonb_build_object('formato',jsonb_build_object('tipo',case when a.format_code in ('almacen','autoservicio','kiosco','despensa','cafeteria') then a.format_code else 'otro' end,
 'tamano','desconocido','cajas',a.checkout_count,'m2_estimados',a.estimated_area_m2,'gondolas',null),
 'nse',jsonb_build_object('nivel',case a.audience_segment when 'value' then 'bajo' when 'premium' then 'alto' else 'medio' end,
 'senales',coalesce((select jsonb_agg(s.signal) from legacy_shippear.profile_signals s where s.analysis_id=a.id),'[]'::jsonb)),
 'surtido',jsonb_build_object('tiene','[]'::jsonb,'le_falta','[]'::jsonb),
 'ofrecer_primero',coalesce((select jsonb_agg(jsonb_build_object('producto',p.name,'argumento',r.sales_pitch) order by r.priority)
 from legacy_shippear.recommendation_items r join legacy_shippear.products p on p.id=r.product_id where r.analysis_id=a.id),'[]'::jsonb),
 'categoria',jsonb_build_object('valor',case a.audience_segment when 'value' then 'basico' when 'premium' then 'premium' else 'estandar' end,'motivo','Categoría comercial sintética DEMO; reemplazar por análisis de evidencias reales'),
 'competencia',jsonb_build_object('marcas',null,'share_frentes_pct',null,'promos','[]'::jsonb),
 'confianza',a.confidence,'limitaciones',a.limitations),a.model,a.prompt_version,a.request_key,a.created_at
 from legacy_shippear.analyses a;
 insert into public.mensajes(id,visita_id,rol,contenido,request_id,created_at)
 select id,visit_id,role,content,client_request_id,created_at from legacy_shippear.chat_messages;
 end if;
end $$;

-- Políticas y permisos explícitos; sólo servidor puede escribir fichas o respuestas de IA.
do $$ declare t text; pol record; begin
 for pol in select policyname from pg_policies where schemaname='public' and tablename='profiles' loop
 execute format('drop policy %I on public.profiles',pol.policyname); end loop;
 foreach t in array array['profiles','comercios','visitas','fotos','fichas','mensajes','productos_lv'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on table public.%I from public,anon,authenticated',t);
 execute format('grant select on table public.%I to authenticated',t);
 execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;
create policy profiles_lectura on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.es_admin()));
grant update(nombre) on public.profiles to authenticated;
create policy profiles_nombre on public.profiles for update to authenticated using(id=(select auth.uid()) and (select private.rol_actual()) is not null)
 with check(id=(select auth.uid()) and (select private.rol_actual()) is not null);
create policy comercios_lectura on public.comercios for select to authenticated using((select private.rol_actual()) is not null);
create policy comercios_crear on public.comercios for insert to authenticated with check((select private.rol_actual()) is not null and creado_por=(select auth.uid()) and(vendedor_asignado is null or vendedor_asignado=(select auth.uid()) or (select private.es_admin())));
grant insert on public.comercios to authenticated;
create policy visitas_lectura on public.visitas for select to authenticated using(private.puede_ver_visita(id));
create policy visitas_crear on public.visitas for insert to authenticated with check((select private.rol_actual()) is not null and vendedor_id=(select auth.uid()));
grant insert on public.visitas to authenticated;
create policy productos_lectura on public.productos_lv for select to authenticated using((select private.rol_actual()) is not null);
create policy fotos_lectura on public.fotos for select to authenticated using(private.puede_ver_visita(visita_id));
create policy mensajes_lectura on public.mensajes for select to authenticated using(private.puede_ver_visita(visita_id));
create policy mensajes_crear on public.mensajes for insert to authenticated with check(rol='user' and private.puede_ver_visita(visita_id));
grant insert on public.mensajes to authenticated;
create policy fichas_lectura on public.fichas for select to authenticated using(private.puede_ver_visita(visita_id));

create function private.puede_ver_foto(ruta text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.visitas v where v.id::text=split_part(ruta,'/',2)
 and v.comercio_id::text=split_part(ruta,'/',1) and private.puede_ver_visita(v.id))
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('fotos','fotos',false,10485760,array['image/jpeg','image/png','image/webp']);
drop policy if exists shippear_evidence_read on storage.objects;
drop policy if exists shippear_evidence_insert on storage.objects;
create policy shippear_fotos_leer on storage.objects for select to authenticated using(bucket_id='fotos' and private.puede_ver_foto(name));
create policy shippear_fotos_subir on storage.objects for insert to authenticated with check(bucket_id='fotos' and private.puede_ver_foto(name));
create policy fotos_crear on public.fotos for insert to authenticated with check(private.puede_ver_foto(storage_path)
 and exists(select 1 from storage.objects o where o.bucket_id='fotos' and o.name=fotos.storage_path));
grant insert on public.fotos to authenticated;

create view public.v_comercios_ultima_ficha with(security_invoker=true) as
select c.*,ult.visita_id,ult.formato,ult.nse,ult.categoria,ult.data as ficha,ult.fecha_visita
from public.comercios c left join lateral(select v.id visita_id,v.fecha_visita,f.formato,f.nse,f.categoria,f.data
from public.visitas v join public.fichas f on f.visita_id=v.id where v.comercio_id=c.id order by v.fecha_visita desc,v.created_at desc limit 1) ult on true;
revoke all on public.v_comercios_ultima_ficha from public,anon,authenticated;
grant select on public.v_comercios_ultima_ficha to authenticated,service_role;

-- Proyección global mínima para mapa vendedor. Nunca devuelve data de otra visita.
create function private.mapa_seguro() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare admin boolean; result jsonb; begin
 if auth.uid() is null or private.rol_actual() is null then raise exception 'No autorizado' using errcode='42501'; end if;
 admin:=private.es_admin();
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nombre',c.nombre,'direccion',c.direccion,'lat',c.lat,'lng',c.lng,
 'formato',u.formato,'nse',u.nse,'es_demo',c.es_demo)||case when admin then jsonb_build_object('categoria',u.categoria,'ficha',u.data,'visita_id',u.visita_id,
 'fecha_visita',u.fecha_visita,'vendedor_id',c.vendedor_asignado,'visitas',(select count(*) from public.visitas v where v.comercio_id=c.id)) else '{}'::jsonb end order by c.nombre),'[]'::jsonb)
 into result from public.comercios c left join lateral(select f.formato,f.nse,f.categoria,f.data,v.id visita_id,v.fecha_visita
 from public.visitas v join public.fichas f on f.visita_id=v.id where v.comercio_id=c.id order by v.fecha_visita desc,v.created_at desc limit 1) u on true;
 return result;
end $$;
create function public.mapa_comercios() returns jsonb language sql stable security invoker set search_path='' as $$ select private.mapa_seguro() $$;
revoke all on function public.mapa_comercios() from public,anon;
grant execute on function public.mapa_comercios() to authenticated;

create function public.guardar_ficha(p_visita_id uuid,p_request_id uuid,p_data jsonb,p_modelo text,p_prompt_version text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare anterior public.fichas%rowtype; nuevo uuid; nombre_producto text; begin
 perform 1 from public.visitas where id=p_visita_id for update;
 if not found then raise exception 'Visita inexistente' using errcode='23503'; end if;
 select * into anterior from public.fichas where visita_id=p_visita_id;
 if found then
 if anterior.request_id=p_request_id and anterior.data=p_data then return anterior.id; end if;
 raise exception 'La visita ya tiene una ficha; crear otra visita para una nueva evaluación' using errcode='23505'; end if;
 if jsonb_typeof(p_data#>'{ofrecer_primero}') is distinct from 'array' or jsonb_array_length(p_data->'ofrecer_primero')>3 then raise exception 'Ofertas inválidas' using errcode='22023'; end if;
 for nombre_producto in select jsonb_array_elements_text(p_data#>'{surtido,tiene}') union all select jsonb_array_elements_text(p_data#>'{surtido,le_falta}')
 union all select x->>'producto' from jsonb_array_elements(p_data->'ofrecer_primero') x loop
 if not exists(select 1 from public.productos_lv p where p.nombre=nombre_producto and p.activo) then raise exception 'Producto fuera de catálogo' using errcode='22023'; end if;
 end loop;
 insert into public.fichas(visita_id,formato,nse,categoria,data,modelo,prompt_version,request_id)
 values(p_visita_id,p_data#>>'{formato,tipo}',p_data#>>'{nse,nivel}',p_data#>>'{categoria,valor}',p_data,p_modelo,p_prompt_version,p_request_id) returning id into nuevo;
 return nuevo;
end $$;
revoke all on function public.guardar_ficha(uuid,uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.guardar_ficha(uuid,uuid,jsonb,text,text) to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.rol_actual(),private.es_admin(),private.puede_ver_visita(uuid),private.puede_ver_foto(text),private.mapa_seguro() to authenticated,service_role;
