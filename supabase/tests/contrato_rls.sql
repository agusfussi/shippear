-- Pruebas del contrato español. Ejecutar como postgres; todo se revierte.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000001','test-a@example.invalid','{"rol":"admin"}'),
('00000000-0000-4000-8000-000000000002','test-b@example.invalid','{}'),
('00000000-0000-4000-8000-000000000003','test-admin@example.invalid','{}');
do $$ begin assert (select rol='vendedor' from public.profiles where id='00000000-0000-4000-8000-000000000001'),'Escalamiento en registro'; end $$;
do $$ begin assert (select bool_and(not activo) from public.profiles where id::text like '00000000-0000-4000-8000-00000000000_'),'Cuenta nueva habilitada sin admin'; end $$;
update public.profiles set activo=true where id::text like '00000000-0000-4000-8000-00000000000_';
update public.profiles set rol='admin' where id='00000000-0000-4000-8000-000000000003';
insert into public.comercios(id,nombre,creado_por) values
('10000000-0000-4000-8000-000000000001','Prueba A','00000000-0000-4000-8000-000000000001'),
('10000000-0000-4000-8000-000000000002','Prueba B','00000000-0000-4000-8000-000000000002');
insert into public.visitas(id,comercio_id,vendedor_id) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002');
-- Objetos de metadata simulados, sin crear binarios. Sólo para probar políticas SQL.
insert into storage.objects(bucket_id,name) values
('fotos','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/gondola-test.jpg'),
('fotos','10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/gondola-test.jpg');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 assert (select count(*)=1 from public.visitas),'Visitas ajenas visibles';
 assert (select count(*)=0 from public.fichas),'Fichas ajenas visibles';
 assert (select count(*)=1 from public.profiles),'Perfiles ajenos visibles';
 assert (select count(*)=12 from public.comercios where es_demo),'Mapa básico incompleto';
 assert not exists(select 1 from jsonb_array_elements(public.mapa_comercios()) j where j?'ficha' or j?'categoria' or j?'vendedor_id'),'Mapa filtra detalles privados';
 assert not has_schema_privilege('authenticated','legacy_shippear','usage'),'Archivo del prototipo expuesto';
 begin update public.profiles set rol='admin' where id=auth.uid(); raise exception 'Cambio de rol permitido'; exception when insufficient_privilege then null; end;
 update public.profiles set nombre='Nombre permitido' where id=auth.uid();
 assert (select nombre='Nombre permitido' from public.profiles where id=auth.uid()),'No permite editar nombre';
 begin insert into public.visitas(comercio_id,vendedor_id) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'); raise exception 'Suplantación de vendedor'; exception when insufficient_privilege then null; end;
 begin insert into public.mensajes(visita_id,rol,contenido) values('20000000-0000-4000-8000-000000000001','assistant','Falso'); raise exception 'Respuesta IA falsificada'; exception when insufficient_privilege then null; end;
 begin perform public.guardar_ficha('20000000-0000-4000-8000-000000000001',gen_random_uuid(),'{}','x','x'); raise exception 'Escritura de IA desde cliente'; exception when insufficient_privilege then null; end;
 assert private.puede_ver_foto('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/gondola-test.jpg'),'No ve foto propia';
 assert not private.puede_ver_foto('10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001/gondola-test.jpg'),'Ruta de otro comercio';
 assert not private.puede_ver_foto('10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/gondola-test.jpg'),'Ruta de otra visita';
 assert (select count(*)=1 from storage.objects where bucket_id='fotos'),'Storage muestra archivo ajeno';
 insert into public.fotos(visita_id,tipo,storage_path,mime_type,byte_size)
 values('20000000-0000-4000-8000-000000000001','gondola','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/gondola-test.jpg','image/jpeg',100);
 begin insert into public.fotos(visita_id,tipo,storage_path,mime_type,byte_size)
 values('20000000-0000-4000-8000-000000000001','gondola','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/no-existe.jpg','image/jpeg',100);
 raise exception 'Metadata sin objeto'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('shippear.payload',(select data::text from public.fichas limit 1),true);
set local role service_role;
select set_config('shippear.ficha',public.guardar_ficha('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',current_setting('shippear.payload')::jsonb,'test','test')::text,true);
do $$ declare n integer; begin
 assert public.guardar_ficha('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',current_setting('shippear.payload')::jsonb,'test','test')::text=current_setting('shippear.ficha'),'Reintento duplicado';
 begin perform public.guardar_ficha('20000000-0000-4000-8000-000000000001',gen_random_uuid(),current_setting('shippear.payload')::jsonb,'test','test'); raise exception 'Dos fichas para visita'; exception when unique_violation then null; end;
 select count(*) into n from public.fichas;
 begin perform public.guardar_ficha('20000000-0000-4000-8000-000000000002',gen_random_uuid(),jsonb_set(current_setting('shippear.payload')::jsonb,'{ofrecer_primero,0,producto}','"Inventado"'),'test','test'); raise exception 'Producto inventado'; exception when invalid_parameter_value then null; end;
 assert (select count(*)=n from public.fichas),'Escritura parcial';
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 assert (select count(*)=12 from jsonb_array_elements(public.mapa_comercios()) j where (j->>'es_demo')::boolean and j?'ficha'),'Admin sin detalles del mapa';
 assert (select count(*)=63 from public.productos_lv where activo and not es_demo),'Catálogo oficial incompleto';
end $$;
reset role;
update public.profiles set activo=false where id='00000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 assert (select count(*)=0 from public.comercios),'Usuario inactivo con acceso';
 begin perform public.mapa_comercios(); raise exception 'Inactivo accede al mapa'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform 1 from public.comercios; raise exception 'Acceso anónimo'; exception when insufficient_privilege then null; end;
 begin perform public.mapa_comercios(); raise exception 'RPC anónima'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: contrato, RLS, roles, mapa mínimo/ampliado, Storage, catálogo, idempotencia y atomicidad' as resultado;
rollback;
