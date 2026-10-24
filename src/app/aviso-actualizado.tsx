import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Casilla } from '@/components/Casilla';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Texto } from '@/constants/theme';
import { AVISO_ACTUALIZACION } from '@/lib/avisoPrivacidad';
import { irAlLogin } from '@/lib/navegacion';
import { toast } from '@/lib/toast';
import { VERSION_AVISO } from '@/lib/verificacion';
import { aceptarAviso } from '@/services/aviso.service';
import { useAuthStore } from '@/store/useAuthStore';

// Lo esencial de lo que cambió en la versión 3. El detalle completo está en el aviso, que se puede leer antes de aceptar.
const CAMBIOS = [
  'Quien ofrece servicios o viviendas entrega su INE, su nombre y su domicilio para verificar su identidad. Una persona del equipo la revisa, y se borra a los 30 días de aprobada (7 si se rechaza).',
  'Hay planes de suscripción para vendedores. Por ahora los cobros son simulados: no se procesa ninguna tarjeta.',
  'Puedes escribir reseñas de negocios y viviendas. Las ve cualquier usuario con sesión, con tu nombre de usuario.',
  'Tus favoritos son privados: solo se muestra cuántas personas guardaron algo, nunca quiénes.',
  'Hoy no tratamos datos biométricos. Si algún día se ofrece, te lo avisaremos y pediremos un consentimiento aparte.',
];

/**
 * Pide aceptar el aviso de privacidad VIGENTE (migración 0059). Se llega aquí desde el guardia de entrada (`index.tsx`) cuando la
 * cuenta no tiene registrada la versión actual. Aceptar llama a la RPC, que escribe la versión y la hora del servidor; solo si eso sale
 * bien se continúa. Quien no acepta puede cerrar sesión: no se queda sin salida, pero tampoco entra sin aceptar.
 */
export default function AvisoActualizadoScreen() {
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const [consiente, setConsiente] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const aceptar = async () => {
    if (!consiente || enviando) return;
    setEnviando(true);
    try {
      await aceptarAviso(VERSION_AVISO);
      router.replace('/');
    } catch {
      toast.error('No pudimos registrar tu aceptación. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const salir = async () => {
    await cerrarSesion();
    irAlLogin();
  };

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.desplazable} showsVerticalScrollIndicator={false}>
        <ThemedText type="subtitle">Actualizamos el aviso de privacidad</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {AVISO_ACTUALIZACION}
        </ThemedText>
        <ThemedText style={Texto.cuerpo}>Esto es lo que cambió:</ThemedText>
        {CAMBIOS.map((c) => (
          <ThemedText key={c} type="small" themeColor="textSecondary" style={estilos.linea}>
            {`• ${c}`}
          </ThemedText>
        ))}
        <Pulsable
          onPress={() => router.push('/aviso-privacidad')}
          accessibilityRole="link"
          accessibilityLabel="Leer el aviso de privacidad"
          style={estilos.enlace}
        >
          <ThemedText type="small" themeColor="acento">
            Leer el aviso completo
          </ThemedText>
        </Pulsable>
        <Casilla valor={consiente} onCambiar={setConsiente} etiqueta="Acepto el aviso de privacidad" />
        <View style={estilos.acciones}>
          <Sello onPress={() => void aceptar()} cargando={enviando} deshabilitado={!consiente} accessibilityLabel="Continuar">
            Continuar
          </Sello>
          <Sello onPress={() => void salir()} variante="contorno" accessibilityLabel="No acepto, cerrar sesión">
            No acepto, cerrar sesión
          </Sello>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { padding: Spacing.three, paddingTop: Spacing.six, paddingBottom: Spacing.six, gap: Spacing.three },
  linea: { lineHeight: 22 },
  enlace: { minHeight: 44, justifyContent: 'center' },
  acciones: { gap: Spacing.two },
});
