import { CORREO_RESPONSABLE, type Seccion } from './avisoPrivacidad';

// Términos y condiciones de uso · 24/10/2026.
//
// Mismo formato que el aviso (`Seccion`/`Bloque`) para que la app los pinte con el mismo componente. Cada afirmación de aquí describe algo que la app
// hace hoy; si cambia el comportamiento, cambia este texto. No hay aceptación obligatoria todavía: el aviso de privacidad sí se acepta al registrarse.

export const TERMINOS_ACTUALIZACION = '24 de octubre de 2026 · Versión 1';

export const TERMINOS_INTRO =
  'Estas reglas explican cómo usar Cuervo 360. Están escritas para leerse en un par de minutos.';

export const TERMINOS_ESENCIAL = [
  'Cuervo 360 es un proyecto académico de la UTVT: te ayuda a encontrar vivienda, roomies y negocios cerca.',
  'No somos parte de lo que acuerdes con otra persona: renta, pago o compra son entre ustedes.',
  'Lo que publicas es responsabilidad tuya. Podemos retirar lo que sea falso o dañino.',
  'Las sugerencias con inteligencia artificial son una guía; las puedes apagar cuando quieras.',
];

export const TERMINOS: Seccion[] = [
  {
    numero: 1,
    titulo: 'Qué es Cuervo 360',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Cuervo 360 es un proyecto académico de la Universidad Tecnológica del Valle de Toluca (UTVT) que ayuda a estudiantes a encontrar vivienda, ' +
          'roomies compatibles y negocios o servicios cercanos. **Solo ponemos en contacto a las personas**: no somos dueños de las viviendas, ' +
          'no vendemos los servicios y no somos parte de los acuerdos que hagan entre ustedes.',
      },
    ],
  },
  {
    numero: 2,
    titulo: 'Tu cuenta',
    bloques: [
      {
        tipo: 'lista',
        puntos: [
          'Las cuentas de **estudiante** se crean con un correo institucional (.edu.mx).',
          'Las cuentas de **arrendador** o **comerciante** pueden usar cualquier correo, pero para publicar deben pasar una verificación.',
          'Da datos verdaderos y cuida tu contraseña: lo que se haga desde tu cuenta se entiende hecho por ti.',
          'Una persona puede tener un perfil de estudiante y uno de vendedor con el mismo correo.',
        ],
      },
    ],
  },
  {
    numero: 3,
    titulo: 'Lo que publicas',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Eres responsable de lo que publicas: fotos, descripciones, precios y ubicación deben ser **reales y actuales**. No publiques contenido falso, ' +
          'engañoso, ilegal, ofensivo ni que no sea tuyo. Podemos ocultar o retirar una publicación que incumpla estas reglas.',
      },
    ],
  },
  {
    numero: 4,
    titulo: 'Reportes y cuentas restringidas',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Puedes reportar publicaciones, perfiles y reseñas. Quien revisa los reportes puede **restringir una cuenta**: seguirá viendo la app y ' +
          'podrá responder mensajes, pero no podrá reportar, reseñar ni abrir chats nuevos mientras dure la restricción.',
      },
    ],
  },
  {
    numero: 5,
    titulo: 'Verificación de vendedores',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Para publicar como arrendador o comerciante pedimos una identificación y unas fotos. **Solo las ve el equipo que verifica.** ' +
          'Que una cuenta esté verificada significa que revisamos esos documentos; **no garantiza** la calidad del servicio ni de la vivienda.',
      },
    ],
  },
  {
    numero: 6,
    titulo: 'Planes y pagos',
    bloques: [
      {
        tipo: 'lista',
        puntos: [
          'Empezar con una cuenta de vendedor es gratis. Puedes **empezar una prueba gratis de 15 días** con todo lo de un plan; sin tarjeta y sin compromiso.',
          'La prueba se puede usar **una vez por tipo de cuenta** y no se ofrece a quien ya pagó un plan.',
          'Si la prueba termina y no eliges un plan, lo tuyo deja de mostrarse. No se borra.',
          'Los pagos se hacen con **Mercado Pago**. Si eliges pagar en OXXO, el plan se activa cuando pagues en la tienda.',
          'En esta etapa del proyecto los pagos funcionan en **modo de pruebas** de Mercado Pago.',
        ],
      },
    ],
  },
  {
    numero: 7,
    titulo: 'Sugerencias con inteligencia artificial',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Para sugerirte viviendas y roomies compatibles usamos algoritmos y técnicas de ciencia de datos sobre lo que tú nos cuentas. ' +
          '**Son una guía, no una decisión**: tú eliges con quién hablar y qué rentar. Puedes apagar el análisis en cualquier momento desde ' +
          '**Configuración → Personalización**. El detalle de qué datos se usan está en el aviso de privacidad.',
      },
    ],
  },
  {
    numero: 8,
    titulo: 'Eliminar tu cuenta',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Puedes eliminar tu cuenta cuando quieras desde **Configuración → Eliminar mi cuenta**. Es definitivo y no se puede deshacer.',
      },
    ],
  },
  {
    numero: 9,
    titulo: 'Cambios y contacto',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Si estas reglas cambian, la fecha y la versión de arriba cambian con ellas. Para dudas o aclaraciones escribe a ' +
          `**${CORREO_RESPONSABLE}**.`,
      },
    ],
  },
];
