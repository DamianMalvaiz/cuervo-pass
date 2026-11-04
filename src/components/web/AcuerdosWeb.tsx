import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { BloqueInfoWeb, NotaInfoWeb, PaginaInfoWeb } from '@/components/web/InfoWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { RutasWeb } from '@/lib/rutasWeb';

export const TEMAS_ACUERDO: { clave: string; titulo: string; opciones: string[] }[] = [
  { clave: 'gastos', titulo: 'Gastos', opciones: ['Partes iguales', 'Según el cuarto', 'Cada quien lo suyo'] },
  { clave: 'limpieza', titulo: 'Limpieza', opciones: ['Cada quien lo suyo', 'Turnos semanales', 'Contratamos ayuda'] },
  { clave: 'visitas', titulo: 'Visitas', opciones: ['Avisando antes', 'Hasta las 10 pm', 'Sin visitas entre semana'] },
  { clave: 'ruido', titulo: 'Ruido', opciones: ['Silencio de 11 pm a 7 am', 'Silencio de 10 pm a 8 am', 'Lo hablamos caso por caso'] },
  { clave: 'mascotas', titulo: 'Mascotas', opciones: ['Sin mascotas', 'Con acuerdo previo', 'Permitidas'] },
];

/** El texto que se copia: solo los temas ya elegidos, uno por renglón; sin elegir nada no hay acuerdo que copiar. */
export function textoDelAcuerdo(elegidas: Record<string, string>): string | null {
  const lineas = TEMAS_ACUERDO.filter((t) => elegidas[t.clave]).map((t) => `· ${t.titulo}: ${elegidas[t.clave]}`);
  return lineas.length === 0 ? null : ['Acuerdos de convivencia', ...lineas].join('\n');
}

/**
 * Acuerdos de convivencia: una plantilla para ponerse de acuerdo con los roomies ANTES de mudarse. Cinco temas con opciones; lo elegido forma el resumen, que se copia para pasarlo por el chat. Todo ocurre en el navegador: no se guarda ni se manda a
 * ningún lado. Es una guía para conversar, no un contrato. Si el portapapeles no está disponible, el texto queda a la vista para copiarlo a mano (nunca un «copiado» que no pasó).
 */
export function AcuerdosWeb() {
  const theme = useTheme();
  const [elegidas, setElegidas] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const texto = textoDelAcuerdo(elegidas);

  const elegir = (clave: string, opcion: string) => {
    setAviso(null);
    setElegidas((e) => (e[clave] === opcion ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== clave)) : { ...e, [clave]: opcion }));
  };
  const copiar = async () => {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setAviso('Copiado. Pégalo en el chat con tus roomies.');
    } catch {
      setAviso('No se pudo copiar solo. Selecciona el texto de abajo y cópialo.');
    }
  };

  return (
    <PaginaInfoWeb titulo="Acuerdos de convivencia" subtitulo="Lo que se habla al inicio evita pleitos después. Elige lo que les funciona y copia el resumen." actual={RutasWeb.acuerdos}>
      <View style={estilos.columnas}>
        <View style={estilos.temas}>
          {TEMAS_ACUERDO.map((t) => (
            <BloqueInfoWeb key={t.clave} titulo={t.titulo}>
              <View style={estilos.opciones} accessibilityRole="radiogroup" accessibilityLabel={t.titulo}>
                {t.opciones.map((o) => {
                  const activa = elegidas[t.clave] === o;
                  return (
                    <Pulsable
                      key={o}
                      onPress={() => elegir(t.clave, o)}
                      accessibilityRole="radio"
                      accessibilityLabel={`${t.titulo}: ${o}`}
                      accessibilityState={{ checked: activa }}
                      aria-checked={activa}
                      style={[estilos.opcion, { borderColor: activa ? theme.sello : theme.filete, backgroundColor: activa ? theme.sello : theme.background }]}
                    >
                      <ThemedText style={[Texto.pequenoFuerte, { color: activa ? theme.selloTexto : theme.text }]}>{o}</ThemedText>
                    </Pulsable>
                  );
                })}
              </View>
            </BloqueInfoWeb>
          ))}
        </View>
        <View style={estilos.resumen}>
          <BloqueInfoWeb titulo="Tu resumen">
            {texto ? (
              <ThemedText selectable style={Texto.cuerpo}>{texto}</ThemedText>
            ) : (
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Elige una opción en cada tema que quieras acordar; aquí va quedando el resumen.</ThemedText>
            )}
            {texto ? <BotonWeb onPress={copiar} accessibilityLabel="Copiar para mis roomies">Copiar para mis roomies</BotonWeb> : null}
            {aviso ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" accessibilityRole="alert">{aviso}</ThemedText> : null}
          </BloqueInfoWeb>
        </View>
      </View>
      <NotaInfoWeb>Es una guía para conversar, no un contrato. Nada de esto se guarda ni se envía: se queda en tu navegador hasta que lo copies.</NotaInfoWeb>
    </PaginaInfoWeb>
  );
}

const estilos = StyleSheet.create({
  columnas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, alignItems: 'flex-start' },
  temas: { flexGrow: 2, flexBasis: 420, flexShrink: 1, maxWidth: '100%', minWidth: 0, gap: Spacing.three },
  resumen: { flexGrow: 1, flexBasis: 300, flexShrink: 1, maxWidth: '100%', minWidth: 0 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  opcion: { minHeight: 44, paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: Filete.fino, justifyContent: 'center' },
});
