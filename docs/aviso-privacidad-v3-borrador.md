# Aviso de privacidad integral — Cuervo 360 · BORRADOR de la versión 3

> **ESTADO: BORRADOR. No es el aviso vigente.** El aviso que está en vigor en la app es el de
> `docs/aviso-privacidad.md` (versión 2) y su copia en `src/lib/avisoPrivacidad.ts`.
>
> **Esto no es asesoría legal y no está validado.** Lo redactó una IA a partir de lo que la
> aplicación hace o hará, y de lo que dicen las fuentes del final. Lo marcado como **[VERIFICAR]**
> tiene que revisarlo una persona abogada antes de publicarse. Ni el responsable del proyecto ni quien
> lo redactó es abogado.
>
> **No se publica hasta que exista cada tratamiento que describe.** Un aviso que declara que se
> guarda el INE cuando todavía no se guarda es tan falso como uno que calla que se guarda. Cada
> sección dice qué fase del plan la hace real.

Redactado el 17 de octubre de 2026 · Sustituirá a la versión 2 (18 de septiembre de 2026).

## 0. Dos cosas que ya están mal en la versión 2, aunque no se publicara la 3

Se encontraron al preparar este borrador. Son independientes de Cuervo 360 y conviene corregirlas
**ya**, no esperar a la versión 3.

1. **Cita una ley abrogada.** La versión 2 se emitió «conforme a los artículos 15, 16 y 17» de la
   LFPDPPP **de 2010** y «a los artículos 24 a 30 de su Reglamento», y cita además los artículos 3, 6,
   8, 20, 32, 36 y 37. La LFPDPPP se **publicó de nuevo en el Diario Oficial el 20 de marzo de 2025 y
   entró en vigor el 21**, y abrogó la de 2010. La numeración cambió (por ejemplo, según el texto
   consultado, lo sensible está en el artículo 6 y los plazos de los derechos ARCO en el 31). **[VERIFICAR
   cada artículo antes de citarlo.]**
2. **Manda las quejas a una autoridad que ya no existe.** La versión 2 remite al INAI
   (`home.inai.org.mx`). El INAI se extinguió y, desde el 21 de marzo de 2025, la autoridad en la
   materia es la **Secretaría Anticorrupción y Buen Gobierno**. **[VERIFICAR el procedimiento y el
   sitio de contacto vigentes.]**

## 0 bis. Lo que ya existe y lo que el borrador todavía describe mal (revisado el 17/10/2026 contra el código)

**Hallazgos que importan más que la redacción:**

1. **El INE ya se pide HOY y el aviso vigente (v2) dice lo contrario.** La verificación de vendedor está desplegada (migraciones 0049–0051)
   y v2 afirma «no solicitamos datos sensibles» y no menciona INE ni domicilio de quien vende. El consentimiento que se guarda es la casilla de
   la propia pantalla, con `version_aviso = 'v2'`. Conviene publicar la v3 **sin la sección de biometría** en cuanto esté revisada, y añadir la
   biometría después: el INE no puede esperar a que esté lista la biometría.
2. **Un INE rechazado o pendiente no se borra nunca.** `resolver_verificacion` fija `ine_borrar_en` solo al APROBAR (30 días); al rechazar lo
   deja en `null` (0053, línea 227) y el barrido solo borra filas con fecha. Es la fila de la tabla de la sección 5 que dice «por definir»:
   hoy el comportamiento real es **conservarlo indefinidamente**. Hace falta decidir el plazo y una migración (propuesta: 30 días tras el
   rechazo, y un tope para las pendientes olvidadas).
3. **El aviso aceptado al registrarse solo guarda la fecha**, no la versión (`handle_new_user`, 0046). La verificación y la biometría sí guardan
   la versión. Para exigir «aceptar de nuevo» ante una v3 hay que guardar la versión también en el alta.

**Qué ya es cierto y estaba marcado como futuro:**

| Tema del borrador | Estado real |
|---|---|
| Funciones comerciante/arrendador y verificación (Semanas 1-2) | Hecho y desplegado |
| Planes y pagos (Semana 3) | Hecho; los pagos son SIMULADOS y `demo_mode` está apagado en producción; no hay pasarela. Quitar a Mercado Pago de la tabla de proveedores hasta que exista |
| Reseñas (Semana 4) | Hecho (0054); falta mencionar que el texto lo ve el público y que se puede reportar |
| Negocios con fotos | Hecho (0048, 0052): fotos del local son públicas para quien ve la ficha |
| Biometría | Código listo y **apagado**: ai-service `BIOMETRIA_ACTIVA=false`, app `BIOMETRIA_HABILITADA=false` |

**Correcciones al texto de la biometría (sección 3), según lo construido:**

- Lo que se guarda no es «si la prueba fue superada, un puntaje…»: es **un estado** (coincide / no coincide / no parece viva / sin resultado / sin rostro en
  la INE), **dos cifras** (similitud y puntaje de vida), el **modelo**, el **número de intentos (máx. 5)** y la fecha y versión del aviso del
  consentimiento. Quién revisó y cuándo está en la verificación, no en este registro.
- **La persona no ve las cifras ni la causa** del resultado; solo «recibida» o «repite la foto». Decirlo evita que se lea como falta de transparencia.
- El resultado se conserva **mientras exista la cuenta o hasta que se reenvíe la verificación** (entonces se descarta, porque era de otra evidencia).
  No se borra a los 30 días con la INE. Es un número, no una huella facial, pero hay que decidir y escribir el plazo.
- Es **optativo**: sin él, una persona revisa los documentos igual (ya implementado). Lo dicho en la sección 4 sobre condicionar el servicio no aplica mientras siga siendo optativo.
- Limitaciones medidas (ver `docs/algoritmos.md`): se probó con un monitor y una persona; no se probaron fotos impresas, vídeo ni máscaras; los
  umbrales no están calibrados con estudiantes; alrededor de 1 de cada 3 selfies reales pide repetirse.
- **Licencia de los modelos:** los modelos de reconocimiento son de uso **solo de investigación no comercial** y el módulo de prueba de presencia no
  declara licencia. El aviso debe decir que es un proyecto académico; una versión comercial exigiría otro modelo.
- Procesamiento: la selfie y la imagen del INE pasan por la función de servidor y el servicio de IA **solo en memoria** durante la petición; el túnel de
  Cloudflare las transporta cifradas pero es un tercero en el camino (añadir a la sección 6).

## 1. Qué cambia respecto de la versión 2

| Tema | Versión 2 | Versión 3 | Se vuelve real con |
|---|---|---|---|
| Naturaleza | «Proyecto académico, no es un servicio comercial, no se cobra» | Proyecto académico con **planes de suscripción para vendedores**. Los cobros de la demo son **simulados**: no se procesa ninguna tarjeta. | Semana 3 |
| Quién publica | Cualquier cuenta | Estudiante por defecto; **comerciante** y **arrendador** son funciones que se agregan y se verifican | Semanas 1 y 2 |
| Datos sensibles | «No solicitamos datos sensibles» | **Sí** se tratan: rostro (verificación biométrica) | Semana 4 |
| Documentos de identidad | No se piden | **INE** (frente y vuelta) de quien vende | Semana 2 |
| Consentimiento | Una marca de tiempo de aceptación | Consentimiento **versionado**, y uno **aparte y expreso** para la biometría | Semanas 2 y 4 |
| Contacto entre personas | WhatsApp | **Chat dentro de la app** como camino principal; WhatsApp como segunda opción | Hecho |
| Favoritos | No existían | Privados; solo se publica **cuántas** personas guardaron una publicación, nunca quiénes | Hecho |

## 2. Responsable y domicilio

Igual que la versión 2: **Angel Damian Malvaiz Gonzalez**, estudiante de Ingeniería en Redes
Inteligentes y Ciberseguridad de la Universidad Tecnológica del Valle de Toluca (UTVT); domicilio
institucional y correo del responsable, como en la versión 2. **[VERIFICAR que siguen vigentes.]**

## 3. Qué datos personales tratamos

**Todas las cuentas** (como en la versión 2): nombre, nombre de usuario, correo (administrado por
Supabase Auth), preferencias de vivienda, foto y biografía opcionales.

**Nuevos en esta versión:**

- **Funciones de la cuenta:** si agregaste la de comerciante o la de arrendador, y el estado de su
  verificación (sin verificar, pendiente, aprobada o rechazada) con la fecha y quién la revisó.
- **Favoritos:** las publicaciones que guardaste. **Son privados.** La app muestra cuántas personas
  guardaron una publicación, sin decir quiénes.
- **Conversaciones:** los mensajes que escribes dentro de la app. No se pueden editar ni borrar, y los
  ve solo quien participa.
- **Reseñas** *(Semana 4)*: lo que escribes sobre un negocio o una vivienda.

**Solo para quien vende (comerciante o arrendador)** *(Semana 2)*:

- **INE**, frente y vuelta, y tu **domicilio**.
- **Fotografías del local o del inmueble** y su **ubicación en el mapa**.
- Datos de contacto del negocio (teléfono, horarios).
- Datos de tu **suscripción**: plan, fechas de inicio y vencimiento y estado de los pagos. **La app nunca
  ve datos de tarjeta**: el cobro lo haría una pasarela externa. *(Hoy los pagos son simulados.)*

### Datos sensibles *(Semana 4)* — **[VERIFICAR calificación y requisitos]**

Si usas la **verificación biométrica**, se tratan tu **rostro** (una fotografía tuya y una prueba de
que estás presente al momento) para compararlo con la foto de tu INE.

> **[VERIFICAR]** Los despachos consultados indican que la ley vigente trata los datos biométricos como
> sensibles y exige consentimiento informado antes de tratarlos. En el texto de la ley que se leyó,
> la lista de ejemplos de datos sensibles **no nombra** los biométricos expresamente. **Mientras una
> persona abogada no lo aclare, este borrador los trata como sensibles**, que es la postura prudente.

Lo que hacemos con ellos, por diseño:

- **Se usan solo para esa comparación.** No se usan para identificarte en otro sitio, ni para
  publicidad, ni se comparten.
- **No guardamos tu fotografía del rostro ni la huella numérica** que se calcula de ella. Se procesan
  en el momento y se descartan.
- **Lo que sí guardamos** es el **resultado**: si la prueba de presencia fue superada, un puntaje de
  coincidencia, la fecha y quién revisó. El puntaje **es solo una ayuda para quien revisa; nunca
  decide por sí solo**.
- El análisis lo hace una librería de código abierto en el servidor del proyecto. Si el servicio no
  responde, tu verificación **queda pendiente**; nunca se aprueba sola.
- **Limitaciones, dichas con honestidad:** el sistema no resiste una fotografía impresa de alta
  calidad ni un deepfake, y una foto de INE con reflejos puede dar un puntaje bajo aunque seas tú.
  Por eso la decisión final la toma una persona.

**Lo que NO recabamos, a propósito** (como en la versión 2): fecha de nacimiento, CURP, RFC,
matrícula escolar, datos financieros ni tu ubicación en tiempo real. *(Tu domicilio y tu INE solo se
piden a quien vende. **[VERIFICAR]** que el INE no se esté pidiendo más datos de los que la finalidad
necesita: el INE incluye CURP y clave de elector.)*

## 4. Para qué usamos tus datos

**Finalidades necesarias** (sin ellas la app no funciona): crear y mantener tu cuenta; mostrarte
publicaciones y negocios; ordenarlos por afinidad; permitir que te contacten y contactar; moderar
reportes y abusos.

**Finalidades para quien vende** *(Semana 2)*: **verificar que quien publica es quien dice ser**,
para proteger a quienes buscan vivienda o servicios; cobrar y gestionar tu suscripción.

**Finalidad que requiere tu consentimiento aparte:** la **verificación biométrica**. Puedes no
dar este consentimiento; en ese caso tu verificación se revisa solo de forma manual. **[VERIFICAR si
la ley permite condicionar el servicio y qué alternativa debe ofrecerse.]**

## 5. Cuánto tiempo conservamos tus datos

| Dato | Plazo propuesto | Estado |
|---|---|---|
| Cuenta, preferencias, favoritos | Mientras tengas la cuenta; se borran al eliminarla | Ya funciona (`eliminar-cuenta`) |
| Mensajes | Mientras exista la conversación; se borran al eliminar la cuenta | Ya funciona |
| **Foto del INE** | **30 días después de aprobada la verificación** | **Por confirmar con el responsable.** Queda solo el estado, la fecha y quién aprobó |
| Foto del INE de una verificación **rechazada** | **7 días tras el rechazo** (decidido por el responsable) | Migración 0057 (escrita; aplicar). Los archivos huérfanos al reenviar los barre la 0058 + `barrer-verificaciones` (escritos; aplicar y desplegar). Queda sin resolver las pendientes sin revisar |
| Fotografía del rostro y huella numérica | **No se guardan** | Diseño |
| Resultado de la verificación (puntaje, quién y cuándo) | **Por definir** | **[VERIFICAR]** |
| Registro de pagos y suscripciones | **Por definir:** puede haber obligaciones fiscales de conservación | **[VERIFICAR con una persona contadora]** |

## 6. Con quién se comparten (encargados y transferencias)

Solo con los proveedores que de verdad se usan, **cuando se usan**. Ninguno recibe tus datos para sus
propios fines. **[VERIFICAR]** si cada uno cuenta como «encargado» o como «transferencia» y qué debe
decirse de las transferencias al extranjero.

| Proveedor | Para qué | Qué recibe |
|---|---|---|
| Supabase | Base de datos, archivos y autenticación | Todo lo que guardas |
| Cloudflare | Túnel hacia el servidor de la IA | Texto que mandas al análisis de perfil, en tránsito |
| Anthropic | Análisis de tu texto libre, **solo si lo consientes** y hay clave activa | Ese texto |
| Mapbox | Autocompletar direcciones | Lo que escribes en el campo de dirección |
| Google | Mapa de la ficha, si se activa | Ubicación de la publicación que ves |
| Expo | Avisos en el teléfono | El identificador de tu dispositivo |
| Mercado Pago *(cuando se conecte)* | Cobrar suscripciones | Los datos del pago, que **no pasan por la app** |

## 7. Tus derechos (ARCO) y cómo ejercerlos

Acceso, rectificación, cancelación y oposición, como en la versión 2: *Mi perfil → Descargar mis
datos* (acceso) y *Eliminar mi cuenta* (cancelación) funcionan dentro de la app. Para lo demás, escribe
al correo del responsable. **[VERIFICAR]** plazos: según el texto consultado, **20 días** para responder y
**15 más** para ejecutarlo (artículo 31). Si no estás conforme, la autoridad es la **Secretaría
Anticorrupción y Buen Gobierno** (según el texto consultado, artículo 40).

## 8. Cambios a este aviso

Si cambia, lo verás dentro de la app y tendrás que aceptarlo de nuevo. **Requisito de implementación:**
hoy solo se guarda una marca de tiempo (`acepto_aviso_privacidad_en`). Para que esto sea cierto hay que
guardar **qué versión** aceptaste, y un consentimiento **separado y con su propia fecha** para la biometría.

## 9. Qué falta para poder publicar este aviso

- [ ] Revisión por una persona abogada de todo lo marcado **[VERIFICAR]**.
- [ ] Confirmar con el responsable el plazo de borrado del INE (supuesto de 30 días).
- [x] Consentimiento versionado y expreso de la biometría: guardado en `verificaciones_biometria` (0056) y `verificaciones_vendedor` (0049). Falta la versión en el alta (hallazgo 3).
- [x] Existen: verificación con INE, planes y pagos (simulados), reseñas. Biometría: existe pero apagada.
- [ ] Decidir y construir el borrado de la INE rechazada o abandonada (hallazgo 2; migración 0057).
- [ ] Sustituir en la app el texto v2 (`src/lib/avisoPrivacidad.ts`, `docs/aviso-privacidad.md`) por la v3 revisada y exigir aceptarla de nuevo; cambiar `VERSION_AVISO`.
- [ ] Encender la biometría (3 interruptores a la vez) SOLO con la v3 ya publicada.
- [ ] Actualizar la versión 2 vigente (ver la sección 0), que no depende de nada de esto.

## Fuentes consultadas el 17/10/2026

- [Texto de la LFPDPPP (consultado como la ley publicada en el DOF el 20/03/2025)](https://www.ordenjuridico.gob.mx/Documentos/Federal/html/wo125102.html)
- [Greenberg Traurig: nueva ley de protección de datos (marzo de 2025)](https://www.gtlaw.com/es/insights/2025/3/nueva-ley-general-proteccion-de-datos)
- [Crowe México: nueva LFPDPPP](https://www.crowe.com/mx/noticias/ley_federal_pdppp_consultoria)
- [Garrigues: nueva ley federal de protección de datos personales en posesión de los particulares](https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce)
- [Basham: publicación en el Diario Oficial](https://basham.com.mx/en/nueva-ley-federal-de-proteccion-de-datos-personales-en-posesion-de-los-particulares-publicada-en-el-diario-oficial-de-la-federacion/)

Las fuentes de despachos son resúmenes y pueden equivocarse o quedarse atrás. Ninguna sustituye el texto
publicado en el Diario Oficial ni a una persona abogada.
