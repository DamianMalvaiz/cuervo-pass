import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Campo } from '@/components/Campo';
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useEsAdmin, useModeracionAdmin, useModerar } from '@/hooks/queries/useAdmin';
import { useTheme } from '@/hooks/use-theme';
import { ErrorAdmin, MENSAJE_ERROR_ADMIN } from '@/lib/admin';
import { toast } from '@/lib/toast';
import type { ItemModeracion } from '@/services/admin.service';

const mensajeDe = (e: unknown) => MENSAJE_ERROR_ADMIN[e instanceof ErrorAdmin ? e.tipo : 'desconocido'];

function TarjetaModeracion({ item }: { item: ItemModeracion }) {
  const theme = useTheme();
  const moderar = useModerar();
  const [ocultando, setOcultando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | undefined>();
  const etiqueta = item.tipo === 'resena' ? 'Reseña' : 'Negocio';

  const enviar = (ocultar: boolean, texto: string | null) =>
    moderar.mutate(
      { tipo: item.tipo, id: item.id, ocultar, motivo: texto },
      {
        onSuccess: () => {
          toast.exito(ocultar ? 'Contenido oculto.' : 'Contenido restaurado.');
          setOcultando(false);
          setMotivo('');
        },
        onError: (e) => toast.error(mensajeDe(e)),
      },
    );

  const restaurar = () =>
    Alert.alert('Restaurar', `¿Volver a mostrar «${item.titulo}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restaurar', onPress: () => enviar(false, null) },
    ]);

  const confirmarOcultar = () => {
    if (motivo.trim().length < 3) {
      setErrorMotivo('Escribe un motivo (al menos 3 letras).');
      return;
    }
    setErrorMotivo(undefined);
    enviar(true, motivo.trim());
  };

  return (
    <View style={[estilos.tarjeta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
      <ThemedText type="smallBold" themeColor="textSecondary">{`${etiqueta} · de @${item.autor}`}</ThemedText>
      <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{item.titulo}</ThemedText>
      {item.texto ? <ThemedText type="small" themeColor="textSecondary">{item.texto}</ThemedText> : null}
      <ThemedText type="small" themeColor="textSecondary">
        {`${item.reportes} ${item.reportes === 1 ? 'reporte' : 'reportes'} · ${item.oculto ? 'Oculto' : 'Visible'}`}
      </ThemedText>

      {item.oculto ? (
        <Sello onPress={restaurar} cargando={moderar.isPending} variante="contorno" accessibilityLabel={`Restaurar ${item.titulo}`}>
          Restaurar
        </Sello>
      ) : ocultando ? (
        <View style={estilos.bloque}>
          <Campo
            etiqueta="Motivo para ocultar"
            value={motivo}
            onChangeText={setMotivo}
            error={errorMotivo}
            maxLength={400}
            accessibilityLabel="Motivo para ocultar"
          />
          <Sello onPress={confirmarOcultar} cargando={moderar.isPending} accessibilityLabel="Confirmar ocultar">
            Confirmar ocultar
          </Sello>
        </View>
      ) : (
        <Sello onPress={() => setOcultando(true)} variante="contorno" accessibilityLabel={`Ocultar ${item.titulo}`}>
          Ocultar
        </Sello>
      )}
    </View>
  );
}

/** Contenido reportado u oculto. Ocultar exige un motivo y queda en la bitácora; restaurar no borra los reportes. */
export default function AdminModeracionScreen() {
  const { admin, cargando: cargandoRol } = useEsAdmin();
  const lista = useModeracionAdmin(admin);

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
        <BloqueEstado etiqueta="Todo en orden" mensaje="Nada que moderar: no hay contenido reportado ni oculto." icono="checkmark-done-outline" />
      </ThemedView>
    );
  }
  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.lista} showsVerticalScrollIndicator={false}>
        {lista.datos.map((item) => (
          <TarjetaModeracion key={`${item.tipo}:${item.id}`} item={item} />
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
});
