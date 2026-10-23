import type { ResumenAdmin } from '../lib/api';

const CIFRAS: { clave: keyof Omit<ResumenAdmin, 'modo_demo'>; titulo: string }[] = [
  { clave: 'cuentas', titulo: 'Cuentas' },
  { clave: 'negocios_activos', titulo: 'Negocios activos' },
  { clave: 'verificaciones_pendientes', titulo: 'Verificaciones pendientes' },
  { clave: 'resenas_reportadas', titulo: 'Reseñas reportadas' },
  { clave: 'resenas_ocultas', titulo: 'Reseñas ocultas' },
  { clave: 'negocios_ocultos', titulo: 'Negocios ocultos' },
];

export function Resumen({ resumen }: { resumen: ResumenAdmin }) {
  return (
    <section aria-labelledby="titulo-resumen">
      <h2 id="titulo-resumen">Resumen</h2>
      <div className="rejilla">
        {CIFRAS.map(({ clave, titulo }) => (
          <article key={clave} className="tarjeta cifra">
            <p className="etiqueta">{titulo}</p>
            <p className="valor">{resumen[clave]}</p>
          </article>
        ))}
        <article className="tarjeta cifra">
          <p className="etiqueta">Modo de demostración</p>
          <p className="valor">{resumen.modo_demo ? 'Encendido' : 'Apagado'}</p>
        </article>
      </div>
    </section>
  );
}
