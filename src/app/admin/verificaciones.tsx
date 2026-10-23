import { Redirect } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Campo } from '@/components/Campo';
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useEsAdmin, useResolverVerificacion, useVerificacionesAdmin } from '@/hooks/queries/useAdmin';
import { useTheme } from '@/hooks/use-theme';
import { ErrorAdmin, MENSAJE_ERROR_ADMIN } from '@/lib/admin';
import { toast } from '@/lib/toast';
import { documentosDe, type DocumentoAdmin, type VerificacionPendiente } from '@/services/admin.service';

const mensajeDe = (e: unknown) => MENSAJE_ERROR_ADMIN[e instanceof ErrorAdmin ? e.tipo : 'desconocido'];

const LECTURA_ROSTRO: Record<string, string> = {
  coincide: 'la selfie parece la misma persona de la INE y una cara viva',
  no_coincide: 'la selfie no se parece lo bastante a la foto de la INE (una INE vieja o con reflejos también lo causa)',
  no_vivo: 'la selfie pudo ser una foto de otra pantalla o papel, o salió mal',
  repetir_selfie: 'no se pudo medir ninguna selfie; no es una señal contra la persona',
  sin_rostro_ine: 'no se detectó la cara en la foto de la INE',
  pendiente_de_foto: 'se reservó un intento, pero no hay resultado',
};

function TarjetaVerificacion({ v }: { v: VerificacionPendiente }) {
  const theme = useTheme();
  const resolver = useResolverVerificacion();
  const [documentos, setDocumentos] = useState<DocumentoAdmin[] | null>(null);
  const [cargandoDocs, setCargandoDocs] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | undefined>();

  const verDocumentos = () => {
    Alert.alert(
      'Ver documentos',
      `Vas a ver los documentos de identidad de ${v.nombre_legal}. Quedará registrado que los viste.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ver',
          onPress: async () => {
            setCargandoDocs(true);
            try {
              setDocumentos(await documentosDe(v.usuario_id, v.rol));
            } catch (e) {
              toast.error(mensajeDe(e));
            } finally {
              setCargandoDocs(false);
            }
          },
        },
      ],
    );
  };

  const decidir = (aprobar: boolean, texto: string | null) =>
    resolver.mutate(
      { usuarioId: v.usuario_id, rol: v.rol, aprobar, motivo: texto },
      {
        onSuccess: () => toast.exito(aprobar ? 'Verificación aprobada.' : 'Verificación rechazada.'),
        onError: (e) => toast.error(mensajeDe(e)),
      },
    );

  const aprobar = () =>
    Alert.alert('Aprobar verificación', `¿Aprobar a ${v.nombre_legal} como ${v.rol}? Empieza su prueba gratis de 15 días.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprobar', onPress: () => decidir(true, null) },
    ]);

  const confirmarRechazo = () => {
    if (motivo.trim().length < 3) {
      setErrorMotivo('Escribe un motivo (al menos 3 letras).');
      return;
    }
    setErrorMotivo(undefined);
    decidir(false, motivo.trim());
  };

  return (
    <View style={[estilos.tarjeta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
      <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{v.nombre_legal}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {`@${v.nombre_usuario} · ${v.rol} · aviso ${v.version_aviso}`}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{v.direccion}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {`${v.fotos_del_lugar} ${v.fotos_del_lugar === 1 ? 'foto' : 'fotos'} del lugar · enviada ${new Date(v.enviada_en).toLocaleDateString('es-MX')}`}
      </ThemedText>

      {v.rostro_estado ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`Comparación de rostro: ${LECTURA_ROSTRO[v.rostro_estado] ?? v.rostro_estado}. Es una ayuda, no una decisión.`}
        </ThemedText>
      ) : null}

      {documentos ? (
        <View style={estilos.documentos}>
          {documentos.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">No hay documentos disponibles (la INE pudo borrarse ya).</ThemedText>
          ) : (
            documentos.map((d) => (
              <View key={d.etiqueta} style={estilos.documento}>
                <ThemedText type="smallBold" themeColor="textSecondary">{d.etiqueta}</ThemedText>
                {d.url ? (
                  <Image source={{ uri: d.url }} style={estilos.imagen} contentFit="contain" accessibilityLabel={d.etiqueta} />
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">(no disponible)</ThemedText>
                )}
              </View>
            ))
          )}
          <ThemedText type="small" themeColor="textSecondary">Los enlaces caducan a los 10 minutos.</ThemedText>
        </View>
      ) : (
        <Sello
          onPress={verDocumentos}
          cargando={cargandoDocs}
          variante="contorno"
          icono="eye-outline"
          accessibilityLabel={`Ver documentos de ${v.nombre_legal}`}
        >
          Ver documentos
        </Sello>
      )}

      {rechazando ? (
        <View style={estilos.bloque}>
          <Campo
            etiqueta="Motivo del rechazo"
            value={motivo}
            onChangeText={setMotivo}
            error={errorMotivo}
            maxLength={400}
            accessibilityLabel="Motivo del rechazo"
          />
          <Sello onPress={confirmarRechazo} cargando={resolver.isPending} accessibilityLabel="Confirmar rechazo">
            Confirmar rechazo
          </Sello>
        </View>
      ) : (
        <View style={estilos.bloque}>
          <Sello onPress={aprobar} cargando={resolver.isPending} accessibilityLabel={`Aprobar a ${v.nombre_legal}`}>
            Aprobar
          </Sello>
          <Sello onPress={() => setRechazando(true)} variante="contorno" accessibilityLabel={`Rechazar a ${v.nombre_legal}`}>
            Rechazar
          </Sello>
        </View>
      )}
    </View>
  );
}

/** Verificaciones pendientes. Ver los documentos y decidir son acciones del servidor, con rastro de quién las hizo. */
export default function AdminVerificacionesScreen() {
  const { admin, cargando: cargandoRol, sinSesion } = useEsAdmin();
  const lista = useVerificacionesAdmin(admin);

  if (sinSesion) return <Redirect href={{ pathname: '/(auth)/login', params: { volverA: '/admin/verificaciones' } }} />;
  if (cargandoRol || (admin && lista.cargando)) {
    return (
      <ThemedView style={estilos.pantalla}>
        <ThemedText type="small" themeColor="textSecondary" accessibilityLabel="Cargando">Cargando…</ThemedText>
      </ThemedView>
    );
  }
  if (!admin) {
    return (
      <ThemedView style={estilos.pantalla}>
        <BloqueEstado etiqueta="Sin acceso" mensaje="No tienes acceso al panel de administración." icono="lock-closed-outline" />
      </ThemedView>
    );
  }
  // Un fallo NUNCA se pinta como «no hay pendientes».
  if (lista.fallo || !lista.datos) {
    return (
      <ThemedView style={estilos.pantalla}>
        <BloqueEstado etiqueta="No se pudo cargar" mensaje={MENSAJE_ERROR_ADMIN[lista.error?.tipo ?? 'desconocido']} icono="cloud-offline-outline" tono="alerta" />
        <Sello onPress={lista.reintentar} icono="refresh" accessibilityLabel="Reintentar">Reintentar</Sello>
      </ThemedView>
    );
  }
  if (lista.datos.length === 0) {
    return (
      <ThemedView style={estilos.pantalla}>
        <BloqueEstado etiqueta="Todo al día" mensaje="No hay verificaciones pendientes." icono="checkmark-done-outline" />
      </ThemedView>
    );
  }
  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.lista} showsVerticalScrollIndicator={false}>
        {lista.datos.map((v) => (
          <TarjetaVerificacion key={`${v.usuario_id}:${v.rol}`} v={v} />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  lista: { gap: Spacing.three, paddingBottom: Spacing.six },
  tarjeta: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.three, gap: Spacing.two },
  bloque: { gap: Spacing.two },
  documentos: { gap: Spacing.two },
  documento: { gap: Spacing.one },
  imagen: { width: '100%', height: 200, borderRadius: Radios.control },
});
