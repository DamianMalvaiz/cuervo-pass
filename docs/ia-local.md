# La IA corriendo en tu laptop · guía de operación

Decisión (18/10/2026): el servicio de IA corre **local** y se expone con un **dominio estable**. Esto NO lo hace autónomo —sigue dependiendo de que tu laptop esté
encendida y con internet—, pero elimina lo que de verdad fallaba: el túnel rápido de Cloudflare cambia de dominio en cada arranque y su DNS llegó a tardar **más de media
hora**. Si la laptop se apaga o el túnel cae, la app baja a **Nivel 1** (sin afinidad semántica) y lo dice en pantalla; no se rompe.

## Por qué ngrok con dominio estático
| Opción | Dominio estable | Necesita | Riesgo |
|---|---|---|---|
| **ngrok (cuenta gratis, 1 dominio estático)** ← elegida | sí | una cuenta; un binario sin `sudo` | página intermedia en navegadores (el proxy manda `ngrok-skip-browser-warning`) |
| Tailscale Funnel | sí | cuenta; instalar un servicio con `sudo` y activar Funnel | toca la red de la laptop |
| Cloudflare con túnel con nombre | sí | un dominio propio en Cloudflare | no hay dominio |
| Cloudflare túnel rápido (lo que había) | **no** | nada | DNS de hasta 30+ min al cambiar |

## Configuración, UNA sola vez
1. Crea una cuenta en ngrok.com. En *Domains* reclama tu dominio estático gratuito (algo como `tu-nombre.ngrok-free.app`).
2. Instala ngrok y pon TU token (lo copias del panel; **no lo compartas ni lo escribas en ningún archivo del repositorio**):
   `ngrok config add-authtoken <tu-token>`
3. En `.env.server` (no se versiona): `AI_SERVICE_URL_FIJA=https://tu-nombre.ngrok-free.app`
4. Redespliega el proxy una vez (lleva la cabecera que evita la página intermedia): `npx supabase functions deploy ai-proxy`

## Cada vez que vayas a exponer la app (30 min antes)
```bash
./scripts/ia-arrancar.sh                              # reconstruye el contenedor con el commit del árbol y espera a que cargue el modelo
ngrok http --url=tu-nombre.ngrok-free.app 8000        # en OTRA terminal; déjala abierta
./scripts/tunel.sh                                    # comprueba que responde por el camino público y fija el secret SOLO si cambió
node scripts/verificar.mjs                            # debe salir sin ✗ (la clave de Anthropic y Google Maps son avisos)
```
El secret `AI_SERVICE_URL` se fija **la primera vez**; mientras el dominio sea el mismo, `tunel.sh` dice «el secret ya apunta aquí» y no lo toca.

## Si algo falla en vivo
| Síntoma | Qué mirar | Arreglo |
|---|---|---|
| El encabezado dice «Nivel 1» y esperabas Nivel 2 | `curl -s https://tu-nombre.ngrok-free.app/listo` | ¿sigue abierta la terminal de ngrok? Si no, vuélvela a lanzar: el dominio es el mismo, no hay que tocar nada más |
| `/listo` por el dominio responde, pero la app no | `node scripts/verificar.mjs` | mira «Cadena de IA»: si falla, el secret no apunta al dominio → `./scripts/tunel.sh --forzar` |
| `tunel.sh` dice «sirve X y el árbol está en Y» | el contenedor es de una versión vieja | `./scripts/ia-arrancar.sh` |
| El contenedor no responde | `docker logs cuervo-pass-ai-service-1` | `./scripts/ia-arrancar.sh` |
| La laptop se durmió | suspensión automática | desactívala durante la demostración; al despertar, `ngrok` se reconecta solo |

## Lo que SIGUE siendo una limitación (dicho, no escondido)
- **Depende de tu laptop**: apagada, sin internet o suspendida, no hay Nivel 2. La app lo dice y funciona sin él.
- Sin `ANTHROPIC_API_KEY` el análisis del texto libre devuelve valores neutros (`horario_predominante` queda en «Variable»). **No afecta** el ranking ni la afinidad.
- La cuenta gratuita de ngrok tiene límite mensual de ancho de banda; las consultas de embeddings son diminutas (≈ 1.5 KB), así que no es un problema real.
- El camino a la verdadera autonomía sigue siendo alojar el contenedor en un servicio con URL fija (p. ej. un Hugging Face Space); no cambia nada de lo anterior más que el destino.
