import { render, screen } from '@testing-library/react-native';

// La vista previa del menú: por secciones, con foto, descripción y precio; refleja lo que hay AHORA (aunque no esté guardado) y no inventa: sin nombre no se pinta, sin precio dice «Consulta el precio».

import { VistaPreviaMenuWeb } from '../VistaPreviaMenuWeb';

const p = (clave: string, nombre: string, extra: Record<string, unknown> = {}) => ({ clave, nombre, precio: '', seccion: '', descripcion: '', fotos: [] as string[], fotosNuevas: [] as string[], estrella: false, ...extra });
const v = (productos: ReturnType<typeof p>[], urls: [string, string][] = []) => ({ productos: productos as never, urls: new Map(urls) });

it('sin productos lo dice (no una lista vacía)', async () => {
  await render(<VistaPreviaMenuWeb v={v([])} />);
  expect(screen.getByText(/Cuando agregues productos/)).toBeTruthy();
  await render(<VistaPreviaMenuWeb v={null} />);
});

it('agrupa por sección y deja los sin sección al final, con descripción y precio', async () => {
  await render(<VistaPreviaMenuWeb v={v([p('1', 'Taco', { seccion: 'Tacos', precio: '20', descripcion: 'Con piña' }), p('2', 'Agua', { seccion: 'Bebidas', precio: '15.5' }), p('3', 'Extra', { precio: '5' })])} />);
  expect(screen.getByText('Tacos')).toBeTruthy();
  expect(screen.getByText('Bebidas')).toBeTruthy();
  expect(screen.getByText('Con piña')).toBeTruthy();
  expect(screen.getByText('$20')).toBeTruthy();
  expect(screen.getByText('$15.5')).toBeTruthy();
  expect(screen.getByText('Extra')).toBeTruthy();
});

it('un producto sin nombre todavía no se pinta; uno sin precio (o con un precio roto) dice «Consulta el precio», nunca $0', async () => {
  await render(<VistaPreviaMenuWeb v={v([p('1', '   ', { precio: '10' }), p('2', 'Revisión'), p('3', 'Raro', { precio: 'abc' })])} />);
  expect(screen.queryByText('$10')).toBeNull();
  expect(screen.getAllByText('Consulta el precio')).toHaveLength(2);
  expect(screen.queryByText(/\$0/)).toBeNull();
});

it('la foto de un producto ya guardado sale de su URL firmada; la de uno nuevo, de su archivo local', async () => {
  await render(<VistaPreviaMenuWeb v={v([p('1', 'Taco', { fotos: ['ruta/a.jpg'] }), p('2', 'Torta', { fotosNuevas: ['file:///nueva.jpg'] })], [['ruta/a.jpg', 'https://f.test/a']])} />);
  expect(screen.getByText('Taco')).toBeTruthy();
  expect(screen.getByText('Torta')).toBeTruthy();
});

it('dice que es aproximada y que se publica al guardar', async () => {
  await render(<VistaPreviaMenuWeb v={v([p('1', 'Taco')])} />);
  expect(screen.getByText(/aunque aún no lo hayas guardado/)).toBeTruthy();
  expect(screen.getByText(/Guardar menú/)).toBeTruthy();
});
