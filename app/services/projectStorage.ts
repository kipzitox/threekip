import { Platform } from 'react-native';
import type { ProjectMeta, ProjectFile, ExportFile } from '../stores/ProjectStore';

// Must be Platform-only. React Native defines a global `window` (alias of
// `global`), so a `typeof window !== 'undefined'` test is also true on Android
// and iOS, which silently routed every storage call to the localStorage branch.
const isWeb = Platform.OS === 'web';

// Safe lazy accessor for native expo-file-system on Android / iOS only
function getNativeFS(): typeof import('expo-file-system') | null {
  if (isWeb) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-file-system');
  } catch (e) {
    console.warn('[projectStorage] FileSystem not available', e);
    return null;
  }
}

function getNativeSharing(): typeof import('expo-sharing') | null {
  if (isWeb) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-sharing');
  } catch {
    return null;
  }
}

// ──────────────── Web Storage Adapter (localStorage) ────────────────

const WEB_INDEX_KEY = 'threekip_projects_index';
const WEB_PROJ_PREFIX = 'threekip_proj_';
const WEB_EXPORTS_KEY = 'threekip_exports_index';

function getWebIndex(): ProjectMeta[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(WEB_INDEX_KEY);
      if (raw) return JSON.parse(raw) as ProjectMeta[];
    }
  } catch (e) {
    console.warn('[projectStorage] Failed to read web index', e);
  }
  return [];
}

function setWebIndex(list: ProjectMeta[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WEB_INDEX_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('[projectStorage] Failed to save web index', e);
  }
}

// ──────────────── Unified Storage Functions ────────────────

export async function ensureProjectsDir(): Promise<void> {
  if (isWeb) return;
  const FS = getNativeFS();
  if (!FS || !FS.documentDirectory) return;
  const dir = `${FS.documentDirectory}projects/`;
  try {
    const info = await FS.getInfoAsync(dir);
    if (!info.exists) {
      await FS.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch (e) {
    console.warn('[projectStorage] ensureProjectsDir error', e);
  }
}

export async function listProjectFiles(): Promise<ProjectMeta[]> {
  if (isWeb) {
    const metas = getWebIndex();
    return metas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  const FS = getNativeFS();
  if (!FS || !FS.documentDirectory) return [];
  const dir = `${FS.documentDirectory}projects/`;

  await ensureProjectsDir();
  try {
    const files = await FS.readDirectoryAsync(dir);
    const metas: ProjectMeta[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const parsed = JSON.parse(await FS.readAsStringAsync(dir + f)) as ProjectFile;
        if (!parsed?.meta) continue;
        const info = await FS.getInfoAsync(dir + f);
        metas.push({
          ...parsed.meta,
          size: info.exists && 'size' in info ? (info as any).size : 0,
        });
      } catch {
        // skip corrupt entries
      }
    }
    return metas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  } catch (e) {
    console.warn('[projectStorage] listProjectFiles error', e);
    return [];
  }
}

export async function writeProjectFile(
  meta: ProjectMeta,
  scene: unknown | null
): Promise<void> {
  const content: ProjectFile = { meta, scene: scene ?? null };
  const jsonStr = JSON.stringify(content);

  if (isWeb) {
    try {
      if (typeof localStorage === 'undefined') {
        throw new Error('localStorage unavailable');
      }
      localStorage.setItem(WEB_PROJ_PREFIX + meta.id, jsonStr);
      const index = getWebIndex();
      const updatedMeta: ProjectMeta = { ...meta, size: jsonStr.length };
      const filtered = index.filter((p) => p.id !== meta.id);
      setWebIndex([updatedMeta, ...filtered]);
    } catch (e) {
      console.warn('[projectStorage] writeProjectFile web error', e);
      // Propagate: callers report the failure instead of showing a false
      // "saved" toast while nothing reached disk.
      throw e;
    }
    return;
  }

  const FS = getNativeFS();
  if (!FS || !FS.documentDirectory) {
    throw new Error('File system unavailable: cannot save project');
  }
  const dir = `${FS.documentDirectory}projects/`;

  await ensureProjectsDir();
  try {
    await FS.writeAsStringAsync(dir + meta.filePath, jsonStr);
  } catch (e) {
    console.warn('[projectStorage] writeProjectFile native error', e);
    throw e;
  }
}

export async function readProjectFile(id: string): Promise<ProjectFile | null> {
  if (isWeb) {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(WEB_PROJ_PREFIX + id);
        if (raw) return JSON.parse(raw) as ProjectFile;
      }
    } catch (e) {
      console.warn('[projectStorage] readProjectFile web error', e);
    }
    return null;
  }

  const FS = getNativeFS();
  if (!FS || !FS.documentDirectory) return null;
  const path = `${FS.documentDirectory}projects/${id}.json`;

  try {
    const info = await FS.getInfoAsync(path);
    if (!info.exists) return null;
    return JSON.parse(await FS.readAsStringAsync(path)) as ProjectFile;
  } catch (e) {
    console.warn('[projectStorage] readProjectFile native error', e);
    return null;
  }
}

export async function deleteProjectFile(id: string): Promise<void> {
  if (isWeb) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(WEB_PROJ_PREFIX + id);
      }
      const index = getWebIndex().filter((p) => p.id !== id);
      setWebIndex(index);
    } catch (e) {
      console.warn('[projectStorage] deleteProjectFile web error', e);
      throw e;
    }
    return;
  }

  const FS = getNativeFS();
  if (!FS || !FS.documentDirectory) {
    throw new Error('File system unavailable: cannot delete project');
  }
  const path = `${FS.documentDirectory}projects/${id}.json`;

  try {
    const info = await FS.getInfoAsync(path);
    if (info.exists) await FS.deleteAsync(path);
  } catch (e) {
    console.warn('[projectStorage] deleteProjectFile native error', e);
    throw e;
  }
}

export async function copyProjectFile(id: string, newId: string): Promise<ProjectFile | null> {
  const file = await readProjectFile(id);
  if (!file) return null;

  const newMeta: ProjectMeta = {
    ...file.meta,
    id: newId,
    filePath: `${newId}.json`,
  };

  await writeProjectFile(newMeta, file.scene);
  return { meta: newMeta, scene: file.scene };
}

export async function patchProjectMeta(
  id: string,
  patch: Partial<ProjectMeta>
): Promise<ProjectMeta | null> {
  const file = await readProjectFile(id);
  // Throw instead of returning null: every caller did `if (meta) {...}`, so a
  // missing file made favourite / rename / trash appear to do nothing at all.
  if (!file) throw new Error(`Project not found: ${id}`);
  const meta: ProjectMeta = { ...file.meta, ...patch };
  await writeProjectFile(meta, file.scene);
  return meta;
}

export async function importProjectFile(
  uri: string,
  name?: string,
  rawJson?: string
): Promise<ProjectMeta> {
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  let content: ProjectFile | null = null;

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      content = parsed?.meta && parsed?.scene !== undefined ? parsed : { meta: null, scene: parsed };
    } catch {}
  } else if (isWeb) {
    try {
      const resp = await fetch(uri);
      const text = await resp.text();
      const parsed = JSON.parse(text);
      content = parsed?.meta && parsed?.scene !== undefined ? parsed : { meta: null, scene: parsed };
    } catch (e) {
      console.warn('[projectStorage] importProjectFile web fetch error', e);
    }
  } else {
    const FS = getNativeFS();
    if (FS && FS.documentDirectory) {
      await ensureProjectsDir();
      const dest = `${FS.documentDirectory}projects/${id}.json`;
      await FS.copyAsync({ from: uri, to: dest });
      try {
        content = JSON.parse(await FS.readAsStringAsync(dest)) as ProjectFile;
      } catch {}
    }
  }

  // If the source could not be read or parsed we would otherwise create a
  // brand-new empty project and report success, hiding a failed import.
  if (!content) {
    throw new Error('Could not read or parse the selected project file');
  }

  const meta: ProjectMeta = {
    id,
    name: name || content.meta?.name || 'Importado',
    createdAt: now,
    updatedAt: now,
    filePath: `${id}.json`,
    favorite: false,
    trashed: false,
  };

  await writeProjectFile(meta, content.scene ?? null);
  return meta;
}

export async function listExportFiles(): Promise<ExportFile[]> {
  if (isWeb) {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(WEB_EXPORTS_KEY);
        if (raw) return JSON.parse(raw) as ExportFile[];
      }
    } catch {}
    return [];
  }

  const FS = getNativeFS();
  if (!FS || !FS.documentDirectory) return [];
  const exportDir = `${FS.documentDirectory}exports/`;

  try {
    const info = await FS.getInfoAsync(exportDir);
    if (!info.exists) return [];
    const files = await FS.readDirectoryAsync(exportDir);
    const out: ExportFile[] = [];
    for (const f of files) {
      const p = `${exportDir}${f}`;
      const fi = await FS.getInfoAsync(p);
      const ext = f.includes('.') ? f.split('.').pop()! : '';
      out.push({ name: f, path: p, size: fi.exists && 'size' in fi ? (fi as any).size : 0, ext });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function shareFile(path: string): Promise<void> {
  if (isWeb) {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: 'ThreeKip Export', url: path });
        return;
      } catch {}
    }
    return;
  }
  const Sharing = getNativeSharing();
  if (Sharing && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(path);
  }
}
