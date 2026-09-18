# Aviso de privacidad integral — Cuervo Pass

**Última actualización:** 18 de septiembre de 2026 · **Versión:** 2

Emitido conforme a los artículos 15, 16 y 17 de la **Ley Federal de Protección
de Datos Personales en Posesión de los Particulares** (LFPDPPP) y a los
artículos 24 a 30 de su Reglamento.

## 1. Responsable y domicilio

**Angel Damian Malvaiz Gonzalez**, estudiante de Ingeniería en Redes
Inteligentes y Ciberseguridad (IRIC) de la Universidad Tecnológica del Valle de
Toluca (UTVT), es el responsable del tratamiento de tus datos personales.

- **Domicilio para oír y recibir notificaciones:** Carretera del Departamento del D.F. km 7.5, Santa María Atarasquillo, Lerma, Estado de México, C.P. 52044
  (domicilio institucional de la Universidad Tecnológica del Valle de Toluca,
  donde se desarrolla el proyecto académico)
- **Correo del responsable:** al222211405@gmail.com

Cuervo Pass es un proyecto académico desarrollado dentro del programa integrador
de la UTVT. No es un servicio comercial, no se cobra por su uso y no persigue
fines de lucro.

## 2. Qué datos personales tratamos

**Identificación y contacto (necesarios):**

- Nombre completo y nombre de usuario
- Correo electrónico (lo administra Supabase Auth como encargado; tu contraseña
  no se guarda, ver sección 9)
- Número de WhatsApp, **únicamente si publicas** un departamento

**Preferencias de vivienda (necesarios):**

- Universidad y sus coordenadas, que eliges de una lista
- Presupuesto mínimo y máximo, y distancia máxima que aceptas recorrer
- Si tienes mascotas, si fumas y tu nivel de ruido preferido

**Opcionales:**

- Foto de perfil y biografía
- Texto libre sobre ti y sobre lo que buscas
- Fotos de tus publicaciones

**Lo que NO recabamos, a propósito** (principio de minimización, art. 6
LFPDPPP): fecha de nacimiento, CURP, RFC, matrícula escolar, domicilio actual,
datos financieros ni tu ubicación en tiempo real. Ninguno hace falta para lo que
la app hace.

### Datos sensibles

**Cuervo Pass no solicita datos sensibles** en el sentido del artículo 3,
fracción VI de la LFPDPPP: origen racial o étnico, estado de salud, información
genética, creencias religiosas, filosóficas o morales, afiliación sindical,
opiniones políticas o preferencia sexual.

Ahora bien, el **texto libre** es un campo abierto: si escribes ahí información
sensible, la estaremos tratando sin habértela pedido. Te pedimos expresamente
que no lo hagas. Puedes borrar ese texto cuando quieras desde *Mi perfil →
Editar mis preferencias*.

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

### 3.2 Secundaria (opcional)

6. **Análisis del texto libre con inteligencia artificial** para mejorar la
   precisión de las sugerencias. Ver la sección 4.

### 3.3 Cómo negarte a la finalidad secundaria

La casilla de análisis con IA **no viene premarcada**. No marcarla es negarse, y
la app funciona con normalidad sin ella: las sugerencias se calculan solo con tu
cuestionario.

Si ya la marcaste, puedes retirarla cuando quieras desde *Mi perfil → Editar mis
preferencias*. No necesitas escribirnos ni justificarlo.

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

- La casilla **no viene premarcada**, conforme al artículo 8 de la LFPDPPP.
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
instrucciones**. Conforme al artículo 36 de la LFPDPPP **esto no constituye una
transferencia** y no requiere consentimiento adicional:

| Encargado | Qué trata | Para qué |
|---|---|---|
| **Supabase** | Base de datos, autenticación y almacenamiento de fotos | Es la infraestructura sobre la que corre la app |
| **Anthropic** | Únicamente tu texto libre, y solo si consentiste | Extraer atributos para las sugerencias (sección 4) |
| **OpenStreetMap / Nominatim** | La dirección que escribes al publicar | Convertirla en coordenadas |

### 5.2 Transferencias

**No realizamos transferencias de datos personales a terceros** en el sentido
del artículo 3, fracción XVIII de la LFPDPPP. Es decir: no entregamos tus datos
a nadie que los trate para sus propios fines.

Las únicas excepciones serían las del artículo 37 de la LFPDPPP —por ejemplo, un
requerimiento de autoridad competente—, que no requieren tu consentimiento pero
que, de ocurrir, te serían notificadas al correo de tu cuenta salvo que la
autoridad lo prohíba.

### 5.3 Lo que otros usuarios ven

Esto no es una transferencia: es el funcionamiento del servicio que solicitaste.

| Quién | Qué ve de ti |
|---|---|
| Cualquier usuario con sesión | Solo lo que expone la vista `perfiles_publicos`: nombre, usuario, foto, biografía, mascotas, tabaco, nivel de ruido y horario. **No** tu presupuesto, **no** tu universidad, **no** tu texto libre, **no** tu vector. |
| Usuarios que ven tus publicaciones | Todo el contenido de la publicación **menos tu teléfono** |
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
| **Acceso** | *Mi perfil → Descargar mis datos*. Entrega un archivo JSON con tu perfil, tus publicaciones, tus mensajes y los contactos que solicitaste. |
| **Rectificación** | *Mi perfil* y *Editar mis preferencias* corrigen cualquier dato que hayas proporcionado. |
| **Cancelación** | *Mi perfil → Eliminar mi cuenta*. |
| **Oposición** | Desmarcar la casilla de análisis con IA en *Editar mis preferencias*. |

### 7.2 Por escrito

Si algo de lo anterior falla, o prefieres el trámite formal, escribe al correo
de la sección 1 indicando:

1. Tu nombre y un medio para comunicarte la respuesta.
2. Los documentos que acrediten tu identidad (o la representación legal).
3. La descripción clara de los datos sobre los que ejerces el derecho.
4. Cualquier elemento que facilite localizar los datos.

**Plazos** (artículo 32 de la LFPDPPP): responderemos en un máximo de **20 días
hábiles** y, si procede, lo haremos efectivo dentro de los **15 días hábiles**
siguientes.

### 7.3 Ante la autoridad

Si consideras que tu derecho a la protección de datos personales fue vulnerado,
puedes acudir al **Instituto Nacional de Transparencia, Acceso a la Información
y Protección de Datos Personales (INAI)**: <https://home.inai.org.mx>

## 8. Revocación del consentimiento

Puedes revocar en cualquier momento el consentimiento que nos otorgaste.

- **Para el análisis con IA:** desmarca la casilla en *Editar mis preferencias*.
  Surte efecto de inmediato y el vector se borra.
- **Para el tratamiento en general:** equivale a cancelar la cuenta, porque sin
  los datos de la sección 2 el servicio no puede operar. Se hace desde *Mi
  perfil → Eliminar mi cuenta*.

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
cuenta conforme al artículo 20 de la LFPDPPP.

## 10. Cambios a este aviso

Cualquier modificación se publica en este archivo (`docs/aviso-privacidad.md`)
dentro del repositorio del proyecto, con su historial completo de versiones en
Git, y se refleja en la pantalla *Aviso de privacidad* dentro de la app.

Si el cambio afecta a las finalidades del tratamiento, te lo comunicaremos al
correo asociado a tu cuenta antes de aplicarlo.
