import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';

import { Calificacion } from '@/components/ficha/Calificacion';
import { FileteHoja } from '@/components/ficha/CampoFicha';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// LayoutAnimation en Android sigue detrás de una bandera experimental.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * "¿Por qué 9.4?" — la caja negra se abre.
 *
 * Es la interacción que define el producto. Cualquier app puede ordenar una
 * lista; lo que Airbnb nunca tiene que hacer, y esto sí, es justificar el orden.
 * Tocar la calificación despliega exactamente la fórmula de la migración 0015:
 *
 *     calificación = 0.6 · filtros ponderados + 0.4 · afinidad semántica
 *
 * Los números no se inventan ni se redondean a conveniencia: son los mismos que
 * Postgres devolvió. Si el Nivel 2 no está disponible, el desglose lo DICE en
 * vez de esconder la mitad de la fórmula — que es la diferencia entre explicar
 * y aparentar que se explica.
 */
export function DesgloseCalificacion({
  score,
  base,
  similitud,
}: {
  /** El score final que se muestra, en [0,1]. */
  score: number | null;
  /** Filtros ponderados (Nivel 1), en [0,1]. */
  base: number | null;
  /** Afinidad semántica (Nivel 2), en [0,1]. Null si no hubo Nivel 2. */
  similitud: number | null;
}) {
  const theme = useTheme();
  const [abierto, setAbierto] = useState(false);

  const hayDesglose = base != null && Number.isFinite(base);
  const hayNivel2 = similitud != null && Number.isFinite(similitud);

  const alternar = () => {
    // Altura, no rebote: la regla de movimiento de este proyecto es una sola
    // transición plana y corta, sin resorte ni escalonado.
    LayoutAnimation.configureNext(LayoutAnimation.create(160, 'easeInEaseOut', 'opacity'));
    setAbierto((v) => !v);
  };

  const filas = hayNivel2
    ? [
        { etiqueta: 'Filtros ponderados', valor: base! * 10, peso: 0.6 },
        { etiqueta: 'Afinidad semántica', valor: similitud! * 10, peso: 0.4 },
      ]
    : [{ etiqueta: 'Filtros ponderados', valor: base != null ? base * 10 : 0, peso: 1 }];

  return (
    <View style={[estilos.bloque, { borderColor: theme.border }]}>
      <Pressable
        onPress={hayDesglose ? alternar : undefined}
        disabled={!hayDesglose}
        style={estilos.cabecera}
        accessibilityRole={hayDesglose ? 'button' : undefined}
        accessibilityLabel={abierto ? 'Ocultar cómo se calculó la afinidad' : 'Ver cómo se calculó la afinidad'}
        accessibilityState={{ expanded: abierto }}
      >
        <Calificacion score={score} tamano="ficha" />
        {hayDesglose && (
          <View style={estilos.pista}>
            <ThemedText type="small" themeColor="acento">
              {abierto ? 'Ocultar el cálculo' : '¿Por qué esta calificación?'}
            </ThemedText>
            <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={16} color={theme.acento} />
          </View>
        )}
      </Pressable>

      {abierto && hayDesglose && (
        <View style={estilos.desglose}>
          <FileteHoja />
          {filas.map((f) => (
            <View key={f.etiqueta} style={estilos.fila}>
              <ThemedText type="small" themeColor="textSecondary" style={estilos.filaEtiqueta}>
                {f.etiqueta}
              </ThemedText>
              <ThemedText type="cifra" style={estilos.filaValor}>
                {f.valor.toFixed(1)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={estilos.filaPeso}>
                × {f.peso.toFixed(1)}
              </ThemedText>
            </View>
          ))}

          <FileteHoja />
          <View style={estilos.fila}>
            <ThemedText type="etiqueta" style={estilos.filaEtiqueta}>
              CALIFICACIÓN
            </ThemedText>
            <ThemedText type="cifra" style={estilos.filaValor}>
              {score != null ? (score * 10).toFixed(1) : '—'}
            </ThemedText>
            <View style={estilos.filaPeso} />
          </View>

          {!hayNivel2 && (
            <ThemedText type="small" themeColor="textSecondary" style={estilos.nota}>
              Esta calificación viene solo de los filtros ponderados. La afinidad semántica
              necesita que hayas activado el análisis con IA en Mis preferencias y que el
              servicio esté disponible.
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { borderWidth: Filete.fino, borderRadius: Radios.hoja },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    minHeight: 44,
  },
  pista: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexShrink: 1 },
  desglose: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two },
  fila: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, paddingTop: Spacing.two },
  filaEtiqueta: { flex: 1 },
  filaValor: { minWidth: 56, textAlign: 'right' },
  filaPeso: { minWidth: 44, textAlign: 'right' },
  nota: { lineHeight: 20, paddingTop: Spacing.one },
});
