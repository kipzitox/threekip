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
} from 'react-native';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing, typography, shadows } from '../theme';

const shadow = StyleSheet.create({
  sm: shadows.sm,
  md: shadows.md,
  lg: shadows.lg,
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

type BtnVariant = 'primary' | 'secondary' | 'ghost';
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
  const bg = variant === 'primary' ? t.primary : variant === 'secondary' ? t.surfaceAlt : 'transparent';
  const fg = variant === 'primary' ? t.onPrimary : t.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
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
  size = 22,
  variant = 'surface',
}: {
  name: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: number;
  variant?: 'surface' | 'floating' | 'ghost';
}) {
  const t = useTheme();
  const bg =
    active
      ? t.primary
      : variant === 'floating'
      ? t.surface
      : variant === 'ghost'
      ? 'transparent'
      : t.surfaceAlt;
  const fg = active ? t.onPrimary : t.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        shadow.md,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Icon name={name} size={size} color={fg} />
    </Pressable>
  );
}

export function Panel({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}) {
  const t = useTheme();
  return (
    <View
            style={[
              styles.panel,
              { backgroundColor: t.surface, borderColor: t.border },
              padded && styles.panelPad,
              shadow.md,
              style,
            ]}
    >
      {children}
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const ty = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ty, {
        toValue: visible ? 1 : 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(op, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, op, ty]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Animated.View style={[styles.sheetScrim, { opacity: op, backgroundColor: t.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheetCard,
            {
              backgroundColor: t.surface,
              borderColor: t.border,
              transform: [{ translateY: ty.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }) }],
            },
          ]}
        >
          <View style={styles.sheetHandleWrap}>
            <View style={[styles.sheetHandle, { backgroundColor: t.border }]} />
          </View>
          {title ? <Text style={[styles.sheetTitle, { color: t.text }]}>{title}</Text> : null}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyPad}
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
        { backgroundColor: color, borderColor: active ? t.primary : t.border },
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
    <View style={[styles.seg, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={[
              styles.segItem,
              active && { backgroundColor: t.surface },
              active && shadow.sm,
            ]}
          >
            {it.icon ? <Icon name={it.icon} size={16} color={active ? t.primary : t.textMuted} /> : null}
            {it.label ? (
              <Text style={[styles.segLabel, { color: active ? t.primary : t.textMuted }]}>
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
  return <Text style={[styles.sectionTitle, { color: t.textMuted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btnText: { fontSize: typography.body.fontSize, fontWeight: '600', fontFamily: typography.body.fontFamily },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  panelPad: { padding: spacing.lg },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetScrim: { ...StyleSheet.absoluteFillObject },
  sheetCard: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing.sm,
    maxHeight: '88%',
  },
  sheetHandleWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  sheetHandle: { width: 40, height: 4, borderRadius: radius.full },
  sheetTitle: {
    fontSize: typography.subtitle.fontSize,
    fontFamily: typography.subtitle.fontFamily,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sheetBody: { flex: 1 },
  sheetBodyPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  swatch: {
    width: 38,
    height: 38,
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
    gap: 2,
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
  segLabel: { fontSize: typography.caption.fontSize, fontWeight: '600' },
  sectionTitle: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
});
