import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface AnclaFicha {
  /** `nativeID` de la sección a la que lleva (en la web es su `id`). */
  id: string;
  etiqueta: string;
}

// RN no conoce `sticky` ni `scroll-margin-top`; React Native Web los deja pasar al CSS. El margen deja el título de la sección DEBAJO de la barra al saltar.
const PEGADA = { position: 'sticky', top: 0, zIndex: 10 } as unknown as ViewStyle;
export const MARGEN_ANCLA = { scrollMarginTop: 72 } as unknown as ViewStyle;

const LINEA_LECTURA = 140;

/**
 * Qué sección está «en lectura»: la última cuyo borde de arriba ya pasó la línea de lectura (bajo la barra pegada); y si la última se ve ENTERA en la ventana (el final de la página no deja subirla más), esa.
 * Sin esa segunda regla, una sección final corta nunca llegaría a la línea y la barra marcaría la anterior aunque ya se esté viendo la última. Las secciones vienen en el orden de la página.
 */
export function anclaActiva(secciones: { id: string; top: number; bottom: number }[], altoVentana: number): string | null {
  if (secciones.length === 0) return null;
  const ultima = secciones[secciones.length - 1];
  if (secciones.length > 1 && ultima.top >= 0 && ultima.bottom <= altoVentana) return ultima.id;
  const pasadas = secciones.filter((s) => s.top <= LINEA_LECTURA);
  return (pasadas.length > 0 ? pasadas[pasadas.length - 1] : secciones[0]).id;
}

/**
 * La barra de anclas de una ficha larga: se queda pegada arriba al bajar y lleva a cada sección. La sección que se está leyendo queda marcada (`anclaActiva`, medida con IntersectionObserver; si el navegador no lo tiene,
 * simplemente no marca ninguna y los saltos siguen funcionando). Con «reducir movimiento» el salto es directo, sin desplazamiento suave.
 */
export function SubnavFichaWeb({ anclas }: { anclas: AnclaFicha[] }) {
  const theme = useTheme();
  const [activa, setActiva] = useState<string | null>(null);
  const clave = anclas.map((a) => a.id).join('|');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const orden = clave.split('|');
    const medir = () => {
      const rects = orden.map((id) => {
        const r = document.getElementById(id)?.getBoundingClientRect();
        return r ? { id, top: r.top, bottom: r.bottom } : null;
      });
      setActiva(anclaActiva(rects.filter((r): r is { id: string; top: number; bottom: number } => r !== null), window.innerHeight));
    };
    // Se vuelve a medir cada vez que una sección entra, sale o termina de verse entera.
    const obs = new IntersectionObserver(medir, { threshold: [0, 1] });
    for (const id of orden) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    medir();
    return () => obs.disconnect();
  }, [clave]);

  const ir = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <View style={[PEGADA, estilos.barra, { backgroundColor: theme.background, borderBottomColor: theme.filete }]} role="navigation" aria-label="Secciones de la ficha">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fila}>
        {anclas.map((a) => {
          const marcada = a.id === activa;
          return (
            <Pulsable
              key={a.id}
              onPress={() => ir(a.id)}
              accessibilityRole="link"
              accessibilityLabel={a.etiqueta}
              aria-current={marcada ? 'location' : undefined}
              style={[estilos.ancla, { borderColor: marcada ? theme.text : 'transparent', backgroundColor: marcada ? theme.backgroundSelected : 'transparent' }]}
            >
              <ThemedText style={[Texto.pequenoFuerte, marcada ? undefined : { color: theme.textSecondary }]}>{a.etiqueta}</ThemedText>
            </Pulsable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { borderBottomWidth: Filete.fino, paddingVertical: Spacing.two },
  fila: { gap: Spacing.two, alignItems: 'center' },
  ancla: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Radios.full, borderWidth: Filete.fino, alignItems: 'center', justifyContent: 'center' },
});
