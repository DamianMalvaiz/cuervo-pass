# Aviso de privacidad integral — Cuervo 360

**Última actualización:** 26 de octubre de 2026 · **Versión:** 5

Emitido conforme a la **Ley Federal de Protección de Datos Personales en
Posesión de los Particulares** (LFPDPPP), publicada en el Diario Oficial de la
Federación el 20 de marzo de 2025, y a las demás disposiciones aplicables.

## 1. Responsable y domicilio

**Angel Damian Malvaiz Gonzalez**, estudiante de Ingeniería en Redes
Inteligentes y Ciberseguridad (IRIC) de la Universidad Tecnológica del Valle de
Toluca (UTVT), es el responsable del tratamiento de tus datos personales.

- **Domicilio para oír y recibir notificaciones:** Carretera del Departamento del D.F. km 7.5, Santa María Atarasquillo, Lerma, Estado de México, C.P. 52044
  (domicilio institucional de la Universidad Tecnológica del Valle de Toluca,
  donde se desarrolla el proyecto académico)
- **Correo del responsable:** al222211405@gmail.com

Cuervo 360 es un proyecto académico desarrollado dentro del programa integrador
de la UTVT y no persigue fines de lucro. Para quien ofrece servicios o viviendas
existen planes de suscripción; **en esta etapa los pagos funcionan en el modo de
pruebas de Mercado Pago: no se cobra dinero real.**

## 2. Qué datos personales tratamos

**Identificación y contacto (necesarios):**

- Nombre completo y nombre de usuario
- Correo electrónico (lo administra Supabase Auth como encargado; tu contraseña
  no se guarda, ver sección 9)
- Número de WhatsApp, **únicamente si publicas** un departamento
- Las funciones de tu cuenta (comerciante, arrendador) y el estado de su
  verificación

**Lo que generas al usar la app:**

- Tus favoritos, de publicaciones y de negocios. **Son privados:** la app muestra
  cuántas personas guardaron una publicación o un negocio, nunca quiénes.
- Tus conversaciones con otras personas dentro de la app.
- Tus **avisos** dentro de la app (por ejemplo, que aprobaron tu verificación).
- Tus reseñas de negocios y viviendas. **Las ve cualquier usuario con sesión,
  junto con tu nombre de usuario.**

**Preferencias de vivienda (necesarios):**

- Universidad y sus coordenadas, que eliges de una lista
- Presupuesto mínimo y máximo, y distancia máxima que aceptas recorrer
- Si tienes mascotas, si fumas y tu nivel de ruido preferido

**Opcionales:**

- Foto de perfil y biografía
- Texto libre sobre ti y sobre lo que buscas
- Fotos de tus publicaciones

**Solo si ofreces servicios o viviendas (comerciante o arrendador):**

- Tu **nombre legal** y tu **domicilio**, para verificar quién eres.
- Fotografías de tu **INE** (frente y reverso).
- Fotografías de tu local o de tu inmueble, su ubicación y los datos de contacto
  del negocio.
- Los **productos** de tu tienda: nombre, descripción, precio y fotos, que verá
  cualquier usuario con sesión.
- Los datos de tu **suscripción y de tus pagos**: plan, fechas, estado y el número
  de orden. **La app no ve ni guarda datos de tarjeta**: el pago se hace en la
  página de Mercado Pago (ver sección 5).

**Lo que NO recabamos, a propósito** (principio de minimización): fecha de
nacimiento, RFC, matrícula escolar, datos financieros ni tu ubicación en tiempo
real. A los estudiantes que solo buscan tampoco les pedimos CURP ni domicilio.
**La INE de quien vende contiene más datos de los que necesitamos** (por ejemplo
la CURP y la clave de elector): no los extraemos ni los guardamos como datos
aparte; se guarda solo la imagen, que revisa una persona.

### Datos sensibles

**Cuervo 360 no solicita datos sensibles** en el sentido de la LFPDPPP (origen
racial o étnico, estado de salud, información genética, creencias religiosas,
filosóficas o morales, afiliación sindical, opiniones políticas o preferencia
sexual).

**Hoy no tratamos datos biométricos.** Si en el futuro se ofrece una
verificación con tu rostro, se te avisará con un aviso nuevo y te pediremos un
consentimiento aparte, expreso y opcional. No empezará a funcionar antes.

Ahora bien, el **texto libre** es un campo abierto: si escribes ahí información
sensible, la estaremos tratando sin habértela pedido. Te pedimos expresamente
que no lo hagas. Puedes borrar ese texto cuando quieras desde *Mi perfil → Mis
datos*.

## 3. Finalidades del tratamiento

### 3.1 Primarias (necesarias para el servicio)

Sin estos tratamientos la app no puede funcionar, y por eso no es posible
oponerse a ellos conservando la cuenta:

1. Crear y mantener tu cuenta, y autenticarte.
2. Calcular y mostrarte sugerencias de departamentos y de compañeros de
   vivienda. **Tu perfil se usa explícitamente para esto**: distancia a tu
   universidad, si el precio cabe en tu presupuesto, y si coinciden las
   mascotas, el tabaco y el nivel de ruido.
3. Mostrar tu perfil público a otros usuarios con sesión iniciada, para que
   puedan decidir si te contactan.
4. Permitirte conversar con otros usuarios dentro de la app.
5. Prevenir abusos: registrar quién solicita un número de contacto y cuándo,
   aplicar cuotas de uso y atender reportes.
6. Mostrar a todos los usuarios con sesión las reseñas que escribes, con tu
   nombre de usuario, y permitir que la persona reseñada responda o reporte.

**Primarias solo para quien ofrece servicios o viviendas:**

- **Verificar que quien publica es quien dice ser**, con una revisión hecha por
  una persona del equipo, para proteger a quienes buscan vivienda o servicios.
  Sin esta verificación no se puede publicar.
- Gestionar tu suscripción y los límites de tu plan, y procesar su pago con
  Mercado Pago.

### 3.2 Secundaria (opcional)

7. **Análisis del texto libre con inteligencia artificial** para mejorar la
   precisión de las sugerencias. Ver la sección 4.

### 3.3 Cómo negarte a la finalidad secundaria

La casilla de análisis con IA **no viene premarcada**. No marcarla es negarse, y
la app funciona con normalidad sin ella: las sugerencias se calculan solo con tu
cuestionario.

Si ya la marcaste, puedes retirarla cuando quieras desde *Configuración →
Personalización*. No necesitas escribirnos ni justificarlo.

**No tratamos tus datos con fines de mercadotecnia, publicidad ni prospección
comercial, y no los vendemos ni los cedemos a nadie.**

## 4. Tratamiento con inteligencia artificial

Si —y solo si— otorgas tu consentimiento marcando la casilla correspondiente:

- El **texto libre** de tu perfil se envía a la API de **Anthropic (Claude)**
  para extraer atributos estructurados.
- Ese texto se convierte además en un **vector numérico** (384 números) que
  permite comparar afinidad semántica entre perfiles. No es legible como texto y
  no se muestra a ningún otro usuario.
- Ningún otro dato tuyo se envía al proveedor del modelo: ni tu nombre, ni tu
  correo, ni tu teléfono, ni tus fotos.

Garantías concretas:

- La casilla **no viene premarcada**: tu consentimiento tiene que ser un acto tuyo.
- Si no la marcas, **no se llama al modelo y no se genera el vector**.
- Al **retirar** el consentimiento, el vector se **borra**. No se conserva "por
  si acaso": un dato derivado de un consentimiento retirado no tiene fundamento
  para seguir existiendo.
- Los registros del microservicio guardan **la longitud del texto, nunca el
  texto**.
- Política de privacidad del proveedor:
  <https://www.anthropic.com/legal/privacy>

## 5. Encargados y transferencias

### 5.1 Encargados

Estas empresas tratan datos **por cuenta nuestra y bajo nuestras
instrucciones**. Conforme a la LFPDPPP **esto no constituye una transferencia** y
no requiere consentimiento adicional. Cada uno recibe solo lo que necesita para
su tarea:

| Encargado | Qué trata | Para qué |
|---|---|---|
| **Supabase** | Base de datos, autenticación y almacenamiento de fotos | Es la infraestructura sobre la que corre la app |
| **Anthropic** | Únicamente tu texto libre, y solo si consentiste | Extraer atributos para las sugerencias (sección 4) |
| **OpenStreetMap / Nominatim** | La dirección que escribes al publicar | Convertirla en coordenadas |
| **Mapbox** | Lo que escribes en el campo de dirección | Autocompletarla |
| **Cloudflare** | El tráfico hacia nuestro servicio de IA | Transportarlo cifrado. Solo pasa texto si diste tu consentimiento para el análisis con IA |
| **Expo** | El identificador de tu dispositivo | Enviarte avisos en el teléfono. En Android los entrega a través de Firebase Cloud Messaging (Google) |
| **Mercado Pago** | El plan, el monto y un número de orden (ni tu nombre ni tu correo) | Procesar el pago de tu plan en su propia página, con sus términos y su aviso de privacidad. **La app no ve ni guarda datos de tarjeta** |

### 5.2 Transferencias

**No realizamos transferencias de datos personales a terceros** en el sentido de
la LFPDPPP. Es decir: no entregamos tus datos a nadie que los trate para sus
propios fines.

La única excepción serían las que la propia ley permite sin tu consentimiento
—por ejemplo, un requerimiento de autoridad competente—, que, de ocurrir, te
serían notificadas al correo de tu cuenta salvo que la autoridad lo prohíba.

### 5.3 Lo que otros usuarios ven

Esto no es una transferencia: es el funcionamiento del servicio que solicitaste.

| Quién | Qué ve de ti |
|---|---|
| Cualquier persona, sin cuenta (la web) | De una publicación de vivienda: el título, el tipo, el precio, las recámaras, las condiciones, la zona (la dirección sin la calle ni el número), una ubicación aproximada (redondeada a cerca de 1 km), la calificación y las fotos. **No** la dirección exacta, **no** el teléfono, **no** quién publica y **no** la descripción de una vivienda. De un negocio: el nombre, la descripción, la zona, el horario, los productos con su precio, la calificación y las fotos. Las fotos se ven con un enlace temporal, que dura una hora. |
| Cualquier usuario con sesión | Solo lo que expone la vista `perfiles_publicos`: nombre, usuario, foto, biografía, mascotas, tabaco, nivel de ruido y horario. **No** tu presupuesto, **no** tu universidad, **no** tu texto libre, **no** tu vector. |
| Usuarios que ven tus publicaciones | Todo el contenido de la publicación **menos tu teléfono** |
| Quien ve tus negocios o publicaciones de vendedor | Las fotos, la descripción, el horario y la ubicación que tú publicas. **No** tu INE, **no** tu domicilio legal ni tu nombre legal: eso solo lo ve quien revisa tu verificación. |
| Usuarios que piden tu contacto | Tu WhatsApp, **solo** al tocar "Ver contacto". Queda registrado quién lo pidió y cuándo, y hay un límite diario por persona. |

## 6. Conservación de los datos

| Dato | Cuánto se conserva | Quién puede borrarlo |
|---|---|---|
| Perfil y preferencias | Mientras la cuenta exista | Tú, desde la app |
| Texto libre del perfil | Hasta que lo edites o borres | Tú |
| Vector del perfil | Ídem; se regenera al editar el texto y se borra al retirar el consentimiento | Tú |
| Publicaciones y sus fotos | Mientras la cuenta exista o hasta que las elimines | Tú |
| Mensajes | Mientras la cuenta exista | Tú |
| Registro de contactos solicitados | Mientras la cuenta exista. Es lo que permite detectar abuso | Se elimina con la cuenta |
| Productos de tu tienda y sus fotos | Mientras la cuenta exista o hasta que los quites | Tú, o al eliminar la cuenta |
| Órdenes y pagos | Mientras la cuenta exista | Se eliminan con la cuenta |
| Favoritos y reseñas | Mientras la cuenta exista | Se eliminan con la cuenta |
| INE de una verificación aprobada | **30 días** después de aprobarla. Queda solo el estado, la fecha y quién aprobó | Borrado programado |
| INE de una verificación rechazada | **7 días** después del rechazo. Si reenvías antes, los archivos de la entrega anterior se borran en el barrido siguiente (cada hora, con un día de gracia) | Borrado programado |
| Fotos de tu local o inmueble, y datos de tu suscripción | Mientras la cuenta exista. Las fotos son parte de tu publicación | Tú, o al eliminar la cuenta |
| Cuotas de uso | 90 días | Limpieza programada |
| Registros del microservicio | 7 días, y **no contienen el texto**: solo su longitud y el resultado | Rotación automática |
| Texto enviado al proveedor del modelo | Fuera de nuestro control; según la política de Anthropic | Nadie desde esta app |

Al eliminar tu cuenta, **todo lo anterior se borra en cascada**, incluidas tus
fotos del almacenamiento. Es irreversible y no conservamos copia.

## 7. Derechos ARCO y cómo ejercerlos

Tienes derecho a **Acceder** a tus datos, **Rectificarlos** cuando sean
inexactos, **Cancelarlos** cuando consideres que no se requieren, y **Oponerte**
a su tratamiento para fines específicos.

### 7.1 Desde la app, sin trámite

| Derecho | Dónde |
|---|---|
| **Rectificación** | *Mi perfil → Mis datos* y *Mi perfil → Sobre mí* corrigen cualquier dato que hayas proporcionado. |
| **Cancelación** | *Configuración → Eliminar mi cuenta*. |
| **Oposición** | *Configuración → Personalización*: apagar «Usar mi descripción». |

### 7.2 Por escrito

El **acceso** a tus datos se ejerce por escrito, y este camino sirve también para
cualquier otro derecho si algo de lo anterior falla o prefieres el trámite
formal. Escribe al correo de la sección 1 indicando:

1. Tu nombre y un medio para comunicarte la respuesta.
2. Los documentos que acrediten tu identidad (o la representación legal).
3. La descripción clara de los datos sobre los que ejerces el derecho.
4. Cualquier elemento que facilite localizar los datos.

Para el acceso te entregamos un archivo con tu perfil, tus publicaciones, tus
mensajes enviados, los contactos que solicitaste, tus funciones y su verificación
(sin las rutas internas de tu INE), tus negocios y su menú, tus favoritos, tus
reseñas y tus suscripciones y pagos.

**Plazos** (artículo 31 de la LFPDPPP): responderemos en un máximo de **20 días
hábiles** y, si procede, lo haremos efectivo dentro de los **15 días hábiles**
siguientes.

### 7.3 Ante la autoridad

Si consideras que tu derecho a la protección de datos personales fue vulnerado,
puedes acudir a la **Secretaría Anticorrupción y Buen Gobierno**, que es la
autoridad en la materia desde la entrada en vigor de la ley vigente (el INAI,
que antes ejercía esa función, se extinguió).

## 8. Revocación del consentimiento

Puedes revocar en cualquier momento el consentimiento que nos otorgaste.

- **Para el análisis con IA:** apágalo en *Configuración → Personalización*.
  Surte efecto de inmediato y el vector se borra.
- **Para el tratamiento en general:** equivale a cancelar la cuenta, porque sin
  los datos de la sección 2 el servicio no puede operar. Se hace desde
  *Configuración → Eliminar mi cuenta*.

En ninguno de los dos casos hace falta escribirnos ni justificar la decisión.

## 9. Medidas de seguridad

Queremos ser precisos aquí, porque un aviso de privacidad que exagera sus
medidas es una declaración falsa.

### Tu contraseña no se guarda: se convierte en un hash

Nunca llega a nuestra base de datos ni queda en el código de la app. Se entrega
a Supabase Auth, que la transforma con **bcrypt** en un valor del que la
contraseña original **no se puede recuperar**. Ni nosotros, ni Supabase, ni
nadie con acceso a la base podría leerla.

Se exigen al menos **10 caracteres**, con mayúsculas, minúsculas y dígitos, y
esa regla se aplica **del lado del servidor**, no solo en la pantalla — de modo
que tampoco puede saltarse llamando a la API directamente.

### Tus fotos no están cifradas de extremo a extremo, y no deberían estarlo

Una foto de perfil existe para que otros usuarios la vean. Lo que sí hay:

- Viven en un **almacenamiento privado**: no son accesibles desde internet sin
  autorización. Antes de septiembre de 2026 el almacenamiento era público y
  cualquiera que adivinara la ruta podía verlas; eso se corrigió.
- Se sirven mediante **enlaces firmados que caducan a la hora**. Con precisión:
  **mientras un enlace firmado no caduque, funciona para quien lo tenga.**
- Están **cifradas en reposo** por el proveedor de infraestructura, lo que
  protege frente al robo físico del medio de almacenamiento, no frente a otro
  usuario.
- Solo tú puedes subir, reemplazar o borrar archivos en tus propias rutas.

### Tu INE: la más cuidada, y aun así no es invulnerable

- Va a un **almacenamiento privado aparte**, distinto del de las fotos de perfil.
  Solo tú puedes subirla y leerla desde tu cuenta; otros usuarios no pueden.
- Quien revisa tu verificación la ve mediante **enlaces que caducan a los 10
  minutos** y que no se guardan.
- Se borra a los plazos de la sección 6. Mientras exista, **cualquier persona con
  acceso administrativo a la infraestructura podría leerla**: es una limitación
  real que preferimos decirte.

### El resto de los controles

- Todo el tráfico viaja cifrado por **HTTPS**.
- La base de datos está cifrada en reposo por el proveedor.
- El acceso está controlado **fila por fila y columna por columna** mediante Row
  Level Security y vistas de lista blanca. Es lo que impide que un usuario
  legítimo lea los datos de otro.
- Esos controles **están verificados con pruebas automatizadas** que se ejecutan
  en cada cambio del código, no con una revisión manual que envejece.
- El servicio de inteligencia artificial solo acepta peticiones con un token
  compartido, y registra la longitud del texto, nunca el texto.

Ninguna medida de seguridad es absoluta. Si detectamos una vulneración que
afecte de forma significativa tus derechos, te lo comunicaremos al correo de tu
cuenta, como exige la ley.

## 10. Cambios a este aviso

Cualquier modificación se publica en este archivo (`docs/aviso-privacidad.md`)
dentro del repositorio del proyecto, con su historial completo de versiones en
Git, y se refleja en la pantalla *Aviso de privacidad* dentro de la app.

Si el cambio afecta a las finalidades del tratamiento, te lo comunicaremos al
correo asociado a tu cuenta antes de aplicarlo. Cuando cambie este aviso, la app
te lo mostrará y tendrás que aceptarlo de nuevo; la versión que aceptaste queda
registrada.
