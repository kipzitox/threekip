<div align="center">

# 🎨 ThreeKip

**Aplicación de dibujo 3D profesional con Material Design 3**

*Construida con Expo + React Native + Three.js · 100% offline · APK instalable*

[![Expo SDK](https://img.shields.io/badge/Expo_SDK-52-000020?style=flat&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?style=flat&logo=react)](https://reactnative.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r155-000000?style=flat&logo=three.js)](https://threejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat&logo=typescript)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

</div>

---

## ✨ ¿Qué es ThreeKip?

ThreeKip es una **aplicación nativa Android de dibujo y modelado 3D** que te permite crear bocetos, superficies (Loft) y modelos tridimensionales con una interfaz **Material Design 3** pulida y profesional.

> **La clave:** todo el motor 3D (Three.js) corre **100% offline** dentro de un `WebView` — sin servidores, sin internet, sin latencia. La interfaz nativa (React Native / Expo) expone cada función del editor con un diseño nativo MD3, sin tocar el motor.

---

## 🎯 Características principales

| Característica | Descripción |
|----------------|-------------|
| 🎨 **Dibujo 3D libre** | Trazos, goma, selección, panorámica y órbita en 3D |
| 📐 **Superficies Loft** | Crea superficies entre curvas (`Crear Loft`) |
| 🧱 **Gestión de capas** | Múltiples capas + fusión (`Fusionar capa 0/1/2`) |
| ↩️ **Historial completo** | Deshacer / Rehacer ilimitado |
| 💾 **Proyectos locales** | Guardar / Cargar / Importar / Exportar JSON |
| 🖼️ **Exportación** | PNG (imagen) · GLB / OBJ / USD / USDZ / JSON (modelos 3D) |
| 🌑 **Tema oscuro/claro** | Material Design 3 completo (MD3 tokens) |
| 📱 **100% Offline** | Sin servidores, sin cuentas, sin telemetría |
| 🌐 **Versión Web** | [ThreeKip Web](https://kipzitox.github.io/threekip/) — mismo motor en el navegador |

---

## 📱 Capturas (concepto)

<div align="center">

| Escritorio (Library) | Editor 3D | Exportación |
|:---:|:---:|:---:|
| ![Library](assets/screenshots/library.png) | ![Editor](assets/screenshots/editor.png) | ![Export](assets/screenshots/export.png) |
| *Gestor de proyectos con filtros, búsqueda y grid* | *Canvas 3D + barra MD3 nativa* | *PNG / GLB / OBJ / USDZ* |

</div>

> *Añade capturas reales en `assets/screenshots/` para mostrar la app en acción.*

---

## 🚀 Inicio rápido

### Opción A: Web (sin instalar nada)
Abre **[threekip-web](https://kipzitox.github.io/threekip/)** en tu navegador.

### Opción B: App nativa Android (APK)

**Con EAS Build (nube, sin JDK/SDK local):**
```bash
npm install
eas login
eas build --platform android --profile preview
# → Descarga el APK desde la URL / QR que te da EAS
```

**Compilación local (requiere JDK 17 + Android SDK):**
```bash
npm install
npm run android:prebuild   # genera carpetas nativas + copia motor
npm run android:apk-debug  # compila APK debug (android/app/build/outputs/apk/debug/app-debug.apk)
```

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    ThreeKip App (React Native)              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Native UI (MD3, React Native)              │   │
│  │  Library · Editor · Settings · Export · History     │   │
│  └───────────────────────────┬────────────────────────┘   │
│                               │ Bridge (postMessage)       │
│  ┌───────────────────────────▼────────────────────────┐   │
│  │              WebView (engine)                       │   │
│  │  Three.js Engine (assets/engine)  →  Canvas 3D    │   │
│  │  · Bridge: loadProject / saveProject / export      │   │
│  │  · Commands: setTool, undo, redo, setCamera, etc.  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

- **App shell:** React Native / Expo Router / MD3 / Zustand
- **Motor 3D:** Three.js (offline) en `assets/engine/` → embebido como asset en Android
- **Comunicación:** Bridge bidireccional (`postMessage` ↔ `SketchbookBridge`)

---

## 📁 Estructura del repo

```
threeKip/
├── app/                    # React Native (Expo Router)
│   ├── (tabs)/             # Library, Editor, Settings, About
│   ├── ui/                 # MD3 primitives, EditorUI, ExportDialog
│   ├── stores/             # Zustand (Project, UI, Settings)
│   └── services/           # Bridge, storage, engineLoader
├── assets/engine/          # Motor Three.js (fuente)
│   ├── index.html          # Entry point del motor
│   ├── js/                 # Three.js + SDK (Bridge, commands)
│   └── styles/             # MD3 tokens (CSS variables)
├── scripts/                # Build utilities
│   ├── copy-engine-assets.mjs
│   └── bundle-engine.mjs
├── plugins/                # Expo config plugin (engine assets)
├── docs/                   # GitHub Pages (sitio estático)
│   ├── index.html          # Web desktop
│   ├── web/                # Shell web (desktop.js + css)
│   └── engine/             # Copia del motor para web
├── eas.json                # Config EAS Build
├── app.json                # Config Expo
└── server.ts               # Dev server (Express + tsx)
```

---

## 🛠️ Scripts útiles

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor web dev (`localhost:3000`) |
| `npm start` | Expo dev server |
| `npm run android:prebuild` | `expo prebuild` + copia engine a Android |
| `npm run android:apk-debug` | APK debug local (requiere JDK+SDK) |
| `npm run lint` / `npm run typecheck` | Calidad de código |
| `npm run build` | Build web (`dist-web/`) + server bundle |

---

## 🔐 Seguridad y privacidad

- **Cero telemetría** · **Cero red** · **Cero cuentas**
- Los proyectos se guardan **localmente** en el dispositivo (`expo-file-system`)
- Exportación de modelos usa `blob:` URLs temporales (revocadas al instante)
- Repo público sin secretos: `.env.example` vacío, `package-lock.json` único lockfile

---

## 🤝 Contribuir

1. Fork → rama `feature/mi-mejora`
2. `npm run typecheck && npm run lint`
3. PR con descripción clara

---

## 📄 Licencia

MIT — libre para uso personal y comercial.

---

<div align="center">

**Hecho con ❤️ usando Expo, React Native y Three.js**

[🌐 Web Demo](https://kipzitox.github.io/threekip/) · [📦 APK (EAS)](https://expo.dev/accounts/mgh.example/projects/threekip/builds) · [🐛 Issues](https://github.com/kipzitox/threekip/issues)

</div>