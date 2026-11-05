import { DIAS_DE_PRUEBA, textoDePrueba } from '../planes';

// La duración de la prueba vive en la base (`iniciar_prueba`: 15 días). La pantalla la nombra antes de empezar, así que es UN número en un solo sitio
// del cliente, y esta prueba lo ata a lo que dice el texto. Si la base cambia, hay que cambiar el número Y esta prueba, a la vista.
test('la prueba dura 15 días (el número de la base)', () => {
  expect(DIAS_DE_PRUEBA).toBe(15);
});

test('el texto de la prueba nombra los días y el plan', () => {
  expect(textoDePrueba('Básico')).toBe('15 días con todo lo del plan Básico. Sin tarjeta y sin compromiso.');
});
