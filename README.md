# ThreeKip

Aplicación Android de dibujo 3D con interfaz **Material Design 3** profesional,
construida con **Expo / React Native (SDK 52)** y un motor **Three.js** que corre
offline dentro de un `WebView` (sin servidor, sin internet).

La interfaz nativa expone todas las funciones del editor (dibujar, capas,
deshacer/rehacer, exportar PNG y modelos, cargar/guardar proyectos, Loft,
fusionar capas) **sin modificar el motor**.

## Identidad de la app

- **Nombre:** ThreeKip
- **Slug:** `threekip`
- **Package (Android):** `com.threekip.app`
- **Proyecto EAS:** `@mgh.example/threekip`

## Requisitos

- **Node.js** (compatible con Expo SDK 52)
- **npm**
- Cuenta de [Expo](https://expo.dev) para EAS Build (el APK se compila en la nube)

> No se necesita JDK ni Android SDK si usas EAS Build en la nube. Solo se
> requieren para compilación local.

## Compilar el APK con EAS Build (en la nube)

```bash
npm install                # instala dependencias
eas login                  # inicia sesión una sola vez
eas build --platform android --profile preview
```

El perfil `preview` de `eas.json` genera un **APK debug instalable directo**
(`buildType: apk`, `distribution: internal`). Al terminar obtienes una URL y un
código QR (en `eas build --platform android`) para descargar e instalar el `.apk`.

- Listar builds: `eas build:list --platform android`
- Ver detalles de un build: `eas build:view <id>`

## Scripts disponibles

| Script                  | Descripción                                          |
|-------------------------|------------------------------------------------------|
| `npm start`             | Servidor de desarrollo Expo                         |
| `npm run android`       | Compila y ejecuta en dispositivo/emulador           |
| `npm run android:prebuild` | `expo prebuild` + copia de assets del motor       |
| `npm run android:apk-debug` | Genera el APK de debug (embed + motor + gradle)   |
| `npm run copy-engine-assets` | Copia manual del motor a Android                |
| `npm run lint`          | Lint del proyecto                                    |
| `npm run typecheck`     | `tsc --noEmit`                                       |

> `npm run android:prebuild` y `npm run android:apk-debug` requieren **JDK 17 y
> Android SDK** locales. Para obtener un APK sin esos requisitos, usa EAS Build.

## Estructura

- `app/` — código React Native (UI nativa MD3, puente con el motor)
- `assets/engine/` — fuente del motor 3D (Three.js) que se embebe en Android
- `android/` — proyecto nativo Android (generado por Expo/prebuild; ignorado en Git)
- `scripts/` — utilidades de build (bundle del motor, copia de assets)
- `plugins/` — plugin Expo de assets del motor
- `eas.json` — configuración de builds de EAS

## Notas

- El motor 3D es un asset externo embebido; **no se edita** como parte de la app.
- `android/`, `ios/`, `node_modules/` y `local.properties` están ignorados en Git
  y se regeneran al compilar. **EAS generará las carpetas nativas en la nube**
  a partir de `app.json` (no se deben versionar).
- Solo se usa un lock file: `package-lock.json` (EAS infiere el gestor de
  paquetes de él; no subas `bun.lock` ni `yarn.lock`).
