import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { usePerfilActivo } from '@/hooks/queries/usePerfilActivo';
import { useAgregarFuncion, useMisRoles } from '@/hooks/queries/useRoles';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';

type Vendedor = 'arrendador' | 'comerciante';

const OPCIONES: { valor: Vendedor; etiqueta: string; descripcion: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { valor: 'arrendador', etiqueta: 'Arrendador', descripcion: 'Ofrece un departamento o un cuarto a estudiantes.', icono: 'home-outline' },
  {
    valor: 'comerciante',
    etiqueta: 'Negocio o servicio',
    descripcion: 'Cafés, comida, lavandería, reparaciones… cerca de la universidad.',
    icono: 'storefront-outline',
  },
];

/**
 * «Crea tu perfil de vendedor» (0083). Reemplaza al viejo «Tus funciones» del perfil, que pedía el rol con una alerta.
 *
 * Tres pasos EN ORDEN y ninguno se salta: pedir la función (solo si no se tiene), pasar al perfil de vendedor, y entrar al panel. Si el servidor
 * rechaza alguno, se dice y NO se avanza: no se deja a la persona en un perfil de vendedor sin función, ni en una pantalla que no le corresponde.
 * Pedir la función no da acceso: nace sin verificar; la verificación (INE y fotos) es el paso siguiente, desde el panel.
 */
export default function CrearVendedorScreen() {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { roles } = useMisRoles(miId);
  const agregar = useAgregarFuncion(miId);
  const { cambiar } = usePerfilActivo(miId);
  const [elegido, setElegido] = useState<Vendedor>('arrendador');
  const [enCurso, setEnCurso] = useState(false);
  // Un ref y no solo el estado: dos toques en el mismo fotograma pasan antes de que el estado se actualice.
  const yaEnCurso = useRef(false);

  const continuar = async () => {
    if (yaEnCurso.current) return;
    yaEnCurso.current = true;
    setEnCurso(true);
    try {
      if (!roles.some((r) => r.rol === elegido)) await agregar.mutateAsync(elegido);
      await cambiar('vendedor');
      router.replace('/(tabs)/panel');
    } catch (e) {
      toast.error(
        esCodigo(e, CP.ROL_NO_PERMITIDO)
          ? 'Esa función no se puede crear.'
          : 'No pudimos crear tu perfil de vendedor. Revisa tu conexión e intenta de nuevo.'
      );
    } finally {
      yaEnCurso.current = false;
      setEnCurso(false);
    }
  };

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]} showsVerticalScrollIndicator={false}>
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
          <ThemedText style={Texto.tituloHoja}>Crea tu perfil de vendedor</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tu cuenta sigue siendo la misma. Elige qué quieres ofrecer.
          </ThemedText>

          <View accessibilityRole="radiogroup" style={estilos.opciones}>
            {OPCIONES.map((o) => {
              const activo = o.valor === elegido;
              return (
                <Pulsable
                  key={o.valor}
                  onPress={() => setElegido(o.valor)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${o.etiqueta}. ${o.descripcion}`}
                  accessibilityState={{ checked: activo }}
                  style={[
                    estilos.opcion,
                    {
                      borderColor: activo ? theme.text : theme.filete,
                      borderWidth: activo ? Filete.grueso : Filete.fino,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}
                >
                  <Ionicons name={o.icono} size={26} color={theme.text} />
                  <View style={estilos.textosOpcion}>
                    <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{o.etiqueta}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{o.descripcion}</ThemedText>
                  </View>
                  {activo ? <Ionicons name="checkmark-circle" size={22} color={theme.acento} /> : null}
                </Pulsable>
              );
            })}
          </View>

          <View style={[estilos.siguiente, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">Lo que sigue</ThemedText>
            <ThemedText type="small">1. Verificamos tu identidad con tu INE y unas fotos.</ThemedText>
            <ThemedText type="small">2. Cuando te aprobamos, ya puedes publicar.</ThemedText>
            <ThemedText type="small">3. Mientras tanto, tu cuenta de estudiante sigue funcionando igual.</ThemedText>
          </View>

          <Sello onPress={continuar} cargando={enCurso} accessibilityLabel="Continuar">Continuar</Sello>
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
  opciones: { gap: Spacing.three },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radios.hoja, padding: Spacing.three, minHeight: 72 },
  textosOpcion: { flex: 1, gap: Spacing.half },
  siguiente: { borderWidth: Filete.fino, borderRadius: Radios.hoja, padding: Spacing.three, gap: Spacing.one },
});
