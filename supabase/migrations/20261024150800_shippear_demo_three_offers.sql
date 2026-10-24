-- Mejora de ejemplos ficticios: tres ofertas plausibles por formato y segmentos variados.
do $$ declare a record; seg text; skus text[]; k integer; p record; offers jsonb; updated_payload jsonb;
begin
for a in select an.id,an.raw_output,s.declared_format from public.analyses an join public.visits v on v.id=an.visit_id join public.stores s on s.id=v.store_id
where s.is_demo and an.model='DEMO-synthetic-no-ai' loop
case a.declared_format
 when 'cafeteria' then seg:='premium'; skus:=array['DEMO-005','DEMO-004','DEMO-011'];
 when 'supermercado' then seg:='premium'; skus:=array['DEMO-004','DEMO-002','DEMO-010'];
 when 'kiosco' then seg:='value'; skus:=array['DEMO-007','DEMO-009','DEMO-015'];
 when 'despensa' then seg:='value'; skus:=array['DEMO-006','DEMO-007','DEMO-009'];
 when 'almacen' then seg:='mainstream'; skus:=array['DEMO-001','DEMO-008','DEMO-009'];
 else seg:='mainstream'; skus:=array['DEMO-001','DEMO-003','DEMO-008'];
end case;
offers:='[]'::jsonb;
for k in 1..3 loop
select * into strict p from public.products where sku=skus[k];
offers:=offers||jsonb_build_array(jsonb_build_object('product_id',p.id,'priority',k,
'rationale','Hipótesis DEMO: presentación '||p.presentation||' y gama '||p.tier||' para formato '||a.declared_format,
'sales_pitch',case when k=1 then 'Probar esta presentación en una compra inicial pequeña y medir rotación en la próxima visita.'
when k=2 then 'Complementar el surtido con esta presentación; confirmar espacio y precio antes de sugerir cantidad.'
else 'Incorporar una opción adicional para comparar aceptación del público del local.' end,
'gap_status','unknown','suggested_quantity',case when a.declared_format='cafeteria' and k=1 then 2 else 6 end,'quantity_unit','unidades'));
insert into public.assortment_rules(format_code,product_id,audience_segment,required,priority,rationale,is_demo)
values(a.declared_format,p.id,seg,k=1,k,'Guía ficticia DEMO para comparar formatos y gamas; validar con catálogo oficial',true)
on conflict(format_code,product_id,audience_segment) do nothing;
end loop;
updated_payload:=a.raw_output||jsonb_build_object('audience_segment',seg,'recommendations',offers);
update public.analyses set audience_segment=seg,raw_output=updated_payload where id=a.id;
-- Sólo se sustituyen recomendaciones del dataset sintético que acabamos de crear.
delete from public.recommendation_items where analysis_id=a.id;
insert into public.recommendation_items(analysis_id,product_id,priority,rationale,sales_pitch,gap_status,suggested_quantity,quantity_unit)
select a.id,(x->>'product_id')::uuid,(x->>'priority')::integer,x->>'rationale',x->>'sales_pitch',x->>'gap_status',(x->>'suggested_quantity')::integer,x->>'quantity_unit'
from jsonb_array_elements(offers) x;
end loop;
update public.sales_facts sf set product_id=r.product_id
from public.visits v join public.analyses an2 on an2.visit_id=v.id join public.recommendation_items r on r.analysis_id=an2.id and r.priority=1
where sf.store_id=v.store_id and sf.is_demo and an2.model='DEMO-synthetic-no-ai';
end $$;
