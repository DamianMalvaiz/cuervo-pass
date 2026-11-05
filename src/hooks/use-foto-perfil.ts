import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { avisarPermisoDeFotosDenegado } from '@/lib/permisos';
import { subirFotoPerfil } from '@/lib/storage';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

/**
 * Cambiar la foto de perfil, con sus tres caminos: sin permiso se explica (con «Ajustes» si el sistema ya no volverá a preguntar), cancelar el selector no hace nada, y subir guarda la RUTA, no la uri local. Un fallo se dice y
 * el botón vuelve a su estado: sin el `finally`, un fallo lo dejaba deshabilitado hasta reiniciar la app. Lo usan la tarjeta de identidad de la app y el perfil de la web.
 * El bucket es privado (§14): `foto_url` guarda una ruta, y para mostrarla hay que firmarla (`urlFoto`).
 */
export function useFotoPerfil() {
  const session = useAuthStore((s) => s.session);
  const { perfil, actualizarPerfil } = usePerfilStore();
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { urls: urlsFirmadas } = useFotosFirmadas([perfil?.foto_url]);
  const urlFoto = perfil?.foto_url ? urlsFirmadas.get(perfil.foto_url) : null;

  const cambiarFoto = async () => {
    if (!session?.user.id) return;
    setError(null);
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      // En la ficha Y como aviso: el texto puede estar fuera de la vista si se ha deslizado.
      setError(avisarPermisoDeFotosDenegado(permiso.canAskAgain));
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, aspect: [1, 1], allowsEditing: true });
    if (resultado.canceled) return;

    setSubiendoFoto(true);
    try {
      const ruta = await subirFotoPerfil(session.user.id, resultado.assets[0].uri);
      await actualizarPerfil(session.user.id, { foto_url: ruta });
      toast.exito('Foto actualizada');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No se pudo subir la foto';
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setSubiendoFoto(false);
    }
  };

  return { urlFoto, subiendoFoto, error, cambiarFoto };
}
