import type { ResenaPublica } from '@/lib/resenas';
import type { MiSuscripcion } from '@/lib/planes';

// Tipos mínimos a mano, mientras existe un proyecto Supabase real para generar
// los definitivos con: supabase gen types typescript --linked > src/types/database.types.ts
// No los reescribas a mano una vez que ese comando funcione.
//
// El índice `[key: string]: unknown` en cada interfaz es deliberado: supabase-js
// exige que Row/Insert/Update sean asignables a Record<string, unknown>, y en
// TypeScript 6 una interfaz sin índice explícito ya no satisface eso.
//
// Documento maestro v5 · §11 (modelo de datos) y §13 (vistas públicas).

export interface Usuario {
  [key: string]: unknown;
  id: string;
  nombre_usuario: string;
  nombre_completo: string;
  foto_url: string | null;          // RUTA dentro del bucket, no URL (§14)
  biografia: string | null;
  perfil_texto: string | null;      // texto plano: ver §30 sobre por qué NO va cifrado
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  distancia_max_km: number | null;
  mascotas: boolean;
  fuma: boolean;
  nivel_ruido: 'bajo' | 'medio' | 'alto' | null;
  horario_predominante: 'diurno' | 'nocturno' | 'mixto' | null;
  busca_roomie: boolean;
  universidad: string | null;
  latitud_universidad: number | null;
  longitud_universidad: number | null;
  cuestionario_completo: boolean;
  acepto_aviso_privacidad_en: string | null;
  /** Versión del aviso que aceptó la cuenta (0059). null = anterior al registro de versiones: hay que aceptar la vigente. */
  version_aviso_aceptada?: string | null;
  consiente_analisis_ia: boolean;
  // pgvector: se ESCRIBE como number[] plano (supabase-js lo serializa a JSON
  // y Postgres lo parsea porque coincide con la sintaxis literal de vector),
  // pero se LEE de vuelta como texto "[0.1,0.2,...]", nunca como array.
  // Nunca se necesita parsearlo en el cliente: toda la similitud de coseno se
  // calcula del lado de Postgres (§18).
  perfil_vector: string | number[] | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

// Lo que CUALQUIER usuario autenticado puede ver de otro. Es la lista blanca de
// columnas de la vista `perfiles_publicos` (§13): aquí no hay presupuesto, ni
// perfil_texto, ni perfil_vector, ni universidad. Si agregas una columna
// sensible a Usuario, NO la agregues aquí — ese es justamente el punto.
export interface PerfilPublico {
  [key: string]: unknown;
  id: string;
  nombre_usuario: string;
  nombre_completo: string;
  foto_url: string | null;
  biografia: string | null;
  mascotas: boolean;
  fuma: boolean;
  nivel_ruido: 'bajo' | 'medio' | 'alto' | null;
  horario_predominante: 'diurno' | 'nocturno' | 'mixto' | null;
  creado_en: string;
  /**
   * Se derivó de `auth.users.email_confirmed_at` en la vista (migración 0026),
   * no es una columna copiada. Dice que el correo existe y que esa persona lo
   * controla — NADA más. No es «usuario verificado»: la app no verifica
   * identidades (§28). Etiquétalo en pantalla como «correo verificado».
   */
  correo_verificado: boolean;
  /**
   * Cuenta sin correo universitario (0082): no reporta, no reseña ni abre conversaciones; sí responde en las que ya existen. La fija el
   * servidor al dar de alta; la dueña no la cambia. La app la usa solo para NO ofrecer lo que la base va a rechazar.
   */
  cuenta_restringida: boolean;
  /** Qué perfil usa la persona ahora (0083): decide la barra de pestañas y la primera vista. Solo cambia con `cambiar_perfil_activo`. */
  perfil_activo: 'estudiante' | 'vendedor';
}

export type TipoPublicacion = 'depa' | 'cuarto' | 'casa_compartida';

export interface Publicacion {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  titulo: string;
  tipo: TipoPublicacion;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  pendiente_geocoding: boolean;
  geocodificado_por: string | null;
  precio_renta: number;
  descripcion: string | null;
  permite_mascotas: boolean;
  amueblado: boolean;
  servicios_incluidos: boolean;
  recamaras: number;
  fotos: string[] | null;           // RUTAS dentro del bucket, no URLs (§14)
  whatsapp: string;                 // solo visible para el dueño: la vista pública no lo trae
  vector_embedding: string | number[] | null;
  activa: boolean;
  oculta_por_reportes: boolean;
  reportes_count: number;
  creado_en: string;
  actualizado_en: string;
}

// La vista `publicaciones_publicas`: lo mismo SIN el teléfono. El número se
// entrega solo por revelar_contacto(), que aplica cuota y deja registro.
//
// Escrita a mano y no con `Omit<Publicacion, 'whatsapp' | ...>`: sobre una
// interfaz con índice `[key: string]: unknown`, Omit colapsa a solo el índice y
// pierde todas las propiedades nombradas, así que el tipo resultante era `{}`.
// Escribirla a mano además espeja la lista blanca de columnas de la vista, que
// es justo la que hay que revisar en cada cambio de esquema (§13, AUD-14).
export interface PublicacionPublica {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  titulo: string;
  tipo: TipoPublicacion;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  precio_renta: number;
  descripcion: string | null;
  permite_mascotas: boolean;
  amueblado: boolean;
  servicios_incluidos: boolean;
  recamaras: number;
  fotos: string[] | null;
  vector_embedding: string | number[] | null;
  creado_en: string;
}

// Fila que devuelven sugerencias_publicaciones() y sugerencias_con_ranking().
export interface PublicacionSugerida {
  [key: string]: unknown;
  id: string;
  titulo: string;
  tipo: TipoPublicacion;
  direccion: string;
  precio_renta: number;
  descripcion: string | null;
  fotos: string[] | null;
  permite_mascotas: boolean;
  amueblado: boolean;
  latitud: number | null;
  longitud: number | null;
  distancia: number | null;         // km, ya calculada en Postgres; null si no hay geocoding
  score: number;
  // `similitud` es null cuando esa publicación no tiene embedding. Null y no
  // cero: cero es una afinidad medida, null es su ausencia (END-08).
  similitud?: number | null;
  score_final?: number | null;
  // El nivel es POR FILA, no una bandera de la consulta: en una misma lista
  // conviven publicaciones ordenadas por afinidad y publicaciones ordenadas
  // solo por filtros.
  nivel?: 1 | 2;
  /** Título de TU favorito más cercano, si se parece lo bastante (coseno ≥ 0.70, 0071). Null = no se explica. */
  parecido_a?: string | null;
}

/** Fila de `publicaciones_parecidas` (0071): lo visible más cercano a una publicación. */
export interface PublicacionParecida {
  [key: string]: unknown;
  id: string;
  titulo: string;
  tipo: TipoPublicacion;
  direccion: string;
  precio_renta: number;
  fotos: string[] | null;
  similitud: number;
}

/**
 * END-32 · El orden que el usuario elige, aplicado en Postgres.
 *
 * No es cosmético que viva aquí y no en la pantalla: ordenar en el cliente
 * significaría ordenar el top-30 YA TRUNCADO por encaje, así que «menor renta»
 * daría las más baratas de las treinta que mejor encajan, no las más baratas.
 * Es el mismo defecto que END-17, y el carrusel «Las de menor renta» lo tenía.
 */
export type OrdenSugerencias = 'ajuste' | 'cercania' | 'precio';

/** Fila de `nuevas_esta_semana`. No trae `similitud` ni `nivel`: este carrusel
 *  ordena por FECHA, y mezclar ahí la afinidad volvería a contar lo mismo. */
export interface PublicacionNueva {
  [key: string]: unknown;
  id: string;
  titulo: string;
  tipo: TipoPublicacion;
  direccion: string;
  precio_renta: number;
  descripcion: string | null;
  fotos: string[] | null;
  latitud: number | null;
  longitud: number | null;
  distancia: number | null;
  score: number;
  creado_en: string;
}

export interface Roomie {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  descripcion_busqueda: string;
  presupuesto_aportacion: number | null;
  vector_busqueda: string | number[] | null;
  estado: 'activo' | 'pausado' | 'cerrado';
  creado_en: string;
}

// Fila que devuelve sugerencias_roomies(): el roomie más los datos públicos de
// su dueño, ya unidos en Postgres.
export interface RoomieSugerido {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  descripcion_busqueda: string;
  presupuesto_aportacion: number | null;
  estado: 'activo' | 'pausado' | 'cerrado';
  creado_en: string;
  nombre_completo: string;
  foto_url: string | null;
  biografia: string | null;
  similitud: number | null;
  /** Compatibilidad por reglas (0066): null = no hay dato que comparar. `undefined` = el servidor aún no la manda. */
  compatibilidad?: number | null;
  puntaje?: number;
  coincidencias?: string[];
  diferencias?: string[];
}

export interface Conversacion {
  [key: string]: unknown;
  id: string;
  usuario_a: string;
  usuario_b: string;
  ultimo_mensaje_en: string;
  creado_en: string;
}

export interface Mensaje {
  [key: string]: unknown;
  id: string;
  conversacion_id: string;
  remitente_id: string;
  contenido: string;
  leido: boolean;
  creado_en: string;
}

export interface Contacto {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  publicacion_id: string | null;
  roomie_id: string | null;
  score_mostrado: number | null;
  creado_en: string;
}

export interface Notificacion {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  tipo:
    | 'nuevo_mensaje'
    | 'nuevo_contacto'
    | 'publicacion_oculta'
    | 'cuenta_suspendida'
    | 'verificacion_resuelta'
    | 'resena_nueva'
    | 'resena_respondida';
  contenido: string | null;
  leida: boolean;
  creado_en: string;
  /** «clase:id» a donde lleva tocarla (0072). Solo se sigue si la clase es conocida: ver `rutaDeDestino`. */
  destino?: string | null;
}

export interface Reporte {
  [key: string]: unknown;
  id: string;
  reportado_por: string;
  publicacion_id: string | null;
  usuario_reportado_id: string | null;
  motivo: string;
  creado_en: string;
}

// Tabla aparte de `usuarios` a propósito (migración 0008, Semana 11): un token
// push no debe ser legible por nadie más que su dueño, porque quien lo tenga
// puede mandarle notificaciones falsas a esa persona vía el servicio de Expo.
//
// Esa decisión se tomó cuando `usuarios` era de lectura pública para cualquier
// autenticado. v5 cerró esa tabla (§13), así que el argumento original ya no
// aplica — pero la separación sigue siendo correcta: el token no tiene por qué
// vivir junto al perfil, y mantenerlo aparte hace que nunca pueda colarse en
// `perfiles_publicos` por descuido.
export interface PushToken {
  [key: string]: unknown;
  usuario_id: string;
  token: string;
  actualizado_en: string;
}

/** Funciones que se AGREGAN a una cuenta (migración 0043). «Estudiante» es implícito y no se guarda. */
export type Rol = 'comerciante' | 'arrendador' | 'admin';
export type EstadoRol = 'sin_verificar' | 'pendiente' | 'aprobado' | 'rechazado';
export interface RolUsuario {
  [key: string]: unknown;
  usuario_id: string;
  rol: Rol;
  estado: EstadoRol;
  /** `migracion`: heredada al introducir los roles, NO una aprobación revisada. */
  origen: 'solicitud' | 'migracion' | 'sembrado';
  desde: string;
}

/** Una publicación que esta cuenta guardó (migración 0044). Privado: solo su dueña lo lee. */
export interface Favorito {
  [key: string]: unknown;
  usuario_id: string;
  publicacion_id: string;
  creado_en: string;
}

/** Servicios · 0047. */
export interface CategoriaServicio {
  [key: string]: unknown;
  id: string;
  nombre: string;
  icono: string;
  orden: number;
}

export interface Negocio {
  [key: string]: unknown;
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  /** 1 = $, 2 = $$, 3 = $$$. Nulo = sin dato. */
  rango_precio: number | null;
  horario: string | null;
  fotos: string[];
  destacado: boolean;
  /** `sembrado` = negocio de ejemplo (inventado para la demostración). */
  origen: 'solicitud' | 'sembrado';
  /** Promedio de las reseñas visibles (0054); `null` si no tiene. NUNCA se asigna: lo calcula la base. */
  calificacion?: number | null;
  num_resenas?: number;
  /** Solo en la lista ordenada (0055): km desde TU universidad, o null si falta el dato. */
  distancia_km?: number | null;
  /** Solo en la lista ordenada: el puntaje de ranking, entre 0 y 1. */
  puntaje?: number;
  /** Abierto ahora, calculado en el servidor (0070): `null` = sin horario estructurado (no se sabe). */
  abierto_ahora?: boolean | null;
}

/** Un negocio visto por su DUEÑA (tabla `negocios`, 0052): trae lo que la vista pública no expone. */
export interface NegocioPropio extends Negocio {
  usuario_id: string | null;
  activo: boolean;
  oculto_por_reportes: boolean;
  creado_en: string;
}

/** Un turno semanal de un negocio (0070). `abre`/`cierra` llegan como «HH:MM:SS» de Postgres. */
export interface NegocioHorarioFila {
  [key: string]: unknown;
  negocio_id: string;
  dia: number;
  abre: string;
  cierra: string;
}

export interface NegocioItem {
  [key: string]: unknown;
  id: string;
  negocio_id: string;
  nombre: string;
  /** Nulo = «consulta el precio». Nunca se inventa uno. */
  precio: number | null;
  orden: number;
  seccion: string | null;
  descripcion: string | null;
  /** La PORTADA: la primera de `fotos`. La base las mantiene sincronizadas (0085). */
  foto: string | null;
  /** Rutas de Storage de las fotos del producto (hasta 5, dentro de la carpeta de su negocio); la primera es la portada. */
  fotos: string[];
  /** Producto estrella (0086): el vendedor lo elige y sale primero, en el carrusel «Destacados» de su tienda. */
  estrella: boolean;
}

/** Verificación de vendedor · 0049. Privado: solo su dueña lee su fila. */
export interface VerificacionVendedor {
  [key: string]: unknown;
  usuario_id: string;
  rol: 'comerciante' | 'arrendador';
  nombre_legal: string;
  direccion: string;
  enviada_en: string;
  revisada_en: string | null;
  motivo_rechazo: string | null;
}

/** Un plan de pago (migración 0053). Catálogo público: lo lee cualquier cuenta con sesión. */
export interface PlanDePago {
  [key: string]: unknown;
  id: string;
  rol: 'comerciante' | 'arrendador';
  nombre: string;
  precio_centavos: number;
  limite_principal: number;
  max_fotos: number;
  max_productos: number;
  destaca: boolean;
  es_prueba: boolean;
  orden: number;
}

/** Un pago registrado (0053). Privado: solo su dueña lo lee, y solo el servidor lo escribe. */
export interface PagoRegistrado {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  rol: 'comerciante' | 'arrendador';
  plan_id: string;
  monto_centavos: number;
  origen: 'simulado' | 'mercadopago';
  periodo_inicio: string;
  periodo_fin: string;
  creado_en: string;
}

/** Una orden de pago con Mercado Pago (0077). La dueña solo LEE la suya; el servidor la crea y la actualiza. */
export interface OrdenPago {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  rol: 'comerciante' | 'arrendador';
  plan_id: string;
  monto_centavos: number;
  /** creada: aún sin aviso · pendiente: Mercado Pago la recibió y espera (OXXO) · pagada · rechazada. */
  estado: 'creada' | 'pendiente' | 'pagada' | 'rechazada';
  mp_preference_id: string | null;
  creada_en: string;
  actualizada_en: string;
}

/** Reseña tal como la lee su AUTORA desde la tabla (0054). La pública sale de `resenas_publicas` (ver lib/resenas). */
export interface MiResena {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  negocio_id: string | null;
  publicacion_id: string | null;
  estrellas: number;
  texto: string | null;
}

type Tabla<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
// Las vistas de §13 son de solo lectura, pero supabase-js exige la misma forma
// que una tabla para poder inferir el tipo de `select()`; sin Insert/Update el
// resultado se infiere como `{}` y todo lo que lo consume se cae.
type Vista<Row> = Tabla<Row>;

// Lo que `anon` y `authenticated` leen de las vistas `explorar_*` (0090): datos reducidos, sin dirección exacta, teléfono ni quién publica.
export interface PublicacionExplorar {
  [key: string]: unknown;
  id: string;
  titulo: string;
  tipo: 'depa' | 'cuarto' | 'casa_compartida';
  precio_renta: number;
  recamaras: number | null;
  amueblado: boolean | null;
  permite_mascotas: boolean | null;
  servicios_incluidos: string[] | null;
  /** La dirección sin su primer tramo (calle y número); `null` si no se puede decir sin enseñar la calle. */
  zona: string | null;
  /** Redondeadas a ~1 km: sirven para el mapa, no para llegar a la puerta. */
  latitud_aprox: number | null;
  longitud_aprox: number | null;
  num_fotos: number;
  destacado: boolean;
  calificacion: number | null;
  num_resenas: number | null;
  creado_en: string;
}

export interface NegocioExplorar {
  [key: string]: unknown;
  id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  zona: string | null;
  latitud_aprox: number | null;
  longitud_aprox: number | null;
  horario: unknown;
  num_fotos: number;
  destacado: boolean;
  calificacion: number | null;
  num_resenas: number | null;
  abierto_ahora: boolean | null;
  creado_en: string;
}

export interface ProductoExplorar {
  [key: string]: unknown;
  id: string;
  negocio_id: string;
  nombre: string;
  /** Nulo = «consulta el precio». */
  precio: number | null;
  seccion: string | null;
  descripcion: string | null;
  num_fotos: number;
  estrella: boolean;
  orden: number;
}

export interface HorarioExplorar {
  [key: string]: unknown;
  negocio_id: string;
  dia: number;
  abre: string;
  cierra: string;
}

export interface CategoriaExplorar {
  [key: string]: unknown;
  id: string;
  nombre: string;
  icono: string | null;
  orden: number;
}


export interface Database {
  public: {
    Tables: {
      usuarios: Tabla<Usuario>;
      publicaciones: Tabla<Publicacion>;
      roomies: Tabla<Roomie>;
      conversaciones: Tabla<Conversacion>;
      mensajes: Tabla<Mensaje>;
      contactos: Tabla<Contacto>;
      notificaciones: Tabla<Notificacion>;
      reportes: Tabla<Reporte>;
      push_tokens: Tabla<PushToken>;
      roles_usuario: Tabla<RolUsuario>;
      favoritos: Tabla<Favorito>;
      categorias_servicio: Tabla<CategoriaServicio>;
      verificaciones_vendedor: Tabla<VerificacionVendedor>;
      negocios: Tabla<NegocioPropio>;
      planes: Tabla<PlanDePago>;
      resenas: Tabla<MiResena>;
      pagos: Tabla<PagoRegistrado>;
      ordenes_pago: Tabla<OrdenPago>;
      negocio_items: Tabla<NegocioItem>;
      negocio_horarios: Tabla<NegocioHorarioFila>;
      favoritos_negocios: Tabla<{ [key: string]: unknown; usuario_id: string; negocio_id: string; creado_en: string }>;
      geocodificaciones: Tabla<{
        [key: string]: unknown;
        consulta: string;
        latitud: number | null;
        longitud: number | null;
        proveedor: string;
        creado_en: string;
      }>;
    };
    Views: {
      perfiles_publicos: Vista<PerfilPublico>;
      publicaciones_publicas: Vista<PublicacionPublica>;
      negocios_publicos: Vista<Negocio>;
      negocio_items_publicos: Vista<NegocioItem>;
      negocio_horarios_publicos: Vista<NegocioHorarioFila>;
      resenas_publicas: Vista<ResenaPublica>;
      explorar_publicaciones: Vista<PublicacionExplorar>;
      explorar_negocios: Vista<NegocioExplorar>;
      explorar_categorias: Vista<CategoriaExplorar>;
      explorar_productos: Vista<ProductoExplorar>;
      explorar_horarios: Vista<HorarioExplorar>;
      calificacion_publicaciones: Vista<{ [key: string]: unknown; publicacion_id: string; calificacion: number; num_resenas: number }>;
    };
    Functions: {
      // END-17 · `p_tipo` se aplica dentro de la función que trunca a 30, no
      // después. Filtrar una página ya truncada es lo que hacía que la app
      // negara la existencia de publicaciones que sí estaban.
      sugerencias_publicaciones: {
        Args: { p_limite?: number; p_tipo?: TipoPublicacion | null; p_orden?: OrdenSugerencias };
        Returns: PublicacionSugerida[];
      };
      sugerencias_con_ranking: {
        Args: { p_limite?: number; p_tipo?: TipoPublicacion | null; p_orden?: OrdenSugerencias };
        Returns: PublicacionSugerida[];
      };
      // END-32 · El único carrusel. Trae lo que la lista no tiene —lo reciente—
      // en vez de reordenar el mismo conjunto por tercera vez.
      // Los destacados de Departamentos (0087): arrendadores con el plan que destaca.
      destacadas_publicaciones: {
        Args: { p_limite?: number; p_tipo?: TipoPublicacion | null };
        Returns: PublicacionNueva[];
      };
      nuevas_esta_semana: {
        Args: { p_limite?: number; p_tipo?: TipoPublicacion | null };
        Returns: PublicacionNueva[];
      };
      // La afinidad con una PERSONA. Devuelve una fila siempre, con `similitud`
      // en null cuando no hay con qué comparar — el `left join` de la 0039
      // existe justo para que la pantalla no tenga que distinguir «no hay
      // afinidad» de «la consulta no devolvió nada».
      afinidad_roomie_de: {
        Args: { p_usuario_id: string };
        Returns: { similitud: number | null; nivel: 1 | 2 }[];
      };
      sugerencias_roomies: {
        Args: { p_limite?: number };
        Returns: RoomieSugerido[];
      };
      // Cuántas personas guardaron cada publicación: solo (id, total), nunca quién (migración 0045).
      // Una publicación que no se puede ver no devuelve fila, igual que una inexistente.
      // Cuántas personas guardaron MIS negocios (0088): solo del dueño; uno ajeno no devuelve fila.
      favoritos_por_negocio: {
        Args: { p_ids: string[] };
        Returns: { negocio_id: string; total: number }[];
      };
      favoritos_por_publicacion: {
        Args: { p_ids: string[] };
        Returns: { publicacion_id: string; total: number }[];
      };
      // Estado, municipio, ciudad y colonias de UN código postal (migración 0069). Cero filas si no existe; 22023 si no tiene 5 dígitos.
      buscar_codigo_postal: {
        Args: { p_cp: string };
        Returns: { estado: string; municipio: string; ciudad: string | null; colonias: string[] }[];
      };
      // Registra un error de la app (migración 0068). El servidor lo limpia, lo agrupa y no guarda quién. Falla en silencio si se pasó la cuota.
      registrar_error_app: {
        Args: { p_nivel: string; p_mensaje: string; p_detalle: string | null; p_version: string; p_plataforma: string };
        Returns: undefined;
      };
      // Registra que la cuenta aceptó esta versión del aviso de privacidad (migración 0059). 22023 si la versión no tiene forma `vN`.
      aceptar_aviso: {
        Args: { p_version: string };
        Returns: undefined;
      };
      // Inicia la prueba gratis de una función y devuelve hasta cuándo dura. CP018 sin esa función, CP019 si ya se usó o ya hubo un pago (migración 0084).
      iniciar_prueba: {
        Args: { p_rol: 'comerciante' | 'arrendador' };
        Returns: string;
      };
      // 'estudiante' siempre; 'vendedor' solo con alguna función de vendedor (CP017 si no). 22023 si el perfil no existe (migración 0083).
      cambiar_perfil_activo: {
        Args: { p_perfil: 'estudiante' | 'vendedor' };
        Returns: undefined;
      };
      // Solo comerciante o arrendador, siempre en sin_verificar. admin y estudiante → CP003.
      agregar_funcion: {
        Args: { p_rol: 'comerciante' | 'arrendador' };
        Returns: undefined;
      };
      // Envía la verificación de vendedor a revisión (migración 0049). CP005 si ya no se puede enviar.
      enviar_verificacion: {
        Args: {
          p_rol: 'comerciante' | 'arrendador';
          p_nombre_legal: string;
          p_direccion: string;
          p_ine_frente: string;
          p_ine_reverso: string;
          p_fotos: string[];
          p_version_aviso: string;
        };
        Returns: undefined;
      };
      // Guarda el menú ENTERO en una transacción (migración 0053). CP009 si excede el tope del plan.
      guardar_menu: {
        Args: { p_negocio: string; p_items: unknown };
        Returns: undefined;
      };
      // El plan efectivo de esta cuenta para una función (0053). Sin la función, no devuelve filas.
      mi_suscripcion: {
        Args: { p_rol: 'comerciante' | 'arrendador' };
        Returns: MiSuscripcion[];
      };
      // Pago de DEMOSTRACIÓN: solo con demo_mode activo (CP010 si está apagado, CP011 si el plan no aplica).
      simular_pago: {
        Args: { p_plan: string };
        Returns: string;
      };
      // El dueño del objetivo responde a una reseña; texto vacío QUITA la respuesta (0054).
      responder_resena: {
        Args: { p_resena: string; p_texto: string };
        Returns: undefined;
      };
      // Reporta una reseña ajena; tres personas distintas la ocultan (0054).
      reportar_resena: {
        Args: { p_resena: string; p_motivo: string };
        Returns: undefined;
      };
      // La lista de Servicios, ordenada y filtrada en el servidor (migración 0055).
      negocios_ordenados: {
        Args: { p_categoria: string | null; p_texto: string | null; p_limite: number; p_solo_abiertos?: boolean };
        Returns: Negocio[];
      };
      // Reemplaza TODO el horario de un negocio propio (0070).
      guardar_horario: {
        Args: { p_negocio: string; p_turnos: { dia: number; abre: string; cierra: string }[] };
        Returns: undefined;
      };
      abrir_conversacion: {
        Args: { p_otro: string };
        Returns: string;
      };
      // END-16 · Resuelve el último mensaje y los no leídos de CADA hilo con dos
      // `lateral join`, en vez de traer 1200 mensajes y plegarlos en el cliente.
      resumen_conversaciones: {
        Args: { p_limite: number };
        Returns: {
          conversacion_id: string;
          otro_usuario_id: string;
          ultimo_contenido: string | null;
          ultimo_creado_en: string | null;
          ultimo_remitente_id: string | null;
          ultimo_leido: boolean | null;
          no_leidos: number;
        }[];
      };
      afinidad_de: {
        Args: { p_publicacion_id: string };
        Returns: {
          score: number | null;
          similitud: number | null;
          score_final: number | null;
          nivel: 1 | 2;
          parecido_a: string | null;
        }[];
      };
      // Lo visible más parecido a una publicación (0071). Mínimo 0.60 de coseno; tope 12.
      publicaciones_parecidas: {
        Args: { p_publicacion: string; p_limite?: number };
        Returns: PublicacionParecida[];
      };
      revelar_contacto: {
        Args: { p_publicacion_id: string};
        Returns: string;
      };
      contactos_de_mis_publicaciones: {
        Args: Record<string, never>;
        Returns: { publicacion_id: string; total: number }[];
      };
      exportar_mis_datos: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      consumir_cuota: {
        Args: { p_recurso: string; p_limite: number };
        Returns: undefined;
      };
      enviar_notificacion_push: {
        Args: { destinatario_id: string; titulo: string; cuerpo: string; datos?: unknown };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
