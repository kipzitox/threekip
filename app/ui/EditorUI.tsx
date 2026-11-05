import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
  Animated,
  BackHandler,
  Easing,
  Platform,
  Modal,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import type {
  SketchbookBridge,
  WebViewHandleLike,
} from "../services/sketchbookBridge";
import { Icon, IconButton, Sheet, SectionTitle, Button } from "./primitives";
import { ExportDialog } from "./ExportDialog";
import { useUIStore } from "../stores/UIStore";
import { useSettingsStore } from "../stores/SettingsStore";
import { useProjectStore } from "../stores/ProjectStore";
import { useI18n } from "../i18n";
import * as DocumentPicker from "expo-document-picker";
import { radius, spacing, typography } from "../theme";
import { useTheme } from "../theme/ThemeProvider";

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
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
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
  const [activeTool, setActiveTool] = useState<"draw" | "erase" | "select">(
    "draw",
  );
  const [gestswap, setGestswap] = useState(false);
  const [lcl, setLcl] = useState(false);

  const themeMode = useUIStore((s) => s.themeMode);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const hardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);
  const setHardwareAcceleration = useSettingsStore(
    (s) => s.setHardwareAcceleration,
  );
  const resetCamOnOpen = useSettingsStore((s) => s.resetCamOnOpen);
  const setResetCamOnOpen = useSettingsStore((s) => s.setResetCamOnOpen);
  const confirmExit = useSettingsStore((s) => s.confirmExit);
  const setConfirmExit = useSettingsStore((s) => s.setConfirmExit);
  const saveCurrent = useProjectStore((s) => s.saveCurrent);
  const projectName = useProjectStore(
    (s) => s.projects.find((p) => p.id === s.currentProjectId)?.name,
  );

  const appear = useRef(new Animated.Value(0)).current;
  const toastFade = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    toastFade.setValue(0);
    Animated.sequence([
      Animated.timing(toastFade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.delay(1800),
      Animated.timing(toastFade, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start(() => setToastMsg(null));
  };

  // Auto-save the current project's progress to its own RN file, debounced so
  // we don't hammer the bridge/file system on every stroke or camera move.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSave = async (showFeedback = true) => {
    try {
      const res = (await bridge.send("saveProject")) as
        { data?: unknown } | undefined;
      const data = res?.data;
      // Do not let an empty engine response overwrite the project on disk.
      // saveCurrent() also guards this, but failing here keeps the error
      // message specific about where it came from.
      if (data === null || data === undefined) {
        throw new Error("Engine returned no scene data");
      }
      await saveCurrent(data);
      if (showFeedback) {
        showToast(tr.editor.saveSuccess);
      }
    } catch (e) {
      console.error("[EditorUI] save failed", e);
      if (showFeedback) {
        showToast(tr.editor.saveError);
      }
      throw e;
    }
  };

  // "Cargar" — the engine's own file picker (<input type=file>) can't open a
  // native chooser inside the WebView, so we use RN's Document Picker and load
  // the selected project file's scene directly into the engine + current project.
  const onLoadFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) {
        setSettingsOpen(false);
        return;
      }
      const asset = res.assets[0];
      let text = "";
      if (Platform.OS === "web") {
        if (asset.file) {
          text = await asset.file.text();
        } else if (asset.uri) {
          const resp = await fetch(asset.uri);
          text = await resp.text();
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const NativeFS = require("expo-file-system");
        text = await NativeFS.readAsStringAsync(asset.uri);
      }
      const parsed = JSON.parse(text) as { scene?: unknown };
      const scene = parsed?.scene ?? parsed;
      await bridge.send("loadProject", { data: scene ?? {} });
      await saveCurrent(scene ?? null);
      setSettingsOpen(false);
      showToast(tr.editor.loadSuccess);
    } catch (e) {
      console.error("[EditorUI] load file failed", e);
      Alert.alert(tr.editor.loadTitle, tr.editor.loadError);
      setSettingsOpen(false);
    }
  };

  const scheduleAutoSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (useProjectStore.getState().currentProjectId)
        onSave(false).catch(() => {});
    }, 1200);
  };

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [appear]);

  useEffect(() => {
    const offs = [
      bridge.on("historyChanged", (d: any) => {
        setCanUndo(!!d?.canUndo);
        setCanRedo(!!d?.canRedo);
        scheduleAutoSave();
      }),
      bridge.on("strokeAdded", () => {
        setCanUndo(true);
        scheduleAutoSave();
      }),
      bridge.on("tkState", (d: any) => {
        if (typeof d?.grid === "boolean") setGrid(d.grid);
        if (typeof d?.axis === "boolean") setAxis(d.axis);
        if (typeof d?.persp === "boolean") setPersp(d.persp);
        if (typeof d?.surf === "boolean") setSurf(d.surf);
        if (typeof d?.depth === "boolean") setDepth(d.depth);
        if (typeof d?.surfgrid === "boolean") setSurfgrid(d.surfgrid);
        if (typeof d?.pan === "boolean") setPan(d.pan);
        if (typeof d?.orbit === "boolean") setOrbit(d.orbit);
        if (typeof d?.stylus === "boolean") setStylus(d.stylus);
        if (typeof d?.gestswap === "boolean") setGestswap(d.gestswap);
        if (typeof d?.lcl === "boolean") setLcl(d.lcl);
      }),
      bridge.on("requestClearConfirm" as any, () => {
        setConfirmClearOpen(true);
      }),
    ];
    return () => offs.forEach((f) => f());
  }, [bridge]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = useCallback(async () => {
    const leave = async () => {
      await onSave(false).catch(() => {});
      router.back();
    };
    if (confirmExit) {
      Alert.alert(tr.editor.exitConfirmTitle, tr.editor.exitConfirmMessage, [
        { text: tr.common.cancel, style: "cancel" },
        {
          text: tr.editor.exitButton,
          style: "destructive",
          onPress: () => leave(),
        },
      ]);
    } else {
      await leave();
    }
  }, [confirmExit, onSave, tr]);

  // Android hardware back / predictive-back gesture bypassed handleBack and left
  // the editor without saving or confirming. Intercept it so system back and the
  // in-app button behave identically.
  useEffect(() => {
    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBack();
        return true;
      }
    );
    return () => sub.remove();
  }, [handleBack]);

  // Drive the engine's own buttons (kept in the DOM, just hidden by our CSS) so
  // we don't reimplement editor functions outside the allowed RN-only scope.
  // We evaluate selectors in priority order and click the first matching element.
  const clickEngine = useCallback(
    (sel: string) => {
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
      })()`,
      );
    },
    [webRef],
  );

  const toggleEngine = useCallback(
    (sel: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      clickEngine(sel);
      setter((p) => !p);
    },
    [clickEngine],
  );

  const handleSetTool = useCallback(
    (tool: "draw" | "erase" | "select") => {
      setActiveTool(tool);
      if (tool === "draw") clickEngine("#sdraw");
      else if (tool === "erase") clickEngine("#serase");
      else if (tool === "select") clickEngine("#sselect");
      showToast(
        tool === "draw"
          ? tr.editor.toasts.drawing
          : tool === "erase"
            ? tr.editor.toasts.erasing
            : tr.editor.toasts.selecting,
      );
    },
    [clickEngine, showToast, tr],
  );

  const handleUndo = useCallback(async () => {
    try {
      await bridge.send("undo");
    } catch {
      clickEngine("#bundo, #s-undo, #pb-undo");
    }
    showToast(tr.editor.toasts.undo);
  }, [bridge, clickEngine, showToast, tr]);

  const handleRedo = useCallback(async () => {
    try {
      await bridge.send("redo");
    } catch {
      clickEngine("#bredo, #s-redo, #pb-redo");
    }
    showToast(tr.editor.toasts.redo);
  }, [bridge, clickEngine, showToast, tr]);

  // Physical/Hardware keyboard shortcuts on tablets & web
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave(true).catch(() => {});
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExportOpen(true);
      } else if (e.key === "Escape") {
        setSettingsOpen(false);
        setExportOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo]); // eslint-disable-line react-hooks/exhaustive-deps

  const isMobile = width < 768;
  const isSmallPhone = width < 380;
  const btnSz = isTablet ? 38 : isSmallPhone ? 32 : 36;
  const icnSz = isTablet ? 20 : isSmallPhone ? 16 : 18;
  const bBarBtnSz = isSmallPhone ? 36 : 40;
  const bBarIconSz = isSmallPhone ? 16 : 18;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Top app bar */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.topBarWrap,
          isTablet && styles.topBarWrapTablet,
          {
            opacity: appear,
            transform: [
              {
                translateY: appear.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View
          style={[styles.topBarInner, isTablet && styles.topBarInnerTablet]}
          pointerEvents="box-none"
        >
          {/* Left Section: Back Button + Project Title Badge */}
          <View
            pointerEvents="auto"
            style={[
              styles.topSegment,
              styles.topSegmentTablet,
              {
                backgroundColor: t.surfaceContainerLow,
                borderColor: t.outlineVariant,
                ...sh(t),
              },
            ]}
          >
            <IconButton
              name="ChevronLeft"
              size={icnSz + 2}
              btnSize={btnSz}
              variant="ghost"
              onPress={handleBack}
            />
            <View style={styles.projBadge}>
              <Text
                style={[
                  styles.projText,
                  isMobile && { maxWidth: 105 },
                  { color: t.text },
                ]}
                numberOfLines={1}
              >
                {projectName || tr.library.untitled}
              </Text>
            </View>
          </View>

          {/* Center: Quick Scene View Controls (Tablets & Desktop) */}
          {isTablet && (
            <View
              pointerEvents="auto"
              style={[
                styles.topSegment,
                {
                  backgroundColor: t.surfaceContainerLow,
                  borderColor: t.outlineVariant,
                  ...sh(t),
                },
              ]}
            >
              <IconButton
                name="LayoutGrid"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                active={grid}
                onPress={() => toggleEngine("#bgrid, #pb-grid", setGrid)}
              />
              <IconButton
                name="Compass"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                active={axis}
                onPress={() => toggleEngine("#baxis, #pb-axis", setAxis)}
              />
              <IconButton
                name="Box"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                active={persp}
                onPress={() => toggleEngine("#bpersp, #pb-nav-persp", setPersp)}
              />
              <IconButton
                name="Layers"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                active={surf}
                onPress={() => toggleEngine("#bsurf, #pb-surf", setSurf)}
              />
              <IconButton
                name="Target"
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                active={depth}
                onPress={() => toggleEngine("#bdepth, #pb-depth", setDepth)}
              />
            </View>
          )}

          {/* Right Section: Save, Share & Settings */}
          <View
            pointerEvents="auto"
            style={[
              styles.topSegment,
              {
                backgroundColor: t.surfaceContainerLow,
                borderColor: t.outlineVariant,
                ...sh(t),
              },
            ]}
          >
            <IconButton
              name="Save"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              onPress={() => {
                onSave(true).catch(() => {});
              }}
            />
            <IconButton
              name="Share"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              onPress={() => setExportOpen(true)}
            />
            {isWideTablet && (
              <IconButton
                name={themeMode === "dark" ? "Sun" : "Moon"}
                size={icnSz}
                btnSize={btnSz}
                variant="flat"
                onPress={toggleTheme}
              />
            )}
            <View style={[styles.div, { backgroundColor: t.outlineVariant }]} />
            <IconButton
              name="Menu"
              size={icnSz}
              btnSize={btnSz}
              variant="flat"
              onPress={() => setSettingsOpen(true)}
            />
          </View>
        </View>
      </Animated.View>

      {/* Bottom Control Bar (Mobile & Tablet ergonomic bar) */}
      {!isWideTablet && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.bottomBarWrap,
            {
              opacity: appear,
              transform: [
                {
                  translateY: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            pointerEvents="auto"
            style={[
              styles.bottomBar,
              isSmallPhone && styles.bottomBarSmall,
              {
                backgroundColor: t.surfaceContainerLow,
                borderColor: t.outlineVariant,
                ...sh(t),
              },
            ]}
          >
            {/* Main Tools Group */}
            <View style={[styles.toolGroup, isSmallPhone && { gap: 2 }]}>
              <IconButton
                name="Pencil"
                size={bBarIconSz}
                btnSize={bBarBtnSz}
                variant={activeTool === "draw" ? "tonal" : "ghost"}
                active={activeTool === "draw"}
                onPress={() => handleSetTool("draw")}
              />
              <IconButton
                name="Eraser"
                size={bBarIconSz}
                btnSize={bBarBtnSz}
                variant={activeTool === "erase" ? "tonal" : "ghost"}
                active={activeTool === "erase"}
                onPress={() => handleSetTool("erase")}
              />
              <IconButton
                name="MousePointer2"
                size={bBarIconSz}
                btnSize={bBarBtnSz}
                variant={activeTool === "select" ? "tonal" : "ghost"}
                active={activeTool === "select"}
                onPress={() => handleSetTool("select")}
              />
            </View>

            <View
              style={[
                styles.div,
                { backgroundColor: t.outlineVariant, height: 22 },
              ]}
            />

            {/* History & Meta Group */}
            <View style={[styles.toolGroup, isSmallPhone && { gap: 2 }]}>
              <IconButton
                name="Undo"
                size={bBarIconSz}
                btnSize={bBarBtnSz}
                variant="ghost"
                disabled={!canUndo}
                onPress={handleUndo}
              />
              <IconButton
                name="Redo"
                size={bBarIconSz}
                btnSize={bBarBtnSz}
                variant="ghost"
                disabled={!canRedo}
                onPress={handleRedo}
              />
              <IconButton
                name="LayoutGrid"
                size={bBarIconSz}
                btnSize={bBarBtnSz}
                variant={grid ? "tonal" : "ghost"}
                active={grid}
                onPress={() => toggleEngine("#bgrid, #pb-grid", setGrid)}
              />
            </View>
          </View>
        </Animated.View>
      )}

      {/* Tablet Sidebar Toolbar (Wide screens) */}
      {isWideTablet && (
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.sideBar,
            {
              opacity: appear,
              backgroundColor: t.surfaceContainerLow,
              borderColor: t.outlineVariant,
              transform: [
                {
                  translateX: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
              ...sh(t),
            },
          ]}
        >
          <IconButton
            name="Pencil"
            size={20}
            btnSize={46}
            active={activeTool === "draw"}
            variant={activeTool === "draw" ? "filled" : "ghost"}
            onPress={() => handleSetTool("draw")}
          />
          <IconButton
            name="Eraser"
            size={20}
            btnSize={46}
            active={activeTool === "erase"}
            variant={activeTool === "erase" ? "filled" : "ghost"}
            onPress={() => handleSetTool("erase")}
          />
          <IconButton
            name="MousePointer2"
            size={20}
            btnSize={46}
            active={activeTool === "select"}
            variant={activeTool === "select" ? "filled" : "ghost"}
            onPress={() => handleSetTool("select")}
          />
          <View style={[styles.divH, { backgroundColor: t.outlineVariant }]} />
          <IconButton
            name="Undo"
            size={20}
            btnSize={46}
            variant="ghost"
            disabled={!canUndo}
            onPress={handleUndo}
          />
          <IconButton
            name="Redo"
            size={20}
            btnSize={46}
            variant="ghost"
            disabled={!canRedo}
            onPress={handleRedo}
          />
          <View style={[styles.divH, { backgroundColor: t.outlineVariant }]} />
          <IconButton
            name="Box"
            size={20}
            btnSize={46}
            active={persp}
            variant="ghost"
            onPress={() => toggleEngine("#bpersp, #pb-nav-persp", setPersp)}
          />
          <IconButton
            name="Grid3x3"
            size={20}
            btnSize={46}
            active={grid}
            variant="ghost"
            onPress={() => toggleEngine("#bgrid, #pb-grid", setGrid)}
          />
          <IconButton
            name="Layers"
            size={20}
            btnSize={46}
            variant="ghost"
            onPress={() => clickEngine("#blayers")}
          />
        </Animated.View>
      )}

      {/* Floating Toast Notification */}
      {toastMsg && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastFade,
              backgroundColor: t.inverseSurface,
              transform: [
                {
                  translateY: toastFade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.toastText, { color: t.inverseOnSurface }]}>
            {toastMsg}
          </Text>
        </Animated.View>
      )}

      {/* Export Dialog */}
      <ExportDialog
        bridge={bridge}
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
      />

      {/* Clear Canvas Confirmation Modal */}
      <Modal
        visible={confirmClearOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmClearOpen(false)}
      >
        <View style={styles.confirmModalScrim}>
          <View
            style={[
              styles.confirmModalCard,
              {
                backgroundColor: t.surfaceContainerHigh,
                borderColor: t.outlineVariant,
              },
            ]}
          >
            <View style={styles.confirmIconContainer}>
              <Icon name="Eraser" size={26} color="#d93829" />
            </View>
            <Text style={[styles.confirmTitle, { color: t.text }]}>
              {tr.editor.clearConfirmTitle}
            </Text>
            <Text style={[styles.confirmMessage, { color: t.textMuted }]}>
              {tr.editor.clearConfirmMessage}
            </Text>
            <View style={styles.confirmActionsRow}>
              <Button
                label={tr.common.cancel}
                variant="outlined"
                onPress={() => setConfirmClearOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                label={tr.editor.clearAll}
                variant="danger"
                onPress={() => {
                  setConfirmClearOpen(false);
                  webRef.current?.injectJavaScript(`
                    if (typeof clearAll === 'function') {
                      clearAll();
                    }
                    true;
                  `);
                  showToast(tr.editor.toasts.cleared);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Menu / settings sheet — preserves every engine function */}
      <Sheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={tr.editor.toolsMenu}
        maxWidth={460}
      >
        <SectionTitle>{tr.editor.drawingToolsSection}</SectionTitle>
        <View style={styles.actionGrid}>
          <ActionRow
            icon="Pencil"
            label={tr.editor.drawMode}
            onPress={() => {
              handleSetTool("draw");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="Eraser"
            label={tr.editor.eraseMode}
            onPress={() => {
              handleSetTool("erase");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="MousePointer2"
            label={tr.editor.selectMode}
            onPress={() => {
              handleSetTool("select");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="Square"
            label={tr.editor.flatBrush}
            onPress={() => {
              clickEngine("#sflat");
              setSettingsOpen(false);
              showToast(tr.editor.toasts.flat);
            }}
            t={t}
          />
          <ActionRow
            icon="Droplets"
            label={tr.editor.smoothStroke}
            onPress={() => {
              clickEngine("#ssmooth");
              setSettingsOpen(false);
              showToast(tr.editor.toasts.smooth);
            }}
            t={t}
          />
          <ActionRow
            icon="Scaling"
            label={tr.editor.velocityStroke}
            onPress={() => {
              clickEngine("#svel");
              setSettingsOpen(false);
              showToast(tr.editor.toasts.vel);
            }}
            t={t}
          />
        </View>

        <SectionTitle>{tr.editor.cameraSection}</SectionTitle>
        <View style={styles.actionGrid}>
          <ActionRow
            icon="Orbit"
            label={tr.editor.orbitMode}
            active={orbit}
            onPress={() => {
              clickEngine("#borbit");
              setOrbit(true);
              setPan(false);
            }}
            t={t}
          />
          <ActionRow
            icon="Hand"
            label={tr.editor.panMode}
            active={pan}
            onPress={() => {
              clickEngine("#bpan");
              setPan(true);
              setOrbit(false);
            }}
            t={t}
          />
          <ActionRow
            icon="Locate"
            label={tr.editor.resetCam}
            onPress={() => {
              clickEngine("#nav-reset, #pb-nav-reset");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="Compass"
            label={tr.editor.alignCamPlane}
            onPress={() => {
              clickEngine("#gface, #pb-gface");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="ZoomIn"
            label={tr.editor.zoomIn}
            onPress={() => {
              clickEngine("#nav-zoom-in, #pb-nav-zoom-in");
            }}
            t={t}
          />
          <ActionRow
            icon="ZoomOut"
            label={tr.editor.zoomOut}
            onPress={() => {
              clickEngine("#nav-zoom-out, #pb-nav-zoom-out");
            }}
            t={t}
          />
        </View>

        <SectionTitle>{tr.editor.appearanceSection}</SectionTitle>
        <SwitchRow
          label={tr.editor.appDarkMode}
          value={themeMode === "dark"}
          onValueChange={toggleTheme}
          t={t}
        />
        <SwitchRow
          label={tr.editor.hwAccel}
          value={hardwareAcceleration}
          onValueChange={setHardwareAcceleration}
          t={t}
        />
        <ActionRow
          icon="SunMoon"
          label={tr.editor.themeToggle}
          onPress={() => clickEngine("#btheme, #pb-theme")}
          t={t}
        />

        <SectionTitle>{tr.editor.sceneAndRenderSection}</SectionTitle>
        <View style={isTablet ? styles.actionGrid : undefined}>
          <SwitchRow
            label={tr.editor.gridToggle}
            value={grid}
            onValueChange={() => toggleEngine("#bgrid, #pb-grid", setGrid)}
            t={t}
          />
          <SwitchRow
            label={tr.editor.axisToggle}
            value={axis}
            onValueChange={() => toggleEngine("#baxis, #pb-axis", setAxis)}
            t={t}
          />
          <SwitchRow
            label={tr.editor.perspToggle}
            value={persp}
            onValueChange={() =>
              toggleEngine("#bpersp, #pb-nav-persp", setPersp)
            }
            t={t}
          />
          <SwitchRow
            label={tr.editor.surfaceToggle}
            value={surf}
            onValueChange={() => toggleEngine("#bsurf, #pb-surf", setSurf)}
            t={t}
          />
          <SwitchRow
            label={tr.editor.depthToggle}
            value={depth}
            onValueChange={() => toggleEngine("#bdepth, #pb-depth", setDepth)}
            t={t}
          />
          <SwitchRow
            label={tr.editor.surfGrid}
            value={surfgrid}
            onValueChange={() =>
              toggleEngine("#bsurfgrid, #pb-surfgrid", setSurfgrid)
            }
            t={t}
          />
        </View>
        <ActionRow
          icon="Droplets"
          label={tr.editor.depthOp}
          onPress={() => {
            clickEngine("#bdepth-op, #pb-depthop");
            setSettingsOpen(false);
          }}
          t={t}
        />

        <SectionTitle>{tr.editor.navigationSection}</SectionTitle>
        <View style={isTablet ? styles.actionGrid : undefined}>
          <SwitchRow
            label={tr.editor.gestSwap}
            value={gestswap}
            onValueChange={() =>
              toggleEngine("#bgestswap, #pb-gestswap", setGestswap)
            }
            t={t}
          />
          <SwitchRow
            label={tr.editor.stylusMode}
            value={stylus}
            onValueChange={() =>
              toggleEngine("#bstylus, #pb-stylus", setStylus)
            }
            t={t}
          />
        </View>
        <View style={styles.actionGrid}>
          <ActionRow
            icon="Move3d"
            label={tr.editor.lclGizmo}
            active={lcl}
            onPress={() =>
              toggleEngine("#lcl-float, #glocal, #pb-glocal", setLcl)
            }
            t={t}
          />
          <ActionRow
            icon="Compass"
            label={tr.editor.snap45}
            onPress={() => {
              clickEngine("#gsnap, #pb-gsnap");
            }}
            t={t}
          />
        </View>

        <SectionTitle>{tr.editor.sceneAndBgSection}</SectionTitle>
        <View style={styles.actionGrid}>
          <ActionRow
            icon="FileStack"
            label={tr.editor.pages}
            onPress={() => {
              clickEngine("#pgbtn, #pb-pgbtn");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="Bookmark"
            label={tr.editor.savedViews}
            onPress={() => {
              clickEngine("#vwbtn, #pb-vwbtn");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="Palette"
            label={tr.editor.bgPalette}
            onPress={() => {
              clickEngine("#bbg, #pb-bg");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="Video"
            label={tr.editor.recordVideo}
            onPress={() => {
              clickEngine("#vw-rec");
              setSettingsOpen(false);
            }}
            t={t}
          />
        </View>

        <SectionTitle>{tr.editor.preferencesSection}</SectionTitle>
        <SwitchRow
          label={tr.editor.resetCamPref}
          value={resetCamOnOpen}
          onValueChange={setResetCamOnOpen}
          t={t}
        />
        <SwitchRow
          label={tr.editor.confirmExitPref}
          value={confirmExit}
          onValueChange={setConfirmExit}
          t={t}
        />

        <SectionTitle>{tr.editor.projectAndMeshSection}</SectionTitle>
        <View style={styles.actionGrid}>
          <ActionRow
            icon="Share2"
            label={tr.editor.exportFile}
            onPress={() => {
              setSettingsOpen(false);
              setExportOpen(true);
            }}
            t={t}
          />
          <ActionRow
            icon="FilePlus"
            label={tr.editor.newProject}
            onPress={() => {
              clickEngine("#bnew, #pb-new");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="FolderOpen"
            label={tr.editor.loadJson}
            onPress={onLoadFile}
            t={t}
          />
          <ActionRow
            icon="Image"
            label={tr.editor.quickPng}
            onPress={() => {
              clickEngine("#bpng, #pb-png");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="Scaling"
            label={tr.editor.exportScale}
            onPress={() => {
              clickEngine("#bscale");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="GitMerge"
            label={tr.editor.createLoft}
            onPress={() => {
              clickEngine("#sg-loft");
              setSettingsOpen(false);
            }}
            t={t}
          />
          <ActionRow
            icon="Eraser"
            label={tr.editor.clearAll}
            danger
            onPress={() => {
              setSettingsOpen(false);
              setConfirmClearOpen(true);
            }}
            t={t}
          />
          <ActionRow
            icon="Trash2"
            label={tr.editor.deleteLoft}
            danger
            onPress={() => {
              clickEngine("#bdelloft");
              setSettingsOpen(false);
            }}
            t={t}
          />
        </View>
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
  const iconBg = danger
    ? t.errorContainer
    : active
      ? t.primary
      : t.secondaryContainer;
  const iconFg = danger
    ? t.onErrorContainer
    : active
      ? t.onPrimary
      : t.onSecondaryContainer;

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
      <Text
        style={[
          styles.actionLabel,
          { color: fg, fontWeight: active ? "600" : "500" },
        ]}
      >
        {label}
      </Text>
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
  topBarWrap: {
    position: "absolute",
    top: spacing.sm,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  topBarWrapTablet: {
    top: spacing.md,
  },
  topBarInner: {
    width: "100%",
    maxWidth: 1600,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  topBarInnerTablet: {
    paddingHorizontal: spacing.lg,
  },
  brandChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: typography.title.fontFamily,
    letterSpacing: 0.2,
  },
  brandTextTablet: {
    fontSize: 15,
  },
  projText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: typography.body.fontFamily,
    letterSpacing: 0.2,
    maxWidth: 160,
  },
  projTextTablet: {
    fontSize: 13,
    maxWidth: 240,
  },
  div: {
    width: 1,
    height: 22,
    marginHorizontal: 4,
    opacity: 0.7,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    width: "100%",
  },
  rowLabel: {
    fontSize: typography.bodyMedium.fontSize,
    fontFamily: typography.bodyMedium.fontFamily,
    letterSpacing: 0.15,
    flex: 1,
    paddingRight: spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xs,
    // En celulares el ancho fijo de 140/240 corta los botones; ahora crecen hasta ocupar el espacio disponible.
    flexGrow: 1,
    // 240 px sigue siendo un techo suave, pero dejamos que flexGrow lo supere si es necesario.
    maxWidth: 280,
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: typography.labelLarge.fontSize,
    fontFamily: typography.labelLarge.fontFamily,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  toastContainer: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.full,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 99999,
  },
  toastText: {
    fontSize: typography.labelLarge.fontSize,
    fontFamily: typography.labelLarge.fontFamily,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  confirmModalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  confirmModalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  confirmIconContainer: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: "rgba(217, 56, 41, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: typography.titleLarge.fontSize,
    fontFamily: typography.titleLarge.fontFamily,
    fontWeight: "700",
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: typography.bodyMedium.fontSize,
    fontFamily: typography.bodyMedium.fontFamily,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  confirmActionsRow: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  topSegment: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    padding: spacing.xs,
  },
  topSegmentTablet: {
    gap: spacing.xs,
  },
  projBadge: {
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    maxWidth: 180,
    flexShrink: 1,
  },
  bottomBarWrap: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    alignItems: "center",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  bottomBarSmall: {
    padding: 2,
    gap: spacing.xs,
  },
  toolGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sideBar: {
    position: "absolute",
    top: 84,
    left: spacing.md,
    flexDirection: "column",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xs,
  },
  divH: {
    height: 1,
    width: 22,
    marginVertical: 4,
    opacity: 0.7,
  },
});
