import { DocumentoLegal } from '@/components/DocumentoLegal';
import { AVISO_ACTUALIZACION, AVISO_INTRO, SECCIONES } from '@/lib/avisoPrivacidad';

// Documento maestro v5 · §29 — el aviso, dentro de la app.
//
// Antes esto era un Linking.openURL a GitHub (repositorio privado: 404) y depender de la red para LEER lo que se acepta significa dar el consentimiento a ciegas.
// Aquí el texto viaja dentro del bundle. La presentación (Lo esencial + secciones plegables) es de `DocumentoLegal`; el texto legal no cambia.

/** Cada punto se puede comprobar en las secciones de abajo (3, 4, 7 y 8 del aviso). */
const ESENCIAL = [
  '**No vendemos tus datos** ni los usamos para publicidad.',
  'Tu INE (si eres vendedor) **solo la ve quien revisa** tu verificación.',
  'Tu teléfono solo se muestra cuando alguien toca «Ver contacto».',
  'Puedes pedir acceso, corrección, cancelación u oposición escribiendo al correo del responsable.',
];

export default function AvisoPrivacidadScreen() {
  return <DocumentoLegal actualizacion={AVISO_ACTUALIZACION} intro={AVISO_INTRO} esencial={ESENCIAL} secciones={SECCIONES} />;
}
