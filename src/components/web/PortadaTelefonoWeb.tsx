import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ALTO_BARRA_INFERIOR, BarraInferiorWeb } from '@/components/web/BarraInferiorWeb';
import { CarruselWeb } from '@/components/web/CarruselWeb';
import { ComoFuncionaWeb } from '@/components/web/ComoFuncionaWeb';
import { ConfianzaWeb } from '@/components/web/ConfianzaWeb';
import { EncabezadoWeb } from '@/components/web/EncabezadoWeb';
import { PestanasWeb } from '@/components/web/PestanasWeb';
import { PieWeb } from '@/components/web/PieWeb';
import { PildoraBusquedaWeb } from '@/components/web/PildoraBusquedaWeb';
import { RoomiesWeb } from '@/components/web/RoomiesWeb';
import { TarjetaNegocioWeb } from '@/components/web/TarjetaNegocioWeb';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { Spacing, Texto } from '@/constants/theme';
import { RutasWeb } from '@/lib/rutasWeb';
import type { NegocioExplorar, PublicacionExplorar } from '@/services/explorar.service';

interface Lectura<T> {
  datos: T[];
  cargando: boolean;
  fallo: boolean;
  reintentar: () => void;
}

/**
 * El inicio en el TELÉFONO (menos de 700 px): diseño de app, no el hero de escritorio apilado. Una cabecera delgada, una píldora de búsqueda que lleva a `/departamentos`, atajos a las tres secciones,
 * carruseles con tarjetas compactas (se ven dos y un pedazo), y abajo roomies, cómo funciona y confianza. La navegación va en la barra inferior fija.
 */
export function PortadaTelefonoWeb({
  relleno,
  anchoCarrusel,
  lugares,
  negocios,
  fotoEjemplo,
  tituloEjemplo,
}: {
  relleno: number;
  anchoCarrusel: number;
  lugares: Lectura<PublicacionExplorar>;
  negocios: Lectura<NegocioExplorar>;
  fotoEjemplo?: string;
  tituloEjemplo?: string;
}) {
  return (
    <ThemedView style={estilos.raiz}>
      <ScrollView contentContainerStyle={{ paddingBottom: ALTO_BARRA_INFERIOR }}>
        <View style={[estilos.cuerpo, { paddingTop: Spacing.three }]}>
          <View style={{ paddingHorizontal: relleno }}>
            <EncabezadoWeb activa={null} escritorio={false} telefono />
          </View>

          <View style={{ paddingHorizontal: relleno }}>
            <PildoraBusquedaWeb titulo="¿Dónde quieres vivir?" subtitulo="Zona · presupuesto · tipo" onPress={() => router.push(RutasWeb.departamentos)} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: relleno }}>
            <PestanasWeb activa={null} tono="claro" forma="pildora" />
          </ScrollView>

          <CarruselWeb titulo="Departamentos y cuartos" etiquetaVerTodo="Ver todos los lugares" onVerTodo={() => router.push(RutasWeb.departamentos)} relleno={relleno}>
            {lugares.fallo ? (
              <View style={[estilos.estado, { width: anchoCarrusel * 2 }]}>
                <ErrorDeCarga etiqueta="No pudimos cargar los lugares" onReintentar={lugares.reintentar} />
              </View>
            ) : lugares.cargando ? (
              <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
            ) : lugares.datos.length === 0 ? (
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay lugares publicados.</ThemedText>
            ) : (
              lugares.datos.map((p) => <TarjetaPublicacionWeb key={p.id} p={p} ancho={anchoCarrusel} compacta />)
            )}
          </CarruselWeb>

          <CarruselWeb titulo="Negocios cerca" etiquetaVerTodo="Ver todos los negocios" onVerTodo={() => router.push(RutasWeb.servicios)} relleno={relleno}>
            {negocios.fallo ? (
              <View style={[estilos.estado, { width: anchoCarrusel * 2 }]}>
                <ErrorDeCarga etiqueta="No pudimos cargar los negocios" onReintentar={negocios.reintentar} />
              </View>
            ) : negocios.cargando ? (
              <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
            ) : negocios.datos.length === 0 ? (
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay negocios publicados.</ThemedText>
            ) : (
              negocios.datos.map((n) => <TarjetaNegocioWeb key={n.id} n={n} ancho={anchoCarrusel} />)
            )}
          </CarruselWeb>

          <View style={{ paddingHorizontal: relleno }}>
            <RoomiesWeb escritorio={false} textoBoton="Ver roomies" alBoton={() => router.push(RutasWeb.roomies)} />
          </View>
          <View style={{ paddingHorizontal: relleno }}>
            <ComoFuncionaWeb escritorio={false} foto={fotoEjemplo} titulo={tituloEjemplo} />
          </View>
          <View style={{ paddingHorizontal: relleno }}>
            <ConfianzaWeb escritorio={false} />
          </View>
        </View>
        <PieWeb />
      </ScrollView>
      <BarraInferiorWeb activa="inicio" />
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  cuerpo: { gap: Spacing.four + Spacing.one, paddingBottom: Spacing.five },
  estado: { justifyContent: 'center' },
});
