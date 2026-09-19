import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { CampoFicha, FileteHoja } from '@/components/ficha/CampoFicha';
import { Calificacion } from '@/components/ficha/Calificacion';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Una publicación, como ficha de un expediente.
 *
 * Reconcilia las dos decisiones del encargo. La fotografía manda y va a lo
 * ancho, como pedía la referencia de Airbnb; pero va PEGADA DENTRO del
 * documento, con su folio encima y sus campos ruleados debajo, no coronándolo
 * como el encabezado de una tarjeta. Airbnb ordena por deseo y por eso la foto
 * es todo; esto ordena por ajuste, así que la foto atrae y los campos deciden.
 *
 * La versión anterior era una fila de 88 px con el título, el precio, la
 * dirección y la distancia apilados como prosa: cuatro renglones de texto sin
 * jerarquía, imposibles de comparar entre una tarjeta y la siguiente.
 */

interface Props {
  titulo: string;
  precio: number;
  direccion: string;
  /** URL ya FIRMADA. El bucket es privado (§14): una ruta cruda no carga. */
  fotoUrl?: string | null;
  distanciaKm?: number | null;
  /** Score del motor en [0,1]. Se presenta como calificación sobre 10. */
  score?: number | null;
  tipo?: string | null;
  permiteMascotas?: boolean;
  amueblado?: boolean;
  /** Para el folio: se deriva del id, que es lo único estable que hay. */
  folio?: string;
  onPress?: () => void;
}

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

const NOMBRE_TIPO: Record<string, string> = {
  depa: 'DEPARTAMENTO',
  casa: 'CASA',
  cuarto: 'CUARTO',
};

export function FichaPublicacion({
  titulo,
  precio,
  direccion,
  fotoUrl,
  distanciaKm,
  score,
  tipo,
  permiteMascotas,
  amueblado,
  folio,
  onPress,
}: Props) {
  const theme = useTheme();
  const precioTexto = `$${formateadorPrecio.format(precio)}`;
  // §17: una publicación cuyo geocoding falló se muestra SIN distancia, no
  // desaparece. El campo sigue existiendo y dice que no hay dato — que es
  // información, no un hueco.
  const hayDistancia = distanciaKm != null;
  const etiquetaTipo = tipo ? (NOMBRE_TIPO[tipo] ?? tipo.toUpperCase()) : 'PUBLICACIÓN';

  const atributos: { icono: keyof typeof Ionicons.glyphMap; texto: string }[] = [];
  if (permiteMascotas) atributos.push({ icono: 'paw-outline', texto: 'Acepta mascotas' });
  if (amueblado) atributos.push({ icono: 'bed-outline', texto: 'Amueblado' });

  const descripcionAccesible = [
    titulo,
    `${precioTexto} al mes`,
    direccion,
    hayDistancia ? `a ${distanciaKm!.toFixed(1)} kilómetros de tu universidad` : 'sin distancia calculada',
    ...atributos.map((a) => a.texto),
  ].join('. ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={descripcionAccesible}
      style={({ pressed }) => [
        estilos.hoja,
        { borderColor: theme.filete, backgroundColor: theme.background },
        pressed && estilos.presionada,
      ]}
    >
      <View style={estilos.tiraFolio}>
        <ThemedText type="etiqueta" themeColor="textSecondary">
          {etiquetaTipo}
        </ThemedText>
        {folio && (
          <ThemedText type="folio" themeColor="textSecondary">
            FOLIO {folio}
          </ThemedText>
        )}
      </View>

      {fotoUrl ? (
        <Image
          source={{ uri: fotoUrl }}
          style={[estilos.foto, { borderColor: theme.filete }]}
          contentFit="cover"
          transition={160}
        />
      ) : (
        // Sin foto NO se pinta un rectángulo gris. Se pinta un campo del
        // documento que dice que está vacío, que es lo que hace un formulario
        // con una casilla sin llenar.
        <View
          style={[estilos.foto, estilos.sinFoto, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        >
          <Ionicons name="image-outline" size={20} color={theme.textSecondary} />
          <ThemedText type="etiqueta" themeColor="textSecondary">
            SIN FOTOGRAFÍA
          </ThemedText>
        </View>
      )}

      <View style={estilos.cuerpo}>
        <ThemedText type="subtitle" numberOfLines={2}>
          {titulo}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {direccion}
        </ThemedText>

        <View style={estilos.fichaCampos}>
          <CampoFicha etiqueta="RENTA MENSUAL" valor={precioTexto} ancho={3} />
          <CampoFicha
            etiqueta="DISTANCIA"
            valor={hayDistancia ? `${distanciaKm!.toFixed(1)} km` : 'sin dato'}
            ancho={3}
            tono={hayDistancia ? 'normal' : 'atenuado'}
          />
          <Calificacion score={score} />
        </View>

        {atributos.length > 0 && (
          <>
            <FileteHoja />
            <View style={estilos.atributos}>
              {atributos.map((a) => (
                <View key={a.texto} style={estilos.atributo}>
                  <Ionicons name={a.icono} size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {a.texto}
                  </ThemedText>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  hoja: {
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    overflow: 'hidden',
  },
  presionada: { opacity: 0.7 },
  tiraFolio: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  // 3:2, la proporción de una fotografía impresa. Los bordes van al ras de la
  // hoja porque una foto engomada llega hasta el filete del formulario.
  foto: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderTopWidth: Filete.fino,
    borderBottomWidth: Filete.fino,
  },
  sinFoto: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  cuerpo: { padding: Spacing.three, gap: Spacing.two },
  fichaCampos: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  atributos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, paddingTop: Spacing.two },
  atributo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
