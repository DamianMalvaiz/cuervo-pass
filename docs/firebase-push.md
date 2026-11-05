# Notificaciones push en Android (Firebase) · Cuervo 360

**Por qué.** En Android, Expo entrega las notificaciones con Firebase Cloud Messaging (FCM). Sin `google-services.json` dentro del APK, `getExpoPushTokenAsync` falla con
«Default FirebaseApp is not initialized» y ningún aviso llega como notificación (así salió en el panel, en «Salud de la app»). Nunca bloquea nada: la app sigue funcionando, solo sin push.
Verificado el 23/10/2026 contra la guía de Expo: <https://docs.expo.dev/push-notifications/fcm-credentials/>.

## Dos archivos distintos, con riesgos distintos

| Archivo | Qué es | Dónde va |
|---|---|---|
| `google-services.json` | Identifica la app ante Firebase. Lleva claves de API que **`gitleaks` (job `secretos` del CI) marca por su forma**. | **Variable de EAS de tipo archivo** (`GOOGLE_SERVICES_JSON`). Para compilar en local, en la raíz, **ignorado por git**. |
| Clave de la **cuenta de servicio** (`…-firebase-adminsdk-….json`) | **SECRETO.** Permite enviar notificaciones en nombre del proyecto. | **Solo a EAS** (expo.dev → Credentials). Nunca al repositorio ni a un chat. |

`.gitignore` ya ignora `google-services.json`, `*-firebase-adminsdk-*.json` y `*service-account*.json`.

## Pasos

### A · Firebase (<https://console.firebase.google.com>)
1. **Agregar proyecto** (nombre libre, p. ej. «Cuervo 360»). Google Analytics se puede dejar apagado.
2. En el proyecto, **Agregar app → Android**. El **nombre de paquete debe ser exactamente `mx.cuervopass.app`** (es el de `app.json`). El SHA-1 no hace falta. **Registrar app** y **descargar `google-services.json`**; el resto del asistente se puede saltar.
3. **Configuración del proyecto** (engranaje) → pestaña **Cuentas de servicio** → **Generar nueva clave privada**. Se descarga un JSON: es el secreto.

### B · Subir la clave de la cuenta de servicio a EAS
En <https://expo.dev> → el proyecto `cuervo-pass` → **Project settings → Credentials** → la app Android `mx.cuervopass.app` → **Service credentials → FCM V1 service account key → Upload new key**, y elegir el JSON del paso A.3.
(Alternativa por terminal: `npx eas-cli credentials` → Android → *Google Service Account* → *Manage your Google Service Account Key for Push Notifications (FCM V1)* → *Upload a new service account key*.)

### C · Comprobar `google-services.json` ANTES de gastar un build
Dejarlo en la raíz del proyecto (está ignorado por git) y correr:
```bash
node scripts/verificar-google-services.mjs
```
Debe decir `OK: proyecto «…», paquete «mx.cuervopass.app».` Si el paquete no coincide, lo dice; es el fallo más común y de otro modo se descubre tras esperar un build entero. **El verificador nunca imprime una clave.**

### D · Subir `google-services.json` a EAS como variable de tipo archivo
```bash
npx eas-cli env:set --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment preview --environment production
```
`app.config.js` usa esa variable cuando existe (`android.googleServicesFile`) y, si no, el archivo local. **Si no hay ninguno, la compilación NO se detiene, pero avisa a gritos** de que el push no funcionará.

### E · Compilar el APK
El `google-services.json` se incrusta en el APK, así que **hace falta un build nuevo** (la clave del paso B vive en el servidor de Expo y no requiere build). Conviene juntar este build con los demás cambios pendientes:
```bash
npx eas-cli build --platform android --profile preview
```

## Cómo se sabe que funcionó
1. Instalar el APK nuevo e iniciar sesión (pide el permiso de notificaciones).
2. En el panel, **Salud de la app**: no debe aparecer un grupo NUEVO de «registrarTokenPush falló». El grupo viejo sigue ahí hasta que se borre; conviene **borrarlo** y ver si reaparece.
3. La cuenta debe tener una fila en `push_tokens` (`select usuario_id, actualizado_en from push_tokens;`, solo lectura).
4. Prueba real: aprobar una verificación desde el panel; quien la envió debe recibir «Verificación aprobada». (La guía de Expo también tiene una herramienta de envío manual: <https://expo.dev/notifications>.)

## Si algo sale mal
- **`403 PERMISSION_DENIED` de Firebase Installations:** pasa si la clave de API del archivo está restringida. En Google Cloud Console hay que permitir *FCM Registration API* y *Firebase Installations API*, o dejarla sin restricción.
- **«No matching client found for package name»** al compilar: el paquete del archivo no es `mx.cuervopass.app` (el verificador del paso C lo atrapa antes).
- **El token se pide pero no llega nada:** falta subir la clave de la cuenta de servicio (paso B).
