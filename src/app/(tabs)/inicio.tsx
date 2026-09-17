import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList } from 'react-native';

import { TarjetaPublicacion } from '@/components/TarjetaPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { calcularDistanciaKm } from '@/lib/distancia';
import { listarPublicacionesActivas } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';
import type { Publicacion } from '@/types/database.types';

interface PublicacionConDistancia extends Publicacion {
  distanciaKm?: number;
}

// TODO (Semana 5): motor de sugerencias Nivel 1 (filtros ponderados: presupuesto,
// mascotas/ruido, frescura) — hoy solo ordena por fecha y calcula distancia.
// TODO (Semana 9): combinar con Nivel 2 (similitud de coseno, pgvector).
export default function InicioScreen() {
  const session = useAuthStore((s) => s.session);
  const { perfil, cargarPerfil } = usePerfilStore();
  const [publicaciones, setPublicaciones] = useState<PublicacionConDistancia[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!session?.user.id) return;
    setCargando(true);
    try {
      await cargarPerfil(session.user.id);
      const activas = await listarPublicacionesActivas();
      setPublicaciones(activas.filter((p) => p.usuario_id !== session.user.id));
    } finally {
      setCargando(false);
    }
  }, [session?.user.id, cargarPerfil]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const conDistancia = publicaciones.map((p) => {
    if (
      perfil?.latitud_universidad == null ||
      perfil?.longitud_universidad == null ||
      p.latitud == null ||
      p.longitud == null
    ) {
      return p;
    }
    return {
      ...p,
      distanciaKm: calcularDistanciaKm(perfil.latitud_universidad, perfil.longitud_universidad, p.latitud, p.longitud),
    };
  });

  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Sugerencias para ti</ThemedText>
      {cargando ? (
        <ActivityIndicator style={{ marginTop: Spacing.four }} />
      ) : (
        <FlatList
          data={conDistancia}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TarjetaPublicacion
              precio={item.precio_renta}
              direccion={item.direccion}
              fotoUrl={item.fotos?.[0]}
              distanciaKm={item.distanciaKm}
              onPress={() => router.push(`/publicacion/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <ThemedText type="small" style={{ marginTop: Spacing.four }}>
              Aún no hay publicaciones de otros usuarios para sugerir.
            </ThemedText>
          }
        />
      )}
    </ThemedView>
  );
}
