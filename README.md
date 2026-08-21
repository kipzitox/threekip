# ThreeKip

Aplicación Android de dibujo 3D con interfaz **Material Design 3** profesional,
construida con **Expo / React Native** y un motor **Three.js** que corre offline
dentro de un `WebView` (sin servidor, sin internet).

La interfaz nativa expone todas las funciones del editor (dibujar, capas,
deshacer/rehacer, exportar PNG y modelos, cargar/guardar proyectos, Loft,
fusionar capas) **sin modificar el motor**.

## Requisitos (entorno de desarrollo)

- Node.js (versión compatible con Expo SDK 51)
- JDK 17
- Android SDK + variable de entorno `ANDROID_HOME`
- `npm`

## Puesta en marcha en un nuevo dispositivo

```powershell
git clone https://github.com/kipzitox/threekip.git
cd threekip
npm install
npm run android:prebuild      # genera local.properties y el proyecto nativo (1 vez)
npm run android:apk-debug     # reconstruye el motor, el bundle y compila el APK
```

> El script `android:apk-debug` ejecuta `expo export:embed` (genera
> `index.android.bundle` y los assets) y `copy-engine-assets.mjs` (copia
> `assets/engine/` → `android/app/src/main/assets/engine/`). Todo lo generado
> está en `.gitignore`; el repo solo contiene el código fuente.

## Scripts disponibles

| Script                  | Descripción                                          |
|-------------------------|------------------------------------------------------|
| `npm start`             | Servidor de desarrollo Expo                         |
| `npm run android`       | Compila y ejecuta en dispositivo/emulador           |
| `npm run android:prebuild` | `expo prebuild` + copia de assets del motor       |
| `npm run android:apk-debug` | Genera el APK de debug (embed + motor + gradle)  |
| `npm run android:build` | APK de release                                        |
| `npm run copy-engine-assets` | Copia manual del motor a Android                |
| `npm run lint`          | Lint del proyecto                                    |
| `npm run typecheck`     | `tsc --noEmit`                                       |

## Estructura

- `app/` — código React Native (UI nativa MD3, puente con el motor)
- `assets/engine/` — fuente del motor 3D (Three.js) que se embebe en Android
- `android/` — proyecto nativo Android (generado por Expo)
- `scripts/` — utilidades de build (bundle del motor, copia de assets)
- `plugins/` — plugin Expo de assets del motor

## Notas

- El motor 3D es un asset externo embebido; **no se edita** como parte de la app.
- `android/app/src/main/assets/`, `node_modules/`, `build/` y `local.properties`
  están ignorados en Git y se regeneran al compilar.
