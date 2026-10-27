import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { ChipsCategoriasWeb } from '@/components/web/ChipsCategoriasWeb';
import { MosaicoNegociosWeb } from '@/components/web/MosaicoNegociosWeb';
import { TarjetaNegocioWeb } from '@/components/web/TarjetaNegocioWeb';
import { PaginaWeb } from '@/components/web/PaginaWeb';
import { Spacing, Texto } from '@/constants/theme';
import { useCategoriasPublicas, useNegociosPublicos } from '@/hooks/queries/useExplorar';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { HUECO_WEB, medidasWeb } from '@/lib/medidasWeb';

// `/servicios` · la página de los negocios. Se ve SIN cuenta, con datos reducidos: zona y no dirección exacta, sin teléfono. Las categorías filtran en el servidor.

const RESULTADOS = 20;

export default function Servicios() {
  const { ancho } = useTamanoPantalla();
  const { escritorio, telefono, anchoMosaico, anchoTarjeta } = medidasWeb(ancho);
  const [categoriaId, setCategoriaId] = useState<string | undefined>(undefined);

  const categorias = useCategoriasPublicas();
  const negocios = useNegociosPublicos(categoriaId ? { limite: RESULTADOS, categoriaId } : { limite: RESULTADOS });

  return (
    <PaginaWeb activa="servicios" titulo="Negocios y servicios">
      <View style={estilos.cabecera}>
        <ThemedText accessibilityRole="header" style={escritorio ? Texto.titularWebCompacto : Texto.seccionWebCompacto}>Negocios y servicios</ThemedText>
        {telefono ? null : <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Comida, lavanderías, papelerías y lo que necesitas cerca de tu universidad, con su horario.</ThemedText>}
      </View>

      {/* Si las categorías no cargan, los negocios siguen a la vista: la página no depende de ellas. */}
      {categorias.categorias.length > 0 ? <ChipsCategoriasWeb categorias={categorias.categorias} activa={categoriaId} onElegir={setCategoriaId} deslizar={telefono} /> : null}

      <View style={estilos.resultados}>
        {negocios.fallo ? (
          <ErrorDeCarga etiqueta="No pudimos cargar los negocios" onReintentar={negocios.reintentar} />
        ) : negocios.cargando ? (
          <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
        ) : negocios.negocios.length === 0 ? (
          categoriaId ? (
            <View style={estilos.vacio}>
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">No hay negocios en esta categoría.</ThemedText>
              <BotonWeb variante="contorno" onPress={() => setCategoriaId(undefined)} accessibilityLabel="Quitar filtro">Ver todos</BotonWeb>
            </View>
          ) : (
            <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay negocios publicados.</ThemedText>
          )
        ) : (
          telefono ? (
            <View style={estilos.cuadricula}>
              {negocios.negocios.map((n) => <TarjetaNegocioWeb key={n.id} n={n} ancho={anchoTarjeta} />)}
            </View>
          ) : (
            <MosaicoNegociosWeb negocios={negocios.negocios} escritorio={escritorio} ancho={anchoMosaico} />
          )
        )}
      </View>
    </PaginaWeb>
  );
}

const estilos = StyleSheet.create({
  cabecera: { gap: Spacing.two },
  resultados: { gap: Spacing.three },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_WEB },
  vacio: { gap: Spacing.three, alignItems: 'flex-start' },
});
