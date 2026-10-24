-- Datos 100% ficticios. No representan comercios, catálogo, reglas ni ventas oficiales.
-- Importaciones administrativas pueden no tener creador de Auth.
alter table public.stores alter column created_by drop not null;
alter table public.visits alter column seller_id drop not null;
insert into public.business_formats(code,name,description) values
('almacen','Almacén','Comercio de cercanía'),('autoservicio','Autoservicio','Compra autónoma con caja'),
('kiosco','Kiosco','Compras pequeñas y consumo inmediato'),('despensa','Despensa','Surtido cotidiano'),
('cafeteria','Cafetería','Consumo y preparación de café'),('supermercado','Supermercado','Surtido amplio');
insert into public.products(sku,name,category,presentation,tier,is_demo)
select 'DEMO-'||lpad(n::text,3,'0'),name,category,presentation,tier,true from(values
(1,'DEMO Café molido 250 g','cafe','250 g','standard'),(2,'DEMO Café molido 500 g','cafe','500 g','standard'),
(3,'DEMO Café instantáneo 100 g','cafe','100 g','standard'),(4,'DEMO Café instantáneo 170 g','cafe','170 g','premium'),
(5,'DEMO Café en grano 1 kg','cafe','1 kg','premium'),(6,'DEMO Café torrado 250 g','cafe','250 g','basic'),
(7,'DEMO Mate cocido 25 saquitos','mate_cocido','25 saquitos','basic'),(8,'DEMO Mate cocido 50 saquitos','mate_cocido','50 saquitos','standard'),
(9,'DEMO Té negro 25 saquitos','te','25 saquitos','basic'),(10,'DEMO Té negro 50 saquitos','te','50 saquitos','standard'),
(11,'DEMO Té verde 20 saquitos','te','20 saquitos','premium'),(12,'DEMO Infusión manzanilla 25 saquitos','infusiones','25 saquitos','standard'),
(13,'DEMO Infusión boldo 25 saquitos','infusiones','25 saquitos','standard'),(14,'DEMO Mix de especias 25 g','especias','25 g','standard'),
(15,'DEMO Cacao para preparar 180 g','cacao','180 g','basic')
) as p(n,name,category,presentation,tier);
insert into public.assortment_rules(format_code,product_id,audience_segment,required,priority,rationale,is_demo)
select f.code,p.id,'any',p.sku in ('DEMO-001','DEMO-008','DEMO-009'),
case when p.sku='DEMO-001' then 1 when p.sku='DEMO-008' then 2 else 3 end,
'Regla ficticia para demostrar la recomendación; reemplazar por guía oficial',true
from public.business_formats f cross join public.products p where p.sku in ('DEMO-001','DEMO-008','DEMO-009');
insert into public.assortment_rules(format_code,product_id,audience_segment,required,priority,rationale,is_demo)
select 'cafeteria',id,'premium',true,1,'Ejemplo ficticio de surtido premium para cafetería',true from public.products where sku='DEMO-005';

do $$ declare i integer; store_uuid uuid; visit_uuid uuid; payload jsonb; product_uuid uuid; fmt text; segment text;
begin
for i in 1..12 loop
fmt := (array['almacen','autoservicio','kiosco','despensa','cafeteria','supermercado'])[1+((i-1)%6)];
segment := (array['value','mainstream','premium'])[1+((i-1)%3)];
insert into public.stores(external_code,name,address,latitude,longitude,declared_format,created_by,is_demo,notes)
values('DEMO-STORE-'||i,'DEMO Local '||lpad(i::text,2,'0')||' · '||fmt,'Dirección ficticia para demostración',
-32.94+(i%4)*0.008,-60.67+(i/4)*0.012,fmt,null,true,'Ubicación simulada en Rosario; sin relación con un negocio real') returning id into store_uuid;
insert into public.visits(store_id,seller_id,visited_at,notes)
values(store_uuid,null,now()-make_interval(days=>i),'Visita sintética DEMO; sin fotos reales ni vendedor real') returning id into visit_uuid;
select id into product_uuid from public.products where sku=case when segment='premium' then 'DEMO-005' else 'DEMO-001' end;
payload := jsonb_build_object('model','DEMO-synthetic-no-ai','prompt_version','demo-v1','catalog_version','demo-v1',
'format_code',fmt,'audience_segment',segment,'confidence',0.65,'checkout_count',1+(i%3),
'shelf_meters',5+i,'summary','Perfil ficticio de '||fmt||'. Ejemplo para ensayar la presentación.',
'limitations','Datos sintéticos. No provienen de fotos ni de una IA. Requieren revisión del vendedor.',
'signals',jsonb_build_array(jsonb_build_object('category','bebidas','signal','Señal DEMO: combinación de marcas y presentaciones',
'interpretation','Hipótesis comercial DEMO: '||segment,'confidence',0.65,'source','seller_report')),
'observations',jsonb_build_array(jsonb_build_object('brand','Competidor ficticio','category','cafe','label','DEMO café competidor',
'presence','present','quantity',6,'quantity_unit','unidades visibles','quantity_basis','visible_estimate','facings',2,
'promotion','Promoción DEMO','evidence','Ejemplo sintético; sin evidencia fotográfica','confidence',0.65)),
'recommendations',jsonb_build_array(jsonb_build_object('product_id',product_uuid,'priority',1,
'rationale','Ejemplo de oportunidad según formato y segmento simulado','sales_pitch','Probar esta presentación y revisar rotación en la próxima visita.',
'gap_status','unknown','suggested_quantity',6,'quantity_unit','unidades')));
perform public.record_analysis(visit_uuid,gen_random_uuid(),payload);
insert into public.sales_facts(store_id,product_id,sold_at,quantity,net_amount,external_line_id,is_demo)
values(store_uuid,product_uuid,current_date-(i%7),3+i,1000*(3+i),'DEMO-SALE-'||i,true);
if i<=3 then
 insert into public.visits(store_id,seller_id,visited_at,notes)
 values(store_uuid,null,now()-make_interval(days=>i+14),'Visita histórica sintética DEMO') returning id into visit_uuid;
 perform public.record_analysis(visit_uuid,gen_random_uuid(),payload||jsonb_build_object('summary','Perfil histórico DEMO para comparar visitas','confidence',0.55));
end if;
end loop;
end $$;
