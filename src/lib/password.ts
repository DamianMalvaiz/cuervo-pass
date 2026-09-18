// Documento maestro v5 · §29 — reglas de contraseña.
//
// Contexto de por qué esto existe. La contraseña NUNCA se guarda en este
// proyecto: `supabase.auth.signUp()` la entrega a Supabase Auth, que la convierte
// en un hash bcrypt en `auth.users.encrypted_password` —un esquema que los roles
// `anon` y `authenticated` no pueden leer— y ahí termina. Un hash no se
// descifra: ni nosotros ni Supabase pueden recuperar la original.
//
// Por eso el riesgo no está en el almacenamiento, está en la ELECCIÓN. Y hasta
// hoy la única regla era `min(6)`: "123456" pasaba.
//
// Lo que se valida aquí es la primera de DOS barreras, y conviene tener claro
// cuál es cuál:
//
//   1. Esto, que corre en el teléfono. Sirve para EXPLICARLE a la persona qué
//      se espera, con retroalimentación inmediata. No protege de nadie: quien
//      llame a la API de Auth directamente se lo salta entero.
//   2. `minimum_password_length = 10` y `password_requirements` en
//      supabase/config.toml, empujados al proyecto con `supabase config push`.
//      Esa sí es la barrera, porque vive del lado del servidor.
//
// Las dos tienen que decir lo mismo, o el usuario ve un mensaje distinto al que
// lo rechaza. `password.test.ts` lo verifica leyendo el config.toml.
//
// Sobre las reglas de composición: el NIST SP 800-63B recomienda desde 2017
// longitud + listas de filtradas POR ENCIMA de exigir mayúsculas y dígitos,
// porque la composición empuja a la gente hacia "Password1". Se incluyen aquí
// igualmente porque Supabase las aplica del lado del servidor y porque una
// interfaz que las muestra enseña qué se espera — pero las reglas que de verdad
// mueven la aguja son las dos últimas: no reutilizar datos propios y no usar una
// contraseña conocida.

/** Mismo valor que `minimum_password_length` en supabase/config.toml. */
export const LONGITUD_MINIMA = 10;

/** Contraseñas que aparecen en cualquier lista de las más usadas, más las
 *  obvias para este proyecto en particular. No pretende ser exhaustiva —de eso
 *  se encarga la protección contra filtradas del servidor— sino atrapar lo que
 *  alguien teclea sin pensar cuando la regla le pide diez caracteres. */
const CONOCIDAS = new Set(
  [
    'contrasena1', 'contraseña1', 'password123', 'password1234', 'passw0rd123',
    'qwerty12345', 'qwertyuiop1', '1234567890', '12345678910', 'abcd12345678',
    'administrador', 'administrador1', 'iloveyou123', 'teamo12345',
    'mexico12345', 'america12345', 'chivas12345', 'cruzazul12345',
    'cuervopass', 'cuervopass1', 'cuervopass123', 'utvt12345678',
    'hola12345678', 'bienvenido1', 'principal123',
  ].map((c) => c.toLowerCase())
);

export interface ContextoPassword {
  /** Para impedir que la contraseña sea el propio correo o lo contenga. */
  email?: string;
  nombreUsuario?: string;
  nombre?: string;
}

export interface Regla {
  id: string;
  /** Lo que se le muestra a la persona. En infinitivo y en positivo: describe
   *  el objetivo, no el castigo. */
  etiqueta: string;
  cumple: (password: string, contexto: ContextoPassword) => boolean;
}

// Fragmentos demasiado cortos producen falsos positivos (un nombre de usuario de
// tres letras aparecería dentro de casi cualquier cosa).
const LARGO_MINIMO_FRAGMENTO = 4;

function fragmentosPersonales(contexto: ContextoPassword): string[] {
  const crudos = [
    contexto.email?.split('@')[0],
    contexto.nombreUsuario,
    contexto.nombre,
    // El dominio del correo también: "damian@gmail.com" → "gmail".
    contexto.email?.split('@')[1]?.split('.')[0],
  ];
  return crudos
    .filter((f): f is string => Boolean(f))
    .map((f) => f.toLowerCase().trim())
    .filter((f) => f.length >= LARGO_MINIMO_FRAGMENTO);
}

export const REGLAS: Regla[] = [
  {
    id: 'longitud',
    etiqueta: `Al menos ${LONGITUD_MINIMA} caracteres`,
    cumple: (p) => p.length >= LONGITUD_MINIMA,
  },
  {
    id: 'minuscula',
    etiqueta: 'Una letra minúscula',
    cumple: (p) => /[a-záéíóúüñ]/.test(p),
  },
  {
    id: 'mayuscula',
    etiqueta: 'Una letra mayúscula',
    cumple: (p) => /[A-ZÁÉÍÓÚÜÑ]/.test(p),
  },
  {
    id: 'digito',
    etiqueta: 'Un número',
    cumple: (p) => /\d/.test(p),
  },
  {
    id: 'sin-datos-propios',
    etiqueta: 'Que no contenga tu correo, tu usuario ni tu nombre',
    cumple: (p, contexto) => {
      const minus = p.toLowerCase();
      return !fragmentosPersonales(contexto).some((f) => minus.includes(f));
    },
  },
  {
    id: 'no-conocida',
    etiqueta: 'Que no sea una contraseña conocida',
    cumple: (p) => !CONOCIDAS.has(p.toLowerCase()),
  },
];

export interface EvaluacionPassword {
  /** En el mismo orden que REGLAS, para pintar la lista sin reordenar. */
  resultados: { regla: Regla; cumple: boolean }[];
  incumplidas: Regla[];
  valida: boolean;
}

export function evaluarPassword(password: string, contexto: ContextoPassword = {}): EvaluacionPassword {
  const resultados = REGLAS.map((regla) => ({ regla, cumple: regla.cumple(password, contexto) }));
  const incumplidas = resultados.filter((r) => !r.cumple).map((r) => r.regla);
  return { resultados, incumplidas, valida: incumplidas.length === 0 };
}

/**
 * Mensaje para el formulario. Se nombra UNA regla incumplida, no las seis: una
 * lista de seis errores debajo de un campo no se lee, se ignora. La lista
 * completa se muestra siempre en pantalla, marcada, que es donde sí se entiende.
 */
export function primerMensajeDeError(
  password: string,
  contexto: ContextoPassword = {}
): string | null {
  const { incumplidas } = evaluarPassword(password, contexto);
  return incumplidas.length ? incumplidas[0].etiqueta : null;
}
