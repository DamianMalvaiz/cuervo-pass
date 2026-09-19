# Modelo de amenazas — Cuervo Pass

Documento maestro v5 · §28.

Media cuartilla que v3 no tenía y que, en Ingeniería en Redes Inteligentes y
Ciberseguridad, cuenta más que tres funcionalidades.

## Qué protegemos

Nombre, correo, foto, teléfono, ubicación de la universidad y preferencias
personales de estudiantes — algunos de dieciocho años recién cumplidos. El
activo más sensible es el **teléfono**, porque es el único dato que permite
contactar a alguien fuera de la app.

## Actores y mitigaciones

| Actor | Qué quiere | Cómo lo intentaría | Mitigación | Dónde |
|---|---|---|---|---|
| Curioso con cuenta | Datos de otros usuarios | `select * from usuarios` con su token | RLS por fila propia + vista `perfiles_publicos` con lista blanca de columnas | `0014_v5_rls_y_vistas.sql` |
| Spammer | La base de teléfonos | Leer `whatsapp` de todas las publicaciones | La columna no existe en `publicaciones_publicas`; el número se entrega por `revelar_contacto()` con registro | `0012`, `0013` |
| Spammer persistente | Lo mismo, en bucle | Recorrer `revelar_contacto` sobre todos los identificadores | Cuota de 25 revelaciones al día, materializada en `cuotas_uso` | `0012` |
| Acosador | Ubicar a alguien | Cruzar perfil, fotos y ubicación | El perfil ajeno no muestra presupuesto ni universidad; la dirección exacta solo tras pedir el contacto | `0013`, `perfil/[usuarioId].tsx` |
| Estafador | Cobrar apartados de depas falsos | Publicaciones fraudulentas | Reportes con ocultamiento automático a los 3, aviso al dueño, advertencia explícita de no adelantar dinero | `0012`, `publicacion/[id].tsx` |
| Troll | Molestar por chat | Mensajes masivos o gigantes | `check (length(trim(contenido)) between 1 and 2000)`, reporte de usuario | `0011` |
| Usuario que se arrepiente | Borrar lo que escribió a otro | Editar un mensaje ya enviado | Trigger `trg_mensaje_inmutable`: solo se puede cambiar `leido` | `0011` |
| Cualquiera con el APK | Extraer claves | Descompilar y buscar cadenas | En el bundle solo van la URL de Supabase y la anon key, públicas por diseño. Todo lo demás vive en Edge Functions | `supabase/functions/`, `.env.example` |
| Usuario malicioso vía LLM | Inyección de prompt | Escribir instrucciones dentro del texto libre del perfil | Instrucciones en `system`, dato en el turno del usuario, y validación del JSON de salida contra los CHECK de la tabla | `ai-service/models/parseo_llm.py` |
| Usuario con cuenta | Quemar el presupuesto de la API de pago | Llamar al parseo en bucle con 2 KB por petición | Límite de tamaño en el proxy y en Pydantic, cuota diaria en Postgres, limitador por usuario | `ai-proxy/index.ts`, `main.py`, `0012` |
| Usuario con cuenta | Sepultar el catálogo | Crear cientos de publicaciones | Límite de 15 activas por cuenta, en un trigger | `0009` |
| Quien encuentre el token compartido | Usar el microservicio | Reutilizar el `Bearer` filtrado | Comparación en tiempo constante (`hmac.compare_digest`) y procedimiento de rotación ensayado | `main.py`, §24 |
| Un `drop table` accidental | — | Error humano en la semana 11 | Respaldo antes de cada `db push` a partir de la semana 5 | §33.4 |

## Abuso de la moderación automática (ORDEN A.4 / A.7)

Tres reportes ocultan una publicación (migración 0013) y tres suspenden una
cuenta (0023). El umbral es bajo a propósito: sin moderadores humanos, la
alternativa es que nadie reaccione nunca.

Eso abre un ataque evidente. **Tres cuentas coordinadas tumban a cualquiera.**
El umbral no es el problema; lo era que una cuenta no costara nada: el registro
era abierto y `enable_confirmations` estaba en `false`, así que tres desechables
se creaban en dos minutos.

Lo que se hizo para encarecerlo (A.7):

- `enable_confirmations = true`: hay que controlar un buzón real.
- El correo tiene que ser institucional (`src/lib/correoUniversitario.ts`). Un
  atacante necesita tres correos universitarios distintos, no tres de Gmail.

Lo que **sigue abierto**, y se declara:

- Alguien con acceso a tres cuentas universitarias reales puede hacerlo igual.
- No hay panel de moderación, ni revisión humana, ni apelación. Revertir una
  suspensión es un `update` a mano en el SQL Editor, documentado en la 0023.
- El contador de reportes no caduca: tres reportes repartidos en seis meses
  pesan lo mismo que tres en una tarde.

## Qué prueba —y qué no— la insignia de correo verificado

`perfiles_publicos.correo_verificado` (migración 0026) se deriva de
`auth.users.email_confirmed_at`. Dice **exactamente una cosa**: ese correo
existe y esa persona lo controla.

No dice que sea estudiante vigente, ni que sea quien afirma ser, ni que el
departamento que publica sea suyo. Por eso en la interfaz tiene que leerse
«correo verificado» y nunca «usuario verificado»: la insignia de un documento
oficial presta una credibilidad que este dato no respalda, y el usuario primario
de este producto está decidiendo dónde va a vivir sin haber visto el lugar.

## Lo que este proyecto NO resuelve

Se escribe a propósito: reconocer un riesgo y explicar por qué queda fuera de
alcance es mejor ingeniería que fingir que no existe.

- **No se verifican identidades.** Alguien puede publicar un departamento que no
  es suyo. La mitigación es social (reportes) y no técnica.
- **No se verifica la propiedad del número de WhatsApp.** Se valida el formato
  de diez dígitos, nada más.
- **No hay bloqueo entre usuarios.** Está en el roadmap posterior a la entrega.
- **La app es solo para México.** `^[0-9]{10}$` y `wa.me/52` fijan el país. Es
  una decisión de alcance declarada (AUD-17), no un descuido.

## Cómo se verifica

Las mitigaciones de acceso no se comprueban con capturas de pantalla, que no se
vuelven a ejecutar. Están escritas como aserciones de pgTAP en
`supabase/tests/rls.test.sql` y corren en integración continua en cada push
(AUD-13).
