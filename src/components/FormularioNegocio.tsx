import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Campo } from '@/components/Campo';
import { EditorHorario } from '@/components/EditorHorario';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { ErrorParcial, useBorrarNegocio, useGuardarNegocio } from '@/hooks/queries/useMisNegocios';
import { useMiSuscripcion } from '@/hooks/queries/usePlanes';
import { useCategoriasServicio } from '@/hooks/queries/useServicios';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { geocodificarDireccion } from '@/lib/geocoding';
import { parsearHorarioTexto, resumenAcotado, validarTurnos, type Turno } from '@/lib/horario';
import { MAX_FOTOS_NEGOCIO, validarNegocio, type ErroresNegocio } from '@/lib/negocio';
import { avisarPermisoDeFotosDenegado } from '@/lib/permisos';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';
import type { NegocioItem, NegocioPropio } from '@/types/database.types';

const RANGOS: { valor: number | null; etiqueta: string }[] = [
  { valor: 1, etiqueta: '$' },
  { valor: 2, etiqueta: '$$' },
  { valor: 3, etiqueta: '$$$' },
  { valor: null, etiqueta: 'Sin dato' },
];

/** `ruta` presente = ya está en Storage; ausente = es una foto nueva y `uri` es local. */
type FotoEnForm = { clave: string; ruta: string | null; uri: string };

/**
 * Crear o editar tu negocio de Servicios · Cuervo 360 (migración 0052).
 *
 * Con `inicial` edita; sin él, crea. Los datos, las fotos y el menú se guardan juntos, en el orden que no deja basura a
 * medias (ver `useGuardarNegocio`). La dirección se geocodifica al guardar solo si cambió; si no se puede ubicar, el
 * negocio se guarda igual y no tendrá «Cómo llegar». `destacado` NO se elige aquí: lo decidirá el plan.
 */
export function FormularioNegocio({ inicial }: { inicial?: { negocio: NegocioPropio; items: NegocioItem[]; turnos?: Turno[] } }) {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { categorias } = useCategoriasServicio();
  const guardar = useGuardarNegocio(miId);
  const borrar = useBorrarNegocio(miId);
  // El límite REAL del plan; mientras no se sepa, rige la cota técnica y la base hace cumplir el plan (CP012).
  const { suscripcion } = useMiSuscripcion(miId, 'comerciante');
  const maxFotos = Math.min(suscripcion?.max_fotos ?? MAX_FOTOS_NEGOCIO, MAX_FOTOS_NEGOCIO);
  const n = inicial?.negocio;

  const [categoriaId, setCategoriaId] = useState<string | null>(n?.categoria_id ?? null);
  const [nombre, setNombre] = useState(n?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(n?.descripcion ?? '');
  const [direccion, setDireccion] = useState(n?.direccion ?? '');
  const [rangoPrecio, setRangoPrecio] = useState<number | null>(n?.rango_precio ?? null);
  // Turnos: los guardados; si el negocio solo tiene el texto de siempre y es regular, se propone su equivalente (se guarda al confirmar).
  const turnosIniciales = inicial?.turnos ?? [];
  const propuestos = turnosIniciales.length === 0 ? parsearHorarioTexto(n?.horario) ?? [] : [];
  const [turnos, setTurnos] = useState<Turno[]>(turnosIniciales.length > 0 ? turnosIniciales : propuestos);
  const [turnosTocados, setTurnosTocados] = useState(propuestos.length > 0);
  const [errorHorario, setErrorHorario] = useState<string | undefined>(undefined);
  // Sin turnos tocados, el texto original no se modifica; con turnos, el texto es su resumen.
  const horario = turnosTocados ? resumenAcotado(turnos, 120) : (n?.horario ?? '');
  const [activo, setActivo] = useState(n?.activo ?? true);
  const [fotos, setFotos] = useState<FotoEnForm[]>(
    (n?.fotos ?? []).map((ruta) => ({ clave: ruta, ruta, uri: '' }))
  );
  const [errores, setErrores] = useState<ErroresNegocio>({});
  const [guardando, setGuardando] = useState(false);

  const rutasIniciales = n?.fotos ?? [];
  const { urls } = useFotosFirmadas(rutasIniciales);

  const agregarFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      avisarPermisoDeFotosDenegado(permiso.canAskAgain);
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const uri = r.canceled ? null : (r.assets[0]?.uri ?? null);
    if (uri) setFotos((f) => [...f, { clave: `nueva-${Date.now()}-${f.length}`, ruta: null, uri }]);
  };

  const onGuardar = async () => {
    const e = validarNegocio({
      categoriaId, nombre, descripcion, direccion, rangoPrecio, horario, fotos: fotos.map((f) => f.clave),
    }, maxFotos);
    setErrores(e);
    const problemaHorario = turnosTocados ? validarTurnos(turnos) : null;
    setErrorHorario(problemaHorario ?? undefined);
    if (Object.keys(e).length > 0 || problemaHorario || !categoriaId) return;

    setGuardando(true);
    try {
      // Geocodifica solo si la dirección es nueva o cambió: no se gasta una consulta en cada guardado.
      let latitud = n?.latitud ?? null;
      let longitud = n?.longitud ?? null;
      if (!n || n.direccion.trim() !== direccion.trim()) {
        const c = await geocodificarDireccion(direccion.trim());
        latitud = c?.lat ?? null;
        longitud = c?.lng ?? null;
        if (!c) toast.info('No pudimos ubicar la dirección en el mapa. Tu negocio se guarda sin «Cómo llegar».');
      }

      const conservadas = fotos.filter((f) => f.ruta).map((f) => f.ruta as string);
      guardar.mutate(
        {
          id: n?.id,
          datos: {
            categoria_id: categoriaId,
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            direccion: direccion.trim(),
            latitud,
            longitud,
            rango_precio: rangoPrecio,
            horario: horario.trim() || null,
            activo,
          },
          fotosConservadas: conservadas,
          fotosQuitadas: rutasIniciales.filter((r) => !conservadas.includes(r)),
          fotosNuevas: fotos.filter((f) => !f.ruta).map((f) => f.uri),
          turnos: turnosTocados ? turnos : undefined,
        },
        {
          onSuccess: () => {
            toast.exito(n ? 'Cambios guardados' : 'Tu negocio quedó publicado');
            router.back();
          },
          onError: (err) => {
            if (err instanceof ErrorParcial) {
              toast.error('Guardamos tu negocio, pero faltó terminar de subir algo. Ábrelo para completarlo.');
              router.replace({ pathname: '/negocio/editar/[id]', params: { id: err.idCreado } });
              return;
            }
            toast.error(
              esCodigo(err, CP.LIMITE_NEGOCIOS)
                ? 'Ya tienes un negocio visible. Pausa el otro para activar este.'
                : esCodigo(err, CP.LIMITE_FOTOS_PLAN)
                  ? 'Tu plan permite menos fotos de galería. Quita algunas para guardar.'
                  : 'No pudimos guardar tu negocio. Revisa tu conexión e intenta de nuevo.'
            );
          },
        }
      );
    } finally {
      setGuardando(false);
    }
  };

  const onBorrar = () => {
    if (!n) return;
    Alert.alert(
      'Borrar mi negocio',
      'Se borran el negocio, su menú y sus fotos. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () =>
            borrar.mutate(
              { id: n.id, fotos: rutasIniciales },
              {
                onSuccess: () => {
                  toast.exito('Negocio borrado');
                  router.back();
                },
                onError: () => toast.error('No pudimos borrar tu negocio. Revisa tu conexión e intenta de nuevo.'),
              }
            ),
        },
      ]
    );
  };

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
          <ThemedText type="subtitle">{n ? 'Editar mi negocio' : 'Publicar mi negocio'}</ThemedText>

          <Campo etiqueta="Nombre del negocio" value={nombre} onChangeText={setNombre} error={errores.nombre} maxLength={80} />

          <View style={estilos.bloque}>
            <ThemedText type="smallBold" themeColor="textSecondary">Categoría</ThemedText>
            <View style={estilos.chips}>
              {categorias.map((c) => {
                const activa = c.id === categoriaId;
                return (
                  <Pulsable
                    key={c.id}
                    onPress={() => setCategoriaId(c.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Categoría ${c.nombre}`}
                    accessibilityState={{ selected: activa }}
                    style={[estilos.chip, { backgroundColor: activa ? theme.lima : theme.backgroundElement, borderColor: activa ? theme.lima : theme.filete }]}
                  >
                    <ThemedText type="small" style={[Texto.pesoFuerte, activa && { color: theme.limaTexto }]}>{c.nombre}</ThemedText>
                  </Pulsable>
                );
              })}
            </View>
            {errores.categoriaId ? <ThemedText type="small" style={{ color: theme.error }}>{errores.categoriaId}</ThemedText> : null}
          </View>

          <Campo
            etiqueta="Descripción (opcional)"
            value={descripcion}
            onChangeText={setDescripcion}
            error={errores.descripcion}
            multiline
            maxLength={600}
            style={estilos.multilinea}
          />
          <Campo etiqueta="Dirección" value={direccion} onChangeText={setDireccion} error={errores.direccion} maxLength={200} />
          <EditorHorario
            turnos={turnos}
            onChange={(t) => {
              setTurnos(t);
              setTurnosTocados(true);
            }}
            error={errorHorario ?? errores.horario}
          />
          {!turnosTocados && n?.horario ? (
            <ThemedText type="small" themeColor="textSecondary">
              Horario actual: {n.horario}. Defínelo arriba para que tu negocio pueda aparecer en «Abierto ahora».
            </ThemedText>
          ) : null}

          <View style={estilos.bloque}>
            <ThemedText type="smallBold" themeColor="textSecondary">Rango de precio</ThemedText>
            <View style={estilos.chips}>
              {RANGOS.map((r) => {
                const activo = r.valor === rangoPrecio;
                return (
                  <Pulsable
                    key={r.etiqueta}
                    onPress={() => setRangoPrecio(r.valor)}
                    accessibilityRole="button"
                    accessibilityLabel={`Rango de precio ${r.etiqueta}`}
                    accessibilityState={{ selected: activo }}
                    style={[estilos.chip, { backgroundColor: activo ? theme.lima : theme.backgroundElement, borderColor: activo ? theme.lima : theme.filete }]}
                  >
                    <ThemedText type="small" style={[Texto.pesoFuerte, activo && { color: theme.limaTexto }]}>{r.etiqueta}</ThemedText>
                  </Pulsable>
                );
              })}
            </View>
          </View>

          <View style={estilos.bloque}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Fotos ({fotos.length}/{maxFotos}) · la primera es la portada
            </ThemedText>
            {fotos.map((f, i) => (
              <View key={f.clave} style={estilos.filaFoto}>
                {(f.ruta ? urls.get(f.ruta) : f.uri) ? (
                  <Image source={{ uri: (f.ruta ? urls.get(f.ruta) : f.uri) as string }} style={estilos.miniatura} contentFit="cover" />
                ) : (
                  <View style={[estilos.miniatura, { backgroundColor: theme.backgroundSelected }]} />
                )}
                <ThemedText style={estilos.crece}>Foto {i + 1}</ThemedText>
                <Pulsable
                  onPress={() => setFotos((xs) => xs.filter((x) => x.clave !== f.clave))}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar la foto ${i + 1}`}
                  style={estilos.quitar}
                >
                  <Ionicons name="close-circle-outline" size={24} color={theme.textSecondary} />
                </Pulsable>
              </View>
            ))}
            {fotos.length < maxFotos ? (
              <Pulsable
                onPress={() => void agregarFoto()}
                accessibilityRole="button"
                accessibilityLabel="Agregar una foto del negocio"
                style={[estilos.agregar, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
              >
                <Ionicons name="add" size={20} color={theme.bosque} />
                <ThemedText style={Texto.pesoFuerte}>Agregar foto</ThemedText>
              </Pulsable>
            ) : null}
            {fotos.length >= maxFotos && suscripcion ? (
              <Pulsable
                onPress={() => router.push({ pathname: '/planes/[rol]', params: { rol: 'comerciante' } })}
                accessibilityRole="link"
                accessibilityLabel="Ver planes para agregar más fotos"
                style={estilos.enlacePlan}
              >
                <ThemedText type="small" themeColor="acento">
                  Llegaste al límite de tu plan ({maxFotos}). Ver planes
                </ThemedText>
              </Pulsable>
            ) : null}
            {errores.fotos ? <ThemedText type="small" style={{ color: theme.error }}>{errores.fotos}</ThemedText> : null}
          </View>

          {/* El menú tiene su propia pantalla (secciones, búsqueda y un editor por producto): con decenas o cientos de
              productos, un formulario único no se puede manejar. Solo se puede abrir cuando el negocio YA existe. */}
          {n ? (
            <Pulsable
              onPress={() => router.push({ pathname: '/negocio/menu/[id]', params: { id: n.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Editar el menú, ${inicial?.items.length ?? 0} productos`}
              style={[estilos.fila, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
            >
              <View style={estilos.crece}>
                <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>Menú y precios</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {inicial?.items.length ? `${inicial.items.length} productos` : 'Todavía no tiene productos'}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pulsable>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Cuando publiques tu negocio podrás agregar su menú, con secciones, precios y fotos.
            </ThemedText>
          )}

          <View style={[estilos.fila, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <View style={estilos.crece}>
              <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>Visible para todos</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Si lo pausas, deja de salir en Servicios.</ThemedText>
            </View>
            <Switch
              value={activo}
              onValueChange={setActivo}
              accessibilityLabel="Visible para todos"
              trackColor={{ true: theme.text, false: theme.border }}
              thumbColor={theme.background}
            />
          </View>

          <Sello onPress={() => void onGuardar()} cargando={guardando || guardar.isPending} accessibilityLabel={n ? 'Guardar cambios' : 'Publicar negocio'}>
            {n ? 'Guardar cambios' : 'Publicar negocio'}
          </Sello>

          {n ? (
            <Pulsable
              onPress={onBorrar}
              accessibilityRole="button"
              accessibilityLabel="Borrar mi negocio"
              style={estilos.borrar}
            >
              <ThemedText type="small" style={{ color: theme.error }}>Borrar mi negocio</ThemedText>
            </Pulsable>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.three },
  bloque: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderWidth: Filete.fino,
    borderRadius: Radios.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multilinea: { minHeight: 110, textAlignVertical: 'top', paddingTop: Spacing.three },
  filaFoto: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  miniatura: { width: 56, height: 56, borderRadius: Radios.control },
  crece: { flex: 1 },
  quitar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  agregar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 48,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: Filete.fino,
    borderRadius: Radios.tarjeta,
  },
  borrar: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  enlacePlan: { minHeight: 44, justifyContent: 'center' },
});
