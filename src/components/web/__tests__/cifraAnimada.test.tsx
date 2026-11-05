import { render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

// La cifra del ajuste de la portada. Lo que se fija: el valor REAL está en el primer pintado (sin JavaScript, en el HTML exportado o sin saber aún la preferencia se ve la cifra final), con «reducir movimiento»
// no cuenta, y cuando sí hay movimiento termina EXACTO en su valor.

const mockReducido = { valor: null as boolean | null };
jest.mock('@/hooks/use-movimiento-reducido', () => ({ useMovimientoReducido: () => mockReducido.valor }));

import { CifraAnimadaWeb } from '../CifraAnimadaWeb';

const plataforma = Platform.OS;
beforeEach(() => {
  Platform.OS = 'web';
  mockReducido.valor = null;
});
afterEach(() => {
  Platform.OS = plataforma;
});

describe('CifraAnimadaWeb', () => {
  it('sin saber todavía la preferencia enseña la cifra final (no empieza en 0)', async () => {
    await render(<CifraAnimadaWeb valor={94} />);
    expect(screen.getByText('94')).toBeTruthy();
  });

  it('con «reducir movimiento» enseña la cifra final y no cuenta', async () => {
    mockReducido.valor = true;
    await render(<CifraAnimadaWeb valor={94} />);
    expect(screen.getByText('94')).toBeTruthy();
  });

  it('con movimiento termina exactamente en su valor', async () => {
    mockReducido.valor = false;
    await render(<CifraAnimadaWeb valor={94} duracionMs={60} />);
    await waitFor(() => expect(screen.getByText('94')).toBeTruthy(), { timeout: 2000 });
  });

  it('fuera de la web (app) no anima nunca', async () => {
    Platform.OS = 'ios';
    mockReducido.valor = false;
    await render(<CifraAnimadaWeb valor={94} />);
    expect(screen.getByText('94')).toBeTruthy();
  });
});
