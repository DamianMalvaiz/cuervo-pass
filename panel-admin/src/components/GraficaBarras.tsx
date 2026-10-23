// Gráfica de barras hecha a mano con SVG, sin librería. Cada barra lleva su valor y su etiqueta como TEXTO (no solo como dibujo), y el conjunto un nombre accesible.
// Un cero se dibuja como cero; una barra con valor pero muy pequeña conserva un mínimo visible para que no parezca un cero.
export interface Dato {
  etiqueta: string;
  valor: number;
}

const ANCHO_BARRA = 40;
const SEPARACION = 20;
const ALTO_MAX = 120;
const MARGEN_ARRIBA = 22;
const MARGEN_ABAJO = 24;
const MINIMO_VISIBLE = 2;

export function GraficaBarras({ titulo, datos }: { titulo: string; datos: Dato[] }) {
  if (datos.length === 0) return <p className="suave">Sin datos</p>;

  const maximo = Math.max(...datos.map((d) => d.valor), 0);
  const ancho = datos.length * (ANCHO_BARRA + SEPARACION) + SEPARACION;
  const alto = MARGEN_ARRIBA + ALTO_MAX + MARGEN_ABAJO;
  const resumen = datos.map((d) => `${d.etiqueta}: ${d.valor}`).join('; ');

  return (
    <svg className="grafica" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`${titulo}. ${resumen}`}>
      {datos.map((d, i) => {
        const x = SEPARACION + i * (ANCHO_BARRA + SEPARACION);
        const proporcional = maximo > 0 ? (d.valor / maximo) * ALTO_MAX : 0;
        const h = d.valor > 0 ? Math.max(proporcional, MINIMO_VISIBLE) : 0;
        const y = MARGEN_ARRIBA + ALTO_MAX - h;
        return (
          <g key={`${d.etiqueta}-${i}`}>
            <rect data-barra className="barra" x={x} y={y} width={ANCHO_BARRA} height={h} rx={4} />
            <text className="valor-barra" x={x + ANCHO_BARRA / 2} y={y - 6} textAnchor="middle">{d.valor}</text>
            <text className="etiqueta-barra" x={x + ANCHO_BARRA / 2} y={alto - 8} textAnchor="middle">{d.etiqueta}</text>
          </g>
        );
      })}
    </svg>
  );
}
