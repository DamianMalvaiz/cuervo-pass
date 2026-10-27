import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { LogoMarca } from '@/components/LogoMarca';
import { ThemedText } from '@/components/themed-text';
import { CuentaWeb } from '@/components/web/CuentaWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useGuardado } from '@/hooks/use-guardado';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/useAuthStore';
import { anim } from '@/lib/movimientoWeb';
import { RutasWeb } from '@/lib/rutasWeb';

/**
 * La barra de las fichas públicas: el logo (lleva al inicio) y las dos cuentas arriba; abajo, «Volver» y las dos acciones de la ficha.
 * «Volver» regresa si hay a dónde; si la persona llegó por un enlace directo, no hay historial y va a la lista de su sección (`volverA`: lugares por omisión, negocios en la ficha de un negocio).
 * «Guardar» pide entrar sin cuenta; con cuenta guarda o quita de verdad (`guardar` dice qué ficha es); «Compartir» copia el enlace de la ficha (solo en la web, donde hay portapapeles).
 */
export function BarraFichaWeb({ escritorio, volverA = RutasWeb.departamentos, guardar }: { escritorio: boolean; volverA?: string; guardar?: { tipo: 'publicacion' | 'negocio'; id: string } }) {
  const theme = useTheme();
  const [copiado, setCopiado] = useState(false);

  const volver = () => (router.canGoBack() ? router.back() : router.push(volverA as never));
  const compartir = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
    } catch {
      // Sin portapapeles (o sin permiso) no hay nada que avisar: el enlace está en la barra de direcciones.
    }
  };
  const puedeCompartir = Platform.OS === 'web' && typeof navigator !== 'undefined' && Boolean(navigator.clipboard);

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.fila}>
        <Pulsable onPress={() => router.push(RutasWeb.inicio)} accessibilityRole="link" accessibilityLabel="Ir al inicio" style={estilos.marca}>
          <LogoMarca tamano={40} />
          {escritorio ? <ThemedText style={Texto.subtitulo}>Cuervo 360</ThemedText> : null}
        </Pulsable>
        <View style={estilos.cuentas}>
          <CuentaWeb escritorio={escritorio} tono="claro" />
        </View>
      </View>
      <View style={estilos.fila}>
        <Pulsable onPress={volver} accessibilityRole="link" accessibilityLabel="Volver" style={estilos.volver}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
          <ThemedText style={Texto.pequenoFuerte}>{escritorio ? 'Volver a los resultados' : 'Volver'}</ThemedText>
        </Pulsable>
        <View style={estilos.acciones}>
          {puedeCompartir ? (
            <Pulsable onPress={compartir} accessibilityRole="button" accessibilityLabel="Compartir" style={[estilos.accion, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
              <Ionicons name={copiado ? 'checkmark' : 'share-outline'} size={18} color={theme.text} />
              <ThemedText style={Texto.pequenoFuerte}>{copiado ? 'Enlace copiado' : 'Compartir'}</ThemedText>
            </Pulsable>
          ) : null}
          <Guardar guardar={guardar} />
        </View>
      </View>
    </View>
  );
}

/** Sin cuenta (o sin saber qué ficha es) pide entrar; con cuenta se monta aparte para que quien explora no monte consultas que no necesita. */
function Guardar({ guardar }: { guardar?: { tipo: 'publicacion' | 'negocio'; id: string } }) {
  const hayCuenta = useAuthStore((s) => Boolean(s.session));
  if (!hayCuenta || !guardar) return <BotonGuardar guardado={false} cargando={false} etiqueta="Guardar: inicia sesión para guardar" onPress={() => router.push('/(auth)/login')} />;
  return <GuardarConCuenta guardar={guardar} />;
}

function GuardarConCuenta({ guardar }: { guardar: { tipo: 'publicacion' | 'negocio'; id: string } }) {
  const { guardado, cargando, alternar } = useGuardado(guardar.tipo, guardar.id);
  return <BotonGuardar guardado={guardado} cargando={cargando} etiqueta={guardado ? 'Quitar de favoritos' : 'Guardar en favoritos'} onPress={alternar} />;
}

function BotonGuardar({ guardado, cargando, etiqueta, onPress }: { guardado: boolean; cargando: boolean; etiqueta: string; onPress: () => void }) {
  const theme = useTheme();
  // Salta solo cuando la persona guarda, no al cargar una ficha que ya estaba guardada.
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
      style={[estilos.accion, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
    >
      <View key={saltos} testID="guardar-icono" {...(saltos > 0 && guardado ? anim('pop') : {})}>
        <Ionicons name={guardado ? 'heart' : 'heart-outline'} size={18} color={guardado ? theme.bosque : theme.text} />
      </View>
      <ThemedText style={Texto.pequenoFuerte}>{guardado ? 'Guardado' : 'Guardar'}</ThemedText>
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: Spacing.three },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, flexWrap: 'wrap' },
  marca: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  cuentas: { flexDirection: 'row', gap: Spacing.two },
  volver: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 44 },
  acciones: { flexDirection: 'row', gap: Spacing.two },
  accion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Radios.full, borderWidth: Filete.fino },
});
