import { DocumentoLegal } from '@/components/DocumentoLegal';
import { TERMINOS, TERMINOS_ACTUALIZACION, TERMINOS_ESENCIAL, TERMINOS_INTRO } from '@/lib/terminos';
import { EnMarcoWeb } from '@/components/web/EnMarcoWeb';

export default function TerminosScreen() {
  return (
    <EnMarcoWeb titulo="Términos y condiciones" ancho="completo">
      <TerminosScreenPantalla />
    </EnMarcoWeb>
  );
}

function TerminosScreenPantalla() {
  return (
    <DocumentoLegal actualizacion={TERMINOS_ACTUALIZACION} intro={TERMINOS_INTRO} esencial={TERMINOS_ESENCIAL} secciones={TERMINOS} />
  );
}
