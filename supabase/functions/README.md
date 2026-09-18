# Edge Functions

Corren en **Deno**, no en el bundle de la app: por eso `supabase/functions` está
excluido de `tsconfig.json`. Con las globales de Node/React Native en contexto,
`Deno.env` y los imports `jsr:` se reportan como errores que no lo son.

Se verifican con `supabase functions serve` y se despliegan con
`supabase functions deploy <nombre>`.

| Función | Para qué | Documento maestro |
|---|---|---|
| `ai-proxy` | Único camino hacia el microservicio de IA: valida la sesión, aplica la cuota diaria en Postgres y agrega el token compartido | §24 |
| `geocodificar` | Geocodificación con Nominatim/OSM desde el servidor, con caché de direcciones normalizadas | §9 · AUD-02 |
| `eliminar-cuenta` | Derecho de cancelación (ARCO): borra la cuenta de Auth y, en cascada, todo lo demás | §29 |

Secrets que necesitan (no viven en ningún archivo del repositorio):

```bash
supabase secrets set AI_SERVICE_URL=https://tu-tunel.trycloudflare.com
supabase secrets set AI_SHARED_TOKEN=$(openssl rand -hex 32)
supabase secrets set NOMINATIM_CONTACTO=tu-correo@ejemplo.mx
```
