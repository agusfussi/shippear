-- Mantener sincronizadas señal, interpretación y perfil del dataset sintético.
update public.analyses a set raw_output=jsonb_set(a.raw_output,'{signals,0}',
 jsonb_build_object('category','surtido','source','seller_report','confidence',0.65,
 'signal',case a.audience_segment when 'premium' then 'DEMO: surtido simulado con productos de gama alta y presentaciones especiales'
 when 'value' then 'DEMO: surtido simulado con segundas marcas y presentaciones económicas'
 else 'DEMO: surtido simulado con marcas de distintas gamas y presentaciones familiares' end,
 'interpretation','Hipótesis comercial sintética DEMO: '||a.audience_segment))
where a.model='DEMO-synthetic-no-ai';
update public.profile_signals sig set category=a.raw_output#>>'{signals,0,category}',
 signal=a.raw_output#>>'{signals,0,signal}',interpretation=a.raw_output#>>'{signals,0,interpretation}'
from public.analyses a where a.id=sig.analysis_id and a.model='DEMO-synthetic-no-ai';
