import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { CampoFicha, FileteHoja } from '@/components/ficha/CampoFicha';
import { Calificacion } from '@/components/ficha/Calificacion';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PorQue } from '@/components/ficha/PorQue';

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
  /** Afinidad semántica en [0,1]. Null cuando esta fila es de Nivel 1 (END-08). */
  similitud?: number | null;
  /** Tope de presupuesto de quien mira, para explicar la holgura. */
  presupuestoMax?: number | null;
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
  similitud,
  presupuestoMax,
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
    // La calificación iba PRIMERO en la pantalla y no aparecía en la etiqueta
    // accesible: un lector de pantalla oía todo menos la tesis.
    typeof score === 'number' && Number.isFinite(score)
      ? `afinidad ${(Math.min(10, Math.max(0, score * 10))).toFixed(1)} de 10`
      : 'sin calificación de afinidad',
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

        {/* La calificación va PRIMERO y a cuerpo grande.
            Estaba a la derecha, a 28px, en tercer lugar y debajo de una foto a
            todo el ancho: acabó siendo el dato MENOS prominente de la ficha,
            justo el que es la tesis entera del producto. Airbnb ordena por deseo
            y por eso la foto manda; esto ordena por AJUSTE, y quien lo lee tiene
            que ver primero cuánto le ajusta. */}
        <View style={estilos.fichaCampos}>
          {/* END-30 · La cifra deja de estar sola. Sus tres razones al lado la
              vuelven discutible, que es lo que distingue una recomendación de
              una sentencia. */}
          <View>
            <Calificacion score={score} />
            <PorQue
              distanciaKm={distanciaKm}
              precio={precio}
              presupuestoMax={presupuestoMax}
              similitud={similitud}
            />
          </View>
          <View style={estilos.camposDerecha}>
            <CampoFicha etiqueta="RENTA MENSUAL" valor={precioTexto} />
            <CampoFicha
              etiqueta="DISTANCIA"
              valor={hayDistancia ? `${distanciaKm!.toFixed(1)} km` : 'sin dato'}
              tono={hayDistancia ? 'normal' : 'atenuado'}
            />
          </View>
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
    alignItems: 'stretch',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  camposDerecha: { flex: 1, justifyContent: 'space-between', gap: Spacing.two },
  atributos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, paddingTop: Spacing.two },
  atributo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
