-- Las cuentas nuevas arrancan deshabilitadas: un admin las habilita desde el panel (Equipo → Habilitar acceso).
-- Evita que cualquiera con la URL se registre, vea el mapa y gaste créditos de Gemini.
-- Las cuentas que ya existen no cambian.
alter table public.profiles alter column activo set default false;
