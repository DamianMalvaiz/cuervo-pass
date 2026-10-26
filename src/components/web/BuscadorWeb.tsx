import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { etiquetaDeTipo, siguienteTipo, type FiltrosWeb } from '@/lib/filtrosWeb';

const L = Colors.light;

/**
 * El buscador de la portada: una píldora blanca (sobre el hero oscuro siempre es blanca, con texto carbón) con tres campos y el botón.
 * Es CONTROLADO: el estado vive en la pantalla, que es quien filtra la lista. Los tres campos son reales: zona (texto parcial), presupuesto máximo y tipo.
 * `compacto` apila los campos en una tarjeta para pantallas angostas.
 */
export function BuscadorWeb({
  filtros,
  onCambiar,
  onBuscar,
  compacto = false,
}: {
  filtros: FiltrosWeb;
  onCambiar: (f: FiltrosWeb) => void;
  onBuscar: () => void;
  compacto?: boolean;
}) {
  const [foco, setFoco] = useState<'zona' | 'presupuesto' | null>(null);
  const etiquetaTipo = etiquetaDeTipo(filtros.tipo);

  return (
    <View style={[estilos.caja, compacto ? estilos.cajaCompacta : estilos.cajaAmplia]}>
      <View style={[estilos.segmento, !compacto && estilos.segmentoFlex, foco === 'zona' && estilos.enFoco]}>
        <ThemedText style={[Texto.etiqueta, { color: L.text }]}>Dónde</ThemedText>
        <TextInput
          accessibilityLabel="Zona o colonia"
          value={filtros.zona}
          onChangeText={(zona) => onCambiar({ ...filtros, zona })}
          onFocus={() => setFoco('zona')}
          onBlur={() => setFoco(null)}
          onSubmitEditing={onBuscar}
          returnKeyType="search"
          placeholder="Colonia o municipio"
          placeholderTextColor={L.textSecondary}
          style={estilos.campo}
        />
      </View>

      <View style={[estilos.segmento, !compacto && estilos.segmentoFlex, !compacto && estilos.divisor, foco === 'presupuesto' && estilos.enFoco]}>
        <ThemedText style={[Texto.etiqueta, { color: L.text }]}>Presupuesto máximo</ThemedText>
        <TextInput
          accessibilityLabel="Presupuesto máximo al mes"
          value={filtros.presupuesto}
          onChangeText={(t) => onCambiar({ ...filtros, presupuesto: t.replace(/\D/g, '') })}
          onFocus={() => setFoco('presupuesto')}
          onBlur={() => setFoco(null)}
          onSubmitEditing={onBuscar}
          keyboardType="number-pad"
          returnKeyType="search"
          placeholder="Sin tope, al mes"
          placeholderTextColor={L.textSecondary}
          style={estilos.campo}
        />
      </View>

      <Pulsable
        onPress={() => onCambiar({ ...filtros, tipo: siguienteTipo(filtros.tipo) })}
        accessibilityRole="button"
        accessibilityLabel={`Tipo: ${etiquetaTipo}. Toca para cambiar`}
        style={[estilos.segmento, !compacto && estilos.segmentoFlex, !compacto && estilos.divisor]}
      >
        <ThemedText style={[Texto.etiqueta, { color: L.text }]}>Tipo</ThemedText>
        <ThemedText style={[Texto.cuerpo, { color: L.textSecondary }]}>{etiquetaTipo}</ThemedText>
      </Pulsable>

      <BotonWeb grande icono="search" onPress={onBuscar}>Buscar</BotonWeb>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { backgroundColor: L.backgroundElement, alignItems: 'stretch' },
  cajaAmplia: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 940,
    borderRadius: Radios.full,
    padding: Spacing.two,
    paddingLeft: Spacing.three,
    // Sombra con desplazamiento y desenfoque: la píldora flota sobre el borde del hero.
    boxShadow: '0px 30px 60px -20px rgba(10, 14, 11, 0.5), 0px 4px 12px rgba(10, 14, 11, 0.12)',
  },
  cajaCompacta: { flexDirection: 'column', gap: Spacing.one, borderRadius: Radios.tarjeta, padding: Spacing.two },
  segmento: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, borderRadius: Radios.full, gap: Spacing.half, minHeight: 56, justifyContent: 'center' },
  segmentoFlex: { flex: 1 },
  divisor: { borderLeftWidth: Filete.fino, borderLeftColor: L.filete, borderRadius: 0 },
  enFoco: { backgroundColor: L.backgroundSelected },
  campo: { ...Texto.cuerpo, color: L.text, padding: 0, outlineWidth: 0 },
});
