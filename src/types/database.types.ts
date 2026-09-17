// Tipos mínimos a mano, mientras existe un proyecto Supabase real para generar
// los definitivos con: supabase gen types typescript --linked > src/types/database.types.ts
// No los reescribas a mano una vez que ese comando funcione.
//
// El índice `[key: string]: unknown` en cada interfaz es deliberado: supabase-js
// exige que Row/Insert/Update sean asignables a Record<string, unknown>, y en
// TypeScript 6 una interfaz sin índice explícito ya no satisface eso.

export interface Usuario {
  [key: string]: unknown;
  id: string;
  nombre_usuario: string;
  nombre_completo: string;
  foto_url: string | null;
  biografia: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  mascotas: boolean;
  fuma: boolean;
  nivel_ruido: 'bajo' | 'medio' | 'alto' | null;
  busca_roomie: boolean;
  universidad: string | null;
  latitud_universidad: number | null;
  longitud_universidad: number | null;
  activo: boolean;
  creado_en: string;
}

export interface Publicacion {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  precio_renta: number;
  descripcion: string | null;
  fotos: string[] | null;
  whatsapp: string;
  activa: boolean;
  reportes: number;
  creado_en: string;
  actualizado_en: string;
}

export interface Rooming {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  descripcion_busqueda: string | null;
  estado: 'activo' | 'pausado' | 'cerrado';
  creado_en: string;
}

export interface Mensaje {
  [key: string]: unknown;
  id: string;
  remitente_id: string;
  destinatario_id: string;
  contenido: string;
  leido: boolean;
  creado_en: string;
}

export interface Match {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  publicacion_id: string | null;
  usuario_id_2: string | null;
  score: number | null;
  creado_en: string;
}

export interface Notificacion {
  [key: string]: unknown;
  id: string;
  usuario_id: string;
  tipo: 'nuevo_mensaje' | 'nuevo_match' | 'contacto_publicacion';
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
  motivo: string | null;
  creado_en: string;
}

type Tabla<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      usuarios: Tabla<Usuario>;
      publicaciones: Tabla<Publicacion>;
      roomings: Tabla<Rooming>;
      mensajes: Tabla<Mensaje>;
      matches: Tabla<Match>;
      notificaciones: Tabla<Notificacion>;
      reportes: Tabla<Reporte>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
