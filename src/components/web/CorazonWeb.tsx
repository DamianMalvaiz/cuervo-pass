import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { Colors, Radios, Spacing } from '@/constants/theme';
import { useAlternarFavorito, useMisFavoritosIds } from '@/hooks/queries/useFavoritos';
import { useAlternarFavoritoNegocio, useMisNegociosFavoritosIds } from '@/hooks/queries/useFavoritosNegocios';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';

const L = Colors.light;

/**
 * El corazón de las tarjetas de la web, sobre la foto (el círculo es siempre claro: la foto no cambia con el modo). Sin sesión pide entrar; con sesión guarda o quita de verdad, de una vivienda o de un negocio.
 * Mientras no se sabe qué hay guardado no responde: tocar sin saber el estado guardaría lo que ya estaba o quitaría lo que nunca estuvo.
 */
export function CorazonWeb({ tipo, id, compacta = false }: { tipo: 'publicacion' | 'negocio'; id: string; compacta?: boolean }) {
  const sesion = useAuthStore((s) => s.session);
  if (!sesion) return <Base guardado={false} cargando={false} compacta={compacta} etiqueta="Guardar: inicia sesión para guardar" onPress={() => router.push('/(auth)/login')} />;
  const Con = tipo === 'publicacion' ? ConPublicacion : ConNegocio;
  return <Con usuarioId={sesion.user.id} id={id} compacta={compacta} />;
}

function avisarFallo(e: unknown) {
  toast.error(esCodigo(e, CP.FAVORITOS_LLENOS) ? 'Llegaste al tope de 200 favoritos. Quita alguno para guardar otro.' : 'No pudimos actualizar tus favoritos. Revisa tu conexión e intenta de nuevo.');
}

function ConPublicacion({ usuarioId, id, compacta }: { usuarioId: string; id: string; compacta: boolean }) {
  const { ids, cargando } = useMisFavoritosIds(usuarioId);
  const alternar = useAlternarFavorito(usuarioId);
  const guardado = ids.has(id);
  return <Base guardado={guardado} cargando={cargando} compacta={compacta} etiqueta={guardado ? 'Quitar de favoritos' : 'Guardar en favoritos'} onPress={() => alternar.mutate({ publicacionId: id, guardar: !guardado }, { onError: avisarFallo })} />;
}

function ConNegocio({ usuarioId, id, compacta }: { usuarioId: string; id: string; compacta: boolean }) {
  const { ids, cargando } = useMisNegociosFavoritosIds(usuarioId);
  const alternar = useAlternarFavoritoNegocio(usuarioId);
  const guardado = ids.has(id);
  return <Base guardado={guardado} cargando={cargando} compacta={compacta} etiqueta={guardado ? 'Quitar de favoritos' : 'Guardar en favoritos'} onPress={() => alternar.mutate({ negocioId: id, guardar: !guardado }, { onError: avisarFallo })} />;
}

function Base({ guardado, cargando, compacta, etiqueta, onPress }: { guardado: boolean; cargando: boolean; compacta: boolean; etiqueta: string; onPress: () => void }) {
  return (
    <Pulsable
      onPress={() => {
        if (!cargando) onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      // toque-ok: en la tarjeta compacta el círculo mide 36 y el hitSlop de 4 a cada lado lo lleva a 44
      hitSlop={compacta ? 4 : undefined}
      style={[estilos.corazon, compacta && estilos.compacto]}
    >
      <Ionicons name={guardado ? 'heart' : 'heart-outline'} size={compacta ? 20 : 22} color={guardado ? L.bosque : L.text} />
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  corazon: { position: 'absolute', right: Spacing.three, top: Spacing.three, width: 44, height: 44, borderRadius: Radios.full, backgroundColor: L.backgroundElement, alignItems: 'center', justifyContent: 'center' },
  compacto: { right: Spacing.two, top: Spacing.two, width: 36, height: 36 },
});
