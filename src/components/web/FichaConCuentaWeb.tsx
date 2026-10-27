import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useAfinidad, usePublicacion } from '@/hooks/queries/usePublicaciones';
import { useNegocio } from '@/hooks/queries/useServicios';
import { useTheme } from '@/hooks/use-theme';
import { calcularDistanciaKm } from '@/lib/distancia';
import { etiquetaDeAjuste, razonesDeAjuste } from '@/lib/razonesDeAjuste';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

// Lo que la ficha de una vivienda enseña SOLO con cuenta. Cada pieza lee la publicación completa (la misma consulta, que react-query comparte) y se monta solo con sesión: quien explora sin cuenta no monta consultas.

/** La dirección exacta. Mientras carga enseña la zona que ya se sabe; un fallo se dice (no deja la dirección en blanco). */
export function DireccionConCuentaWeb({ id, zona }: { id: string; zona: string }) {
  const { publicacion, cargando, fallo, reintentar } = usePublicacion(id);
  if (fallo) return <ErrorDeCarga etiqueta="No pudimos cargar la dirección exacta" onReintentar={() => void reintentar()} />;
  if (cargando || !publicacion) return zona ? <ThemedText style={Texto.subtitulo}>{zona}</ThemedText> : null;
  return <ThemedText style={Texto.subtitulo}>{publicacion.direccion}</ThemedText>;
}

/** La descripción de la vivienda, si la hay. Un fallo no se repite aquí: ya lo dice la dirección. */
export function DescripcionConCuentaWeb({ id }: { id: string }) {
  const { publicacion } = usePublicacion(id);
  const texto = publicacion?.descripcion?.trim();
  if (!texto) return null;
  return (
    <View style={estilos.bloque}>
      <ThemedText accessibilityRole="header" style={Texto.titulo}>Descripción</ThemedText>
      <ThemedText style={Texto.cuerpo}>{texto}</ThemedText>
    </View>
  );
}

/**
 * «Por qué podría encajar contigo» con tus datos: qué tan compatible es (solo si es alto: por debajo de 0.5 se calla en vez de decir «poco compatible») y las razones que SE CUMPLEN con tu perfil y la publicación.
 * Una razón inventada es peor que ninguna: sin etiqueta ni razones, el bloque no se pinta.
 */
export function AjusteConCuentaWeb({ id, precio, permiteMascotas }: { id: string; precio: number; permiteMascotas: boolean }) {
  const theme = useTheme();
  const miId = useAuthStore((s) => s.session?.user.id);
  const perfil = usePerfilStore((s) => s.perfil);
  const cargarPerfil = usePerfilStore((s) => s.cargarPerfil);
  const { publicacion } = usePublicacion(id);
  const afinidad = useAfinidad(id);

  useEffect(() => {
    if (miId) cargarPerfil(miId);
  }, [miId, cargarPerfil]);

  const distanciaKm =
    publicacion?.latitud != null && publicacion?.longitud != null && perfil?.latitud_universidad != null && perfil?.longitud_universidad != null
      ? calcularDistanciaKm(perfil.latitud_universidad, perfil.longitud_universidad, publicacion.latitud, publicacion.longitud)
      : null;
  const etiqueta = etiquetaDeAjuste(afinidad?.scoreFinal);
  const razones = razonesDeAjuste({
    precio,
    presupuestoMax: perfil?.presupuesto_max,
    distanciaKm,
    distanciaMaxKm: perfil?.distancia_max_km,
    permiteMascotas,
    tengoMascotas: Boolean(perfil?.mascotas),
  });
  if (!etiqueta && razones.length === 0) return null;

  return (
    <View style={estilos.bloque}>
      <ThemedText accessibilityRole="header" style={Texto.titulo}>Por qué podría encajar contigo</ThemedText>
      <View style={[estilos.ajuste, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
        {etiqueta ? <ThemedText style={Texto.subtitulo}>{etiqueta}</ThemedText> : null}
        {razones.map((r) => (
          <View key={r} style={estilos.razon}>
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.bosque} />
            <ThemedText style={Texto.cuerpo}>{r}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** La dirección exacta de un negocio y «Cómo llegar» (abre el mapa en su punto). Mientras carga enseña la zona; un fallo se dice; sin coordenadas no se ofrece un mapa que no sabría a dónde ir. */
export function UbicacionNegocioConCuentaWeb({ id, zona }: { id: string; zona: string }) {
  const theme = useTheme();
  const { negocio, cargando, fallo, reintentar } = useNegocio(id);
  if (fallo) return <ErrorDeCarga etiqueta="No pudimos cargar la dirección exacta" onReintentar={reintentar} />;
  const conMapa = negocio?.latitud != null && negocio?.longitud != null;
  return (
    <View style={[estilos.ubicacion, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
      <ThemedText accessibilityRole="header" style={Texto.titulo}>Dónde está</ThemedText>
      {cargando || !negocio ? (zona ? <ThemedText style={Texto.cuerpo}>{zona}</ThemedText> : null) : <ThemedText style={Texto.cuerpo}>{negocio.direccion}</ThemedText>}
      {conMapa ? (
        <BotonWeb grande icono="map-outline" onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${negocio.latitud},${negocio.longitud}`)} accessibilityLabel="Cómo llegar">Cómo llegar</BotonWeb>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  ubicacion: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radios.panel - Spacing.one, borderWidth: Filete.fino },
  bloque: { borderTopWidth: Filete.fino, marginTop: Spacing.four, paddingTop: Spacing.four, gap: Spacing.three },
  ajuste: { padding: Spacing.four, gap: Spacing.three, borderRadius: Radios.tarjeta, borderWidth: Filete.fino },
  razon: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
