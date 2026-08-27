import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch, StyleSheet, Alert, Animated, Easing, Platform, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import type { SketchbookBridge, WebViewHandleLike } from '../services/sketchbookBridge';
import { Icon, IconButton, Sheet, SectionTitle } from './primitives';
import { ExportDialog } from './ExportDialog';
import { useUIStore } from '../stores/UIStore';
import { useSettingsStore } from '../stores/SettingsStore';
import { useProjectStore } from '../stores/ProjectStore';
import { useI18n } from '../i18n';
import * as DocumentPicker from 'expo-document-picker';
import { radius, spacing, typography } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

export function EditorUI({
  bridge,
  webRef,
}: {
  bridge: SketchbookBridge;
  webRef: React.RefObject<WebViewHandleLike | any>;
}) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isWideTablet = width >= 1024;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
  const toastFade = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    toastFade.setValue(0);
    Animated.sequence([
      Animated.timing(toastFade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastFade, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToastMsg(null));
  };

  // Auto-save the current project's progress to its own RN file, debounced so
  // we don't hammer the bridge/file system on every stroke or camera move.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSave = async (showFeedback = true) => {
    try {
      const res = (await bridge.send('saveProject')) as { data?: unknown } | undefined;
      await saveCurrent(res?.data ?? null);
      if (showFeedback) {
        showToast(tr.editor.saveSuccess);
      }
    } catch (e) {
      console.error('[EditorUI] save failed', e);
      if (showFeedback) {
        showToast(tr.editor.saveError);
      }
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
      const asset = res.assets[0];
      let text = '';
      if (Platform.OS === 'web') {
        if (asset.file) {
          text = await asset.file.text();
        } else if (asset.uri) {
          const resp = await fetch(asset.uri);
          text = await resp.text();
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const NativeFS = require('expo-file-system');
        text = await NativeFS.readAsStringAsync(asset.uri);
      }
      const parsed = JSON.parse(text) as { scene?: unknown };
      const scene = parsed?.scene ?? parsed;
      await bridge.send('loadProject', { data: scene ?? {} });
      await saveCurrent(scene ?? null);
      setSettingsOpen(false);
      showToast(tr.editor.loadSuccess);
    } catch (e) {
      console.error('[EditorUI] load file failed', e);
      Alert.alert(tr.editor.loadTitle, tr.editor.loadError);
      setSettingsOpen(false);
    }
  };

  const scheduleAutoSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (useProjectStore.getState().currentProjectId) onSave(false).catch(() => {});
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
        setCanUndo(true);
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
      await onSave(false).catch(() => {});
      router.back();
    };
    if (confirmExit) {
      Alert.alert(tr.editor.exitConfirmTitle, tr.editor.exitConfirmMessage, [
        { text: tr.common.cancel, style: 'cancel' },
        { text: tr.editor.exitButton, style: 'destructive', onPress: () => leave() },
      ]);
    } else {
      await leave();
    }
  };

  // Drive the engine's own buttons (kept in the DOM, just hidden by our CSS) so
  // we don't reimplement editor functions outside the allowed RN-only scope.
  // We evaluate selectors in priority order and click the first matching element.
  const clickEngine = (sel: string) => {
    webRef.current?.injectJavaScript(
      `(function(){
        var parts = '${sel}'.split(',');
        for (var i = 0; i < parts.length; i++) {
          var s = parts[i].trim();
          if (!s) continue;
          var el = document.querySelector(s);
          if (el) {
            try { el.click(); return; } catch(e){}
          }
        }
      })()`
    );
  };

  const toggleEngine = (sel: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    clickEngine(sel);
    setter((p) => !p);
  };

  const handleUndo = async () => {
    try {
      await bridge.send('undo');
    } catch {
      clickEngine('#bundo, #s-undo, #pb-undo');
    }
    showToast(tr.editor.toasts.undo);
  };

  const handleRedo = async () => {
    try {
      await bridge.send('redo');
    } catch {
      clickEngine('#bredo, #s-redo, #pb-redo');
    }
    showToast(tr.editor.toasts.redo);
  };

  // Physical/Hardware keyboard shortcuts on tablets & web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave(true);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setExportOpen(true);
      } else if (e.key === 'Escape') {
        setSettingsOpen(false);
        setExportOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo]); // eslint-disable-line react-hooks/exhaustive-deps

  const btnSz = isTablet ? 36 : 32;
  const icnSz = isTablet ? 18 : 17;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Top app bar */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.topBar,
          isTablet && styles.topBarTablet,
          {
            opacity: appear,
            transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        {/* Left Section: Back, Brand / Project Title & Quick Actions */}
        <View pointerEvents="auto" style={[styles.topLeft, isTablet && styles.topLeftTablet, { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant, ...sh(t) }]}>
          <IconButton name="ArrowLeft" size={icnSz} btnSize={btnSz} variant="flat" onPress={handleBack} />
          <View style={styles.brandChip}>
            <Icon name="Box" size={isTablet ? 17 : 15} color={t.primary} strokeWidth={2.4} />
            <Text style={[styles.brandText, isTablet && styles.brandTextTablet, { color: t.text }]}>ThreeKip</Text>
            {projectName ? (
              <Text style={[styles.projText, isTablet && styles.projTextTablet, { color: t.textMuted }]} numberOfLines={1}>
                · {projectName}
              </Text>
            ) : null}
          </View>
          {isTablet && (
            <>
              <View style={[styles.div, { backgroundColor: t.outlineVariant }]} />
              <IconButton
                name="FilePlus"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                onPress={() => clickEngine('#bnew, #pb-new')}
              />
              <IconButton
                name="Save"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                onPress={() => onSave(true)}
              />
            </>
          )}
        </View>

        {/* Tablet-Only Center Toolbar: Direct Viewport, Geometry & Navigation controls */}
        {isTablet && (
          <View pointerEvents="auto" style={[styles.topCenterTablet, { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant, ...sh(t) }]}>
            {/* Viewport / Grid controls */}
            <IconButton
              name="Grid3x3"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              active={grid}
              onPress={() => toggleEngine('#bgrid, #pb-grid', setGrid)}
            />
            <IconButton
              name="Compass"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              active={axis}
              onPress={() => toggleEngine('#baxis, #pb-axis', setAxis)}
            />
            <IconButton
              name={persp ? 'Box' : 'Square'}
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              active={persp}
              onPress={() => toggleEngine('#bpersp, #pb-nav-persp', setPersp)}
            />
            <IconButton
              name="Layers2"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              active={surf}
              onPress={() => toggleEngine('#bsurf, #pb-surf', setSurf)}
            />
            <IconButton
              name="Droplets"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              active={depth}
              onPress={() => toggleEngine('#bdepth, #pb-depth', setDepth)}
            />

            <View style={[styles.div, { backgroundColor: t.outlineVariant }]} />

            {/* Navigation / Stylus Modes */}
            <IconButton
              name="Orbit"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              active={orbit}
              onPress={() => { clickEngine('#borbit'); setOrbit(true); setPan(false); }}
            />
            <IconButton
              name="Hand"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              active={pan}
              onPress={() => { clickEngine('#bpan'); setPan(true); setOrbit(false); }}
            />
            <IconButton
              name="PenTool"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              active={stylus}
              onPress={() => toggleEngine('#bstylus, #pb-stylus', setStylus)}
            />
            <IconButton
              name="Move3d"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              active={lcl}
              onPress={() => toggleEngine('#lcl-float, #glocal, #pb-glocal', setLcl)}
            />
          </View>
        )}

        {/* Right Section: History, Layers, Export & Settings */}
        <View pointerEvents="auto" style={[isTablet ? styles.topRightTablet : styles.topRight, { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant, ...sh(t) }]}>
          {isTablet ? (
            <View style={styles.topRightTabletContent}>
              <IconButton
                name="Undo2"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                active={canUndo}
                onPress={handleUndo}
              />
              <IconButton
                name="Redo2"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                active={canRedo}
                onPress={handleRedo}
              />
              <View style={[styles.div, { backgroundColor: t.outlineVariant }]} />
              <IconButton
                name="Layers"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                onPress={() => clickEngine('#blayers')}
              />
              {isWideTablet && (
                <>
                  <IconButton
                    name="Bookmark"
                    size={icnSz}
                    btnSize={btnSz}
                    variant="flat"
                    onPress={() => clickEngine('#vwbtn, #pb-vwbtn')}
                  />
                  <IconButton
                    name="Palette"
                    size={icnSz}
                    btnSize={btnSz}
                    variant="flat"
                    onPress={() => clickEngine('#bbg, #pb-bg')}
                  />
                </>
              )}
              <IconButton
                name="Share2"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                onPress={() => setExportOpen(true)}
              />
              <View style={[styles.div, { backgroundColor: t.outlineVariant }]} />
              <IconButton
                name="Settings"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                onPress={() => setSettingsOpen(true)}
              />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topRightScroll}
            >
              <IconButton
                name="Grid3x3"
                size={17}
                btnSize={34}
                variant="flat"
                active={grid}
                onPress={() => toggleEngine('#bgrid, #pb-grid', setGrid)}
              />
              <IconButton
                name="Compass"
                size={17}
                btnSize={34}
                variant="flat"
                active={axis}
                onPress={() => toggleEngine('#baxis, #pb-axis', setAxis)}
              />
              <IconButton
                name={persp ? 'Box' : 'Square'}
                size={17}
                btnSize={34}
                variant="flat"
                active={persp}
                onPress={() => toggleEngine('#bpersp, #pb-nav-persp', setPersp)}
              />
              <IconButton
                name="Layers"
                size={17}
                btnSize={34}
                variant="flat"
                onPress={() => clickEngine('#blayers')}
              />
              <IconButton
                name="Undo2"
                size={17}
                btnSize={34}
                variant="flat"
                active={canUndo}
                onPress={handleUndo}
              />
              <IconButton
                name="Redo2"
                size={17}
                btnSize={34}
                variant="flat"
                active={canRedo}
                onPress={handleRedo}
              />
              <IconButton
                name="Share2"
                size={17}
                btnSize={34}
                variant="flat"
                onPress={() => setExportOpen(true)}
              />
              <View style={[styles.div, { backgroundColor: t.outlineVariant }]} />
              <IconButton
                name="Save"
                size={17}
                btnSize={34}
                variant="flat"
                onPress={() => onSave(true)}
              />
              <IconButton
                name="Settings"
                size={17}
                btnSize={34}
                variant="flat"
                onPress={() => setSettingsOpen(true)}
              />
            </ScrollView>
          )}
        </View>
      </Animated.View>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastFade,
              backgroundColor: t.inverseSurface,
              transform: [{ translateY: toastFade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.toastText, { color: t.inverseOnSurface }]}>{toastMsg}</Text>
        </Animated.View>
      )}

      {/* Export Dialog */}
      <ExportDialog
        bridge={bridge}
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
      />

      {/* Menu / settings sheet — preserves every engine function */}
      <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} title={tr.editor.toolsMenu} maxWidth={640}>
        <SectionTitle>{tr.editor.drawingToolsSection}</SectionTitle>
        <View style={isTablet ? styles.settingsGridTablet : undefined}>
          <ActionRow icon="PenTool" label={tr.editor.drawMode} onPress={() => { clickEngine('#sdraw'); setSettingsOpen(false); showToast(tr.editor.toasts.drawing); }} t={t} />
          <ActionRow icon="Eraser" label={tr.editor.eraseMode} onPress={() => { clickEngine('#serase'); setSettingsOpen(false); showToast(tr.editor.toasts.erasing); }} t={t} />
          <ActionRow icon="Hand" label={tr.editor.selectMode} onPress={() => { clickEngine('#sselect'); setSettingsOpen(false); showToast(tr.editor.toasts.selecting); }} t={t} />
          <ActionRow icon="Square" label={tr.editor.flatBrush} onPress={() => { clickEngine('#sflat'); setSettingsOpen(false); showToast(tr.editor.toasts.flat); }} t={t} />
          <ActionRow icon="Droplets" label={tr.editor.smoothStroke} onPress={() => { clickEngine('#ssmooth'); setSettingsOpen(false); showToast(tr.editor.toasts.smooth); }} t={t} />
          <ActionRow icon="Scaling" label={tr.editor.velocityStroke} onPress={() => { clickEngine('#svel'); setSettingsOpen(false); showToast(tr.editor.toasts.vel); }} t={t} />
        </View>

        <SectionTitle>{tr.editor.cameraSection}</SectionTitle>
        <View style={isTablet ? styles.settingsGridTablet : undefined}>
          <ActionRow icon="Orbit" label={tr.editor.orbitMode} active={orbit} onPress={() => { clickEngine('#borbit'); setOrbit(true); setPan(false); }} t={t} />
          <ActionRow icon="Hand" label={tr.editor.panMode} active={pan} onPress={() => { clickEngine('#bpan'); setPan(true); setOrbit(false); }} t={t} />
          <ActionRow icon="Locate" label={tr.editor.resetCam} onPress={() => { clickEngine('#nav-reset, #pb-nav-reset'); setSettingsOpen(false); }} t={t} />
          <ActionRow icon="Compass" label={tr.editor.alignCamPlane} onPress={() => { clickEngine('#gface, #pb-gface'); setSettingsOpen(false); }} t={t} />
          <ActionRow icon="ZoomIn" label={tr.editor.zoomIn} onPress={() => { clickEngine('#nav-zoom-in, #pb-nav-zoom-in'); }} t={t} />
          <ActionRow icon="ZoomOut" label={tr.editor.zoomOut} onPress={() => { clickEngine('#nav-zoom-out, #pb-nav-zoom-out'); }} t={t} />
        </View>

        <SectionTitle>{tr.editor.appearanceSection}</SectionTitle>
        <SwitchRow label={tr.editor.appDarkMode} value={themeMode === 'dark'} onValueChange={toggleTheme} t={t} />
        <SwitchRow
          label={tr.editor.hwAccel}
          value={hardwareAcceleration}
          onValueChange={setHardwareAcceleration}
          t={t}
        />
        <ActionRow icon="SunMoon" label={tr.editor.themeToggle} onPress={() => clickEngine('#btheme, #pb-theme')} t={t} />

        <SectionTitle>{tr.editor.sceneAndRenderSection}</SectionTitle>
        <View style={isTablet ? styles.settingsGridTablet : undefined}>
          <SwitchRow label={tr.editor.gridToggle} value={grid} onValueChange={() => toggleEngine('#bgrid, #pb-grid', setGrid)} t={t} />
          <SwitchRow label={tr.editor.axisToggle} value={axis} onValueChange={() => toggleEngine('#baxis, #pb-axis', setAxis)} t={t} />
          <SwitchRow label={tr.editor.perspToggle} value={persp} onValueChange={() => toggleEngine('#bpersp, #pb-nav-persp', setPersp)} t={t} />
          <SwitchRow label={tr.editor.surfaceToggle} value={surf} onValueChange={() => toggleEngine('#bsurf, #pb-surf', setSurf)} t={t} />
          <SwitchRow label={tr.editor.depthToggle} value={depth} onValueChange={() => toggleEngine('#bdepth, #pb-depth', setDepth)} t={t} />
          <SwitchRow label={tr.editor.surfGrid} value={surfgrid} onValueChange={() => toggleEngine('#bsurfgrid, #pb-surfgrid', setSurfgrid)} t={t} />
        </View>
        <ActionRow icon="Droplets" label={tr.editor.depthOp} onPress={() => { clickEngine('#bdepth-op, #pb-depthop'); setSettingsOpen(false); }} t={t} />

        <SectionTitle>{tr.editor.navigationSection}</SectionTitle>
        <View style={isTablet ? styles.settingsGridTablet : undefined}>
          <SwitchRow label={tr.editor.gestSwap} value={gestswap} onValueChange={() => toggleEngine('#bgestswap, #pb-gestswap', setGestswap)} t={t} />
          <SwitchRow label={tr.editor.stylusMode} value={stylus} onValueChange={() => toggleEngine('#bstylus, #pb-stylus', setStylus)} t={t} />
          <ActionRow icon="Move3d" label={tr.editor.lclGizmo} active={lcl} onPress={() => toggleEngine('#lcl-float, #glocal, #pb-glocal', setLcl)} t={t} />
          <ActionRow icon="Compass" label={tr.editor.snap45} onPress={() => { clickEngine('#gsnap, #pb-gsnap'); }} t={t} />
        </View>

        <SectionTitle>{tr.editor.sceneAndBgSection}</SectionTitle>
        <View style={isTablet ? styles.settingsGridTablet : undefined}>
          <ActionRow icon="FileStack" label={tr.editor.pages} onPress={() => { clickEngine('#pgbtn, #pb-pgbtn'); setSettingsOpen(false); }} t={t} />
          <ActionRow icon="Bookmark" label={tr.editor.savedViews} onPress={() => { clickEngine('#vwbtn, #pb-vwbtn'); setSettingsOpen(false); }} t={t} />
          <ActionRow icon="Palette" label={tr.editor.bgPalette} onPress={() => { clickEngine('#bbg, #pb-bg'); setSettingsOpen(false); }} t={t} />
          <ActionRow icon="Video" label={tr.editor.recordVideo} onPress={() => { clickEngine('#vw-rec'); setSettingsOpen(false); }} t={t} />
        </View>

        <SectionTitle>{tr.editor.preferencesSection}</SectionTitle>
        <SwitchRow
          label={tr.editor.resetCamPref}
          value={resetCamOnOpen}
          onValueChange={setResetCamOnOpen}
          t={t}
        />
        <SwitchRow label={tr.editor.confirmExitPref} value={confirmExit} onValueChange={setConfirmExit} t={t} />

        <SectionTitle>{tr.editor.projectAndMeshSection}</SectionTitle>
        <View style={isTablet ? styles.settingsGridTablet : undefined}>
          <ActionRow icon="Share2" label={tr.editor.exportFile} onPress={() => { setSettingsOpen(false); setExportOpen(true); }} t={t} />
          <ActionRow icon="FilePlus" label={tr.editor.newProject} onPress={() => { clickEngine('#bnew, #pb-new'); setSettingsOpen(false); }} t={t} />
          <ActionRow icon="FolderOpen" label={tr.editor.loadJson} onPress={onLoadFile} t={t} />
          <ActionRow icon="Image" label={tr.editor.quickPng} onPress={() => { clickEngine('#bpng, #pb-png'); setSettingsOpen(false); }} t={t} />
          <ActionRow icon="Scaling" label={tr.editor.exportScale} onPress={() => { clickEngine('#bscale'); setSettingsOpen(false); }} t={t} />
          <ActionRow icon="GitMerge" label={tr.editor.createLoft} onPress={() => { clickEngine('#sg-loft'); setSettingsOpen(false); }} t={t} />
        </View>
        <ActionRow icon="Eraser" label={tr.editor.clearAll} danger onPress={() => { clickEngine('#bclear, #pb-clear'); setSettingsOpen(false); }} t={t} />
        <ActionRow icon="Trash2" label={tr.editor.deleteLoft} danger onPress={() => { clickEngine('#bdelloft'); setSettingsOpen(false); }} t={t} />
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
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: t.surfaceContainerHighest, true: t.primary }}
        thumbColor={value ? t.onPrimary : t.outline}
      />
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
  const fg = danger ? t.error : active ? t.onPrimaryContainer : t.text;
  const bg = active ? t.primaryContainer : t.surfaceContainer;
  const iconBg = danger ? t.errorContainer : active ? t.primary : t.secondaryContainer;
  const iconFg = danger ? t.onErrorContainer : active ? t.onPrimary : t.onSecondaryContainer;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        {
          backgroundColor: pressed ? t.surfaceContainerHighest : bg,
          borderColor: active ? t.primary : t.outlineVariant,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={18} color={iconFg} />
      </View>
      <Text style={[styles.actionLabel, { color: fg, fontWeight: active ? '600' : '500' }]}>{label}</Text>
    </Pressable>
  );
}

function sh(t: ReturnType<typeof useTheme>) {
  return {
    shadowColor: t.shadowColor,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  };
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTablet: {
    top: spacing.md + 2,
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.md,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  topLeftTablet: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    gap: 6,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: typography.title.fontFamily,
    letterSpacing: 0.2,
  },
  brandTextTablet: {
    fontSize: 15,
  },
  projText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: typography.body.fontFamily,
    letterSpacing: 0.2,
    maxWidth: 160,
  },
  projTextTablet: {
    fontSize: 13,
    maxWidth: 240,
  },
  topCenterTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 4,
  },
  topRightTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  topRightTabletContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topRight: {
    flex: 1,
    marginLeft: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  topRightScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  div: {
    width: 1,
    height: 22,
    marginHorizontal: 4,
    opacity: 0.7,
  },
  settingsGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    minWidth: '48%',
  },
  rowLabel: {
    fontSize: typography.bodyLarge.fontSize,
    fontFamily: typography.bodyLarge.fontFamily,
    letterSpacing: 0.2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xs,
    minWidth: '48%',
    flex: 1,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: typography.labelLarge.fontSize,
    fontFamily: typography.labelLarge.fontFamily,
    letterSpacing: 0.1,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.full,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 99999,
  },
  toastText: {
    fontSize: typography.labelLarge.fontSize,
    fontFamily: typography.labelLarge.fontFamily,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
