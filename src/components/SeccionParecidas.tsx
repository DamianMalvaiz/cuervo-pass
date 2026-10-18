import { router } from 'expo-router';
import { View } from 'react-native';

import { FilaPublicacion } from '@/components/FilaPublicacion';
import { Seccion } from '@/components/ficha/Seccion';
import { ThemedText } from '@/components/themed-text';
import { useParecidas } from '@/hooks/queries/usePublicaciones';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useMiniaturas } from '@/hooks/use-miniaturas';
import { ANCHOS } from '@/lib/miniaturas';

/**
 * «Parecidos a este» · 0071. Lo visible más cercano por contenido (descripción, zona, características), de otras cuentas.
 * Si no hay nada lo bastante parecido, la sección NO aparece: no se rellena con lo que no se parece. Si la lectura falla
 * se dice, porque «no pudimos cargar» y «no hay parecidos» no son lo mismo.
 */
export function SeccionParecidas({ publicacionId }: { publicacionId: string }) {
  const { parecidas, cargando, fallo } = useParecidas(publicacionId);
  const { urls } = useFotosFirmadas(parecidas.map((p) => p.fotos?.[0]));
  const mini = useMiniaturas(parecidas.map((p) => p.fotos?.[0]), ANCHOS.ancha);

  if (cargando) return null;
  if (fallo) {
    return (
      <Seccion titulo="Parecidos a este">
        <ThemedText type="small" themeColor="textSecondary">No pudimos cargar los parecidos.</ThemedText>
      </Seccion>
    );
  }
  if (parecidas.length === 0) return null;

  return (
    <Seccion titulo="Parecidos a este">
      <View>
        {parecidas.map((p) => (
          <FilaPublicacion
            key={p.id}
            publicacionId={p.id}
            titulo={p.titulo}
            tipo={p.tipo}
            precio={p.precio_renta}
            fotoUrl={p.fotos?.[0] ? urls.get(p.fotos[0]) : null}
            fotoMini={mini(p.fotos?.[0])}
            onPress={() => router.push({ pathname: '/publicacion/[id]', params: { id: p.id } })}
          />
        ))}
      </View>
    </Seccion>
  );
}
