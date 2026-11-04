import { render, screen } from '@testing-library/react-native';

// Al EDITAR, las fotos ya guardadas llegan como RUTAS de Storage (`publicaciones/<cuenta>/…`), no como URL: el bucket es privado y hay que firmarlas para verlas. El formulario pintaba la ruta tal cual y la miniatura salía rota. Ahora recibe
// las URL firmadas (`urlsDeFotos`) para MOSTRARLAS, y sigue guardando la ruta (esa es la identidad de la foto, no la URL que caduca).

jest.mock('@/lib/direccionMx', () => ({ buscarPorCodigoPostal: jest.fn() }));
jest.mock('@/lib/mapboxAutocomplete', () => ({ buscarCalles: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }), MediaTypeOptions: { Images: 'Images' } }));

import { FormularioPublicacion, type VistaPreviaPublicacion } from '../FormularioPublicacion';

const INICIALES = {
  titulo: 'Depa de 1 recámara', tipo: 'depa' as const, direccion: 'Calle Zapata 224, Guadalupe, San Mateo Atenco, San Mateo Atenco, México, CP 52104', precioRenta: '2500',
  descripcion: '', permiteMascotas: false, amueblado: true, serviciosIncluidos: false, recamaras: '1', whatsapp: '7221599193',
};
const RUTA = 'publicaciones/u1/a.jpg';
const FIRMADA = 'https://firmada.test/a.jpg?token=1';

// expo-image normaliza `source` (a veces una lista): se lee de las dos formas.
const uri = (n: number): string | undefined => {
  const s = screen.getByLabelText(`Foto ${n}`).props.source as { uri?: string } | { uri?: string }[] | undefined;
  return Array.isArray(s) ? s[0]?.uri : s?.uri;
};

it('las miniaturas de fotos ya guardadas usan la URL FIRMADA, no la ruta', async () => {
  await render(<FormularioPublicacion textoBoton="Guardar" valoresIniciales={INICIALES} fotosIniciales={[RUTA]} urlsDeFotos={new Map([[RUTA, FIRMADA]])} onGuardar={jest.fn()} />);
  expect(uri(1)).toBe(FIRMADA);
});

it('si todavía no hay firma, NO se pinta la ruta como si fuera una imagen (queda el hueco)', async () => {
  await render(<FormularioPublicacion textoBoton="Guardar" valoresIniciales={INICIALES} fotosIniciales={[RUTA]} onGuardar={jest.fn()} />);
  expect(uri(1)).toBeUndefined();
});

it('una foto que ya es una URL https (las de ejemplo) se muestra tal cual', async () => {
  const externa = 'https://images.unsplash.com/foto.jpg';
  await render(<FormularioPublicacion textoBoton="Guardar" valoresIniciales={INICIALES} fotosIniciales={[externa]} onGuardar={jest.fn()} />);
  expect(uri(1)).toBe(externa);
});

it('la vista previa recibe la foto firmada de la portada (antes no se podía enseñar una ya guardada)', async () => {
  const previa = jest.fn();
  await render(<FormularioPublicacion textoBoton="Guardar" valoresIniciales={INICIALES} fotosIniciales={[RUTA]} urlsDeFotos={new Map([[RUTA, FIRMADA]])} onVistaPrevia={previa} onGuardar={jest.fn()} />);
  expect((previa.mock.calls.at(-1)![0] as VistaPreviaPublicacion).fotoUri).toBe(FIRMADA);
});
