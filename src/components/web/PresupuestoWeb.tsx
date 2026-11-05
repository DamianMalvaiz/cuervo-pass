import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { EsqueletoFilasWeb } from '@/components/web/EsqueletoWeb';
import { BloqueInfoWeb, NotaInfoWeb, PaginaInfoWeb } from '@/components/web/InfoWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { usePreciosPublicados } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';
import { MONTOS, resumirMercado } from '@/lib/presupuestoMercado';
import { RutasWeb } from '@/lib/rutasWeb';
import { usePerfilStore } from '@/store/usePerfilStore';

const pesos = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const NOMBRES = { cuarto: 'Cuartos', depa: 'Departamentos', casa_compartida: 'Casas compartidas' } as const;
const ALTO_BARRAS = 160;

/** El monto con que se abre: el presupuesto máximo de la cuenta, llevado al monto de la lista más cercano; sin él, 4,000. */
export function montoInicial(presupuestoMax: number | null | undefined): number {
  if (presupuestoMax == null || !Number.isFinite(presupuestoMax) || presupuestoMax <= 0) return 4000;
  return MONTOS.reduce((mejor, m) => (Math.abs(m - presupuestoMax) < Math.abs(mejor - presupuestoMax) ? m : mejor), MONTOS[0]);
}

/**
 * «¿Qué alcanza con tu presupuesto?»: eliges un monto y ves cuántos de los lugares publicados AHORA caben en él (en total, por tipo y por tramo de renta). Todo sale de las rentas de lo visible; no hay cifras de ejemplo. Cargando, FALLÓ y
 * «no hay lugares» son estados distintos (END-11), y si llegan tantas filas como el tope de la consulta se dice que puede haber más. Es una foto de hoy: cambia cuando se publican o pausan lugares.
 */
export function PresupuestoWeb() {
  const theme = useTheme();
  const presupuesto = usePerfilStore((s) => s.perfil?.presupuesto_max);
  const [elegido, setElegido] = useState<number | null>(null);
  const monto = elegido ?? montoInicial(presupuesto);
  const { precios, truncado, cargando, fallo, reintentar } = usePreciosPublicados();
  const r = resumirMercado(precios, monto);
  const maximo = Math.max(1, ...r.tramos.map((t) => t.total));

  let cuerpo;
  if (fallo) cuerpo = <ErrorDeCarga etiqueta="No pudimos contar los lugares" onReintentar={reintentar} />;
  else if (cargando) cuerpo = <EsqueletoFilasWeb filas={3} />;
  else if (r.total === 0) cuerpo = <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay lugares publicados que contar.</ThemedText>;
  else {
    cuerpo = (
      <>
        <View style={estilos.cifra} accessibilityLiveRegion="polite">
          <ThemedText style={Texto.seccionWebCompacto}>{`Hasta $${pesos.format(monto)}`}</ThemedText>
          <ThemedText style={Texto.titulo}>{`${r.alcanzan} de ${r.total} ${r.total === 1 ? 'lugar alcanza' : 'lugares alcanzan'}`}</ThemedText>
        </View>
        <View style={estilos.columnas}>
          <View style={estilos.grafica}>
            <BloqueInfoWeb titulo="Cuántos hay a cada renta">
              <View style={estilos.barras} accessibilityRole="list" accessibilityLabel="Lugares por tramo de renta">
                {r.tramos.map((t) => (
                  <View key={t.etiqueta} style={estilos.columna} accessible accessibilityLabel={`${t.etiqueta}: ${t.total} ${t.total === 1 ? 'lugar' : 'lugares'}, ${t.alcanzan} dentro de tu presupuesto`}>
                    <ThemedText style={Texto.pequenoFuerte}>{String(t.total)}</ThemedText>
                    <View style={[estilos.barra, { height: Math.max(4, (t.total / maximo) * ALTO_BARRAS), backgroundColor: theme.backgroundSelected }]}>
                      <View style={{ height: t.total === 0 ? 0 : `${(t.alcanzan / t.total) * 100}%`, backgroundColor: theme.bosque }} />
                    </View>
                    <ThemedText style={[Texto.etiqueta, estilos.rotulo]} themeColor="textSecondary">{t.etiqueta}</ThemedText>
                  </View>
                ))}
              </View>
              <ThemedText style={Texto.pequeno} themeColor="textSecondary">Lo verde es lo que cabe en tu presupuesto; lo gris, lo que no.</ThemedText>
            </BloqueInfoWeb>
          </View>
          <View style={estilos.tipos}>
            <BloqueInfoWeb titulo="Por tipo">
              {(Object.keys(NOMBRES) as (keyof typeof NOMBRES)[]).map((k) => (
                <View key={k} style={[estilos.fila, { borderTopColor: theme.filete }]}>
                  <ThemedText style={Texto.cuerpo}>{NOMBRES[k]}</ThemedText>
                  <ThemedText style={Texto.pesoFuerte}>{`${r.porTipo[k].alcanzan} de ${r.porTipo[k].total}`}</ThemedText>
                </View>
              ))}
            </BloqueInfoWeb>
          </View>
        </View>
        {/* La búsqueda con el monto puesto es una página de la web; en la app no hay equivalente al que llevar. */}
        {Platform.OS === 'web' ? (
          <View style={estilos.acciones}>
            <BotonWeb onPress={() => router.push({ pathname: RutasWeb.departamentos, params: { presupuesto: String(monto) } })} accessibilityLabel="Ver los lugares que alcanzan">Ver los lugares que alcanzan</BotonWeb>
          </View>
        ) : null}
        {truncado ? <NotaInfoWeb>Hay más lugares publicados de los que se pueden contar aquí; la cifra es de los más recientes.</NotaInfoWeb> : null}
      </>
    );
  }

  return (
    <PaginaInfoWeb titulo="¿Qué alcanza con tu presupuesto?" subtitulo="Elige un monto y mira cuántos lugares publicados caben en él." actual={RutasWeb.presupuesto}>
      <View style={estilos.montos} accessibilityRole="radiogroup" accessibilityLabel="Presupuesto máximo al mes">
        {MONTOS.map((m) => {
          const activo = m === monto;
          return (
            <Pulsable
              key={m}
              onPress={() => setElegido(m)}
              accessibilityRole="radio"
              accessibilityLabel={`Hasta $${pesos.format(m)}`}
              accessibilityState={{ checked: activo }}
              aria-checked={activo}
              style={[estilos.monto, { borderColor: activo ? theme.sello : theme.filete, backgroundColor: activo ? theme.sello : theme.backgroundElement }]}
            >
              <ThemedText style={[Texto.pequenoFuerte, { color: activo ? theme.selloTexto : theme.text }]}>{`$${pesos.format(m)}`}</ThemedText>
            </Pulsable>
          );
        })}
      </View>
      {cuerpo}
      <NotaInfoWeb>Es una foto de los lugares publicados hoy: cambia cuando alguien publica o pausa uno. Cuenta rentas mensuales de lo visible, sin importar el tipo salvo donde se dice.</NotaInfoWeb>
    </PaginaInfoWeb>
  );
}

const estilos = StyleSheet.create({
  montos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  monto: { minHeight: 44, paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: Filete.fino, justifyContent: 'center' },
  cifra: { gap: Spacing.one },
  columnas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, alignItems: 'flex-start' },
  grafica: { flexGrow: 2, flexBasis: 420, flexShrink: 1, maxWidth: '100%', minWidth: 0 },
  tipos: { flexGrow: 1, flexBasis: 280, flexShrink: 1, maxWidth: '100%', minWidth: 0 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, minHeight: ALTO_BARRAS + 56 },
  columna: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.one },
  barra: { width: '100%', borderTopLeftRadius: Radios.control, borderTopRightRadius: Radios.control, overflow: 'hidden', justifyContent: 'flex-end' },
  rotulo: { textAlign: 'center' },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: Spacing.two, borderTopWidth: Filete.fino },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
