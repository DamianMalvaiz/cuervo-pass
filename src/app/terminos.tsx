import { DocumentoLegal } from '@/components/DocumentoLegal';
import { TERMINOS, TERMINOS_ACTUALIZACION, TERMINOS_ESENCIAL, TERMINOS_INTRO } from '@/lib/terminos';

export default function TerminosScreen() {
  return (
    <DocumentoLegal actualizacion={TERMINOS_ACTUALIZACION} intro={TERMINOS_INTRO} esencial={TERMINOS_ESENCIAL} secciones={TERMINOS} />
  );
}
