import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppColors, Spacing } from '@/constants/theme';
import { evaluarPassword, type ContextoPassword } from '@/lib/password';

// Los requisitos se MUESTRAN, no se adivinan.
//
// El patrón contrario —dejar el campo en blanco y soltar "Mínimo 10 caracteres,
// una mayúscula y un número" al pulsar Crear cuenta— obliga a descubrir las
// reglas fallando. Aquí la lista está desde el principio y cada línea se marca
// al cumplirse, así que la persona ve hacia dónde va mientras escribe.
//
// Mientras el campo está vacío todas las líneas se ven en gris, ninguna en rojo:
// no haber empezado a escribir no es un error.

export function RequisitosPassword({
  password,
  contexto,
}: {
  password: string;
  contexto: ContextoPassword;
}) {
  const { resultados } = evaluarPassword(password, contexto);
  const vacio = password.length === 0;

  return (
    <View style={styles.contenedor} accessibilityLabel="Requisitos de la contraseña">
      {resultados.map(({ regla, cumple }) => (
        <View key={regla.id} style={styles.linea}>
          <ThemedText
            type="small"
            style={[styles.marca, cumple && styles.marcaCumplida]}
            themeColor={cumple ? undefined : 'textSecondary'}>
            {cumple ? '✓' : '•'}
          </ThemedText>
          <ThemedText
            type="small"
            themeColor={cumple ? 'text' : 'textSecondary'}
            style={[styles.texto, cumple && styles.textoCumplido, vacio && styles.textoVacio]}>
            {regla.etiqueta}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginTop: Spacing.two, marginBottom: Spacing.two, gap: Spacing.half },
  linea: { flexDirection: 'row', alignItems: 'flex-start' },
  marca: { width: Spacing.three, lineHeight: 20 },
  marcaCumplida: { color: AppColors.successGreen, fontWeight: '700' },
  texto: { flex: 1 },
  textoCumplido: { fontWeight: '600' },
  textoVacio: { opacity: 0.7 },
});
