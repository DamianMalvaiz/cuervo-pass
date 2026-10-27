// Perfil activo: estudiante o vendedor (0083).
//
// Una cuenta puede tener los dos perfiles y usa uno a la vez. El perfil decide qué pestañas se ven y adónde se entra. Un negocio no ve Depas ni
// Roomies; un estudiante no ve el panel de un vendedor. Lo guarda el servidor (`usuarios.perfil_activo`) y se cambia con `cambiar_perfil_activo`.

export type PerfilActivo = 'estudiante' | 'vendedor';

export type NombrePestana = 'inicio' | 'favoritos' | 'panel' | 'publicar' | 'chats' | 'perfil';

/**
 * Las pestañas que se enseñan, en orden. `null` = todavía no se sabe: la barra de siempre (la de estudiante).
 * `puedePublicar`: el estudiante con alguna función de vendedor APROBADA conserva «Publicar», donde siempre estuvo.
 */
export function pestanasVisibles(perfil: PerfilActivo | null, puedePublicar: boolean): NombrePestana[] {
  if (perfil === 'vendedor') return ['panel', 'publicar', 'chats', 'perfil'];
  return puedePublicar ? ['inicio', 'favoritos', 'publicar', 'chats', 'perfil'] : ['inicio', 'favoritos', 'chats', 'perfil'];
}

/** Adónde se entra con una sesión válida. El cuestionario es de quien BUSCA: un vendedor no pasa por él. En la web (`web`) el inicio de quien busca son las páginas de explorar. */
export function destinoInicial(
  perfil: PerfilActivo | null,
  cuestionarioCompleto: boolean,
  web = false
): '/(tabs)/inicio' | '/departamentos' | '/(tabs)/panel' | '/(auth)/cuestionario-inicial' {
  if (perfil === 'vendedor') return '/(tabs)/panel';
  if (!cuestionarioCompleto) return '/(auth)/cuestionario-inicial';
  return web ? '/departamentos' : '/(tabs)/inicio';
}
