import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Configuración (D1, 24/10/2026): tres grupos —Cuenta, Privacidad y datos, Sesión— y «Mi plan» arriba. Lo que se fija: cada renglón lleva a donde dice,
// «Personalización» dice el estado REAL del consentimiento, «Eliminar mi cuenta» es una fila sobria que lleva a su PROPIA pantalla (ya no un bloque rojo ni
// una alerta), y ya no hay «Descargar mis datos»: el derecho de ACCESO se ejerce con el correo del aviso de privacidad, no con un JSON compartido a ciegas.

const mockCerrarSesion = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: (...a: unknown[]) => mockPush(...a) },
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ session: { user: { id: 'u1', email: 'yo@ejemplo.mx' } }, cerrarSesion: mockCerrarSesion }),
}));
const almacen = { consiente: true };
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({ perfil: { id: 'u1', consiente_analisis_ia: almacen.consiente } }),
}));

// «Mi plan» tiene sus propias pruebas; aquí solo importa que Configuración lo monte.
jest.mock('@/components/GrupoMiPlan', () => ({
  GrupoMiPlan: () => {
    const { Text } = require('react-native');
    return <Text>GRUPO MI PLAN</Text>;
  },
}));

import ConfiguracionScreen from '../configuracion';

const pintar = async () => render(<ConfiguracionScreen />);
const pulsar = async (etiqueta: string | RegExp) => {
  await act(async () => { fireEvent.press(screen.getByLabelText(etiqueta)); });
};

beforeEach(() => {
  jest.clearAllMocks();
  almacen.consiente = true;
});

describe('Cuenta', () => {
  it('«Cambiar contraseña» lleva a su pantalla', async () => {
    await pintar();
    await pulsar(/^Cambiar contraseña/);
    expect(mockPush).toHaveBeenCalledWith('/cambiar-contrasena');
  });
});

describe('Privacidad y datos', () => {
  it('el aviso de privacidad se puede abrir', async () => {
    await pintar();
    await pulsar(/^Aviso de privacidad/);
    expect(mockPush).toHaveBeenCalledWith('/aviso-privacidad');
  });

  it('los términos y condiciones se pueden abrir', async () => {
    await pintar();
    await pulsar(/^Términos y condiciones/);
    expect(mockPush).toHaveBeenCalledWith('/terminos');
  });

  it('«Personalización» dice el estado real y lleva a su pantalla', async () => {
    await pintar();
    await pulsar(/^Personalización.*Activada/);
    expect(mockPush).toHaveBeenCalledWith('/perfil/personalizacion');
  });

  it('sin consentimiento dice «Desactivada»', async () => {
    almacen.consiente = false;
    await pintar();
    expect(screen.getByLabelText(/^Personalización.*Desactivada/)).toBeTruthy();
    expect(screen.queryByLabelText(/Activada/)).toBeNull();
  });

  // Lo pidió el usuario: nadie descarga «un JSON de todo lo que guardamos». El derecho de ACCESO sigue en el aviso, con su correo de contacto.
  it('ya NO ofrece «Descargar mis datos» ni «Sugerencias con IA»', async () => {
    await pintar();
    expect(screen.queryByLabelText(/Descargar mis datos/)).toBeNull();
    expect(screen.queryByLabelText(/JSON/)).toBeNull();
    expect(screen.queryByLabelText(/Sugerencias con IA/)).toBeNull();
  });
});

describe('Sesión', () => {
  it('cerrar sesión cierra y lleva al login', async () => {
    await pintar();
    await pulsar(/^Cerrar sesión/);
    await waitFor(() => expect(mockCerrarSesion).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('«Eliminar mi cuenta» lleva a SU pantalla: no borra nada desde aquí y no abre una alerta', async () => {
    await pintar();
    await pulsar(/^Eliminar mi cuenta/);
    expect(mockPush).toHaveBeenCalledWith('/eliminar-cuenta');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('lo de arriba', () => {
  it('Configuración monta «Mi plan»', async () => {
    await pintar();
    expect(screen.getByText('GRUPO MI PLAN')).toBeTruthy();
  });
});
