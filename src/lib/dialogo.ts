import { Alert, Platform } from 'react-native';

// `Alert.alert` que también funciona en la web.
//
// react-native-web no trae diálogos: ahí `Alert.alert` no hace NADA. Un aviso que no aparece deja la pantalla muerta (el botón «Entendido» era el que navegaba, y el cuestionario se quedaba sin salir), y una
// confirmación que no aparece hace que «Borrar» o «Pagar» parezcan botones rotos. En la app es EXACTAMENTE `Alert.alert`; en el navegador:
//   · un botón (o ninguno)  → `window.alert`, y al aceptarlo corre lo que ese botón hacía;
//   · cancelar + una acción → `window.confirm`: aceptar corre la acción, cancelar corre la de cancelar (si la hay);
//   · tres o más botones    → un diálogo del navegador no ofrece varias opciones, así que se PREGUNTA una por una («¿Elegir: …?»): la primera que se acepta se ejecuta; si se rechazan todas (o se cancela), no pasa nada.
//                             Nunca se elige por nadie. Es menos fino que un menú, pero funciona en cualquier navegador.

export interface BotonDialogo {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export function dialogo(titulo: string, mensaje?: string, botones: BotonDialogo[] = []) {
  if (Platform.OS !== 'web') {
    Alert.alert(titulo, mensaje, botones);
    return;
  }
  const texto = mensaje ? `${titulo}\n\n${mensaje}` : titulo;
  if (botones.length <= 1) {
    window.alert(texto);
    botones[0]?.onPress?.();
    return;
  }
  const cancelar = botones.find((b) => b.style === 'cancel');
  const acciones = botones.filter((b) => b.style !== 'cancel');
  if (botones.length === 2 && cancelar && acciones.length === 1) {
    if (window.confirm(texto)) acciones[0].onPress?.();
    else cancelar.onPress?.();
    return;
  }
  // Varias opciones: se pregunta una por una; la primera que se acepta se ejecuta.
  for (const accion of acciones) {
    if (window.confirm(`${texto}\n\n¿Elegir: «${accion.text}»?`)) {
      accion.onPress?.();
      return;
    }
  }
  cancelar?.onPress?.();
}
