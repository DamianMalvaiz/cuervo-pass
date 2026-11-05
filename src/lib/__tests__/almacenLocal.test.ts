import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLAVES_ALMACEN, cuandoListo, escribirAlmacen, hidratarAlmacen, leerAlmacen, reiniciarAlmacenParaPruebas } from '../almacenLocal';
import { CLAVE_COMPARAR, alternarComparar, leerComparar } from '../comparar';
import { CLAVE_VISTOS, leerVistos, registrarVisto } from '../vistos';

// El almacén de la APP (sin `localStorage`): se lee UNA vez a una copia en memoria y los cambios esperan a esa lectura; si no, escribir sobre una lista aún vacía pisaría lo guardado.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

beforeEach(async () => {
  reiniciarAlmacenParaPruebas();
  await AsyncStorage.clear();
});

it('las claves que se hidratan son las de Vistos y Comparar (si una cambia, esto avisa)', () => {
  expect([...CLAVES_ALMACEN].sort()).toEqual([CLAVE_COMPARAR, CLAVE_VISTOS].sort());
});

it('lo guardado en una sesión anterior se lee al hidratar', async () => {
  await AsyncStorage.setItem(CLAVE_COMPARAR, JSON.stringify([id(1), id(2)]));
  expect(leerComparar()).toEqual([]); // aún sin leer
  await hidratarAlmacen();
  expect(leerComparar()).toEqual([id(1), id(2)]);
});

it('un cambio hecho ANTES de hidratar espera, y se aplica sobre lo guardado (no lo pisa)', async () => {
  await AsyncStorage.setItem(CLAVE_COMPARAR, JSON.stringify([id(1)]));
  alternarComparar(id(2)); // la app aún no leyó lo guardado
  expect(leerComparar()).toEqual([]);
  await hidratarAlmacen();
  expect(leerComparar()).toEqual([id(1), id(2)]);
});

it('lo que se cambia se escribe a AsyncStorage para la próxima vez', async () => {
  await hidratarAlmacen();
  registrarVisto(id(7));
  expect(leerVistos()).toEqual([id(7)]);
  expect(JSON.parse((await AsyncStorage.getItem(CLAVE_VISTOS)) ?? '[]')).toEqual([id(7)]);
});

it('vaciar la lista borra la clave', async () => {
  await hidratarAlmacen();
  alternarComparar(id(1));
  alternarComparar(id(1));
  expect(leerComparar()).toEqual([]);
  expect(await AsyncStorage.getItem(CLAVE_COMPARAR)).toBeNull();
});

it('pedir la lectura dos veces no la repite', async () => {
  const leer = jest.spyOn(AsyncStorage, 'multiGet');
  leer.mockClear(); // el mock de AsyncStorage acumula las llamadas de pruebas anteriores
  await Promise.all([hidratarAlmacen(), hidratarAlmacen()]);
  await hidratarAlmacen();
  expect(leer).toHaveBeenCalledTimes(1);
  leer.mockRestore();
});

it('si AsyncStorage no se puede leer sigue con la lista vacía y no se atora', async () => {
  const leer = jest.spyOn(AsyncStorage, 'multiGet').mockRejectedValueOnce(new Error('disco'));
  await hidratarAlmacen();
  const hecho = jest.fn();
  cuandoListo(hecho);
  expect(hecho).toHaveBeenCalledTimes(1);
  expect(leerAlmacen(CLAVE_VISTOS)).toBe('');
  leer.mockRestore();
});

it('escribir sin hidratar sigue siendo seguro (no lanza)', () => {
  expect(() => escribirAlmacen(CLAVE_VISTOS, '[]')).not.toThrow();
});
