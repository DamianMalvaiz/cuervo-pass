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
  similitud?: number | null;        // solo en Nivel 2
  score_final?: number | null;      // solo en Nivel 2
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
  tipo: 'nuevo_mensaje' | 'nuevo_contacto' | 'publicacion_oculta';
  contenido: string | null;
  leida: boolean;
  creado_en: string;
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

type Tabla<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
// Las vistas de §13 son de solo lectura, pero supabase-js exige la misma forma
// que una tabla para poder inferir el tipo de `select()`; sin Insert/Update el
// resultado se infiere como `{}` y todo lo que lo consume se cae.
type Vista<Row> = Tabla<Row>;

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
    };
    Functions: {
      sugerencias_publicaciones: {
        Args: { p_limite?: number };
        Returns: PublicacionSugerida[];
      };
      sugerencias_con_ranking: {
        Args: { p_limite?: number };
        Returns: PublicacionSugerida[];
      };
      sugerencias_roomies: {
        Args: { p_limite?: number };
        Returns: RoomieSugerido[];
      };
      abrir_conversacion: {
        Args: { p_otro: string };
        Returns: string;
      };
      revelar_contacto: {
        Args: { p_publicacion_id: string; p_score?: number | null };
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
