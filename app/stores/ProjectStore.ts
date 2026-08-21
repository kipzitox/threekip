import { create } from 'zustand';
import {
  ensureProjectsDir,
  listProjectFiles,
  readProjectFile,
  writeProjectFile,
  deleteProjectFile,
  copyProjectFile,
  patchProjectMeta,
  importProjectFile,
  listExportFiles,
} from '../services/projectStorage';

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  filePath: string;
  favorite?: boolean;
  trashed?: boolean;
  size?: number;
}

export interface ProjectFile {
  meta: ProjectMeta;
  scene: unknown;
}

export interface ExportFile {
  name: string;
  path: string;
  size: number;
  ext: string;
}

/** Sentinel used as pendingLoadId to mean "start a fresh, empty canvas". */
export const NEW_PROJECT_SENTINEL = '__new__';

const newId = () =>
  `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

interface ProjectState {
  projects: ProjectMeta[];
  exports: ExportFile[];
  currentProjectId: string | null;
  pendingLoadId: string | null;
  list: () => Promise<void>;
  listExports: () => Promise<void>;
  create: (name: string) => Promise<ProjectMeta>;
  newProject: (name: string) => Promise<ProjectMeta>;
  saveCurrent: (scene: unknown, name?: string) => Promise<ProjectMeta>;
  open: (id: string) => Promise<ProjectFile>;
  remove: (id: string) => Promise<void>;
  trash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  purge: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  duplicate: (id: string) => Promise<ProjectMeta | null>;
  importProject: (uri: string, name?: string) => Promise<ProjectMeta | null>;
  setPendingLoad: (id: string | null) => void;
  setCurrent: (id: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  exports: [],
  currentProjectId: null,
  pendingLoadId: null,

  list: async () => {
    await ensureProjectsDir();
    const projects = await listProjectFiles();
    set({ projects });
  },

  listExports: async () => {
    const exports = await listExportFiles();
    set({ exports });
  },

  create: async (name) => {
    const id = newId();
    const now = new Date().toISOString();
    const meta: ProjectMeta = {
      id,
      name: name || 'Sin título',
      createdAt: now,
      updatedAt: now,
      filePath: `${id}.json`,
      favorite: false,
      trashed: false,
    };
    await writeProjectFile(meta, null);
    set((s) => ({ projects: [meta, ...s.projects], currentProjectId: id }));
    return meta;
  },

  newProject: async (name) => {
    const meta = await get().create(name);
    set({ pendingLoadId: NEW_PROJECT_SENTINEL });
    return meta;
  },

  saveCurrent: async (scene, name) => {
    const state = get();
    let meta: ProjectMeta;
    if (!state.currentProjectId) {
      meta = await state.create(name || 'Sin título');
    } else {
      const existing =
        state.projects.find((p) => p.id === state.currentProjectId) ?? null;
      meta = {
        id: state.currentProjectId,
        name: name || existing?.name || 'Sin título',
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        filePath: `${state.currentProjectId}.json`,
        favorite: existing?.favorite ?? false,
        trashed: existing?.trashed ?? false,
      };
    }
    await writeProjectFile(meta, scene);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === meta.id ? meta : p)),
      currentProjectId: meta.id,
    }));
    return meta;
  },

  open: async (id) => {
    const file = await readProjectFile(id);
    if (!file) throw new Error(`Project not found: ${id}`);
    set({ currentProjectId: id, pendingLoadId: id });
    return file;
  },

  remove: async (id) => {
    await deleteProjectFile(id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      currentProjectId: s.currentProjectId === id ? null : s.currentProjectId,
      pendingLoadId: s.pendingLoadId === id ? null : s.pendingLoadId,
    }));
  },

  trash: async (id) => {
    const meta = await patchProjectMeta(id, { trashed: true });
    if (meta) {
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? meta! : p)) }));
    }
  },

  restore: async (id) => {
    const meta = await patchProjectMeta(id, { trashed: false });
    if (meta) {
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? meta! : p)) }));
    }
  },

  purge: async (id) => {
    await get().remove(id);
  },

  toggleFavorite: async (id) => {
    const cur = get().projects.find((p) => p.id === id);
    const meta = await patchProjectMeta(id, { favorite: !cur?.favorite });
    if (meta) {
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? meta! : p)) }));
    }
  },

  rename: async (id, name) => {
    const meta = await patchProjectMeta(id, { name: name || 'Sin título' });
    if (meta) {
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? meta! : p)) }));
    }
  },

  duplicate: async (id) => {
    const file = await copyProjectFile(id, newId());
    if (!file) return null;
    const now = new Date().toISOString();
    const meta: ProjectMeta = {
      ...file.meta,
      id: file.meta.id,
      name: `${file.meta.name} (copia)`,
      createdAt: now,
      updatedAt: now,
      favorite: false,
      trashed: false,
    };
    await writeProjectFile(meta, file.scene);
    set((s) => ({ projects: [meta, ...s.projects] }));
    return meta;
  },

  importProject: async (uri, name) => {
    const meta = await importProjectFile(uri, name);
    set((s) => ({ projects: [meta, ...s.projects] }));
    return meta;
  },

  setPendingLoad: (id) => set({ pendingLoadId: id }),
  setCurrent: (id) => set({ currentProjectId: id }),
}));
