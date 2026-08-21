import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { router } from 'expo-router';
import type { WebView } from 'react-native-webview';
import type { SketchbookBridge } from '../services/sketchbookBridge';
import { Icon, IconButton, Sheet, SectionTitle } from './primitives';
import { useUIStore } from '../stores/UIStore';
import { useSettingsStore } from '../stores/SettingsStore';
import { useProjectStore } from '../stores/ProjectStore';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { radius, spacing, typography } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

export function EditorUI({
  bridge,
  webRef,
}: {
  bridge: SketchbookBridge;
  webRef: React.RefObject<WebView>;
}) {
  const t = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Engine display/scene toggle states (mirrored from the engine's own buttons
  // via the `tkState` event posted by the injected script).
  const [grid, setGrid] = useState(true);
  const [axis, setAxis] = useState(true);
  const [persp, setPersp] = useState(true);
  const [surf, setSurf] = useState(true);
  const [depth, setDepth] = useState(true);
  const [surfgrid, setSurfgrid] = useState(true);
  const [pan, setPan] = useState(false);
  const [orbit, setOrbit] = useState(true);
  const [stylus, setStylus] = useState(false);
  const [gestswap, setGestswap] = useState(false);
  const [lcl, setLcl] = useState(false);

  const themeMode = useUIStore((s) => s.themeMode);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const hardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);
  const setHardwareAcceleration = useSettingsStore((s) => s.setHardwareAcceleration);
  const resetCamOnOpen = useSettingsStore((s) => s.resetCamOnOpen);
  const setResetCamOnOpen = useSettingsStore((s) => s.setResetCamOnOpen);
  const confirmExit = useSettingsStore((s) => s.confirmExit);
  const setConfirmExit = useSettingsStore((s) => s.setConfirmExit);
  const saveCurrent = useProjectStore((s) => s.saveCurrent);
  const projectName = useProjectStore(
    (s) => s.projects.find((p) => p.id === s.currentProjectId)?.name
  );

  const appear = useRef(new Animated.Value(0)).current;

  // Auto-save the current project's progress to its own RN file, debounced so
  // we don't hammer the bridge/file system on every stroke or camera move.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSave = async () => {
    try {
      const res = (await bridge.send('saveProject')) as { data?: unknown } | undefined;
      await saveCurrent(res?.data ?? null);
    } catch (e) {
      console.error('[EditorUI] save failed', e);
    }
  };

  // "Cargar" — the engine's own file picker (<input type=file>) can't open a
  // native chooser inside the WebView, so we use RN's Document Picker and load
  // the selected project file's scene directly into the engine + current project.
  const onLoadFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) {
        setSettingsOpen(false);
        return;
      }
      const uri = res.assets[0].uri;
      const text = await FileSystem.readAsStringAsync(uri);
      const parsed = JSON.parse(text) as { scene?: unknown };
      const scene = parsed?.scene ?? parsed;
      await bridge.send('loadProject', { data: scene ?? {} });
      await saveCurrent(scene ?? null);
      setSettingsOpen(false);
    } catch (e) {
      console.error('[EditorUI] load file failed', e);
      Alert.alert('Cargar', 'No se pudo cargar el archivo.');
      setSettingsOpen(false);
    }
  };
  const scheduleAutoSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (useProjectStore.getState().currentProjectId) onSave().catch(() => {});
    }, 1200);
  };

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [appear]);

  useEffect(() => {
    const offs = [
      bridge.on('historyChanged', (d: any) => {
        setCanUndo(!!d?.canUndo);
        setCanRedo(!!d?.canRedo);
        scheduleAutoSave();
      }),
      bridge.on('strokeAdded', () => {
        scheduleAutoSave();
      }),
      bridge.on('tkState', (d: any) => {
        if (typeof d?.grid === 'boolean') setGrid(d.grid);
        if (typeof d?.axis === 'boolean') setAxis(d.axis);
        if (typeof d?.persp === 'boolean') setPersp(d.persp);
        if (typeof d?.surf === 'boolean') setSurf(d.surf);
        if (typeof d?.depth === 'boolean') setDepth(d.depth);
        if (typeof d?.surfgrid === 'boolean') setSurfgrid(d.surfgrid);
        if (typeof d?.pan === 'boolean') setPan(d.pan);
        if (typeof d?.orbit === 'boolean') setOrbit(d.orbit);
        if (typeof d?.stylus === 'boolean') setStylus(d.stylus);
        if (typeof d?.gestswap === 'boolean') setGestswap(d.gestswap);
        if (typeof d?.lcl === 'boolean') setLcl(d.lcl);
      }),
    ];
    return () => offs.forEach((f) => f());
  }, [bridge]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = async () => {
    const leave = async () => {
      await onSave().catch(() => {});
      router.back();
    };
    if (confirmExit) {
      Alert.alert('Salir del editor', '¿Volver a la Biblioteca?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => leave() },
      ]);
    } else {
      await leave();
    }
  };

  // Drive the engine's own buttons (kept in the DOM, just hidden by our CSS) so
  // we don't reimplement editor functions outside the allowed RN-only scope.
  const clickEngine = (sel: string) => {
    webRef.current?.injectJavaScript(
      `(function(){var e=document.querySelector('${sel}');if(e)e.click();})()`
    );
  };
  const toggleEngine = (sel: string, setter: (v: (p: boolean) => boolean) => void) => {
    clickEngine(sel);
    setter((p) => !p);
  };

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
      {/* Top app bar — all quick functions live here; sits below the device
          status bar thanks to the SafeAreaView in editor.tsx. */}
      <Animated.View
        style={[
          styles.topBar,
          {
            opacity: appear,
            transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        <View style={[styles.topLeft, { backgroundColor: t.surface, borderColor: t.border, ...sh(t) }]}>
          <IconButton name="ArrowLeft" size={20} variant="floating" onPress={handleBack} />
          <View style={styles.brandChip}>
            <Icon name="Box" size={16} color={t.primary} />
            <Text style={[styles.brandText, { color: t.text }]}>ThreeKip</Text>
            {projectName ? (
              <Text style={[styles.projText, { color: t.textMuted }]} numberOfLines={1}>
                · {projectName}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.topRight, { backgroundColor: t.surface, borderColor: t.border, ...sh(t) }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topRightScroll}
          >
            <IconButton name="Grid3x3" size={19} variant="floating" active={grid} onPress={() => toggleEngine('#bgrid', setGrid)} />
            <IconButton name="Axis3d" size={19} variant="floating" active={axis} onPress={() => toggleEngine('#baxis', setAxis)} />
            <IconButton
              name={persp ? 'Box' : 'Square'}
              size={19}
              variant="floating"
              active={persp}
              onPress={() => toggleEngine('#bpersp', setPersp)}
            />
            <IconButton name="Layers" size={19} variant="floating" onPress={() => clickEngine('#blayers')} />
            <IconButton name="Undo2" size={19} variant="floating" active={canUndo} disabled={!canUndo} onPress={() => bridge.send('undo')} />
            <IconButton name="Redo2" size={19} variant="floating" active={canRedo} disabled={!canRedo} onPress={() => bridge.send('redo')} />
            <IconButton name="Share2" size={19} variant="floating" onPress={() => clickEngine('#bexp')} />
            <View style={[styles.div, { backgroundColor: t.divider }]} />
            <IconButton name="Save" size={19} variant="floating" onPress={onSave} />
            <IconButton name="Settings" size={19} variant="floating" onPress={() => setSettingsOpen(true)} />
          </ScrollView>
        </View>
      </Animated.View>

      {/* Menu / settings sheet — preserves every engine function */}
      <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} title="Menú">
        <SectionTitle>Apariencia</SectionTitle>
        <SwitchRow label="Modo oscuro (app)" value={themeMode === 'dark'} onValueChange={toggleTheme} t={t} />
        <SwitchRow
          label="Aceleración de hardware"
          value={hardwareAcceleration}
          onValueChange={setHardwareAcceleration}
          t={t}
        />
        <ActionRow icon="SunMoon" label="Tema del editor (claro/oscuro)" onPress={() => clickEngine('#btheme')} t={t} />

        <SectionTitle>Escena</SectionTitle>
        <SwitchRow label="Cuadrícula" value={grid} onValueChange={() => toggleEngine('#bgrid', setGrid)} t={t} />
        <SwitchRow label="Ejes X Y Z" value={axis} onValueChange={() => toggleEngine('#baxis', setAxis)} t={t} />
        <SwitchRow label="Perspectiva" value={persp} onValueChange={() => toggleEngine('#bpersp', setPersp)} t={t} />
        <SwitchRow label="Superficie" value={surf} onValueChange={() => toggleEngine('#bsurf', setSurf)} t={t} />
        <SwitchRow label="Profundidad" value={depth} onValueChange={() => toggleEngine('#bdepth', setDepth)} t={t} />
        <SwitchRow label="Malla de superficie" value={surfgrid} onValueChange={() => toggleEngine('#bsurfgrid', setSurfgrid)} t={t} />
        <ActionRow icon="Droplets" label="Opacidad de profundidad" onPress={() => { clickEngine('#bdepth-op'); setSettingsOpen(false); }} t={t} />

        <SectionTitle>Navegación</SectionTitle>
        <ActionRow icon="Orbit" label="Modo órbita" active={orbit} onPress={() => { clickEngine('#borbit'); setOrbit(true); setPan(false); }} t={t} />
        <ActionRow icon="Hand" label="Modo panorámica" active={pan} onPress={() => { clickEngine('#bpan'); setPan(true); setOrbit(false); }} t={t} />
        <SwitchRow label="Intercambiar gestos (2 dedos)" value={gestswap} onValueChange={() => toggleEngine('#bgestswap', setGestswap)} t={t} />
        <SwitchRow label="Modo lápiz (stylus)" value={stylus} onValueChange={() => toggleEngine('#bstylus', setStylus)} t={t} />
        <ActionRow icon="Move3d" label="Gizmo local (LCL)" active={lcl} onPress={() => toggleEngine('#lcl-float', setLcl)} t={t} />

        <SectionTitle>Ver</SectionTitle>
        <ActionRow icon="Layers" label="Páginas" onPress={() => { clickEngine('#pgbtn'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="Bookmark" label="Vistas guardadas" onPress={() => { clickEngine('#vwbtn'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="Palette" label="Fondo (color)" onPress={() => { clickEngine('#bbg'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="Video" label="Grabar vista (video)" onPress={() => { clickEngine('#vw-rec'); setSettingsOpen(false); }} t={t} />

        <SectionTitle>Editor</SectionTitle>
        <SwitchRow
          label="Reiniciar cámara al abrir"
          value={resetCamOnOpen}
          onValueChange={setResetCamOnOpen}
          t={t}
        />
        <SwitchRow label="Confirmar al salir" value={confirmExit} onValueChange={setConfirmExit} t={t} />

        <SectionTitle>Proyecto</SectionTitle>
        <ActionRow icon="FilePlus" label="Nuevo" onPress={() => { clickEngine('#bnew'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="FolderOpen" label="Cargar" onPress={onLoadFile} t={t} />
        <ActionRow icon="Eraser" label="Limpiar todo" danger onPress={() => { clickEngine('#bclear'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="Image" label="Guardar PNG" onPress={() => { clickEngine('#bpng'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="Scaling" label="Escala de exportación" onPress={() => { clickEngine('#bscale'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="GitMerge" label="Crear Loft (superficie)" onPress={() => { clickEngine('#sg-loft'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="Trash2" label="Borrar loft" danger onPress={() => { clickEngine('#bdelloft'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="GitMerge" label="Fusionar capa 0" onPress={() => { clickEngine('#tb-merge0'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="GitMerge" label="Fusionar capa 1" onPress={() => { clickEngine('#tb-merge1'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="GitMerge" label="Fusionar capa 2" onPress={() => { clickEngine('#tb-merge2'); setSettingsOpen(false); }} t={t} />
      </Sheet>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
  t,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.row, { borderColor: t.divider }]}>
      <Text style={[styles.rowLabel, { color: t.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  danger,
  active,
  t,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
  t: ReturnType<typeof useTheme>;
}) {
  const fg = danger ? t.error : active ? t.primary : t.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { borderColor: active ? t.primary : t.divider, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={icon} size={18} color={fg} />
      <Text style={[styles.actionLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

function sh(t: ReturnType<typeof useTheme>) {
  return {
    shadowColor: t.shadowColor,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  };
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  brandChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10 },
  brandText: { fontSize: 14, fontWeight: '700', fontFamily: typography.body.fontFamily },
  projText: { fontSize: 13, fontWeight: '500', fontFamily: typography.body.fontFamily },
  topRight: {
    flex: 1,
    marginLeft: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    padding: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  topRightScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  div: { width: 1, height: 22, marginHorizontal: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 15, fontFamily: typography.body.fontFamily },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  actionLabel: { fontSize: 15, fontWeight: '600', fontFamily: typography.body.fontFamily },
});
