import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  Alert,
  Platform,
  ViewStyle,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useProjectStore } from "./stores/ProjectStore";
import { shareFile } from "./services/projectStorage";
import { Icon, Button, IconButton, Sheet, Chip } from "./ui/primitives";
import { useTheme } from "./theme/ThemeProvider";
import { useI18n } from "./i18n";
import { radius, spacing, typography } from "./theme";

type Filter = "all" | "recent" | "favorites" | "shared" | "trash";
type ViewMode = "grid" | "list";
type SortKey = "name" | "date";

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function Library() {
  const t = useTheme();
  const { t: tr } = useI18n();
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

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortKey>("date");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  );

  const filters: { key: Filter; label: string; icon: string }[] = useMemo(
    () => [
      { key: "all", label: tr.library.allProjects, icon: "mdi-grid" },
      { key: "recent", label: tr.library.recent, icon: "mdi-clock" },
      { key: "favorites", label: tr.library.favorites, icon: "mdi-star" },
      { key: "shared", label: tr.library.shared, icon: "mdi-share-variant" },
      { key: "trash", label: tr.library.trash, icon: "mdi-trash-can" },
    ],
    [tr],
  );

  // Re-read from disk every time the screen regains focus. With expo-router the
  // library stays mounted while the editor is open, so a plain useEffect ran
  // only once and left stale sizes / "recent" ordering after an edit.
  useFocusEffect(
    useCallback(() => {
      list();
      listExports();
    }, [list, listExports])
  );

  const visibleProjects = useMemo(() => {
    let list2 = projects.slice();
    if (filter === "favorites")
      list2 = list2.filter((p) => p.favorite && !p.trashed);
    else if (filter === "trash") list2 = list2.filter((p) => p.trashed);
    else if (filter === "all") list2 = list2.filter((p) => !p.trashed);
    // 'recent' and 'shared' use the same full (non-trashed) set, ordered below
    if (filter !== "trash") list2 = list2.filter((p) => !p.trashed);
    if (query.trim()) {
      const q = query.toLowerCase();
      list2 = list2.filter((p) => p.name.toLowerCase().includes(q));
    }
    list2.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : a.updatedAt < b.updatedAt
          ? 1
          : -1,
    );
    return list2;
  }, [projects, filter, query, sort]);

  const fail = (message: string) => (e: unknown) => {
    console.error("[library] operation failed", e);
    Alert.alert(tr.library.actionErrorTitle, message);
  };
  const onOpen = async (id: string) => {
    try {
      await open(id);
    } catch (e) {
      fail(tr.library.openError)(e);
      return;
    }
    router.push("/editor");
  };
  const onNew = async () => {
    try {
      await newProject(tr.library.untitled);
    } catch (e) {
      fail(tr.library.createError)(e);
      return;
    }
    router.push("/editor");
  };
  const onImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      let rawJson: string | undefined;
      if (Platform.OS === "web" && asset.file) {
        rawJson = await asset.file.text();
      }
      await importProject(asset.uri, asset.name, rawJson);
      listExports();
    } catch {
      Alert.alert(tr.library.importErrorTitle, tr.library.importErrorMessage);
    }
  };

  const { width } = useWindowDimensions();
  const isMobileScreen = width < 540;
  const numColumns = useMemo(() => {
    if (width < 540) return 1;
    if (width < 840) return 2;
    if (width < 1140) return 3;
    if (width < 1440) return 4;
    return 5;
  }, [width]);

  const cardWidth = useMemo(() => {
    const containerWidth = Math.min(width, 1280);
    const pad = isMobileScreen ? spacing.md : spacing.lg;
    if (numColumns === 1) return containerWidth - pad * 2;
    return Math.floor((containerWidth - pad * (numColumns + 1)) / numColumns);
  }, [width, numColumns, isMobileScreen]);

  const renderItem = ({ item }: { item: (typeof projects)[number] }) => (
    <ProjectCard
      item={item}
      width={viewMode === "grid" ? cardWidth : undefined}
      listMode={viewMode === "list"}
      onPress={() => onOpen(item.id)}
      onOptions={() => setMenuId(item.id)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.mainWrapper}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <View
              style={[
                styles.brandIconWrap,
                { backgroundColor: t.primaryContainer },
              ]}
            >
              <Icon name="mdi-cube-outline" size={24} color={t.onPrimaryContainer} strokeWidth={2.2} />
            </View>
            <View>
              <Text style={[styles.brandName, { color: t.text }]}>
                ThreeKip
              </Text>
              <Text style={[styles.brandTagline, { color: t.textMuted }]}>
                {tr.about.subtitle}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <IconButton
              name="settings"
              size={20}
              btnSize={40}
              variant="surface"
              onPress={() => router.push("/settings")}
            />
          </View>
        </View>

        {/* Search + controls */}
        <View style={styles.controls}>
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: t.surfaceContainerHigh,
                borderColor: t.outlineVariant,
              },
            ]}
          >
            <Icon name="mdi-magnify" size={18} color={t.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: t.text }]}
              placeholder={tr.library.searchPlaceholder}
              placeholderTextColor={t.textMuted}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Icon name="close" size={16} color={t.textMuted} />
              </Pressable>
            )}
          </View>
          <View style={styles.controlBtns}>
            <IconButton
              name={sort === "name" ? "mdi-sort-alphabetical-ascending" : "time"}
              size={18}
              btnSize={42}
              variant="surface"
              onPress={() => setSort(sort === "name" ? "date" : "name")}
            />
            <IconButton
              name={viewMode === "grid" ? "list" : "grid"}
              size={18}
              btnSize={42}
              variant="surface"
              onPress={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            />
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}
        >
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <Chip
                key={f.key}
                label={f.label}
                icon={f.icon}
                active={active}
                onPress={() => setFilter(f.key)}
              />
            );
          })}
        </ScrollView>

        {/* Content */}
        {filter === "shared" ? (
          <SharedList />
        ) : visibleProjects.length === 0 ? (
          <EmptyState filter={filter} onNew={onNew} onImport={onImport} />
        ) : viewMode === "grid" ? (
          <FlatList
            key={`grid-${numColumns}`}
            data={visibleProjects}
            keyExtractor={(p) => p.id}
            numColumns={numColumns}
            columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
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
      </View>

      {/* New project FAB (Material Design 3 Floating Action Button) */}
      <Pressable
        style={[
          styles.fab,
          { backgroundColor: t.primaryContainer, ...shadowsFor(t) },
        ]}
        onPress={onNew}
      >
        <Icon name="add" size={32} color={t.onPrimaryContainer} strokeWidth={3} />
      </Pressable>

      {/* Options menu */}
      <Sheet
        visible={!!menuId}
        onClose={() => setMenuId(null)}
        title={tr.library.projectMenuTitle}
      >
        {menuId ? (
          <MenuActions
            id={menuId}
            isTrash={projects.find((p) => p.id === menuId)?.trashed}
            isFavorite={projects.find((p) => p.id === menuId)?.favorite}
            onClose={() => setMenuId(null)}
            onOpen={() => {
              onOpen(menuId);
              setMenuId(null);
            }}
            onRename={() => {
              const p = projects.find((x) => x.id === menuId);
              setRenaming({ id: menuId, name: p?.name ?? "" });
              setMenuId(null);
            }}
            onToggleFav={async () => {
              try {
                await toggleFavorite(menuId);
              } catch (e) {
                fail(tr.library.modifyError)(e);
              }
              setMenuId(null);
            }}
            onDuplicate={async () => {
              try {
                await duplicate(menuId);
              } catch (e) {
                fail(tr.library.modifyError)(e);
              }
              setMenuId(null);
            }}
            onTrash={async () => {
              try {
                await trash(menuId);
              } catch (e) {
                fail(tr.library.modifyError)(e);
              }
              setMenuId(null);
            }}
            onRestore={async () => {
              try {
                await restore(menuId);
              } catch (e) {
                fail(tr.library.modifyError)(e);
              }
              setMenuId(null);
            }}
            onPurge={async () => {
              Alert.alert(
                tr.library.deleteConfirmTitle,
                tr.library.deleteConfirmMessage,
                [
                  { text: tr.common.cancel, style: "cancel" },
                  {
                    text: tr.common.delete,
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await purge(menuId);
                      } catch (e) {
                        fail(tr.library.modifyError)(e);
                      }
                      setMenuId(null);
                    },
                  },
                ],
              );
            }}
          />
        ) : null}
      </Sheet>

      {/* Rename sheet */}
      <Sheet
        visible={!!renaming}
        onClose={() => setRenaming(null)}
        title={tr.library.renameTitle}
      >
        {renaming ? (
          <View>
            <TextInput
              style={[
                styles.renameInput,
                {
                  backgroundColor: t.surfaceAlt,
                  color: t.text,
                  borderColor: t.border,
                },
              ]}
              value={renaming.name}
              onChangeText={(v) => setRenaming({ ...renaming, name: v })}
              placeholder={tr.library.renamePlaceholder}
              placeholderTextColor={t.textMuted}
            />
            <Button
              label={tr.common.save}
              onPress={async () => {
                try {
                  await rename(
                    renaming.id,
                    renaming.name.trim() || tr.library.untitled,
                  );
                } catch (e) {
                  fail(tr.library.modifyError)(e);
                  return;
                }
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
  item: {
    id: string;
    name: string;
    updatedAt: string;
    size?: number;
    favorite?: boolean;
  };
  width?: number;
  listMode?: boolean;
  onPress: () => void;
  onOptions: () => void;
}) {
  const t = useTheme();
  if (listMode) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.rowCard,
          {
            backgroundColor: pressed
              ? t.surfaceContainerHigh
              : t.surfaceContainerLow,
            borderColor: t.outlineVariant,
          },
        ]}
        onPress={onPress}
      >
        <View
          style={[
            styles.rowThumb,
            { backgroundColor: t.surfaceContainerHighest },
          ]}
        >
          <Icon name="mdi-cube" size={24} color={t.primary} strokeWidth={2} />
        </View>
        <View style={styles.rowMain}>
          <Text style={[styles.cardName, { color: t.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.cardMeta, { color: t.textMuted }]}>
            {formatDate(item.updatedAt)} · {formatTime(item.updatedAt)} ·{" "}
            {formatSize(item.size)}
          </Text>
        </View>
        <IconButton
          name="mdi-dots-vertical"
          size={18}
          btnSize={36}
          variant="ghost"
          onPress={onOptions}
        />
      </Pressable>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          width: width ?? "48%",
          backgroundColor: pressed
            ? t.surfaceContainerHigh
            : t.surfaceContainerLow,
          borderColor: t.outlineVariant,
        },
      ]}
      onPress={onPress}
    >
      <View
        style={[styles.thumb, { backgroundColor: t.surfaceContainerHighest }]}
      >
        <Icon name="mdi-cube" size={48} color={t.primary} strokeWidth={1.5} />
        {item.favorite ? (
          <View
            style={[
              styles.favBadge,
              {
                backgroundColor: t.surfaceContainerLow,
                borderColor: t.outlineVariant,
              },
            ]}
          >
            <Icon name="star" size={13} color="#EAB308" fill="#EAB308" />
          </View>
        ) : null}
        <Pressable
          style={[
            styles.cardOptions,
            { backgroundColor: t.surfaceContainerLow },
          ]}
          onPress={onOptions}
          hitSlop={8}
        >
          <Icon name="mdi-dots-vertical" size={16} color={t.text} />
        </Pressable>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: t.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.cardMeta, { color: t.textMuted }]}>
          {formatDate(item.updatedAt)} · {formatTime(item.updatedAt)}
        </Text>
        <Text style={[styles.cardMetaSub, { color: t.textMuted }]}>
          {formatSize(item.size)}
        </Text>
      </View>
    </Pressable>
  );
}

function MenuActions({
  isTrash,
  isFavorite,
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
  isFavorite?: boolean;
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
  const { t: tr } = useI18n();
  const action = (
    icon: string,
    label: string,
    fn: () => void,
    danger?: boolean,
  ) => {
    const fg = danger ? t.error : t.text;
    const bg = danger ? t.errorContainer : t.secondaryContainer;
    const icnFg = danger ? t.onErrorContainer : t.onSecondaryContainer;
    return (
      <Pressable
        key={label}
        style={({ pressed }) => [
          styles.menuItem,
          {
            borderColor: t.divider,
            backgroundColor: pressed ? t.surfaceContainerHigh : "transparent",
          },
        ]}
        onPress={() => {
          fn();
          onClose();
        }}
      >
        <View style={[styles.menuIconWrap, { backgroundColor: bg }]}>
          <Icon name={icon} size={18} color={icnFg} />
        </View>
        <Text style={[styles.menuLabel, { color: fg, fontWeight: "500" }]}>
          {label}
        </Text>
      </Pressable>
    );
  };
  if (isTrash) {
    return (
      <View>
        {action("mdi-folder-open", tr.library.restore, onRestore)}
        {action("mdi-trash-can", tr.library.deleteForever, onPurge, true)}
      </View>
    );
  }
  return (
    <View>
      {action("mdi-folder-open", tr.library.open, onOpen)}
      {action("Pencil", tr.library.rename, onRename)}
      {action(
        "Star",
        isFavorite ? tr.library.unfavorite : tr.library.favorite,
        onToggleFav,
      )}
      {action("Copy", tr.library.duplicate, onDuplicate)}
      {action("Trash2", tr.library.moveToTrash, onTrash, true)}
    </View>
  );
}

function SharedList() {
  const t = useTheme();
  const { t: tr } = useI18n();
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
          {tr.library.emptySharedSubtitle}
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
          style={[
            styles.rowCard,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}
          onPress={() => shareFile(item.path)}
        >
          <View style={[styles.rowThumb, { backgroundColor: t.surfaceAlt }]}>
            <Icon name="FileBox" size={22} color={t.primary} />
          </View>
          <View style={styles.rowMain}>
            <Text
              style={[styles.cardName, { color: t.text }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text style={[styles.cardMeta, { color: t.textMuted }]}>
              {formatSize(item.size)}
            </Text>
          </View>
          <IconButton
            name="Share2"
            size={18}
            variant="ghost"
            onPress={() => shareFile(item.path)}
          />
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
  const { t: tr } = useI18n();
  if (filter === "trash") {
    return (
      <View style={styles.empty}>
        <View
          style={[
            styles.emptyIconWrap,
            { backgroundColor: t.surfaceContainerHighest },
          ]}
        >
          <Icon name="Trash2" size={32} color={t.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, { color: t.text }]}>
          {tr.library.emptyTrashTitle}
        </Text>
        <Text style={[styles.emptyText, { color: t.textMuted }]}>
          {tr.library.emptyTrashSubtitle}
        </Text>
      </View>
    );
  }
  if (filter === "favorites") {
    return (
      <View style={styles.empty}>
        <View
          style={[
            styles.emptyIconWrap,
            { backgroundColor: t.surfaceContainerHighest },
          ]}
        >
          <Icon name="Star" size={32} color={t.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, { color: t.text }]}>
          {tr.library.emptyFavoritesTitle}
        </Text>
        <Text style={[styles.emptyText, { color: t.textMuted }]}>
          {tr.library.emptyFavoritesSubtitle}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <View
        style={[styles.emptyIconWrap, { backgroundColor: t.primaryContainer }]}
      >
        <Icon
          name="Box"
          size={36}
          color={t.onPrimaryContainer}
          strokeWidth={2}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: t.text }]}>
        {tr.library.emptyAllTitle}
      </Text>
      <Text style={[styles.emptyText, { color: t.textMuted }]}>
        {tr.library.emptyAllSubtitle}
      </Text>
      <View style={styles.emptyBtns}>
        <Button label={tr.library.newProject} icon="Plus" onPress={onNew} />
        <Button
          label={tr.library.importFile}
          variant="tonal"
          icon="Download"
          onPress={onImport}
        />
      </View>
    </View>
  );
}

function shadowsFor(t: ReturnType<typeof useTheme>): ViewStyle {
  return {
    shadowColor: t.shadowColor,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  brandIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: typography.title.fontSize,
    fontFamily: typography.title.fontFamily,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  brandTagline: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    marginTop: 1,
  },
  headerActions: { flexDirection: "row", gap: spacing.xs },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
  },
  controlBtns: { flexDirection: "row", gap: spacing.xs },
  tabs: { maxHeight: 44, marginBottom: spacing.sm },
  tabsContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  listPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl + 32 },
  gridRow: { justifyContent: "space-between", marginBottom: spacing.md },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  thumb: {
    height: 124,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  favBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    padding: 4,
  },
  cardBody: { padding: spacing.md, paddingTop: spacing.sm },
  cardName: {
    fontSize: typography.bodyLarge.fontSize,
    fontWeight: "600",
    fontFamily: typography.bodyLarge.fontFamily,
    letterSpacing: 0.15,
  },
  cardMeta: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    marginTop: 3,
  },
  cardMetaSub: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    marginTop: 1,
  },
  cardOptions: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    borderRadius: radius.full,
    padding: 6,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: { flex: 1, paddingHorizontal: spacing.md },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg + 10,
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: typography.labelLarge.fontSize,
    fontFamily: typography.labelLarge.fontFamily,
  },
  renameInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: typography.bodyLarge.fontSize,
    marginBottom: spacing.md,
    fontFamily: typography.bodyLarge.fontFamily,
  },
  sharedEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  sharedEmptyText: { textAlign: "center", fontSize: 14 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.xl,
    marginTop: spacing.xxl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.title.fontSize,
    fontWeight: "600",
    fontFamily: typography.title.fontFamily,
    textAlign: "center",
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  emptyBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
});
