import { destinoInicial, pestanasVisibles } from '../perfilActivo';

// El perfil activo decide qué pestañas se ven y adónde se entra. Lo que se fija: el estudiante conserva su barra de siempre, el vendedor tiene la
// suya, y NADIE ve pestañas del otro perfil (un negocio no ve Depas ni Roomies).

describe('pestanasVisibles', () => {
  it('el estudiante ve Inicio, Favoritos, Chats y Perfil', () => {
    expect(pestanasVisibles('estudiante', false)).toEqual(['inicio', 'favoritos', 'chats', 'perfil']);
  });

  // Hoy un estudiante con función de vendedor APROBADA ve «Publicar». Quitarla sin más le quitaría a esas cuentas la forma de publicar hasta que
  // exista el cambio de perfil: se conserva.
  it('un estudiante que ya puede publicar conserva la pestaña «Publicar», donde siempre estuvo', () => {
    expect(pestanasVisibles('estudiante', true)).toEqual(['inicio', 'favoritos', 'publicar', 'chats', 'perfil']);
  });

  it('el vendedor ve Mi panel, Publicaciones, Chats y Perfil, y NO Inicio ni Favoritos', () => {
    const v = pestanasVisibles('vendedor', false);
    expect(v).toEqual(['panel', 'publicar', 'chats', 'perfil']);
    expect(v).not.toContain('inicio');
    expect(v).not.toContain('favoritos');
  });

  it('mientras no se sabe el perfil, la barra es la de estudiante (la de siempre)', () => {
    expect(pestanasVisibles(null, false)).toEqual(pestanasVisibles('estudiante', false));
  });
});

describe('destinoInicial', () => {
  it('un estudiante con cuestionario va a Inicio; sin cuestionario, a hacerlo', () => {
    expect(destinoInicial('estudiante', true)).toBe('/(tabs)/inicio');
    expect(destinoInicial('estudiante', false)).toBe('/(auth)/cuestionario-inicial');
  });

  it('un vendedor va a su panel, y NUNCA al cuestionario de estudiante', () => {
    expect(destinoInicial('vendedor', true)).toBe('/(tabs)/panel');
    expect(destinoInicial('vendedor', false)).toBe('/(tabs)/panel');
  });

  it('sin perfil conocido, se comporta como estudiante', () => {
    expect(destinoInicial(null, true)).toBe('/(tabs)/inicio');
  });

  // En la web «Inicio» son las páginas de explorar de siempre (`/departamentos`): las pantallas de teléfono de `(tabs)/inicio` no se usan ahí.
  it('en la web, un estudiante con cuestionario entra a los departamentos; lo demás igual', () => {
    expect(destinoInicial('estudiante', true, true)).toBe('/departamentos');
    expect(destinoInicial(null, true, true)).toBe('/departamentos');
    expect(destinoInicial('estudiante', false, true)).toBe('/(auth)/cuestionario-inicial');
    expect(destinoInicial('vendedor', true, true)).toBe('/(tabs)/panel');
  });
});
