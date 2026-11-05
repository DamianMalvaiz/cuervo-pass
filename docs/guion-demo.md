# Guion de la demostración en vivo · Cuervo 360

Actualizado el 03/11/2026 (la versión anterior hablaba de pagos «simulados» y de un aviso de privacidad v2: ya no es cierto; ver «Qué cambió»). Un solo recorrido, unos 15 minutos.

**Regla:** lo que no se vio funcionando ese mismo día **no se enseña**: se dice que está pendiente. Un ✓ que no se vio es lo que más cuesta en una evaluación. Si algo falla, abre `docs/plan-b-demo.md`.

## Qué cambió desde el guion anterior

| Tema | Antes | Ahora (verificado) |
|---|---|---|
| Superficie | Solo la app en teléfonos | **La web `cuervo360.com`** (estudiante, vendedor, páginas públicas) **y la app** |
| Pagos | «Simulados con `demo_mode`; no hay pasarela» | **Mercado Pago en modo de pruebas** (`crear-pago` y `mp-webhook` desplegados; los secretos `MP_*` existen en producción). La app ya no llama a `simular_pago` |
| Aviso de privacidad | v2, «no menciona la INE» | Vigente v5: la INE se menciona y dice que una verificación con rostro se avisaría aparte |
| Seguridad | pgTAP | pgTAP **844** aserciones + `prueba-rls.mjs` contra producción **22 de 22** barreras (03/11/2026) |
| Pruebas | — | **3458** pruebas de Jest en verde |

## Antes (la víspera y una hora antes)

| # | Qué | Comando o acción |
|---|---|---|
| 1 | Los servicios | Supabase local no hace falta para la demo (usa producción). Sí: IA y túnel → `./scripts/ia-arrancar.sh`, `systemctl --user is-active cloudflared-ia` (debe decir `active`), `./scripts/tunel.sh` |
| 2 | Comprobación general | `NODE_OPTIONS=--dns-result-order=ipv4first node scripts/verificar.mjs` → **sin ✗** (el prefijo evita que Node se cuelgue por IPv6 hacia Supabase en esta laptop) |
| 3 | La clave de IA | `ANTHROPIC_API_KEY` en `ai-service/.env` y reiniciar. Sin ella el aviso «Análisis con LLM» queda en amarillo (solo se pierde `horario_predominante`; el ranking y la afinidad no dependen de ella) |
| 4 | Barreras de seguridad | `NODE_OPTIONS=--dns-result-order=ipv4first node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs` → «22 de 22 barreras aguantaron» |
| 5 | Cuentas de demostración | `node --env-file=.env --env-file=.env.server scripts/preparar-demo.mjs` (lee el plan) y luego con `--aplicar`. La contraseña la imprime el script |
| 6 | Imágenes de MUESTRA para la verificación | `python3 scripts/generar-muestras-demo.py` → `demo-material/*.jpg` (**nunca** una INE verdadera) |
| 7 | Vectores de afinidad de las cuentas nuevas | `node --env-file=.env --env-file=.env.server --env-file=ai-service/.env scripts/backfill-embeddings.mjs` |
| 8 | Despliegue al día | `cuervo360.com/ayuda` carga (versión nueva) y `cuervo360.com/ruta-inventada` dice «No encontramos esa página» |
| 9 | Navegador listo | Chrome o Firefox a 100 % de zoom, ventana ancha (≥1200 px), **modo claro**, extensiones de bloqueo apagadas (ensucian la consola), una ventana normal (estudiante) y una **privada** (vendedor) |
| 10 | Teléfono con el APK nuevo (opcional) | Una sola compilación con todo (ver `docs/prueba-en-dispositivo.md`); si no hay APK nuevo, la demo es solo web |
| 11 | Sesiones reales cerradas | Nunca registres una cuenta real delante de quien evalúa |
| 12 | Pagos | Tarjeta o método de **prueba** de Mercado Pago a la mano (los de su documentación). **No** uses una tarjeta real |

Después de la demo: `preparar-demo.mjs --limpiar --aplicar` (quita las tres cuentas y lo suyo) y `rm -rf respaldos/*`.

## Quién es quién

| Pantalla | Cuenta | Para qué |
|---|---|---|
| Ventana normal (o laptop) | `demo.estudiante@cuervopass-demo.test` | Quien busca |
| Ventana privada (o teléfono) | `demo.vendedor@cuervopass-demo.test` | Comerciante **sin verificar**: se verifica en vivo |
| Respaldo | `demo.comerciante@cuervopass-demo.test` | Comerciante **ya verificada** con su negocio: si no hay tiempo de verificar |

## Recorrido (≈15 min)

### 1 · Sin cuenta y entrada (1 min)
1. `cuervo360.com` → **Departamentos**: lugares con zona (no calle) y precio. *Decir:* sin cuenta solo se ve la zona; la dirección exacta se muestra al iniciar sesión.
2. **Iniciar sesión** como estudiante.

### 2 · «Para ti» (3 min)
1. El saludo y las tres cifras (lugares que encajan, mensajes sin leer, guardados): son cuentas reales; si una no se pudo leer dice «—», nunca un 0 falso.
2. El **destacado grande** con «Compatible contigo» y **una sola razón que sí se cumple** (p. ej. «Está dentro de tu presupuesto»). *Decir:* el ajuste se dice en palabras y solo cuando pasa de 0.5; por debajo se calla, no dice «poco compatible».
3. Abrir una ficha: dirección exacta, «Por qué podría encajar contigo» con tu ajuste, barra de anclas que se queda arriba.
4. **Comparar** (agregar dos lugares) → «Ver comparación (2)»: tabla lado a lado; solo marca «Más barato», no dice cuál «conviene».

### 3 · Buscar con criterio (2 min)
1. **Departamentos** → chip **«Cerca de tu universidad»**: «a menos de 1 km · ~6 min a pie». *Decir:* las ubicaciones públicas se redondean a ~1 km, por eso la distancia es aproximada y los tiempos son estimaciones en línea recta; lo dice la pantalla.
2. Pon filtros → **«Guardar esta búsqueda»** → **Guardados → Búsquedas**: se vuelve a aplicar con un toque. *Decir:* son privadas de la cuenta, con tope de 20, y entran en el derecho de acceso a los datos.
3. (Opcional) `/presupuesto`: «¿Qué alcanza con tu presupuesto?», con las rentas reales de hoy.

### 4 · Roomies (2 min)
1. **Roomies**: cada tarjeta dice su compatibilidad y **por qué** (reglas sobre ruido, tabaco, horario, mascotas); lo que alguien no declaró **se ignora**, no cuenta en su contra.
2. Abrir el **perfil de un roomie**: afinidad en palabras; sin presupuesto ni universidad (la vista pública no los da). Una persona sin ficha de roomie dice «Sin datos para comparar», no «baja».
3. **Iniciar chat** (se usa en el paso 7).

### 5 · El vendedor se verifica (4 min)
1. En la **ventana privada**, entrar como vendedor → **Mi panel**: tarjeta «Verifica tu identidad para publicar».
2. Empezar verificación: nombre, dirección, imágenes de MUESTRA (frente, reverso, local), consentimiento → «En revisión». *Mostrar* que «Lo que ofrezco» sigue bloqueado.
3. **En la laptop (el admin):** `node --env-file=.env --env-file=.env.server scripts/revisar-verificaciones.mjs` → aparece la solicitud con enlaces temporales (10 min). Luego `… --aprobar <usuario_id> comerciante`. *Decir:* la aprobación es **manual**; la comparación de rostro no está activa.
4. Recargar el panel: «Verificada» y empieza la **prueba gratis de 15 días**.

### 6 · Publicar con vista previa (2 min)
1. **Publicar → Nuevo negocio**: al escribir nombre, dirección y foto aparece **«Así se verá en Servicios»** a la derecha; la zona **no muestra calle ni número**.
2. **Menú del negocio** → agregar una sección y dos productos: **«Así se verá tu menú»** se arma al lado, aunque no se haya guardado.
3. **Planes**: «Empezar prueba gratis» (interno, no pasa por Mercado Pago). *Si hay tiempo y todo está probado:* «Pagar un plan» → diálogo con el monto y OXXO → pestaña de Mercado Pago en modo de pruebas.

### 7 · Chat en vivo y cierre (1 min)
1. El estudiante escribe al vendedor (o a un roomie desde su perfil); el mensaje llega a la otra ventana **sin recargar**.
2. **Configuración → Personalización**: la persona puede apagar el análisis con IA cuando quiera.

## Si preguntan por…

| Tema | Respuesta honesta |
|---|---|
| IA | Los embeddings de afinidad corren en **nuestro** microservicio (modelo multilingüe local), expuesto por `ia.cuervo360.com`; depende de que la laptop esté encendida y con internet. Sin él la app baja a Nivel 1 (sin afinidad) y **lo dice en pantalla**. El análisis del texto libre con LLM necesita `ANTHROPIC_API_KEY`: [ ] puesta / [x] pendiente (no puesta al 05/11/2026; el campo `horario` queda en «Variable») |
| Biometría | La comparación de rostro está construida, no activa: el aviso de privacidad dice que se avisaría aparte antes de usarla. La verificación hoy la aprueba una persona |
| Pagos | **Mercado Pago en modo de pruebas**; no se cobra dinero real. El plan se activa cuando llega el aviso del pago (unos segundos) |
| Mapa | No hay mapa embebido en la web: «Ver en el mapa» abre el mapa externo. Falta la clave de Google Maps |
| Aviso de privacidad | Vigente **v5**; menciona la INE y las transferencias (ninguna a terceros). Lo de Vistos y Comparar (se guardan solo en el navegador) **no** está en el aviso: decisión pendiente |
| Pesos del ranking | Decisiones de producto, no medidas con usuarios; se mueven con una migración y su prueba (`docs/algoritmos.md`) |
| «¿Son datos reales?» | Los negocios de ejemplo, las cuentas de roomies y las tres de la demo son **fabricados y rotulados** |
| Seguridad | pgTAP 844 aserciones, 22 barreras contra producción con sesiones reales, RLS en todas las tablas (la de búsquedas guardadas incluida) |

## Qué NO hacer ni enseñar

- Registrar una cuenta real, abrir `.env*` o `respaldos/`, enseñar una INE verdadera.
- «Eliminar mi cuenta» o «Borrar mi negocio» en las cuentas de la demo (solo se enseñaría el diálogo y se cancela).
- Pantallas que siguen con estilo de **app** en la web (editor de horario, editor de productos, hilo de chat de una conversación suelta): funcionan, pero no se ven como el resto.
- «Apariencia» (claro/oscuro a mano), «Compartir con la familia», «Agendar visita», «Traspaso de cuarto», «Plan de mudanza»: **no existen**.
- Afirmar algo de esta lista sin haberlo visto ese mismo día.
