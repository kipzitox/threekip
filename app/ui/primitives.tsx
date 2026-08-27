import React, { useEffect, useRef } from 'react';
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
} from 'react-native';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing, typography, shadows } from '../theme';

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
  const Cmp = (Lucide as unknown as Record<string, React.ComponentType<any>>)[name];
  if (!Cmp) return null;
  return <Cmp size={size} color={color ?? t.text} strokeWidth={strokeWidth} fill={fill} />;
}

type BtnVariant = 'primary' | 'secondary' | 'tonal' | 'elevated' | 'outlined' | 'ghost' | 'text';
export function Button({
  label,
  onPress,
  variant = 'primary',
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

  if (variant === 'primary') {
    bg = t.primary;
    fg = t.onPrimary;
  } else if (variant === 'tonal' || variant === 'secondary') {
    bg = t.secondaryContainer;
    fg = t.onSecondaryContainer;
  } else if (variant === 'elevated') {
    bg = t.surfaceContainerLow;
    fg = t.primary;
    hasElevation = true;
  } else if (variant === 'outlined') {
    bg = 'transparent';
    fg = t.primary;
    hasBorder = true;
  } else if (variant === 'ghost' || variant === 'text') {
    bg = 'transparent';
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
          borderColor: hasBorder ? t.outlineVariant : 'transparent',
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
  variant = 'surface',
  style,
}: {
  name: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: number;
  btnSize?: number;
  variant?: 'surface' | 'floating' | 'ghost' | 'flat' | 'outlined' | 'tonal' | 'filled';
  style?: ViewStyle;
}) {
  const t = useTheme();

  // Material Design 3 Toggle Button & Standard Icon Button behavior
  let bg = 'transparent';
  let fg = t.text;
  let hasBorder = false;
  let hasShadow = false;

  if (active) {
    // M3 selected toggle state
    bg = t.primaryContainer;
    fg = t.onPrimaryContainer;
  } else {
    switch (variant) {
      case 'filled':
        bg = t.primary;
        fg = t.onPrimary;
        break;
      case 'tonal':
        bg = t.secondaryContainer;
        fg = t.onSecondaryContainer;
        break;
      case 'floating':
        bg = t.surfaceContainer;
        fg = t.text;
        hasShadow = true;
        break;
      case 'surface':
        bg = t.surfaceContainerHigh;
        fg = t.text;
        break;
      case 'outlined':
        bg = 'transparent';
        fg = t.text;
        hasBorder = true;
        break;
      case 'ghost':
        bg = 'transparent';
        fg = t.textMuted;
        break;
      case 'flat':
      default:
        bg = 'transparent';
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
          backgroundColor: pressed && !active ? (variant === 'flat' || variant === 'ghost' ? t.surfaceContainerHighest : t.surfaceAlt) : bg,
          borderColor: hasBorder ? t.outlineVariant : 'transparent',
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
  variant = 'elevated',
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  variant?: 'elevated' | 'outlined' | 'filled';
}) {
  const t = useTheme();
  const bg =
    variant === 'elevated'
      ? t.surfaceContainerLow
      : variant === 'filled'
      ? t.surfaceContainerHighest
      : t.surface;

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: bg,
          borderColor: variant === 'outlined' ? t.outlineVariant : 'transparent',
          borderWidth: variant === 'outlined' ? 1 : 0,
        },
        variant === 'elevated' && shadowStyles.level1,
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
  const borderColor = active ? 'transparent' : t.outlineVariant;

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
        <Icon name={icon} size={15} color={fg} strokeWidth={active ? 2.3 : 1.8} />
      ) : null}
      <Text style={[styles.chipText, { color: fg, fontWeight: active ? '600' : '500' }]}>
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
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const ty = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ty, {
        toValue: visible ? 1 : 0,
        duration: isTablet ? 180 : 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(op, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(sc, {
        toValue: visible ? 1 : 0.95,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, op, ty, sc, isTablet]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.sheetRoot, isTablet && styles.sheetRootTablet]}>
        <Animated.View style={[styles.sheetScrim, { opacity: op, backgroundColor: t.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheetCard,
            isTablet && [styles.sheetCardTablet, { maxWidth }],
            {
              backgroundColor: isTablet ? t.surfaceContainerHigh : t.surfaceContainerLow,
              borderColor: t.outlineVariant,
              transform: isTablet
                ? [{ scale: sc }, { translateY: ty.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }]
                : [{ translateY: ty.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }) }],
            },
          ]}
        >
          {isTablet ? (
            <View style={[styles.sheetHdrTablet, { borderBottomColor: t.divider }]}>
              {title ? <Text style={[styles.sheetTitleTablet, { color: t.text }]}>{title}</Text> : <View />}
              <IconButton name="X" size={18} btnSize={36} variant="ghost" onPress={onClose} />
            </View>
          ) : (
            <>
              <View style={styles.sheetHandleWrap}>
                <View style={[styles.sheetHandle, { backgroundColor: t.outline }]} />
              </View>
              {title ? <Text style={[styles.sheetTitle, { color: t.text }]}>{title}</Text> : null}
            </>
          )}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={[styles.sheetBodyPad, isTablet && styles.sheetBodyPadTablet]}
            showsVerticalScrollIndicator={false}
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
        { backgroundColor: color, borderColor: active ? t.primary : t.outlineVariant },
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
    <View style={[styles.seg, { backgroundColor: t.surfaceContainer, borderColor: t.outlineVariant }]}>
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
                    fontWeight: active ? '600' : '500',
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
  return <Text style={[styles.sectionTitle, { color: t.primary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btnText: {
    fontSize: typography.labelLarge.fontSize,
    fontFamily: typography.labelLarge.fontFamily,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    borderRadius: radius.lg,
  },
  panelPad: { padding: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
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
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetRootTablet: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  sheetScrim: { ...StyleSheet.absoluteFillObject },
  sheetCard: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing.xs,
    maxHeight: '88%',
  },
  sheetCardTablet: {
    width: '100%',
    borderRadius: radius.xxl,
    borderBottomWidth: 1,
    paddingTop: spacing.md,
    maxHeight: '84%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  sheetHdrTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    marginBottom: spacing.xs,
  },
  sheetTitleTablet: {
    fontSize: typography.title.fontSize,
    fontFamily: typography.title.fontFamily,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  sheetHandleWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  sheetHandle: { width: 32, height: 4, borderRadius: radius.full, opacity: 0.6 },
  sheetTitle: {
    fontSize: typography.title.fontSize,
    fontFamily: typography.title.fontFamily,
    fontWeight: '600',
    letterSpacing: 0.15,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sheetBody: { flex: 1 },
  sheetBodyPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  sheetBodyPadTablet: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    margin: spacing.xs,
  },
  swatchActive: { borderWidth: 3 },
  seg: {
    flexDirection: 'row',
    borderRadius: radius.full,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  segLabel: { fontSize: typography.label.fontSize, fontFamily: typography.label.fontFamily },
  sectionTitle: {
    fontSize: typography.label.fontSize,
    fontFamily: typography.label.fontFamily,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
});
