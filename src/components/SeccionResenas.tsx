import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Campo } from '@/components/Campo';
import { Estrellas } from '@/components/ficha/Estrellas';
import { Pulsable } from '@/components/ficha/Pulsable';
import { SelectorEstrellas } from '@/components/ficha/SelectorEstrellas';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import {
  useBorrarResena, useGuardarResena, useMiResena, useReportarResena, useResenas, useResponderResena,
} from '@/hooks/queries/useResenas';
import { useTheme } from '@/hooks/use-theme';
import { SQL, esCodigo } from '@/lib/erroresPostgres';
import {
  MAX_RESPUESTA, MAX_TEXTO_RESENA, estrellasDe, validarRespuesta, validarResena, type Objetivo, type ResenaPublica,
} from '@/lib/resenas';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

/** Las estrellas de UNA reseña (solo muestra). */
function FilaEstrellas({ n }: { n: number }) {
  const theme = useTheme();
  const { llenas, vacias } = estrellasDe(n);
  return (
    <View style={estilos.estrellas} accessible accessibilityLabel={n === 1 ? '1 estrella' : `${n} estrellas`}>
      {Array.from({ length: llenas }, (_, i) => <Ionicons key={`l${i}`} name="star" size={14} color={theme.text} />)}
      {Array.from({ length: vacias }, (_, i) => <Ionicons key={`v${i}`} name="star-outline" size={14} color={theme.text} />)}
    </View>
  );
}

/**
 * Reseñas de un negocio o una vivienda · Cuervo 360 (migración 0054).
 *
 * Lo que ve cualquiera: el promedio (calculado por la base), la lista y la respuesta del dueño. Quien NO es dueña puede dejar,
 * editar o borrar UNA reseña suya, y reportar las ajenas. El dueño puede responder, no borrar ni ocultar. Tres estados en cada
 * lectura (END-11): cargando, falló y «todavía no hay reseñas» se pintan distinto.
 */
export function SeccionResenas({
  objetivo,
  esDueno,
  calificacion,
  numResenas,
}: {
  objetivo: Objetivo;
  esDueno: boolean;
  calificacion: number | null | undefined;
  numResenas: number;
}) {
  const theme = useTheme();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { resenas, cargando, fallo, reintentar } = useResenas(objetivo);
  const { miResena } = useMiResena(miId, objetivo);
  const guardar = useGuardarResena(miId, objetivo);
  const borrar = useBorrarResena(miId, objetivo);
  const responder = useResponderResena(miId, objetivo);
  const reportar = useReportarResena(miId, objetivo);

  const [editando, setEditando] = useState(false);
  const [estrellas, setEstrellas] = useState(0);
  const [texto, setTexto] = useState('');
  const [errores, setErrores] = useState<{ estrellas?: string; texto?: string }>({});
  const [respondiendo, setRespondiendo] = useState<{ id: string; texto: string } | null>(null);
  const [errorRespuesta, setErrorRespuesta] = useState<string | null>(null);

  const abrirFormulario = () => {
    setEstrellas(miResena?.estrellas ?? 0);
    setTexto(miResena?.texto ?? '');
    setErrores({});
    setEditando(true);
  };

  const onGuardar = () => {
    const e = validarResena(estrellas, texto);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    guardar.mutate(
      { id: miResena?.id, estrellas, texto },
      {
        onSuccess: () => {
          toast.exito(miResena ? 'Reseña actualizada' : 'Gracias por tu reseña');
          setEditando(false);
        },
        onError: (err) =>
          toast.error(
            esCodigo(err, SQL.UNIQUE_VIOLATION)
              ? 'Ya dejaste una reseña aquí. Puedes editarla.'
              : esCodigo(err, SQL.INSUFFICIENT_PRIVILEGE)
                ? 'No puedes reseñar esto.'
                : 'No pudimos guardar tu reseña. Revisa tu conexión e intenta de nuevo.'
          ),
      }
    );
  };

  const onBorrar = () => {
    if (!miResena) return;
    Alert.alert('Borrar mi reseña', 'Se quita tu reseña y cambia el promedio. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          borrar.mutate(miResena.id, {
            onSuccess: () => toast.exito('Reseña borrada'),
            onError: () => toast.error('No pudimos borrar tu reseña. Revisa tu conexión e intenta de nuevo.'),
          }),
      },
    ]);
  };

  const onReportar = (r: ResenaPublica) => {
    Alert.alert('Reportar reseña', 'Si tres personas la reportan, deja de mostrarse. ¿Reportarla por contenido inapropiado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reportar',
        style: 'destructive',
        onPress: () =>
          reportar.mutate(
            { id: r.id, motivo: 'Contenido inapropiado' },
            {
              onSuccess: () => toast.exito('Gracias. Revisaremos esta reseña.'),
              onError: () => toast.error('No pudimos enviar tu reporte. Revisa tu conexión e intenta de nuevo.'),
            }
          ),
      },
    ]);
  };

  const onResponder = () => {
    if (!respondiendo) return;
    const problema = validarRespuesta(respondiendo.texto);
    setErrorRespuesta(problema);
    if (problema) return;
    responder.mutate(
      { id: respondiendo.id, texto: respondiendo.texto },
      {
        onSuccess: () => {
          toast.exito(respondiendo.texto.trim() ? 'Respuesta publicada' : 'Respuesta quitada');
          setRespondiendo(null);
        },
        onError: (err) =>
          toast.error(
            esCodigo(err, SQL.INSUFFICIENT_PRIVILEGE)
              ? 'No puedes responder esta reseña.'
              : 'No pudimos enviar tu respuesta. Revisa tu conexión e intenta de nuevo.'
          ),
      }
    );
  };

  const ajenas = resenas.filter((r) => !r.es_mia);

  return (
    <View style={estilos.seccion}>
      <ThemedText type="subtitle">Reseñas</ThemedText>
      <Estrellas calificacion={calificacion} numResenas={numResenas} />

      {/* Mi reseña: solo quien NO es dueña y tiene sesión. */}
      {!esDueno && miId ? (
        editando ? (
          <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">Tu reseña</ThemedText>
            <SelectorEstrellas valor={estrellas} onCambiar={setEstrellas} />
            {errores.estrellas ? <ThemedText type="small" style={{ color: theme.error }}>{errores.estrellas}</ThemedText> : null}
            <Campo
              etiqueta="Cuéntanos tu experiencia (opcional)"
              value={texto}
              onChangeText={setTexto}
              error={errores.texto}
              multiline
              maxLength={MAX_TEXTO_RESENA}
              style={estilos.multilinea}
            />
            <Sello onPress={onGuardar} cargando={guardar.isPending} accessibilityLabel="Guardar reseña">Guardar reseña</Sello>
            <Pulsable onPress={() => setEditando(false)} accessibilityRole="button" accessibilityLabel="Cancelar" style={estilos.accion}>
              <ThemedText type="small" themeColor="acento">Cancelar</ThemedText>
            </Pulsable>
          </View>
        ) : miResena ? (
          <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">Tu reseña</ThemedText>
            <FilaEstrellas n={miResena.estrellas} />
            {miResena.texto ? <ThemedText>{miResena.texto}</ThemedText> : null}
            <View style={estilos.acciones}>
              <Pulsable onPress={abrirFormulario} accessibilityRole="button" accessibilityLabel="Editar mi reseña" style={estilos.accion}>
                <ThemedText type="small" themeColor="acento">Editar</ThemedText>
              </Pulsable>
              <Pulsable onPress={onBorrar} accessibilityRole="button" accessibilityLabel="Borrar mi reseña" style={estilos.accion}>
                <ThemedText type="small" style={{ color: theme.error }}>Borrar</ThemedText>
              </Pulsable>
            </View>
          </View>
        ) : (
          <Sello variante="contorno" icono="star-outline" onPress={abrirFormulario} accessibilityLabel="Escribir mi reseña">
            Escribir mi reseña
          </Sello>
        )
      ) : null}

      {cargando ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLabel="Cargando">Cargando reseñas…</ThemedText>
      ) : fallo ? (
        <View style={estilos.seccion}>
          <ThemedText type="small" themeColor="textSecondary">No pudimos cargar las reseñas. Revisa tu conexión e intenta de nuevo.</ThemedText>
          <Sello variante="contorno" icono="refresh" onPress={reintentar} accessibilityLabel="Reintentar">Reintentar</Sello>
        </View>
      ) : ajenas.length === 0 && !miResena ? (
        <ThemedText type="small" themeColor="textSecondary">Todavía no hay reseñas.</ThemedText>
      ) : (
        ajenas.map((r) => (
          <View key={r.id} style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <View style={estilos.cabecera}>
              <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>@{r.autor}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{fecha(r.creado_en)}</ThemedText>
            </View>
            <FilaEstrellas n={r.estrellas} />
            {r.texto ? <ThemedText>{r.texto}</ThemedText> : null}

            {r.respuesta ? (
              <View style={[estilos.respuesta, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold">Respuesta del {objetivo.negocioId ? 'negocio' : 'anunciante'}</ThemedText>
                <ThemedText type="small">{r.respuesta}</ThemedText>
              </View>
            ) : null}

            {esDueno ? (
              respondiendo?.id === r.id ? (
                <View style={estilos.seccion}>
                  <Campo
                    etiqueta="Tu respuesta"
                    value={respondiendo.texto}
                    onChangeText={(t) => setRespondiendo({ id: r.id, texto: t })}
                    error={errorRespuesta ?? undefined}
                    multiline
                    maxLength={MAX_RESPUESTA}
                    style={estilos.multilinea}
                  />
                  <Sello onPress={onResponder} cargando={responder.isPending} accessibilityLabel="Enviar respuesta">Enviar respuesta</Sello>
                  <Pulsable onPress={() => setRespondiendo(null)} accessibilityRole="button" accessibilityLabel="Cancelar respuesta" style={estilos.accion}>
                    <ThemedText type="small" themeColor="acento">Cancelar</ThemedText>
                  </Pulsable>
                </View>
              ) : (
                <Pulsable
                  onPress={() => { setErrorRespuesta(null); setRespondiendo({ id: r.id, texto: r.respuesta ?? '' }); }}
                  accessibilityRole="button"
                  accessibilityLabel={r.respuesta ? `Editar mi respuesta a @${r.autor}` : `Responder a @${r.autor}`}
                  style={estilos.accion}
                >
                  <ThemedText type="small" themeColor="acento">{r.respuesta ? 'Editar respuesta' : 'Responder'}</ThemedText>
                </Pulsable>
              )
            ) : miId ? (
              <Pulsable onPress={() => onReportar(r)} accessibilityRole="button" accessibilityLabel={`Reportar la reseña de @${r.autor}`} style={estilos.accion}>
                <ThemedText type="small" themeColor="textSecondary">Reportar</ThemedText>
              </Pulsable>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: Spacing.two },
  tarjeta: { padding: Spacing.three, gap: Spacing.two, borderWidth: Filete.fino, borderRadius: Radios.tarjeta },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  estrellas: { flexDirection: 'row', gap: 2 },
  respuesta: { padding: Spacing.three, gap: Spacing.one, borderRadius: Radios.control },
  acciones: { flexDirection: 'row', gap: Spacing.four },
  accion: { minHeight: 44, justifyContent: 'center' },
  multilinea: { minHeight: 90, textAlignVertical: 'top', paddingTop: Spacing.three },
});
