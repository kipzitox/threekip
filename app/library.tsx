import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
  Alert,
  ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useProjectStore } from './stores/ProjectStore';
import { shareFile } from './services/projectStorage';
import { Icon, Button, IconButton, Sheet } from './ui/primitives';
import { useTheme } from './theme/ThemeProvider';
import { radius, spacing, typography } from './theme';

type Filter = 'all' | 'recent' | 'favorites' | 'shared' | 'trash';
type ViewMode = 'grid' | 'list';
type SortKey = 'name' | 'date';

const FILTERS: { key: Filter; label: string; icon: string }[] = [
  { key: 'all', label: 'Proyectos', icon: 'LayoutGrid' },
  { key: 'recent', label: 'Recientes', icon: 'Clock' },
  { key: 'favorites', label: 'Favoritos', icon: 'Star' },
  { key: 'shared', label: 'Compartidos', icon: 'Share2' },
  { key: 'trash', label: 'Papelera', icon: 'Trash2' },
];

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function Library() {
  const t = useTheme();
  const projects = useProjectStore((s) => s.projects);
  const list = useProjectStore((s) => s.list);
  const listExports = useProjectStore((s) => s.listExports);
  const open = useProjectStore((s) => s.open);
  const newProject = useProjectStore((s) => s.newProject);
  const toggleFavorite = useProjectStore((s) => s.toggleFavorite);
  const trash = useProjectStore((s) => s.trash);
  const restore = useProjectStore((s) => s.restore);
  const purge = useProjectStore((s) => s.purge);
  const rename = useProjectStore((s) => s.rename);
  const duplicate = useProjectStore((s) => s.duplicate);
  const importProject = useProjectStore((s) => s.importProject);

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortKey>('date');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    list();
    listExports();
  }, [list, listExports]);

  const visibleProjects = useMemo(() => {
    let list2 = projects.slice();
    if (filter === 'favorites') list2 = list2.filter((p) => p.favorite && !p.trashed);
    else if (filter === 'trash') list2 = list2.filter((p) => p.trashed);
    else if (filter === 'all') list2 = list2.filter((p) => !p.trashed);
    // 'recent' and 'shared' use the same full (non-trashed) set, ordered below
    if (filter !== 'trash') list2 = list2.filter((p) => !p.trashed);
    if (query.trim()) {
      const q = query.toLowerCase();
      list2 = list2.filter((p) => p.name.toLowerCase().includes(q));
    }
    list2.sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : a.updatedAt < b.updatedAt
        ? 1
        : -1
    );
    return list2;
  }, [projects, filter, query, sort]);

  const onOpen = async (id: string) => {
    await open(id);
    router.push('/editor');
  };
  const onNew = async () => {
    await newProject('Sin título');
    router.push('/editor');
  };
  const onImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const uri = res.assets[0].uri;
      await importProject(uri);
      listExports();
    } catch {
      Alert.alert('Importar', 'No se pudo importar el archivo.');
    }
  };

  const cardWidth = (Dimensions.get('window').width - spacing.lg * 3) / 2;

  const renderItem = ({ item }: { item: (typeof projects)[number] }) => (
    <ProjectCard
      item={item}
      width={viewMode === 'grid' ? cardWidth : undefined}
      listMode={viewMode === 'list'}
      onPress={() => onOpen(item.id)}
      onOptions={() => setMenuId(item.id)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <Icon name="Box" size={26} color={t.primary} strokeWidth={2.4} />
          <Text style={[styles.brandName, { color: t.text }]}>ThreeKip</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton name="Settings" size={20} variant="ghost" onPress={() => router.push('/settings')} />
        </View>
      </View>

      {/* Search + controls */}
      <View style={styles.controls}>
        <View style={[styles.searchBox, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Icon name="Search" size={18} color={t.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: t.text }]}
            placeholder="Buscar proyectos"
            placeholderTextColor={t.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <View style={styles.controlBtns}>
          <IconButton
            name={sort === 'name' ? 'ArrowDownAZ' : 'Clock'}
            size={18}
            variant="ghost"
            onPress={() => setSort(sort === 'name' ? 'date' : 'name')}
          />
          <IconButton
            name={viewMode === 'grid' ? 'List' : 'LayoutGrid'}
            size={18}
            variant="ghost"
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          />
        </View>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? t.primary : t.surface,
                  borderColor: active ? t.primary : t.border,
                },
              ]}
            >
              <Icon name={f.icon} size={15} color={active ? t.onPrimary : t.textMuted} />
              <Text style={[styles.tabLabel, { color: active ? t.onPrimary : t.textMuted }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      {filter === 'shared' ? (
        <SharedList />
      ) : visibleProjects.length === 0 ? (
        <EmptyState filter={filter} onNew={onNew} onImport={onImport} />
      ) : viewMode === 'grid' ? (
        <FlatList
          key="grid"
          data={visibleProjects}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listPad}
          renderItem={renderItem}
        />
      ) : (
        <FlatList
          key="list"
          data={visibleProjects}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listPad}
          renderItem={renderItem}
        />
      )}

      {/* New project FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: t.primary, ...shadowsFor(t) }]}
        onPress={onNew}
      >
        <Icon name="Plus" size={26} color={t.onPrimary} strokeWidth={2.6} />
      </Pressable>

      {/* Options menu */}
      <Sheet visible={!!menuId} onClose={() => setMenuId(null)} title="Opciones">
        {menuId ? (
          <MenuActions
            id={menuId}
            isTrash={projects.find((p) => p.id === menuId)?.trashed}
            onClose={() => setMenuId(null)}
            onOpen={() => {
              onOpen(menuId);
              setMenuId(null);
            }}
            onRename={() => {
              const p = projects.find((x) => x.id === menuId);
              setRenaming({ id: menuId, name: p?.name ?? '' });
              setMenuId(null);
            }}
            onToggleFav={async () => {
              await toggleFavorite(menuId);
              setMenuId(null);
            }}
            onDuplicate={async () => {
              await duplicate(menuId);
              setMenuId(null);
            }}
            onTrash={async () => {
              await trash(menuId);
              setMenuId(null);
            }}
            onRestore={async () => {
              await restore(menuId);
              setMenuId(null);
            }}
            onPurge={async () => {
              await purge(menuId);
              setMenuId(null);
            }}
          />
        ) : null}
      </Sheet>

      {/* Rename sheet */}
      <Sheet visible={!!renaming} onClose={() => setRenaming(null)} title="Renombrar">
        {renaming ? (
          <View>
            <TextInput
              style={[styles.renameInput, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }]}
              value={renaming.name}
              onChangeText={(v) => setRenaming({ ...renaming, name: v })}
              placeholderTextColor={t.textMuted}
            />
            <Button
              label="Guardar"
              onPress={async () => {
                await rename(renaming.id, renaming.name.trim() || 'Sin título');
                setRenaming(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function ProjectCard({
  item,
  width,
  listMode,
  onPress,
  onOptions,
}: {
  item: { id: string; name: string; updatedAt: string; size?: number; favorite?: boolean };
  width?: number;
  listMode?: boolean;
  onPress: () => void;
  onOptions: () => void;
}) {
  const t = useTheme();
  if (listMode) {
    return (
      <Pressable style={[styles.rowCard, { backgroundColor: t.surface, borderColor: t.border }]} onPress={onPress}>
        <View style={[styles.rowThumb, { backgroundColor: t.surfaceAlt }]}>
          <Icon name="Box" size={22} color={t.primary} />
        </View>
        <View style={styles.rowMain}>
          <Text style={[styles.cardName, { color: t.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.cardMeta, { color: t.textMuted }]}>
            {formatDate(item.updatedAt)} · {formatTime(item.updatedAt)} · {formatSize(item.size)}
          </Text>
        </View>
        <IconButton name="MoreVertical" size={18} variant="ghost" onPress={onOptions} />
      </Pressable>
    );
  }
  return (
    <Pressable
      style={[
        styles.card,
        { width: width ?? '48%', backgroundColor: t.surface, borderColor: t.border },
      ]}
      onPress={onPress}
    >
      <View style={[styles.thumb, { backgroundColor: t.surfaceAlt }]}>
        <Icon name="Box" size={40} color={t.primary} strokeWidth={1.8} />
        {item.favorite ? (
          <View style={styles.favBadge}>
            <Icon name="Star" size={12} color="#FBBF24" fill="#FBBF24" />
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: t.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.cardMeta, { color: t.textMuted }]}>
          {formatDate(item.updatedAt)}
        </Text>
        <Text style={[styles.cardMeta, { color: t.textMuted }]}>
          {formatTime(item.updatedAt)} · {formatSize(item.size)}
        </Text>
      </View>
      <Pressable style={styles.cardOptions} onPress={onOptions}>
        <Icon name="MoreVertical" size={18} color={t.textMuted} />
      </Pressable>
    </Pressable>
  );
}

function MenuActions({
  isTrash,
  onClose,
  onOpen,
  onRename,
  onToggleFav,
  onDuplicate,
  onTrash,
  onRestore,
  onPurge,
}: {
  id: string;
  isTrash?: boolean;
  onClose: () => void;
  onOpen: () => void;
  onRename: () => void;
  onToggleFav: () => void;
  onDuplicate: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const t = useTheme();
  const action = (icon: string, label: string, fn: () => void, danger?: boolean) => (
    <Pressable
      key={label}
      style={[styles.menuItem, { borderColor: t.divider }]}
      onPress={() => {
        fn();
        onClose();
      }}
    >
      <Icon name={icon} size={18} color={danger ? t.error : t.text} />
      <Text style={[styles.menuLabel, { color: danger ? t.error : t.text }]}>{label}</Text>
    </Pressable>
  );
  if (isTrash) {
    return (
      <View>
        {action('FolderOpen', 'Restaurar', onRestore)}
        {action('Trash2', 'Eliminar permanentemente', onPurge, true)}
      </View>
    );
  }
  return (
    <View>
      {action('FolderOpen', 'Abrir', onOpen)}
      {action('Pencil', 'Renombrar', onRename)}
      {action('Star', 'Favorito', onToggleFav)}
      {action('Copy', 'Duplicar', onDuplicate)}
      {action('Trash2', 'Mover a papelera', onTrash, true)}
    </View>
  );
}

function SharedList() {
  const t = useTheme();
  const exports = useProjectStore((s) => s.exports);
  const listExports = useProjectStore((s) => s.listExports);
  useEffect(() => {
    listExports();
  }, [listExports]);
  if (!exports.length) {
    return (
      <View style={styles.sharedEmpty}>
        <Icon name="Share2" size={36} color={t.textMuted} />
        <Text style={[styles.sharedEmptyText, { color: t.textMuted }]}>
          Aún no has compartido archivos. Exporta un proyecto para verlo aquí.
        </Text>
      </View>
    );
  }
  return (
    <FlatList
      data={exports}
      keyExtractor={(e) => e.path}
      contentContainerStyle={styles.listPad}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.rowCard, { backgroundColor: t.surface, borderColor: t.border }]}
          onPress={() => shareFile(item.path)}
        >
          <View style={[styles.rowThumb, { backgroundColor: t.surfaceAlt }]}>
            <Icon name="FileBox" size={22} color={t.primary} />
          </View>
          <View style={styles.rowMain}>
            <Text style={[styles.cardName, { color: t.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.cardMeta, { color: t.textMuted }]}>{formatSize(item.size)}</Text>
          </View>
          <IconButton name="Share2" size={18} variant="ghost" onPress={() => shareFile(item.path)} />
        </Pressable>
      )}
    />
  );
}

function EmptyState({
  filter,
  onNew,
  onImport,
}: {
  filter: Filter;
  onNew: () => void;
  onImport: () => void;
}) {
  const t = useTheme();
  if (filter === 'trash') {
    return (
      <View style={styles.empty}>
        <Icon name="Trash2" size={40} color={t.textMuted} />
        <Text style={[styles.emptyText, { color: t.textMuted }]}>La papelera está vacía.</Text>
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <Icon name="Box" size={44} color={t.textMuted} strokeWidth={1.6} />
      <Text style={[styles.emptyText, { color: t.textMuted }]}>No hay proyectos aquí.</Text>
      <View style={styles.emptyBtns}>
        <Button label="Nuevo proyecto" icon="Plus" onPress={onNew} />
        <Button label="Importar" variant="secondary" icon="Download" onPress={onImport} />
      </View>
    </View>
  );
}

function shadowsFor(t: ReturnType<typeof useTheme>): ViewStyle {
  return { shadowColor: t.shadowColor, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandName: { fontSize: 22, fontWeight: '700', fontFamily: typography.title.fontFamily },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: typography.body.fontFamily },
  controlBtns: { flexDirection: 'row', gap: 2 },
  tabs: { maxHeight: 44, marginBottom: spacing.sm },
  tabsContent: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tabLabel: { fontSize: typography.caption.fontSize, fontWeight: '600' },
  listPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  gridRow: { justifyContent: 'space-between', marginBottom: spacing.lg },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  thumb: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  favBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.full,
    padding: 3,
  },
  cardBody: { padding: spacing.md, paddingTop: spacing.sm },
  cardName: { fontSize: 15, fontWeight: '600', fontFamily: typography.body.fontFamily },
  cardMeta: { fontSize: typography.caption.fontSize, marginTop: 2 },
  cardOptions: { position: 'absolute', top: spacing.sm, right: spacing.sm, padding: 4 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  rowThumb: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, paddingHorizontal: spacing.md },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  menuLabel: { fontSize: 15, fontFamily: typography.body.fontFamily },
  renameInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 15,
    marginBottom: spacing.md,
    fontFamily: typography.body.fontFamily,
  },
  sharedEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  sharedEmptyText: { textAlign: 'center', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  emptyText: { fontSize: 15 },
  emptyBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
