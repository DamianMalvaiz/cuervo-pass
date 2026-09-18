// Documento maestro v5 · §29 — el aviso de privacidad, como DATOS.
//
// Por qué vive aquí y no solo en docs/aviso-privacidad.md: la pantalla de
// registro pide aceptar el aviso, y hasta hace poco el único modo de leerlo era
// un enlace a GitHub. El repositorio era privado, así que ese enlace devolvía
// 404 — o sea, se pedía aceptar un documento imposible de consultar. Un
// consentimiento que no se puede informar no es consentimiento.
//
// El .md sigue siendo el documento entregable (historial en Git, §10 del propio
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
  | { tipo: 'subtitulo'; texto: string }
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

export const AVISO_TITULO = 'Aviso de privacidad integral — Cuervo Pass';

export const AVISO_ACTUALIZACION = '18 de septiembre de 2026 · Versión 2';

export const AVISO_INTRO =
  'Emitido conforme a los artículos 15, 16 y 17 de la Ley Federal de Protección ' +
  'de Datos Personales en Posesión de los Particulares (LFPDPPP) y a los ' +
  'artículos 24 a 30 de su Reglamento.';

export const CORREO_RESPONSABLE = 'al222211405@gmail.com';

/** Art. 16 fracción I: el aviso debe traer identidad **y** domicilio. */
export const DOMICILIO_RESPONSABLE =
  'Carretera del Departamento del D.F. km 7.5, Santa María Atarasquillo, ' +
  'Lerma, Estado de México, C.P. 52044';

export const SECCIONES: Seccion[] = [
  {
    numero: 1,
    titulo: 'Responsable y domicilio',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          '**Angel Damian Malvaiz Gonzalez**, estudiante de Ingeniería en Redes ' +
          'Inteligentes y Ciberseguridad (IRIC) de la Universidad Tecnológica del ' +
          'Valle de Toluca (UTVT), es el responsable del tratamiento de tus datos ' +
          'personales.',
      },
      {
        tipo: 'filas',
        filas: [
          {
            titulo: 'Domicilio para oír y recibir notificaciones',
            detalle:
              DOMICILIO_RESPONSABLE +
              ' (domicilio institucional de la Universidad Tecnológica del Valle de ' +
              'Toluca, donde se desarrolla el proyecto académico).',
          },
          { titulo: 'Correo del responsable', detalle: CORREO_RESPONSABLE },
        ],
      },
      {
        tipo: 'parrafo',
        texto:
          'Cuervo Pass es un proyecto académico desarrollado dentro del programa ' +
          'integrador de la UTVT. No es un servicio comercial, no se cobra por su uso ' +
          'y no persigue fines de lucro.',
      },
    ],
  },
  {
    numero: 2,
    titulo: 'Qué datos personales tratamos',
    bloques: [
      { tipo: 'parrafo', texto: '**Identificación y contacto (necesarios):**' },
      {
        tipo: 'lista',
        puntos: [
          'Nombre completo y nombre de usuario',
          'Correo electrónico (lo administra Supabase Auth como encargado; tu contraseña no se guarda, ver sección 9)',
          'Número de WhatsApp, **únicamente si publicas** un departamento',
        ],
      },
      { tipo: 'parrafo', texto: '**Preferencias de vivienda (necesarios):**' },
      {
        tipo: 'lista',
        puntos: [
          'Universidad y sus coordenadas, que eliges de una lista',
          'Presupuesto mínimo y máximo, y distancia máxima que aceptas recorrer',
          'Si tienes mascotas, si fumas y tu nivel de ruido preferido',
        ],
      },
      { tipo: 'parrafo', texto: '**Opcionales:**' },
      {
        tipo: 'lista',
        puntos: ['Foto de perfil y biografía', 'Texto libre sobre ti y sobre lo que buscas', 'Fotos de tus publicaciones'],
      },
      {
        tipo: 'parrafo',
        texto:
          '**Lo que NO recabamos, a propósito** (principio de minimización, art. 6 ' +
          'LFPDPPP): fecha de nacimiento, CURP, RFC, matrícula escolar, domicilio ' +
          'actual, datos financieros ni tu ubicación en tiempo real. Ninguno hace ' +
          'falta para lo que la app hace.',
      },
      { tipo: 'subtitulo', texto: 'Datos sensibles' },
      {
        tipo: 'parrafo',
        texto:
          '**Cuervo Pass no solicita datos sensibles** en el sentido del artículo 3, ' +
          'fracción VI de la LFPDPPP: origen racial o étnico, estado de salud, ' +
          'información genética, creencias religiosas, filosóficas o morales, ' +
          'afiliación sindical, opiniones políticas o preferencia sexual.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Ahora bien, el **texto libre** es un campo abierto: si escribes ahí ' +
          'información sensible, la estaremos tratando sin habértela pedido. Te ' +
          'pedimos expresamente que no lo hagas. Puedes borrar ese texto cuando ' +
          'quieras desde Mi perfil → Editar mis preferencias.',
      },
    ],
  },
  {
    numero: 3,
    titulo: 'Finalidades del tratamiento',
    bloques: [
      { tipo: 'subtitulo', texto: 'Primarias (necesarias para el servicio)' },
      {
        tipo: 'parrafo',
        texto:
          'Sin estos tratamientos la app no puede funcionar, y por eso no es posible ' +
          'oponerse a ellos conservando la cuenta:',
      },
      {
        tipo: 'lista',
        puntos: [
          'Crear y mantener tu cuenta, y autenticarte.',
          'Calcular y mostrarte sugerencias de departamentos y de compañeros de vivienda. **Tu perfil se usa explícitamente para esto**: distancia a tu universidad, si el precio cabe en tu presupuesto, y si coinciden las mascotas, el tabaco y el nivel de ruido.',
          'Mostrar tu perfil público a otros usuarios con sesión iniciada, para que puedan decidir si te contactan.',
          'Permitirte conversar con otros usuarios dentro de la app.',
          'Prevenir abusos: registrar quién solicita un número de contacto y cuándo, aplicar cuotas de uso y atender reportes.',
        ],
      },
      { tipo: 'subtitulo', texto: 'Secundaria (opcional)' },
      {
        tipo: 'parrafo',
        texto:
          '**Análisis del texto libre con inteligencia artificial** para mejorar la ' +
          'precisión de las sugerencias. Ver la sección 4.',
      },
      { tipo: 'subtitulo', texto: 'Cómo negarte a la finalidad secundaria' },
      {
        tipo: 'parrafo',
        texto:
          'La casilla de análisis con IA **no viene premarcada**. No marcarla es ' +
          'negarse, y la app funciona con normalidad sin ella: las sugerencias se ' +
          'calculan solo con tu cuestionario.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Si ya la marcaste, puedes retirarla cuando quieras desde Mi perfil → ' +
          'Editar mis preferencias. No necesitas escribirnos ni justificarlo.',
      },
      {
        tipo: 'parrafo',
        texto:
          '**No tratamos tus datos con fines de mercadotecnia, publicidad ni ' +
          'prospección comercial, y no los vendemos ni los cedemos a nadie.**',
      },
    ],
  },
  {
    numero: 4,
    titulo: 'Tratamiento con inteligencia artificial',
    bloques: [
      {
        tipo: 'parrafo',
        texto: 'Si —y solo si— otorgas tu consentimiento marcando la casilla correspondiente:',
      },
      {
        tipo: 'lista',
        puntos: [
          'El **texto libre** de tu perfil se envía a la API de **Anthropic (Claude)** para extraer atributos estructurados.',
          'Ese texto se convierte además en un **vector numérico** (384 números) que permite comparar afinidad semántica entre perfiles. No es legible como texto y no se muestra a ningún otro usuario.',
          'Ningún otro dato tuyo se envía al proveedor del modelo: ni tu nombre, ni tu correo, ni tu teléfono, ni tus fotos.',
        ],
      },
      { tipo: 'parrafo', texto: 'Garantías concretas:' },
      {
        tipo: 'lista',
        puntos: [
          'La casilla **no viene premarcada**, conforme al artículo 8 de la LFPDPPP.',
          'Si no la marcas, **no se llama al modelo y no se genera el vector**.',
          'Al **retirar** el consentimiento, el vector se **borra**. No se conserva "por si acaso": un dato derivado de un consentimiento retirado no tiene fundamento para seguir existiendo.',
          'Los registros del microservicio guardan **la longitud del texto, nunca el texto**.',
        ],
      },
      { tipo: 'parrafo', texto: 'Política de privacidad del proveedor:' },
      { tipo: 'enlace', texto: 'anthropic.com/legal/privacy', url: 'https://www.anthropic.com/legal/privacy' },
    ],
  },
  {
    numero: 5,
    titulo: 'Encargados y transferencias',
    bloques: [
      { tipo: 'subtitulo', texto: 'Encargados' },
      {
        tipo: 'parrafo',
        texto:
          'Estas empresas tratan datos **por cuenta nuestra y bajo nuestras ' +
          'instrucciones**. Conforme al artículo 36 de la LFPDPPP **esto no ' +
          'constituye una transferencia** y no requiere consentimiento adicional:',
      },
      {
        tipo: 'filas',
        filas: [
          {
            titulo: 'Supabase',
            detalle:
              'Base de datos, autenticación y almacenamiento de fotos. Es la infraestructura sobre la que corre la app.',
          },
          {
            titulo: 'Anthropic',
            detalle: 'Únicamente tu texto libre, y solo si consentiste: extraer atributos para las sugerencias (sección 4).',
          },
          {
            titulo: 'OpenStreetMap / Nominatim',
            detalle: 'La dirección que escribes al publicar, para convertirla en coordenadas.',
          },
        ],
      },
      { tipo: 'subtitulo', texto: 'Transferencias' },
      {
        tipo: 'parrafo',
        texto:
          '**No realizamos transferencias de datos personales a terceros** en el ' +
          'sentido del artículo 3, fracción XVIII de la LFPDPPP. Es decir: no ' +
          'entregamos tus datos a nadie que los trate para sus propios fines.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Las únicas excepciones serían las del artículo 37 de la LFPDPPP —por ' +
          'ejemplo, un requerimiento de autoridad competente—, que no requieren tu ' +
          'consentimiento pero que, de ocurrir, te serían notificadas al correo de tu ' +
          'cuenta salvo que la autoridad lo prohíba.',
      },
      { tipo: 'subtitulo', texto: 'Lo que otros usuarios ven' },
      {
        tipo: 'parrafo',
        texto: 'Esto no es una transferencia: es el funcionamiento del servicio que solicitaste.',
      },
      {
        tipo: 'filas',
        filas: [
          {
            titulo: 'Cualquier usuario con sesión',
            detalle:
              'Solo lo que expone la vista perfiles_publicos: nombre, usuario, foto, ' +
              'biografía, mascotas, tabaco, nivel de ruido y horario. **No** tu ' +
              'presupuesto, **no** tu universidad, **no** tu texto libre, **no** tu vector.',
          },
          {
            titulo: 'Usuarios que ven tus publicaciones',
            detalle: 'Todo el contenido de la publicación **menos tu teléfono**.',
          },
          {
            titulo: 'Usuarios que piden tu contacto',
            detalle:
              'Tu WhatsApp, **solo** al tocar "Ver contacto". Queda registrado quién lo ' +
              'pidió y cuándo, y hay un límite diario por persona.',
          },
        ],
      },
    ],
  },
  {
    numero: 6,
    titulo: 'Conservación de los datos',
    bloques: [
      {
        tipo: 'filas',
        filas: [
          { titulo: 'Perfil y preferencias', detalle: 'Mientras la cuenta exista. Puedes borrarlo tú, desde la app.' },
          { titulo: 'Texto libre del perfil', detalle: 'Hasta que lo edites o borres. Puedes borrarlo tú.' },
          {
            titulo: 'Vector del perfil',
            detalle: 'Se regenera al editar el texto y se borra al retirar el consentimiento.',
          },
          {
            titulo: 'Publicaciones y sus fotos',
            detalle: 'Mientras la cuenta exista o hasta que las elimines. Puedes borrarlas tú.',
          },
          { titulo: 'Mensajes', detalle: 'Mientras la cuenta exista. Puedes borrarlos tú.' },
          {
            titulo: 'Registro de contactos solicitados',
            detalle: 'Mientras la cuenta exista: es lo que permite detectar abuso. Se elimina con la cuenta.',
          },
          { titulo: 'Cuotas de uso', detalle: '90 días. Limpieza programada.' },
          {
            titulo: 'Registros del microservicio',
            detalle: '7 días, y **no contienen el texto**: solo su longitud y el resultado. Rotación automática.',
          },
          {
            titulo: 'Texto enviado al proveedor del modelo',
            detalle: 'Fuera de nuestro control; según la política de Anthropic.',
          },
        ],
      },
      {
        tipo: 'parrafo',
        texto:
          'Al eliminar tu cuenta, **todo lo anterior se borra en cascada**, incluidas ' +
          'tus fotos del almacenamiento. Es irreversible y no conservamos copia.',
      },
    ],
  },
  {
    numero: 7,
    titulo: 'Derechos ARCO y cómo ejercerlos',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Tienes derecho a **Acceder** a tus datos, **Rectificarlos** cuando sean ' +
          'inexactos, **Cancelarlos** cuando consideres que no se requieren, y ' +
          '**Oponerte** a su tratamiento para fines específicos.',
      },
      { tipo: 'subtitulo', texto: 'Desde la app, sin trámite' },
      {
        tipo: 'filas',
        filas: [
          {
            titulo: 'Acceso',
            detalle:
              'Mi perfil → Descargar mis datos. Entrega un archivo JSON con tu perfil, ' +
              'tus publicaciones, tus mensajes y los contactos que solicitaste.',
          },
          {
            titulo: 'Rectificación',
            detalle: 'Mi perfil y Editar mis preferencias corrigen cualquier dato que hayas proporcionado.',
          },
          { titulo: 'Cancelación', detalle: 'Mi perfil → Eliminar mi cuenta.' },
          {
            titulo: 'Oposición',
            detalle: 'Desmarcar la casilla de análisis con IA en Editar mis preferencias.',
          },
        ],
      },
      { tipo: 'subtitulo', texto: 'Por escrito' },
      {
        tipo: 'parrafo',
        texto:
          'Si algo de lo anterior falla, o prefieres el trámite formal, escribe al ' +
          'correo de la sección 1 indicando:',
      },
      {
        tipo: 'lista',
        puntos: [
          'Tu nombre y un medio para comunicarte la respuesta.',
          'Los documentos que acrediten tu identidad (o la representación legal).',
          'La descripción clara de los datos sobre los que ejerces el derecho.',
          'Cualquier elemento que facilite localizar los datos.',
        ],
      },
      {
        tipo: 'parrafo',
        texto:
          '**Plazos** (artículo 32 de la LFPDPPP): responderemos en un máximo de ' +
          '**20 días hábiles** y, si procede, lo haremos efectivo dentro de los ' +
          '**15 días hábiles** siguientes.',
      },
      { tipo: 'subtitulo', texto: 'Ante la autoridad' },
      {
        tipo: 'parrafo',
        texto:
          'Si consideras que tu derecho a la protección de datos personales fue ' +
          'vulnerado, puedes acudir al **Instituto Nacional de Transparencia, Acceso ' +
          'a la Información y Protección de Datos Personales (INAI)**:',
      },
      { tipo: 'enlace', texto: 'home.inai.org.mx', url: 'https://home.inai.org.mx' },
    ],
  },
  {
    numero: 8,
    titulo: 'Revocación del consentimiento',
    bloques: [
      { tipo: 'parrafo', texto: 'Puedes revocar en cualquier momento el consentimiento que nos otorgaste.' },
      {
        tipo: 'lista',
        puntos: [
          '**Para el análisis con IA:** desmarca la casilla en Editar mis preferencias. Surte efecto de inmediato y el vector se borra.',
          '**Para el tratamiento en general:** equivale a cancelar la cuenta, porque sin los datos de la sección 2 el servicio no puede operar. Se hace desde Mi perfil → Eliminar mi cuenta.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: 'En ninguno de los dos casos hace falta escribirnos ni justificar la decisión.',
      },
    ],
  },
  {
    numero: 9,
    titulo: 'Medidas de seguridad',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Queremos ser precisos aquí, porque un aviso de privacidad que exagera sus ' +
          'medidas es una declaración falsa.',
      },
      { tipo: 'subtitulo', texto: 'Tu contraseña no se guarda: se convierte en un hash' },
      {
        tipo: 'parrafo',
        texto:
          'Nunca llega a nuestra base de datos ni queda en el código de la app. Se ' +
          'entrega a Supabase Auth, que la transforma con **bcrypt** en un valor del ' +
          'que la contraseña original **no se puede recuperar**. Ni nosotros, ni ' +
          'Supabase, ni nadie con acceso a la base podría leerla.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Se exigen al menos **10 caracteres**, con mayúsculas, minúsculas y dígitos, ' +
          'y esa regla se aplica **del lado del servidor**, no solo en la pantalla — ' +
          'de modo que tampoco puede saltarse llamando a la API directamente.',
      },
      { tipo: 'subtitulo', texto: 'Tus fotos no están cifradas de extremo a extremo, y no deberían estarlo' },
      {
        tipo: 'parrafo',
        texto: 'Una foto de perfil existe para que otros usuarios la vean. Lo que sí hay:',
      },
      {
        tipo: 'lista',
        puntos: [
          'Viven en un **almacenamiento privado**: no son accesibles desde internet sin autorización. Antes de septiembre de 2026 el almacenamiento era público y cualquiera que adivinara la ruta podía verlas; eso se corrigió.',
          'Se sirven mediante **enlaces firmados que caducan a la hora**. Con precisión: **mientras un enlace firmado no caduque, funciona para quien lo tenga.**',
          'Están **cifradas en reposo** por el proveedor de infraestructura, lo que protege frente al robo físico del medio de almacenamiento, no frente a otro usuario.',
          'Solo tú puedes subir, reemplazar o borrar archivos en tus propias rutas.',
        ],
      },
      { tipo: 'subtitulo', texto: 'El resto de los controles' },
      {
        tipo: 'lista',
        puntos: [
          'Todo el tráfico viaja cifrado por **HTTPS**.',
          'La base de datos está cifrada en reposo por el proveedor.',
          'El acceso está controlado **fila por fila y columna por columna** mediante Row Level Security y vistas de lista blanca. Es lo que impide que un usuario legítimo lea los datos de otro.',
          'Esos controles **están verificados con pruebas automatizadas** que se ejecutan en cada cambio del código, no con una revisión manual que envejece.',
          'El servicio de inteligencia artificial solo acepta peticiones con un token compartido, y registra la longitud del texto, nunca el texto.',
        ],
      },
      {
        tipo: 'parrafo',
        texto:
          'Ninguna medida de seguridad es absoluta. Si detectamos una vulneración que ' +
          'afecte de forma significativa tus derechos, te lo comunicaremos al correo ' +
          'de tu cuenta conforme al artículo 20 de la LFPDPPP.',
      },
    ],
  },
  {
    numero: 10,
    titulo: 'Cambios a este aviso',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Cualquier modificación se publica en el archivo docs/aviso-privacidad.md ' +
          'dentro del repositorio del proyecto, con su historial completo de versiones ' +
          'en Git, y se refleja en esta pantalla.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Si el cambio afecta a las finalidades del tratamiento, te lo comunicaremos ' +
          'al correo asociado a tu cuenta antes de aplicarlo.',
      },
    ],
  },
];
