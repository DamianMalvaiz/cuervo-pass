# Aviso de privacidad — Cuervo Pass

Documento maestro v5 · §29. Cumple los requisitos de la Ley Federal de
Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).

## 1. Responsable

**Angel Damian Malvaiz Gonzalez**, estudiante de Ingeniería en Redes
Inteligentes y Ciberseguridad (IRIC) de la Universidad Tecnológica del Valle de
Toluca (UTVT), es el responsable del tratamiento de los datos personales que
Cuervo Pass recaba.

**Contacto para el ejercicio de derechos ARCO:** al222211405@gmail.com

Cuervo Pass es un proyecto académico desarrollado como parte del programa
integrador de la UTVT. No es un servicio comercial y no se cobra por su uso.

## 2. Qué datos recabamos

**Obligatorios para que la app funcione:**

- Nombre completo y nombre de usuario
- Correo electrónico (lo administra Supabase Auth; nosotros no guardamos tu contraseña)
- Universidad y sus coordenadas, que eliges de una lista
- Presupuesto, distancia máxima, si tienes mascotas, si fumas y tu nivel de ruido preferido
- Número de WhatsApp, **solo si publicas** un departamento

**Opcionales:**

- Foto de perfil y biografía
- Texto libre sobre ti
- Fotos de tus publicaciones

**Lo que NO pedimos, a propósito** (principio de minimización): fecha de
nacimiento, CURP, matrícula, ni tu ubicación en tiempo real. No hacen falta para
nada de lo que la app hace.

## 3. Para qué los usamos

1. Mostrarte departamentos y compañeros de vivienda compatibles. **El perfil se
   usa explícitamente para calcular esas sugerencias**: distancia a tu
   universidad, si el precio cabe en tu presupuesto, si coinciden las mascotas y
   el nivel de ruido.
2. Permitir que otros usuarios te conozcan lo suficiente para decidir si te
   contactan.
3. Permitirte conversar dentro de la app.

No usamos tus datos para publicidad ni los vendemos.

## 4. Tratamiento con inteligencia artificial

Si —y solo si— marcas la casilla correspondiente, el **texto libre** de tu
perfil se envía a la API de Anthropic (Claude) para extraer atributos
estructurados, y se convierte en un vector numérico que permite comparar
afinidad semántica.

- La casilla **no viene premarcada**.
- Si no la marcas, no se llama al modelo, no se genera el vector, y tus
  sugerencias se calculan solo con el cuestionario.
- Puedes retirar el consentimiento en cualquier momento desde *Mi perfil →
  Editar mis preferencias*. Al retirarlo, el vector se borra.
- Política de privacidad del proveedor: <https://www.anthropic.com/legal/privacy>

## 5. Con quién se comparten

| Con quién | Qué ve |
|---|---|
| Otros usuarios con sesión | Solo lo que expone la vista `perfiles_publicos`: nombre, usuario, foto, biografía, mascotas, fuma, nivel de ruido y horario. **No** tu presupuesto, **no** tu universidad, **no** tu texto libre. |
| Otros usuarios, sobre tus publicaciones | Todo menos tu teléfono |
| Otros usuarios, tu teléfono | **Solo** cuando alguien toca "Ver contacto". Queda registrado quién lo pidió y cuándo |
| Anthropic | Únicamente tu texto libre, y solo si consentiste (sección 4) |
| Supabase | Es nuestro proveedor de base de datos y almacenamiento |

## 6. Cuánto tiempo conservamos cada cosa

| Dato | Dónde vive | Cuánto se conserva | Quién puede borrarlo |
|---|---|---|---|
| Texto libre del perfil | Tabla `usuarios` | Hasta que lo edites o elimines tu cuenta | Tú, desde la app |
| Vector del perfil | Tabla `usuarios` | Ídem; se regenera al editar el texto | Tú |
| Texto enviado al proveedor del modelo | Fuera de nuestro control | Según la política de Anthropic (enlace en la sección 4) | Nadie desde esta app |
| Logs del microservicio | Salida del contenedor | 7 días, y **no contienen el texto**: solo su longitud y el resultado | Rotación automática |
| Cuotas de uso | Tabla `cuotas_uso` | 90 días | Limpieza programada |
| Mensajes | Tabla `mensajes` | Hasta que elimines tu cuenta | Tú |

## 7. Derechos ARCO

Puedes ejercerlos tú mismo, sin escribirnos:

- **Acceso** — *Mi perfil → Descargar mis datos*. Entrega un JSON con tu perfil,
  tus publicaciones, tus mensajes y los contactos que pediste.
- **Rectificación** — *Mi perfil* y *Editar mis preferencias* editan cualquier
  dato que hayas dado.
- **Cancelación** — *Mi perfil → Eliminar mi cuenta*. Borra tu cuenta y, en
  cascada, tu perfil, tus publicaciones, tus mensajes y tus fotos del
  almacenamiento. Es irreversible.
- **Oposición** — puedes desmarcar el análisis con IA y seguir usando la app con
  normalidad.

Si algo de lo anterior falla, escríbenos al correo de la sección 1.

## 8. Seguridad

- Todo viaja cifrado por HTTPS.
- La base de datos está cifrada en reposo por nuestro proveedor.
- El acceso a los datos está controlado **fila por fila y columna por columna**
  con Row Level Security y vistas de lista blanca, que es lo que impide que un
  usuario legítimo lea los datos de otro. Esos controles están verificados con
  pruebas automatizadas que corren en cada cambio del código.
- Las fotos viven en un bucket privado y se sirven con enlaces firmados que
  caducan en una hora.

## 9. Cambios a este aviso

Cualquier cambio se publica en este mismo archivo dentro del repositorio del
proyecto, con su historial de versiones en Git.
