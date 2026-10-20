-- Tablas de servicio sin privilegios para el cliente · hallazgo del Security Advisor (INFO `rls_enabled_no_policy`, 20/10/2026).
--
-- Tres tablas de servicio (`cuotas_uso`, `fotos_huerfanas`, `geocodificaciones_ritmo`) tenían RLS activo y NINGUNA policy, o sea que RLS ya las cerraba a
-- `authenticated`. Pero conservaban el INSERT/SELECT/UPDATE/DELETE por defecto de Supabase (0036 no las alcanzó). Hoy no hay fuga: sin policy no se lee ni se escribe.
-- El riesgo es de FUTURO: basta que alguien añada una policy permisiva por otra razón para que esos privilegios, que nadie necesita, se activen. Defensa en
-- profundidad: se quitan los privilegios (como en la 0072 con `notificaciones`) y las dos barreras tienen que fallar a la vez.
--
-- Quién las usa: solo `service_role` (Edge Functions y scripts) y funciones `security definer` (`consumir_cuota`, `devolver_cuota`…), que corren con permisos de su
-- dueño y no necesitan el grant del cliente. Por eso nada se rompe.
--
-- Las otras seis tablas que el Advisor lista (`acciones_admin`, `codigos_postales`, `configuracion_app`, `errores_app`, `resenas_reportes`,
-- `verificaciones_biometria`) ya estaban sin privilegios para `authenticated`; no se tocan.
--
-- Reversión: grant select, insert, update, delete on cuotas_uso, fotos_huerfanas, geocodificaciones_ritmo to authenticated;  (no hace falta; se deja por completitud)

revoke all on cuotas_uso, fotos_huerfanas, geocodificaciones_ritmo from public, anon, authenticated;
grant select, insert, update, delete on cuotas_uso, fotos_huerfanas, geocodificaciones_ritmo to service_role;
