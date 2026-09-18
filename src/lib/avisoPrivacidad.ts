// Documento maestro v5 · §29 — el aviso de privacidad, como DATOS.
//
// Por qué vive aquí y no solo en docs/aviso-privacidad.md: la pantalla de
// registro pide aceptar el aviso, y hasta ahora el único modo de leerlo era un
// enlace a GitHub. El repositorio es privado, así que ese enlace devolvía 404 —
// o sea, se pedía aceptar un documento imposible de consultar. Un consentimiento
// que no se puede informar no es consentimiento.
//
// El .md sigue siendo el documento entregable (historial en Git, §9 del propio
// aviso). Este archivo es su gemelo para pantalla, y `avisoPrivacidad.test.ts`
// falla si los títulos de las secciones dejan de coincidir entre ambos. Es la
// misma idea del §33.1: si una promesa tiene que seguir siendo cierta, se
// verifica con código, no con disciplina.
//
// En `texto` se admite **negritas** al estilo markdown; TextoConNegritas las
// interpreta. No se admite nada más a propósito: el formato que no se puede
// renderizar es el formato que acaba viéndose mal.

export type Bloque =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; puntos: string[] }
  /** Una tabla del .md. En un teléfono una tabla real es ilegible, así que cada
   *  fila se apila como encabezado + detalle. */
  | { tipo: 'filas'; filas: { titulo: string; detalle: string }[] }
  | { tipo: 'enlace'; texto: string; url: string };

export interface Seccion {
  numero: number;
  titulo: string;
  bloques: Bloque[];
}

export const AVISO_TITULO = 'Aviso de privacidad — Cuervo Pass';

export const AVISO_INTRO =
  'Cumple los requisitos de la Ley Federal de Protección de Datos Personales en ' +
  'Posesión de los Particulares (LFPDPPP).';

export const CORREO_RESPONSABLE = 'al222211405@gmail.com';

export const SECCIONES: Seccion[] = [
  {
    numero: 1,
    titulo: 'Responsable',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          '**Angel Damian Malvaiz Gonzalez**, estudiante de Ingeniería en Redes ' +
          'Inteligentes y Ciberseguridad (IRIC) de la Universidad Tecnológica del ' +
          'Valle de Toluca (UTVT), es el responsable del tratamiento de los datos ' +
          'personales que Cuervo Pass recaba.',
      },
      { tipo: 'parrafo', texto: '**Contacto para el ejercicio de derechos ARCO:**' },
      { tipo: 'enlace', texto: CORREO_RESPONSABLE, url: `mailto:${CORREO_RESPONSABLE}` },
      {
        tipo: 'parrafo',
        texto:
          'Cuervo Pass es un proyecto académico desarrollado como parte del programa ' +
          'integrador de la UTVT. No es un servicio comercial y no se cobra por su uso.',
      },
    ],
  },
  {
    numero: 2,
    titulo: 'Qué datos recabamos',
    bloques: [
      { tipo: 'parrafo', texto: '**Obligatorios para que la app funcione:**' },
      {
        tipo: 'lista',
        puntos: [
          'Nombre completo y nombre de usuario',
          'Correo electrónico (lo administra Supabase Auth; nosotros no guardamos tu contraseña)',
          'Universidad y sus coordenadas, que eliges de una lista',
          'Presupuesto, distancia máxima, si tienes mascotas, si fumas y tu nivel de ruido preferido',
          'Número de WhatsApp, **solo si publicas** un departamento',
        ],
      },
      { tipo: 'parrafo', texto: '**Opcionales:**' },
      {
        tipo: 'lista',
        puntos: ['Foto de perfil y biografía', 'Texto libre sobre ti', 'Fotos de tus publicaciones'],
      },
      {
        tipo: 'parrafo',
        texto:
          '**Lo que NO pedimos, a propósito** (principio de minimización): fecha de ' +
          'nacimiento, CURP, matrícula, ni tu ubicación en tiempo real. No hacen falta ' +
          'para nada de lo que la app hace.',
      },
    ],
  },
  {
    numero: 3,
    titulo: 'Para qué los usamos',
    bloques: [
      {
        tipo: 'lista',
        puntos: [
          'Mostrarte departamentos y compañeros de vivienda compatibles. **El perfil se usa explícitamente para calcular esas sugerencias**: distancia a tu universidad, si el precio cabe en tu presupuesto, si coinciden las mascotas y el nivel de ruido.',
          'Permitir que otros usuarios te conozcan lo suficiente para decidir si te contactan.',
          'Permitirte conversar dentro de la app.',
        ],
      },
      { tipo: 'parrafo', texto: 'No usamos tus datos para publicidad ni los vendemos.' },
    ],
  },
  {
    numero: 4,
    titulo: 'Tratamiento con inteligencia artificial',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Si —y solo si— marcas la casilla correspondiente, el **texto libre** de tu ' +
          'perfil se envía a la API de Anthropic (Claude) para extraer atributos ' +
          'estructurados, y se convierte en un vector numérico que permite comparar ' +
          'afinidad semántica.',
      },
      {
        tipo: 'lista',
        puntos: [
          'La casilla **no viene premarcada**.',
          'Si no la marcas, no se llama al modelo, no se genera el vector, y tus sugerencias se calculan solo con el cuestionario.',
          'Puedes retirar el consentimiento en cualquier momento desde Mi perfil → Editar mis preferencias. Al retirarlo, el vector se borra.',
        ],
      },
      { tipo: 'parrafo', texto: 'Política de privacidad del proveedor:' },
      {
        tipo: 'enlace',
        texto: 'anthropic.com/legal/privacy',
        url: 'https://www.anthropic.com/legal/privacy',
      },
    ],
  },
  {
    numero: 5,
    titulo: 'Con quién se comparten',
    bloques: [
      {
        tipo: 'filas',
        filas: [
          {
            titulo: 'Otros usuarios con sesión',
            detalle:
              'Solo lo que expone la vista perfiles_publicos: nombre, usuario, foto, ' +
              'biografía, mascotas, fuma, nivel de ruido y horario. **No** tu presupuesto, ' +
              '**no** tu universidad, **no** tu texto libre.',
          },
          {
            titulo: 'Otros usuarios, sobre tus publicaciones',
            detalle: 'Todo menos tu teléfono.',
          },
          {
            titulo: 'Otros usuarios, tu teléfono',
            detalle:
              '**Solo** cuando alguien toca "Ver contacto". Queda registrado quién lo pidió y cuándo.',
          },
          {
            titulo: 'Anthropic',
            detalle: 'Únicamente tu texto libre, y solo si consentiste (sección 4).',
          },
          {
            titulo: 'Supabase',
            detalle: 'Es nuestro proveedor de base de datos y almacenamiento.',
          },
        ],
      },
    ],
  },
  {
    numero: 6,
    titulo: 'Cuánto tiempo conservamos cada cosa',
    bloques: [
      {
        tipo: 'filas',
        filas: [
          {
            titulo: 'Texto libre del perfil',
            detalle: 'Hasta que lo edites o elimines tu cuenta. Puedes borrarlo tú, desde la app.',
          },
          {
            titulo: 'Vector del perfil',
            detalle: 'Ídem; se regenera al editar el texto. Puedes borrarlo tú.',
          },
          {
            titulo: 'Texto enviado al proveedor del modelo',
            detalle:
              'Fuera de nuestro control: según la política de Anthropic (enlace en la sección 4).',
          },
          {
            titulo: 'Logs del microservicio',
            detalle:
              '7 días, y **no contienen el texto**: solo su longitud y el resultado. Se rotan automáticamente.',
          },
          { titulo: 'Cuotas de uso', detalle: '90 días. Limpieza programada.' },
          { titulo: 'Mensajes', detalle: 'Hasta que elimines tu cuenta. Puedes borrarlos tú.' },
        ],
      },
    ],
  },
  {
    numero: 7,
    titulo: 'Derechos ARCO',
    bloques: [
      { tipo: 'parrafo', texto: 'Puedes ejercerlos tú mismo, sin escribirnos:' },
      {
        tipo: 'lista',
        puntos: [
          '**Acceso** — Mi perfil → Descargar mis datos. Entrega un JSON con tu perfil, tus publicaciones, tus mensajes y los contactos que pediste.',
          '**Rectificación** — Mi perfil y Editar mis preferencias editan cualquier dato que hayas dado.',
          '**Cancelación** — Mi perfil → Eliminar mi cuenta. Borra tu cuenta y, en cascada, tu perfil, tus publicaciones, tus mensajes y tus fotos del almacenamiento. Es irreversible.',
          '**Oposición** — puedes desmarcar el análisis con IA y seguir usando la app con normalidad.',
        ],
      },
      { tipo: 'parrafo', texto: 'Si algo de lo anterior falla, escríbenos al correo de la sección 1.' },
    ],
  },
  {
    numero: 8,
    titulo: 'Seguridad',
    bloques: [
      {
        tipo: 'lista',
        puntos: [
          'Todo viaja cifrado por HTTPS.',
          'La base de datos está cifrada en reposo por nuestro proveedor.',
          'El acceso a los datos está controlado **fila por fila y columna por columna** con Row Level Security y vistas de lista blanca, que es lo que impide que un usuario legítimo lea los datos de otro. Esos controles están verificados con pruebas automatizadas que corren en cada cambio del código.',
          'Las fotos viven en un bucket privado y se sirven con enlaces firmados que caducan en una hora.',
        ],
      },
    ],
  },
  {
    numero: 9,
    titulo: 'Cambios a este aviso',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Cualquier cambio se publica en el archivo docs/aviso-privacidad.md dentro del ' +
          'repositorio del proyecto, con su historial de versiones en Git.',
      },
    ],
  },
];
