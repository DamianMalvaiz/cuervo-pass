// El evento `storage` del navegador avisa cuando OTRA pestaña cambia el almacenamiento (la pestaña que escribe no lo recibe: esa avisa a los suyos por su cuenta). Sin él, quitar algo de «Comparar» en una pestaña
// dejaba la otra enseñando la lista vieja hasta recargar. Sin navegador (página generada, pruebas) no hace nada.

/** Llama a `f` cuando otra pestaña cambia `clave` (o vacía todo el almacenamiento). Devuelve cómo dejar de escuchar. */
export function alCambiarEnOtraPestana(clave: string, f: () => void): () => void {
  const alCambiar = (e: Event) => {
    const { key } = e as StorageEvent;
    // `key === null` es «se vació todo».
    if (key === null || key === clave) f();
  };
  globalThis.addEventListener?.('storage', alCambiar);
  return () => globalThis.removeEventListener?.('storage', alCambiar);
}
