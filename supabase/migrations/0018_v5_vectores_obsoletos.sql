-- Documento maestro v5 · §9 — el cambio de modelo de embeddings.
--
-- `all-MiniLM-L6-v2` (inglés) se sustituye por
-- `paraphrase-multilingual-MiniLM-L12-v2`. Ambos producen vectores de 384
-- dimensiones, así que el esquema no cambia y **nada truena**: pgvector acepta
-- los viejos y los nuevos en la misma columna, y `<=>` devuelve un número.
--
-- Ese es exactamente el problema. La similitud entre un vector de un modelo y
-- uno de otro no es baja: es **ruido con apariencia de resultado**. Sin este
-- borrado, la lista de sugerencias se seguiría viendo bien y estaría ordenada
-- al azar durante todo el tiempo que tardara alguien en sospechar — la misma
-- clase de fallo silencioso que AUD-01.
--
-- Se borran, y se regeneran con:
--   node --env-file=.env scripts/backfill-embeddings.mjs --todos
--
-- Mientras tanto la app funciona en Nivel 1, que es la degradación prevista en
-- §18 y no una avería.
--
-- Reversión: ninguna. Un vector borrado se regenera; no hay nada que restaurar.

update usuarios      set perfil_vector    = null where perfil_vector    is not null;
update publicaciones set vector_embedding = null where vector_embedding is not null;
update roomies       set vector_busqueda  = null where vector_busqueda  is not null;

-- ============================================================
-- Consentimiento para el análisis con IA · §29 · AUD-23
-- ============================================================
-- `consiente_analisis_ia` entra con valor por omisión `false`, y NO se rellena
-- automáticamente para las cuentas que ya existían. Es deliberado: dar por
-- otorgado un consentimiento que nadie dio es precisamente lo que la casilla no
-- premarcada existe para impedir, y el propio §29 lo dice con todas sus letras.
--
-- Consecuencia práctica: hasta que cada persona vuelva a entrar y marque la
-- casilla en *Mi perfil → Editar mis preferencias*, no se genera su vector y
-- recibe sugerencias de Nivel 1.
--
-- Para las CUENTAS DE DEMO —que son tuyas, no de personas reales— sí tiene
-- sentido marcarlas a mano, o la demo se quedaría sin Nivel 2 que enseñar.
-- Corre esto en el SQL Editor, NO como parte de la migración, y solo si las
-- cuentas son de prueba:
--
--   update usuarios
--      set consiente_analisis_ia = true
--    where biografia = 'Cuenta de prueba generada para probar sugerencias — Cuervo Pass.';
--
-- Va comentado a propósito: una migración que otorga consentimientos en lote
-- es exactamente el tipo de cosa que no debe correr sola en producción.
