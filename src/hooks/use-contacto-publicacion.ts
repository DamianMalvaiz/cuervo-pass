import { useState } from 'react';
import { Linking } from 'react-native';

import { useCuentaRestringida } from '@/hooks/queries/useCuentaRestringida';
import { usePublicacion } from '@/hooks/queries/usePublicaciones';
import { abrirChatCon } from '@/lib/abrirChat';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { sello } from '@/lib/tacto';
import { toast } from '@/lib/toast';
import { urlWhatsapp } from '@/lib/whatsapp';
import { revelarContacto } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Lo necesario para contactar a quien publicó una vivienda, para una cuenta con sesión. El `usuario_id` de quien publica NO viaja en la vista pública: se lee de la publicación completa, que solo
 * existe con sesión. El score de afinidad NO se manda: lo calcula el servidor (END-21). Tres estados y no dos (END-11): `cargando`, `fallo` y lista. En tu propia publicación (`esMia`) no se ofrece nada: la base rechaza escribirse a uno mismo. Una cuenta restringida (0082) no
 * abre conversaciones nuevas (`puedeEscribir` false) pero sí puede ver el contacto, con su cuota diaria.
 */
export function useContactoPublicacion(publicacionId: string, titulo: string) {
  const miId = useAuthStore((s) => s.session?.user.id);
  const { publicacion, cargando, fallo, reintentar } = usePublicacion(miId ? publicacionId : undefined);
  const restringida = useCuentaRestringida(miId);
  const [abriendo, setAbriendo] = useState(false);
  const [revelando, setRevelando] = useState(false);

  const esMia = Boolean(miId && publicacion && publicacion.usuario_id === miId);
  const puedeEscribir = Boolean(publicacion) && !esMia && !restringida;

  const escribir = async () => {
    if (!publicacion || abriendo) return;
    setAbriendo(true);
    try {
      await abrirChatCon(publicacion.usuario_id);
    } finally {
      setAbriendo(false);
    }
  };

  const verContacto = async () => {
    if (revelando) return;
    setRevelando(true);
    try {
      const numero = await revelarContacto(publicacionId);
      // El sello se estampa cuando la revelación ya ocurrió (quedó una fila y se gastó cuota), no al tocar.
      sello();
      await Linking.openURL(urlWhatsapp(numero, titulo));
    } catch (e) {
      toast.error(esCodigo(e, CP.CUOTA_AGOTADA) ? 'Llegaste al límite de contactos por hoy. Vuelve mañana.' : 'No pudimos obtener el contacto de esta publicación. Intenta de nuevo en un momento.');
    } finally {
      setRevelando(false);
    }
  };

  return { cargando, fallo, reintentar, esMia, puedeEscribir, escribir, abriendo, verContacto, revelando };
}
