import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { etiquetaCompatibilidad } from '@/components/TarjetaRoomie';
import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { EsqueletoTarjetasWeb } from '@/components/web/EsqueletoWeb';
import { PaginaWeb } from '@/components/web/PaginaWeb';
import { TarjetaRoomieWeb } from '@/components/web/TarjetaRoomieWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useGuardarMiRoomie, useMiRoomie, useRoomiesSugeridos } from '@/hooks/queries/useRoomies';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { HUECO_WEB, medidasWeb } from '@/lib/medidasWeb';
import { aviso } from '@/lib/registro';
import { RutasWeb } from '@/lib/rutasWeb';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';
import type { RoomieSugerido } from '@/types/database.types';

const MIN_DESCRIPCION = 10;
type Filtro = 'todas' | 'alta' | 'altaMedia';
const FILTROS: { valor: Filtro; texto: string; etiqueta: string; adjetivo: string }[] = [
  { valor: 'todas', texto: 'Todas', etiqueta: 'Todas las compatibilidades', adjetivo: '' },
  { valor: 'alta', texto: 'Alta', etiqueta: 'Compatibilidad alta', adjetivo: 'alta' },
  { valor: 'altaMedia', texto: 'Alta o media', etiqueta: 'Compatibilidad alta o media', adjetivo: 'alta o media' },
];

const cumple = (f: Filtro, c: number | null | undefined) => {
  const nivel = etiquetaCompatibilidad(c);
  return f === 'todas' || (f === 'alta' && nivel === 'Alta') || (f === 'altaMedia' && (nivel === 'Alta' || nivel === 'Media'));
};

/**
 * Roomies con cuenta: las personas que buscan con quién compartir, con su compatibilidad y las frases que la explican, y tu propia ficha de roomie. El filtro de compatibilidad filtra sobre las que YA llegaron (tus mejores
 * coincidencias) y lo dice con esas palabras: filtrar en el cliente una lista recortada y afirmar «no hay nadie» sería decir algo falso (invariante 5). Activar tu ficha exige describir qué buscas (con ella se ordena tu lista);
 * si guardar falla, el interruptor vuelve a su sitio y se dice. Un fallo al leer nunca se pinta como «no hay nadie».
 */
export function RoomiesConCuentaWeb() {
  const theme = useTheme();
  const { ancho } = useTamanoPantalla();
  const { escritorio, interior } = medidasWeb(ancho);
  const miId = useAuthStore((s) => s.session?.user.id);
  const lista = useRoomiesSugeridos(Boolean(miId));
  const { miRoomie } = useMiRoomie(miId);
  const guardar = useGuardarMiRoomie(miId);
  const { urls } = useFotosFirmadas(lista.roomies.map((r) => r.foto_url));
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [descripcion, setDescripcion] = useState('');
  const [activa, setActiva] = useState(false);

  // Se siembra desde la ficha guardada la PRIMERA vez que llega, no en cada render: si no, escribir se pisaría con el valor del servidor.
  const sembrado = useRef(false);
  useEffect(() => {
    if (sembrado.current || !miRoomie) return;
    sembrado.current = true;
    setDescripcion(miRoomie.descripcion_busqueda ?? '');
    setActiva(miRoomie.estado === 'activo');
  }, [miRoomie]);

  const alternar = async () => {
    const nuevo = !activa;
    if (nuevo && descripcion.trim().length < MIN_DESCRIPCION) {
      toast.info('Falta tu descripción. Escribe qué buscas antes de activar la búsqueda: es lo que usamos para ordenar tu lista por afinidad.');
      return;
    }
    setActiva(nuevo);
    try {
      await guardar.mutateAsync({ descripcionBusqueda: descripcion.trim() || 'Busco roomie.', estado: nuevo ? 'activo' : 'cerrado' });
      toast.exito(nuevo ? 'Búsqueda de roomie activada' : 'Búsqueda de roomie desactivada');
    } catch (e) {
      setActiva(!nuevo);
      toast.error('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
      aviso('No se pudo guardar el roomie', undefined, e);
    }
  };
  const guardarDescripcion = async () => {
    try {
      await guardar.mutateAsync({ descripcionBusqueda: descripcion.trim(), estado: 'activo' });
      toast.exito('Descripción guardada');
    } catch (e) {
      aviso('No se pudo guardar la descripción del roomie', undefined, e);
      toast.error('No se pudo guardar la descripción. Revisa tu conexión e intenta de nuevo.');
    }
  };
  const sinGuardar = activa && descripcion.trim().length >= MIN_DESCRIPCION && (miRoomie?.descripcion_busqueda ?? '') !== descripcion.trim();

  const visibles = lista.roomies.filter((r) => cumple(filtro, r.compatibilidad));
  const total = lista.roomies.length;
  const columnas = escritorio ? 3 : ancho >= 700 ? 2 : 1;
  const anchoCol = Math.floor((interior - HUECO_WEB * (columnas - 1)) / columnas);
  const adjetivo = FILTROS.find((f) => f.valor === filtro)?.adjetivo ?? '';

  let cuerpo;
  if (lista.fallo) cuerpo = <ErrorDeCarga etiqueta="No pudimos cargar los roomies" onReintentar={lista.reintentar} />;
  else if (lista.cargando) cuerpo = <EsqueletoTarjetasWeb cuantas={columnas * 2} ancho={anchoCol} />;
  else if (total === 0) cuerpo = <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay personas buscando roomie. Activa tu ficha para aparecer tú.</ThemedText>;
  else if (visibles.length === 0) cuerpo = <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{`Ninguna de tus ${total} mejores coincidencias tiene compatibilidad ${adjetivo}.`}</ThemedText>;
  else {
    cuerpo = (
      <View style={estilos.cuadricula}>
        {visibles.map((r: RoomieSugerido, i) => (
          <View key={r.id} style={{ width: anchoCol }}>
            <TarjetaRoomieWeb r={r} foto={r.foto_url ? urls.get(r.foto_url) : undefined} paso={i % columnas} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <PaginaWeb activa="roomies" titulo="Roomies">
      <View style={[estilos.cabecera, escritorio && estilos.cabeceraAncha]}>
        <View style={estilos.cabeceraTexto}>
          <ThemedText accessibilityRole="header" style={escritorio ? Texto.titularWebCompacto : Texto.seccionWebCompacto}>Roomies</ThemedText>
          <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Personas que buscan con quién compartir, cerca de tu universidad.</ThemedText>
        </View>
        <View style={[estilos.ficha, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
          <View style={estilos.fichaCabeza}>
            <View style={estilos.fichaTexto}>
              <ThemedText style={Texto.pesoFuerte}>Tu ficha de roomie</ThemedText>
              <ThemedText style={Texto.pequeno} themeColor="textSecondary">{activa ? 'Visible: los demás pueden saludarte.' : 'Oculta: actívala para aparecer en esta lista.'}</ThemedText>
            </View>
            <Pulsable
              onPress={() => void alternar()}
              accessibilityRole="switch"
              accessibilityLabel="Búsqueda de roomie"
              accessibilityState={{ checked: activa }}
              aria-checked={activa}
              style={[estilos.interruptor, { backgroundColor: activa ? theme.bosque : theme.backgroundSelected }]}
            >
              <View style={[estilos.perilla, activa ? estilos.perillaActiva : null]} />
            </Pulsable>
          </View>
          <TextInput
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            placeholder="Cuéntanos qué buscas en un roomie: horarios, mascotas, presupuesto…"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Qué buscas"
            maxLength={500}
            style={[estilos.entrada, Texto.cuerpo, { borderColor: theme.border, color: theme.text }]}
          />
          {sinGuardar ? <BotonWeb compacto onPress={() => void guardarDescripcion()} accessibilityLabel="Guardar descripción">Guardar descripción</BotonWeb> : null}
        </View>
      </View>

      <View style={estilos.filtros}>
        <View style={estilos.chips} accessibilityRole="radiogroup" accessibilityLabel="Compatibilidad">
          {FILTROS.map((f) => {
            const sel = filtro === f.valor;
            return (
              <Pulsable
                key={f.valor}
                onPress={() => setFiltro(f.valor)}
                accessibilityRole="radio"
                accessibilityLabel={f.etiqueta}
                accessibilityState={{ checked: sel }}
                aria-checked={sel}
                style={[estilos.chip, { borderColor: sel ? theme.sello : theme.filete, backgroundColor: sel ? theme.sello : theme.backgroundElement }]}
              >
                <ThemedText style={[Texto.pequenoFuerte, { color: sel ? theme.selloTexto : theme.text }]}>{f.texto}</ThemedText>
              </Pulsable>
            );
          })}
        </View>
        {!lista.cargando && !lista.fallo && total > 1 ? <ThemedText style={Texto.pequeno} themeColor="textSecondary">{`Mostrando ${visibles.length} de tus ${total} mejores coincidencias`}</ThemedText> : null}
        {!lista.cargando && !lista.fallo && total === 1 ? <ThemedText style={Texto.pequeno} themeColor="textSecondary">1 coincidencia</ThemedText> : null}
      </View>

      {cuerpo}
      <View style={estilos.ver}>
        <BotonWeb variante="contorno" onPress={() => router.push(RutasWeb.departamentos)} accessibilityLabel="Ver lugares">Ver lugares para compartir</BotonWeb>
      </View>
    </PaginaWeb>
  );
}

const estilos = StyleSheet.create({
  cabecera: { gap: Spacing.four },
  cabeceraAncha: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.five },
  cabeceraTexto: { gap: Spacing.two, flex: 1, minWidth: 0 },
  ficha: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radios.panel - Spacing.one, borderWidth: Filete.fino, width: 460, maxWidth: '100%' },
  fichaCabeza: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  fichaTexto: { flex: 1, minWidth: 0 },
  interruptor: { width: 56, height: 32, borderRadius: Radios.full, justifyContent: 'center', padding: Spacing.one },
  perilla: { width: 24, height: 24, borderRadius: Radios.full, backgroundColor: '#FFFFFF' },
  perillaActiva: { alignSelf: 'flex-end' },
  entrada: { minHeight: 88, borderWidth: Filete.fino, borderRadius: Radios.control, padding: Spacing.three, textAlignVertical: 'top' },
  filtros: { gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: 44, paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: Filete.fino, alignItems: 'center', justifyContent: 'center' },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_WEB },
  ver: { alignItems: 'flex-start' },
});
