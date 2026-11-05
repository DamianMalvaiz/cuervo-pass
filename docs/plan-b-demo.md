# Plan B de la demostración · qué hacer si algo falla en vivo

Complementa `docs/guion-demo.md`. Escrito el 03/11/2026. **Regla de oro:** si algo falla, se **dice** («esto depende de X y hoy no responde»), se pasa al plan B de la tabla y se sigue. No se improvisa ni se insiste más de una vez.

## 0 · Antes de entrar a la sala (10 min)

| ✓ | Qué | Cómo |
|---|---|---|
| [ ] | Capturas de respaldo de **cada paso** del guion, tomadas en el ensayo | `node scripts/capturas-demo.mjs` crea `~/demo-capturas/` (fuera del repo) con un LEEME de nombres; `… --revisar` dice qué falta. Imágenes en orden: Para ti, ficha, Comparar, Cerca, Guardados→Búsquedas, perfil de roomie, panel del vendedor, vista previa de negocio, vista previa de menú, chat |
| [ ] | Una grabación corta de pantalla (1–2 min) del recorrido completo | Para el caso de **sin internet** |
| [ ] | Hotspot del teléfono probado con la laptop | La laptop conecta a internet por el teléfono en menos de 1 min |
| [ ] | Laptop **sin suspensión automática** y cargando | Una laptop que se duerme corta el túnel de la IA |
| [ ] | Dos ventanas con sesión ya iniciada | Estudiante (normal) y vendedor (privada), cada una en su pantalla de inicio |
| [ ] | Una pestaña con `cuervo360.com/ayuda` abierta | Para cuando quieras enseñar algo estático sin riesgo |

## 1 · Tabla de fallos

| Si pasa… | Cómo lo reconoces | Haz esto (≤ 1 min) | Qué decir |
|---|---|---|---|
| **No hay internet en la sala** | La web no carga | Hotspot del teléfono. Si tampoco: grabación de pantalla + capturas | «El sistema vive en la nube; sin red enseño el recorrido grabado y puedo responder con el código y las pruebas» |
| **Cae `ia.cuervo360.com`** (túnel o laptop) | En la app el encabezado dice «Nivel 1» (según `docs/ia-local.md`); **en la web no se ha comprobado qué se ve** (sin verificar: míralo en el ensayo apagando el túnel). La lista sigue funcionando, sin afinidad semántica | `systemctl --user restart cloudflared-ia`; si no vuelve, seguir sin ella | «La IA corre en mi máquina; cuando no responde la app baja a Nivel 1 y lo dice. Es un requisito de diseño: no se rompe» |
| **El microservicio de IA no responde** | `curl -s http://127.0.0.1:8000/listo` falla | `./scripts/ia-arrancar.sh` (~30 s) y mientras tanto pasar al paso siguiente | Igual que arriba |
| **La clave de Anthropic no está** | `verificar.mjs` en amarillo «Análisis con LLM» | Nada: no afecta ranking ni afinidad | «El texto libre se analiza con un modelo externo; sin la clave el campo `horario` queda en “Variable”» |
| **Supabase tarda o falla** (listas con «No pudimos cargar…») | Aparece el estado de fallo con «Reintentar» | Tocar **Reintentar** una vez. Si sigue, pasar a capturas de ese paso | «La app distingue “falló la red” de “no hay datos”: no te dice que no hay nada cuando en realidad falló» |
| **Node/scripts no llegan a Supabase** (solo en la laptop) | `fetch failed` al correr un script | Anteponer `NODE_OPTIONS=--dns-result-order=ipv4first` (IPv6 hacia `supabase.co` está colgado en esta red). El navegador y el teléfono no se ven afectados | — (es de la laptop, no del sistema) |
| **La verificación no aparece para aprobar** | `revisar-verificaciones.mjs` dice «No hay verificaciones pendientes» | Comprobar que el vendedor sí envió («En revisión»). Si hubo error de subida: usar la cuenta **`demo.comerciante`** (ya verificada) para el resto | «Esta cuenta ya pasó por el mismo proceso; se enseña lo que sigue» |
| **El pago de Mercado Pago no abre o no confirma** | La pestaña queda en blanco o el plan no cambia tras unos segundos | **No insistir.** Usar «Empezar prueba gratis» (interno, no pasa por Mercado Pago). Si ya enseñaste el diálogo con el monto y OXXO, basta | «Los pagos están en modo de pruebas de Mercado Pago y dependen de su servicio y del aviso (webhook) que activa el plan; la prueba gratis es nuestra» |
| **El navegador bloquea la pestaña de Mercado Pago** | No se abre nada | Permitir ventanas emergentes para `cuervo360.com` y repetir una vez; o saltarlo | — |
| **Una pantalla de la web se ve rota** | Texto cortado o cajas fuera de lugar | Recarga dura (`Ctrl+Shift+R`); si sigue, ver la captura de ese paso | «Eso lo anoto como pendiente» (y de verdad se anota) |
| **La web sirve una versión mala** | Algo que ayer funcionaba ya no | `npx wrangler rollback` desde `~/cuervo-pass` (vuelve al despliegue anterior) | — |
| **Chat: el mensaje no llega** | La otra ventana no lo recibe | Recargar la ventana receptora; el mensaje queda guardado aunque no se muestre en vivo | «El tiempo real usa un canal que depende de la red; el mensaje no se pierde» |
| **Te preguntan algo que no está construido** | — | Responder con el cuadro «Si preguntan por…» del guion; si no está ahí, «no lo tengo; está en la lista de pendientes» | La verdad |

## 2 · Árbol de decisión rápido

1. ¿Se ve la pantalla? **Sí** → sigue. **No** → recarga dura una vez.
2. ¿Sigue mal? → dilo en una frase y abre la captura del paso. No arregles en vivo.
3. ¿Falló algo de **red externa** (IA, Mercado Pago, internet)? → pasa al paso estático o interno más cercano (Ayuda, Acuerdos, Comparar, Guardados, prueba gratis).
4. ¿Falló dos veces seguidas? → pasa a la **grabación** y cuéntalo mientras corre.

## 3 · Pasos que NO dependen de nadie externo (úsalos de colchón)

Todos viven en el navegador o en la base de datos, sin la IA ni Mercado Pago:

- `/ayuda`, `/guia-de-visita`, `/contrato`, `/acuerdos`, `/presupuesto`
- **Comparar** (se guarda en el navegador) y **Vistos recientemente**
- **Guardados → Búsquedas** (cuenta)
- **Cerca de aquí** (usa solo las coordenadas aproximadas públicas)
- El **Panel** del vendedor y las **vistas previas** de publicación, negocio y menú

## 4 · Lo que dices si te piden «¿y si se cae?»

«La app está diseñada para degradar y decirlo: sin la IA baja a Nivel 1, sin red muestra un estado de fallo con reintento (no un “no hay datos” falso), y las pruebas lo fijan: **3458** de interfaz y servicios, **844** aserciones de base de datos, y **22 barreras** de aislamiento comprobadas contra producción con sesiones reales.»

## 5 · Después de la demo

- `preparar-demo.mjs --limpiar --aplicar` y `rm -rf respaldos/*`.
- Apuntar qué falló en vivo en `docs/bitacora-semanal.md`, con la hora y si el plan B funcionó.
