import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { Colors, Radios, Spacing } from '@/constants/theme';
import { useGuardado } from '@/hooks/use-guardado';
import { anim } from '@/lib/movimientoWeb';
import { useAuthStore } from '@/store/useAuthStore';

const L = Colors.light;

/**
 * El corazón de las tarjetas de la web, sobre la foto (el círculo es siempre claro: la foto no cambia con el modo). Sin sesión pide entrar; con sesión guarda o quita de verdad, de una vivienda o de un negocio.
 * Mientras no se sabe qué hay guardado no responde: tocar sin saber el estado guardaría lo que ya estaba o quitaría lo que nunca estuvo.
 */
export function CorazonWeb({ tipo, id, compacta = false }: { tipo: 'publicacion' | 'negocio'; id: string; compacta?: boolean }) {
  const hayCuenta = useAuthStore((s) => Boolean(s.session));
  if (!hayCuenta) return <Base guardado={false} cargando={false} compacta={compacta} etiqueta="Guardar: inicia sesión para guardar" onPress={() => router.push('/(auth)/login')} />;
  return <ConCuenta tipo={tipo} id={id} compacta={compacta} />;
}

// Aparte para que quien explora sin cuenta no monte consultas que no necesita.
function ConCuenta({ tipo, id, compacta }: { tipo: 'publicacion' | 'negocio'; id: string; compacta: boolean }) {
  const { guardado, cargando, alternar } = useGuardado(tipo, id);
  return <Base guardado={guardado} cargando={cargando} compacta={compacta} etiqueta={guardado ? 'Quitar de favoritos' : 'Guardar en favoritos'} onPress={alternar} />;
}

function Base({ guardado, cargando, compacta, etiqueta, onPress }: { guardado: boolean; cargando: boolean; compacta: boolean; etiqueta: string; onPress: () => void }) {
  // El corazón «salta» solo cuando la persona guarda (no al cargar una tarjeta que ya estaba guardada): cada guardado nuevo remonta el icono y repite el salto.
  const [saltos, setSaltos] = useState(0);
  return (
    <Pulsable
      onPress={() => {
        if (cargando) return;
        if (!guardado) setSaltos((n) => n + 1);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      // toque-ok: en la tarjeta compacta el círculo mide 36 y el hitSlop de 4 a cada lado lo lleva a 44
      hitSlop={compacta ? 4 : undefined}
      style={[estilos.corazon, compacta && estilos.compacto]}
    >
      <View key={saltos} testID="corazon-icono" {...(saltos > 0 && guardado ? anim('pop') : {})}>
        <Ionicons name={guardado ? 'heart' : 'heart-outline'} size={compacta ? 20 : 22} color={guardado ? L.bosque : L.text} />
      </View>
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  corazon: { position: 'absolute', right: Spacing.three, top: Spacing.three, width: 44, height: 44, borderRadius: Radios.full, backgroundColor: L.backgroundElement, alignItems: 'center', justifyContent: 'center' },
  compacto: { right: Spacing.two, top: Spacing.two, width: 36, height: 36 },
});
