import { fireEvent, render, screen } from '@testing-library/react-native';

import AvisoPrivacidadScreen from '../aviso-privacidad';
import TerminosScreen from '../terminos';
import { SECCIONES } from '@/lib/avisoPrivacidad';
import { TERMINOS } from '@/lib/terminos';

// Aviso y términos comparten `DocumentoLegal`: «Lo esencial» arriba y secciones plegadas que se abren al tocar. El texto completo tiene que seguir siendo alcanzable.

test('el aviso muestra Lo esencial y sus secciones plegadas', async () => {
  await render(<AvisoPrivacidadScreen />);
  expect(screen.getByText('LO ESENCIAL')).toBeTruthy();
  for (const s of SECCIONES) expect(screen.getByLabelText(`${s.numero}. ${s.titulo}`)).toBeTruthy();
  // plegada: el contenido de la sección 1 no se ve hasta tocarla
  expect(screen.queryByText('Correo del responsable')).toBeNull();
  await fireEvent.press(screen.getByLabelText(`1. ${SECCIONES[0].titulo}`));
  expect(screen.getByText('Correo del responsable')).toBeTruthy();
});

test('una sección dice si está abierta o cerrada', async () => {
  await render(<TerminosScreen />);
  const cab = screen.getByLabelText(`1. ${TERMINOS[0].titulo}`);
  expect(cab.props.accessibilityState).toEqual({ expanded: false });
  await fireEvent.press(cab);
  expect(screen.getByLabelText(`1. ${TERMINOS[0].titulo}`).props.accessibilityState).toEqual({ expanded: true });
  await fireEvent.press(screen.getByLabelText(`1. ${TERMINOS[0].titulo}`));
  expect(screen.getByLabelText(`1. ${TERMINOS[0].titulo}`).props.accessibilityState).toEqual({ expanded: false });
});

test('los términos cubren IA en Personalización, eliminar cuenta y la prueba gratis de 15 días', async () => {
  await render(<TerminosScreen />);
  for (const s of TERMINOS) await fireEvent.press(screen.getByLabelText(`${s.numero}. ${s.titulo}`));
  expect(screen.getByText(/Configuración → Personalización/)).toBeTruthy();
  expect(screen.getByText(/Configuración → Eliminar mi cuenta/)).toBeTruthy();
  expect(screen.getByText(/prueba gratis de 15 días/)).toBeTruthy();
});
