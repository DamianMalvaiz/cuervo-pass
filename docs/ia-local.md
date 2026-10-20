# La IA corriendo en tu laptop · guía de operación

Decisión (18/10/2026): el servicio de IA corre **local** y se expone con un **dominio estable**. Desde el **19/10/2026** ese dominio es propio: **`ia.cuervo360.com`**,
por un túnel con nombre de Cloudflare. Esto NO lo hace autónomo —sigue dependiendo de que tu laptop esté encendida y con internet—, pero elimina lo que de verdad
fallaba: el túnel rápido de Cloudflare cambia de dominio en cada arranque y su DNS llegó a tardar **más de media hora**. Si la laptop se apaga o el túnel cae, la app
baja a **Nivel 1** (sin afinidad semántica) y lo dice en pantalla; no se rompe.

## Opciones (la elegida es la primera)
| Opción | Dominio estable | Necesita | Riesgo |
|---|---|---|---|
| **Cloudflare, túnel con nombre en `ia.cuervo360.com`** ← elegida | sí, propio | el dominio en Cloudflare; `cloudflared` (ya instalado) | depende de la laptop |
| ngrok (cuenta gratis, 1 dominio estático) | sí | una cuenta; un binario sin `sudo` | página intermedia en navegadores (el proxy manda `ngrok-skip-browser-warning`) |
| Tailscale Funnel | sí | cuenta; instalar un servicio con `sudo` | toca la red de la laptop |
| Cloudflare túnel rápido (lo que había) | **no** | nada | DNS de hasta 30+ min al cambiar |

## Configuración del túnel con nombre, UNA sola vez
Las cuatro primeras las corres tú (`!` delante, en el prompt de Claude Code): abren tu navegador o crean credenciales **que no pasan por mí ni se versionan**.

1. `cloudflared tunnel login` — abre el navegador; elige **cuervo360.com**. Deja `~/.cloudflared/cert.pem`.
2. `cloudflared tunnel create cuervo-ia` — imprime un **UUID** y crea `~/.cloudflared/<UUID>.json` (la credencial del túnel).
3. `cloudflared tunnel route dns cuervo-ia ia.cuervo360.com` — crea el registro DNS (un CNAME) en Cloudflare.
4. `cp scripts/cloudflared/config.yml.ejemplo ~/.cloudflared/config.yml` y reemplaza `<UUID>` por el del paso 2 (dos sitios).
5. Instala el servicio de usuario (sin root; reinicia el túnel si cae):
   ```bash
   mkdir -p ~/.config/systemd/user && cp scripts/cloudflared/cloudflared-ia.service ~/.config/systemd/user/
   systemctl --user daemon-reload && systemctl --user enable --now cloudflared-ia
   loginctl enable-linger "$USER"
   ```
6. En `.env.server` (no se versiona): `AI_SERVICE_URL_FIJA=https://ia.cuervo360.com`
7. Redespliega el proxy una vez: `npx supabase functions deploy ai-proxy`
8. `./scripts/tunel.sh` — comprueba que responde por el camino público y fija el secret `AI_SERVICE_URL` (solo la primera vez).

El túnel solo expone el puerto 8000 del microservicio (el resto da 404) y el microservicio exige el token compartido (`AI_SHARED_TOKEN`) y limita las peticiones.

## Cada vez que vayas a exponer la app (30 min antes)
```bash
./scripts/ia-arrancar.sh                       # reconstruye el contenedor con el commit del árbol y espera a que cargue el modelo
systemctl --user is-active cloudflared-ia      # debe decir «active»; si no: systemctl --user restart cloudflared-ia
./scripts/tunel.sh                             # comprueba que responde por el camino público y fija el secret SOLO si cambió
node scripts/verificar.mjs                     # debe salir sin ✗ (la clave de Anthropic y Google Maps son avisos)
```
El secret `AI_SERVICE_URL` se fija **la primera vez**; mientras el dominio sea el mismo, `tunel.sh` dice «el secret ya apunta aquí» y no lo toca.

## Si algo falla en vivo
| Síntoma | Qué mirar | Arreglo |
|---|---|---|
| El encabezado dice «Nivel 1» y esperabas Nivel 2 | `curl -s https://ia.cuervo360.com/listo` | `systemctl --user restart cloudflared-ia`; el dominio es el mismo, no hay que tocar nada más |
| `/listo` por el dominio responde, pero la app no | `node scripts/verificar.mjs` | mira «Cadena de IA»: si falla, el secret no apunta al dominio → `./scripts/tunel.sh --forzar` |
| `tunel.sh` dice «sirve X y el árbol está en Y» | el contenedor es de una versión vieja | `./scripts/ia-arrancar.sh` |
| El contenedor no responde | `docker logs cuervo-pass-ai-service-1` | `./scripts/ia-arrancar.sh` |
| El servicio del túnel no arranca | `journalctl --user -u cloudflared-ia -n 30` | ¿el `<UUID>` de `config.yml` es el del paso 2? ¿existe `~/.cloudflared/<UUID>.json`? |
| La laptop se durmió | suspensión automática | desactívala durante la demostración; al despertar, el servicio se reconecta solo |

## Si prefieres ngrok (la opción anterior)
1. Cuenta en ngrok.com; en *Domains* reclama tu dominio estático gratuito. 2. `ngrok config add-authtoken <tu-token>` (**no lo compartas ni lo escribas en el repositorio**).
3. `.env.server`: `AI_SERVICE_URL_FIJA=https://tu-nombre.ngrok-free.app`. 4. `npx supabase functions deploy ai-proxy`. 5. En otra terminal: `ngrok http --url=tu-nombre.ngrok-free.app 8000`, y `./scripts/tunel.sh`.

## Lo que SIGUE siendo una limitación (dicho, no escondido)
- **Depende de tu laptop**: apagada, sin internet o suspendida, no hay Nivel 2. La app lo dice y funciona sin él.
- Sin `ANTHROPIC_API_KEY` el análisis del texto libre devuelve valores neutros (`horario_predominante` queda en «Variable»). **No afecta** el ranking ni la afinidad.
- La cuenta gratuita de ngrok tiene límite mensual de ancho de banda; las consultas de embeddings son diminutas (≈ 1.5 KB), así que no es un problema real.
- El camino a la verdadera autonomía sigue siendo alojar el contenedor en un servicio con URL fija (p. ej. un Hugging Face Space); no cambia nada de lo anterior más que el destino.
