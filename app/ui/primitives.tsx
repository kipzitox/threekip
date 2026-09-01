import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  ViewStyle,
  Animated,
  Easing,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Lucide from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, typography, shadows } from "../theme";

const shadowStyles = StyleSheet.create({
  sm: shadows.sm,
  md: shadows.md,
  lg: shadows.lg,
  level1: shadows.level1,
  level2: shadows.level2,
  level3: shadows.level3,
});

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 2,
  fill,
}: {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const t = useTheme();
  const Cmp = (Lucide as unknown as Record<string, React.ComponentType<any>>)[
    name
  ];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      color={color ?? t.text}
      strokeWidth={strokeWidth}
      fill={fill}
    />
  );
}

type BtnVariant =
  | "primary"
  | "secondary"
  | "tonal"
  | "elevated"
  | "outlined"
  | "ghost"
  | "text"
  | "danger";
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
}) {
  const t = useTheme();

  let bg = t.primary;
  let fg = t.onPrimary;
  let hasBorder = false;
  let hasElevation = false;

  if (variant === "primary") {
    bg = t.primary;
    fg = t.onPrimary;
  } else if (variant === "danger") {
    bg = "#d93829";
    fg = "#ffffff";
  } else if (variant === "tonal" || variant === "secondary") {
    bg = t.secondaryContainer;
    fg = t.onSecondaryContainer;
  } else if (variant === "elevated") {
    bg = t.surfaceContainerLow;
    fg = t.primary;
    hasElevation = true;
  } else if (variant === "outlined") {
    bg = "transparent";
    fg = t.primary;
    hasBorder = true;
  } else if (variant === "ghost" || variant === "text") {
    bg = "transparent";
    fg = t.primary;
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: hasBorder ? t.outlineVariant : "transparent",
          borderWidth: hasBorder ? 1 : 0,
          opacity: disabled ? 0.38 : pressed ? 0.88 : 1,
        },
        hasElevation && shadowStyles.level1,
        style,
      ]}
    >
      <View style={styles.btnInner}>
        {icon ? <Icon name={icon} size={18} color={fg} /> : null}
        <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  active,
  disabled,
  size = 20,
  btnSize = 40,
  variant = "surface",
  style,
}: {
  name: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: number;
  btnSize?: number;
  variant?:
    "surface" | "floating" | "ghost" | "flat" | "outlined" | "tonal" | "filled";
  style?: ViewStyle;
}) {
  const t = useTheme();

  // Material Design 3 Toggle Button & Standard Icon Button behavior
  let bg = "transparent";
  let fg = t.text;
  let hasBorder = false;
  let hasShadow = false;

  if (active) {
    // M3 selected toggle state
    bg = t.primaryContainer;
    fg = t.onPrimaryContainer;
  } else {
    switch (variant) {
      case "filled":
        bg = t.primary;
        fg = t.onPrimary;
        break;
      case "tonal":
        bg = t.secondaryContainer;
        fg = t.onSecondaryContainer;
        break;
      case "floating":
        bg = t.surfaceContainer;
        fg = t.text;
        hasShadow = true;
        break;
      case "surface":
        bg = t.surfaceContainerHigh;
        fg = t.text;
        break;
      case "outlined":
        bg = "transparent";
        fg = t.text;
        hasBorder = true;
        break;
      case "ghost":
        bg = "transparent";
        fg = t.textMuted;
        break;
      case "flat":
      default:
        bg = "transparent";
        fg = t.text;
        break;
    }
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          width: btnSize,
          height: btnSize,
          borderRadius: radius.full,
          backgroundColor:
            pressed && !active
              ? variant === "flat" || variant === "ghost"
                ? t.surfaceContainerHighest
                : t.surfaceAlt
              : bg,
          borderColor: hasBorder ? t.outlineVariant : "transparent",
          borderWidth: hasBorder ? 1 : 0,
          opacity: disabled ? 0.38 : pressed ? 0.8 : 1,
        },
        hasShadow && shadowStyles.level2,
        style,
      ]}
    >
      <Icon name={name} size={size} color={fg} strokeWidth={active ? 2.4 : 2} />
    </Pressable>
  );
}

export function Panel({
  children,
  style,
  padded = true,
  variant = "elevated",
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  variant?: "elevated" | "outlined" | "filled";
}) {
  const t = useTheme();
  const bg =
    variant === "elevated"
      ? t.surfaceContainerLow
      : variant === "filled"
        ? t.surfaceContainerHighest
        : t.surface;

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: bg,
          borderColor:
            variant === "outlined" ? t.outlineVariant : "transparent",
          borderWidth: variant === "outlined" ? 1 : 0,
        },
        variant === "elevated" && shadowStyles.level1,
        padded && styles.panelPad,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Chip({
  label,
  icon,
  active,
  onPress,
  style,
}: {
  label: string;
  icon?: string;
  active?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const bg = active ? t.secondaryContainer : t.surface;
  const fg = active ? t.onSecondaryContainer : t.textMuted;
  const borderColor = active ? "transparent" : t.outlineVariant;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: pressed && !active ? t.surfaceContainerHigh : bg,
          borderColor,
          borderWidth: active ? 0 : 1,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={15}
          color={fg}
          strokeWidth={active ? 2.3 : 1.8}
        />
      ) : null}
      <Text
        style={[
          styles.chipText,
          { color: fg, fontWeight: active ? "600" : "500" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  maxWidth = 580,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 768;
  const ty = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0.95)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(ty, {
          toValue: 1,
          duration: isTablet ? 180 : 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(op, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(sc, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(ty, {
          toValue: 0,
          duration: isTablet ? 140 : 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(op, {
          toValue: 0,
          duration: 140,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(sc, {
          toValue: 0.95,
          duration: 140,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, op, ty, sc, isTablet]);

  if (!mounted && !visible) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      statusBarTranslucent
      hardwareAccelerated
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={[styles.sheetRoot, isTablet && styles.sheetRootTablet]}>
        <Animated.View
          style={[
            styles.sheetScrim,
            { opacity: op, backgroundColor: t.overlay },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheetCard,
            isTablet
              ? [styles.sheetCardTablet, { maxWidth }]
              : { height: Math.min(height * 0.82, 680) },
            {
              backgroundColor: isTablet
                ? t.surfaceContainerHigh
                : t.surfaceContainerLow,
              borderColor: t.outlineVariant,
              transform: isTablet
                ? [
                    { scale: sc },
                    {
                      translateY: ty.interpolate({
                        inputRange: [0, 1],
                        outputRange: [16, 0],
                      }),
                    },
                  ]
                : [
                    {
                      translateY: ty.interpolate({
                        inputRange: [0, 1],
                        outputRange: [600, 0],
                      }),
                    },
                  ],
            },
          ]}
        >
          {isTablet ? (
            <View
              style={[styles.sheetHdrTablet, { borderBottomColor: t.divider }]}
            >
              {title ? (
                <Text style={[styles.sheetTitleTablet, { color: t.text }]}>
                  {title}
                </Text>
              ) : (
                <View />
              )}
              <IconButton
                name="X"
                size={18}
                btnSize={36}
                variant="ghost"
                onPress={onClose}
              />
            </View>
          ) : (
            <View
              style={[styles.sheetHdrMobile, { borderBottomColor: t.divider }]}
            >
              <View style={styles.sheetHandleWrap}>
                <View
                  style={[styles.sheetHandle, { backgroundColor: t.outline }]}
                />
              </View>
              <View style={styles.sheetTitleRowMobile}>
                {title ? (
                  <Text
                    style={[styles.sheetTitle, { color: t.text }]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                ) : (
                  <View />
                )}
                <IconButton
                  name="X"
                  size={18}
                  btnSize={36}
                  variant="ghost"
                  onPress={onClose}
                />
              </View>
            </View>
          )}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={[
              styles.sheetBodyPad,
              isTablet && styles.sheetBodyPadTablet,
              { paddingBottom: Math.max(insets.bottom + 24, 40) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function Swatch({
  color,
  active,
  onPress,
}: {
  color: string;
  active?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.swatch,
        {
          backgroundColor: color,
          borderColor: active ? t.primary : t.outlineVariant,
        },
        active && styles.swatchActive,
      ]}
    />
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label?: string; icon?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.seg,
        { backgroundColor: t.surfaceContainer, borderColor: t.outlineVariant },
      ]}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={[
              styles.segItem,
              active && { backgroundColor: t.secondaryContainer },
            ]}
          >
            {it.icon ? (
              <Icon
                name={it.icon}
                size={16}
                color={active ? t.onSecondaryContainer : t.textMuted}
                strokeWidth={active ? 2.4 : 1.8}
              />
            ) : null}
            {it.label ? (
              <Text
                style={[
                  styles.segLabel,
                  {
                    color: active ? t.onSecondaryContainer : t.textMuted,
                    fontWeight: active ? "600" : "500",
                  },
                ]}
              >
                {it.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Spinner({ color }: { color?: string }) {
  const t = useTheme();
  return <ActivityIndicator color={color ?? t.primary} />;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text style={[styles.sectionTitle, { color: t.primary }]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnText: {
    fontSize: typography.labelLarge.fontSize,
    fontFamily: typography.labelLarge.fontFamily,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    borderRadius: radius.lg,
  },
  panelPad: { padding: spacing.lg },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    height: 32,
  },
  chipText: {
    fontSize: typography.label.fontSize,
    fontFamily: typography.label.fontFamily,
  },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetRootTablet: {
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  sheetScrim: { ...StyleSheet.absoluteFillObject },
  sheetCard: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing.xs,
    maxHeight: "88%",
    flexShrink: 1,
  },
  sheetCardTablet: {
    width: "100%",
    borderRadius: radius.xxl,
    borderBottomWidth: 1,
    paddingTop: spacing.md,
    maxHeight: "84%",
    flexShrink: 1,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  sheetHdrTablet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    marginBottom: spacing.xs,
  },
  sheetTitleTablet: {
    fontSize: typography.title.fontSize,
    fontFamily: typography.title.fontFamily,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  sheetHandleWrap: {
    alignItems: "center",
    paddingTop: spacing.xs,
    paddingBottom: 2,
  },
  sheetHandle: {
    width: 32,
    height: 4,
    borderRadius: radius.full,
    opacity: 0.6,
  },
  sheetHdrMobile: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    marginBottom: spacing.xs,
  },
  sheetTitleRowMobile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: spacing.xs,
  },
  sheetTitle: {
    fontSize: typography.title.fontSize,
    fontFamily: typography.title.fontFamily,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  sheetBody: { flex: 1 },
  sheetBodyPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  sheetBodyPadTablet: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    margin: spacing.xs,
  },
  swatchActive: { borderWidth: 3 },
  seg: {
    flexDirection: "row",
    borderRadius: radius.full,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  segLabel: {
    fontSize: typography.label.fontSize,
    fontFamily: typography.label.fontFamily,
  },
  sectionTitle: {
    fontSize: typography.label.fontSize,
    fontFamily: typography.label.fontFamily,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
});
