import { renderHook } from '@testing-library/react-native';

let mockToken: string | undefined = 'tok';
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockToken ? { access_token: mockToken } : null }) }));
jest.mock('@/lib/supabase', () => ({ supabaseUrlPublica: 'https://p.supabase.co', supabaseClavePublica: 'clave' }));

import { useMiniaturas } from '../use-miniaturas';

beforeEach(() => { mockToken = 'tok'; });

test('arma una miniatura por cada ruta del bucket, sin red', async () => {
  const { result } = await renderHook(() => useMiniaturas(['a/1.jpg', 'a/2.jpg'], 400));
  expect(result.current('a/1.jpg')?.uri).toContain('/render/image/authenticated/fotos/a/1.jpg');
  expect(result.current('a/2.jpg')).not.toBeNull();
  expect(result.current('a/1.jpg')?.headers.Authorization).toBe('Bearer tok');
});

test('una URL externa no tiene miniatura: queda fuera del mapa y se usará la completa', async () => {
  const { result } = await renderHook(() => useMiniaturas(['https://unsplash/x.jpg', 'a/1.jpg'], 400));
  expect(result.current('https://unsplash/x.jpg')).toBeNull();
  expect(result.current('a/1.jpg')).not.toBeNull();
});

test('sin sesión no hay miniaturas (nunca una URL sin autorización)', async () => {
  mockToken = undefined;
  const { result } = await renderHook(() => useMiniaturas(['a/1.jpg'], 400));
  expect(result.current('a/1.jpg')).toBeNull();
});

test('rutas nulas o vacías se ignoran', async () => {
  const { result } = await renderHook(() => useMiniaturas([null, undefined, '', 'a/1.jpg'], 400));
  expect(result.current(null)).toBeNull();
  expect(result.current(undefined)).toBeNull();
  expect(result.current('')).toBeNull();
  expect(result.current('a/1.jpg')).not.toBeNull();
});

test('una ruta que no se pidió no tiene miniatura', async () => {
  const { result } = await renderHook(() => useMiniaturas(['a/1.jpg'], 400));
  expect(result.current('otra/9.jpg')).toBeNull();
});

test('el mismo conjunto de rutas en otro orden devuelve el MISMO accesor (no se rearma)', async () => {
  const { result, rerender } = await renderHook(({ r }: { r: string[] }) => useMiniaturas(r, 400), { initialProps: { r: ['a/1.jpg', 'a/2.jpg'] } });
  const antes = result.current;
  await rerender({ r: ['a/2.jpg', 'a/1.jpg'] });
  expect(result.current).toBe(antes);
});
