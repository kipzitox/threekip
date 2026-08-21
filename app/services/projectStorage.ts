import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ProjectMeta, ProjectFile } from '../stores/ProjectStore';

const DIR = `${FileSystem.documentDirectory}projects/`;
const EXPORT_DIR = `${FileSystem.documentDirectory}exports/`;

export async function ensureProjectsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

export async function listProjectFiles(): Promise<ProjectMeta[]> {
  await ensureProjectsDir();
  const files = await FileSystem.readDirectoryAsync(DIR);
  const metas: ProjectMeta[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(await FileSystem.readAsStringAsync(DIR + f)) as ProjectFile;
      if (!parsed?.meta) continue;
      const info = await FileSystem.getInfoAsync(DIR + f);
      metas.push({
        ...parsed.meta,
        size: info.exists && 'size' in info ? (info as any).size : 0,
      });
    } catch {
      // skip corrupt entries
    }
  }
  return metas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function writeProjectFile(
  meta: ProjectMeta,
  scene: unknown | null
): Promise<void> {
  await ensureProjectsDir();
  const content: ProjectFile = { meta, scene: scene ?? null };
  await FileSystem.writeAsStringAsync(DIR + meta.filePath, JSON.stringify(content));
}

export async function readProjectFile(id: string): Promise<ProjectFile | null> {
  const path = `${DIR}${id}.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  try {
    return JSON.parse(await FileSystem.readAsStringAsync(path)) as ProjectFile;
  } catch {
    return null;
  }
}

export async function deleteProjectFile(id: string): Promise<void> {
  const path = `${DIR}${id}.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path);
}

export async function copyProjectFile(id: string, newId: string): Promise<ProjectFile | null> {
  const file = await readProjectFile(id);
  if (!file) return null;
  const dest = `${DIR}${newId}.json`;
  await FileSystem.copyAsync({ from: `${DIR}${id}.json`, to: dest });
  return JSON.parse(await FileSystem.readAsStringAsync(dest)) as ProjectFile;
}

export async function patchProjectMeta(
  id: string,
  patch: Partial<ProjectMeta>
): Promise<ProjectMeta | null> {
  const file = await readProjectFile(id);
  if (!file) return null;
  const meta: ProjectMeta = { ...file.meta, ...patch };
  await writeProjectFile(meta, file.scene);
  return meta;
}

export async function importProjectFile(
  uri: string,
  name?: string
): Promise<ProjectMeta> {
  await ensureProjectsDir();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dest = `${DIR}${id}.json`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  const content = JSON.parse(await FileSystem.readAsStringAsync(dest)) as ProjectFile;
  const now = new Date().toISOString();
  const meta: ProjectMeta = {
    id,
    name: name || content?.meta?.name || 'Importado',
    createdAt: now,
    updatedAt: now,
    filePath: `${id}.json`,
    favorite: false,
    trashed: false,
  };
  await writeProjectFile(meta, content?.scene ?? null);
  return meta;
}

export async function listExportFiles(): Promise<
  { name: string; path: string; size: number; ext: string }[]
> {
  const info = await FileSystem.getInfoAsync(EXPORT_DIR);
  if (!info.exists) return [];
  const files = await FileSystem.readDirectoryAsync(EXPORT_DIR);
  const out: { name: string; path: string; size: number; ext: string }[] = [];
  for (const f of files) {
    const p = `${EXPORT_DIR}${f}`;
    const fi = await FileSystem.getInfoAsync(p);
    const ext = f.includes('.') ? f.split('.').pop()! : '';
    out.push({ name: f, path: p, size: fi.exists && 'size' in fi ? (fi as any).size : 0, ext });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function shareFile(path: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path);
  }
}
