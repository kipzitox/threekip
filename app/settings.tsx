import React from 'react';
import { View, Text, Switch, ScrollView, StyleSheet, Pressable } from 'react-native';
import { ScreenContainer } from './components/ScreenContainer';
import { Icon, SectionTitle } from './ui/primitives';
import { useUIStore } from './stores/UIStore';
import { useSettingsStore } from './stores/SettingsStore';
import { useTheme } from './theme/ThemeProvider';
import { useI18n } from './i18n';
import { radius, spacing, typography } from './theme';

function Row({
  icon,
  label,
  value,
  onValueChange,
  hint,
}: {
  icon: string;
  label: string;
  value?: boolean;
  onValueChange?: (v: boolean) => void;
  hint?: string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderColor: t.divider }]}>
      <View style={[styles.rowIcon, { backgroundColor: t.secondaryContainer }]}>
        <Icon name={icon} size={18} color={t.onSecondaryContainer} />
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowLabel, { color: t.text }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: t.textMuted }]}>{hint}</Text> : null}
      </View>
      {value !== undefined && onValueChange ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: t.surfaceContainerHighest, true: t.primary }}
          thumbColor={value ? t.onPrimary : t.outline}
        />
      ) : null}
    </View>
  );
}

export default function Settings() {
  const t = useTheme();
  const { t: tr, language, setLanguage } = useI18n();
  const themeMode = useUIStore((s) => s.themeMode);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const hardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);
  const setHardwareAcceleration = useSettingsStore((s) => s.setHardwareAcceleration);
  const resetCamOnOpen = useSettingsStore((s) => s.resetCamOnOpen);
  const setResetCamOnOpen = useSettingsStore((s) => s.setResetCamOnOpen);
  const confirmExit = useSettingsStore((s) => s.confirmExit);
  const setConfirmExit = useSettingsStore((s) => s.setConfirmExit);

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl + 20 }}>
        <SectionTitle>{tr.settings.languageSection}</SectionTitle>
        <View style={[styles.langCard, { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant }]}>
          <View style={styles.langHeader}>
            <View style={[styles.rowIcon, { backgroundColor: t.primaryContainer }]}>
              <Icon name="Globe" size={18} color={t.onPrimaryContainer} />
            </View>
            <View style={styles.rowMain}>
              <Text style={[styles.rowLabel, { color: t.text }]}>{tr.settings.languageLabel}</Text>
              <Text style={[styles.rowHint, { color: t.textMuted }]}>{tr.settings.languageHint}</Text>
            </View>
          </View>
          <View style={styles.langSelector}>
            <Pressable
              style={[
                styles.langBtn,
                language === 'es'
                  ? { backgroundColor: t.primary, borderColor: t.primary }
                  : { backgroundColor: t.surfaceContainerHighest, borderColor: t.outlineVariant },
              ]}
              onPress={() => setLanguage('es')}
            >
              <Text
                style={[
                  styles.langBtnText,
                  { color: language === 'es' ? t.onPrimary : t.text },
                ]}
              >
                🇪🇸 {tr.settings.spanish}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.langBtn,
                language === 'en'
                  ? { backgroundColor: t.primary, borderColor: t.primary }
                  : { backgroundColor: t.surfaceContainerHighest, borderColor: t.outlineVariant },
              ]}
              onPress={() => setLanguage('en')}
            >
              <Text
                style={[
                  styles.langBtnText,
                  { color: language === 'en' ? t.onPrimary : t.text },
                ]}
              >
                🇬🇧 {tr.settings.english}
              </Text>
            </Pressable>
          </View>
        </View>

        <SectionTitle>{tr.settings.generalSection}</SectionTitle>
        <Row
          icon="Cpu"
          label={tr.settings.hwAccelLabel}
          value={hardwareAcceleration}
          onValueChange={setHardwareAcceleration}
          hint={tr.settings.hwAccelHint}
        />

        <SectionTitle>{tr.settings.appearanceSection}</SectionTitle>
        <Row
          icon="Moon"
          label={tr.settings.darkModeLabel}
          value={themeMode === 'dark'}
          onValueChange={toggleTheme}
          hint={tr.settings.darkModeHint}
        />

        <SectionTitle>{tr.settings.editorSection}</SectionTitle>
        <Row
          icon="Locate"
          label={tr.settings.resetCamLabel}
          value={resetCamOnOpen}
          onValueChange={setResetCamOnOpen}
          hint={tr.settings.resetCamHint}
        />
        <Row
          icon="AlertTriangle"
          label={tr.settings.confirmExitLabel}
          value={confirmExit}
          onValueChange={setConfirmExit}
          hint={tr.settings.confirmExitHint}
        />

        <SectionTitle>{tr.settings.gesturesSection}</SectionTitle>
        <View style={[styles.infoBox, { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant }]}>
          <Text style={[styles.infoText, { color: t.textMuted }]}>
            {tr.settings.gesturesDesc}
          </Text>
        </View>

        <SectionTitle>{tr.settings.exportSection}</SectionTitle>
        <View style={[styles.infoBox, { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant }]}>
          <Text style={[styles.infoText, { color: t.textMuted }]}>
            {tr.settings.exportDesc}
          </Text>
        </View>

        <SectionTitle>{tr.settings.infoSection}</SectionTitle>
        <View style={[styles.infoBox, { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant }]}>
          <Text style={[styles.infoText, { color: t.text }]}>
            {tr.settings.infoDesc}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.md },
  langCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  langHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  langSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBtnText: {
    fontSize: typography.labelLarge.fontSize,
    fontFamily: typography.labelLarge.fontFamily,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowMain: { flex: 1 },
  rowLabel: {
    fontSize: typography.bodyLarge.fontSize,
    fontFamily: typography.bodyLarge.fontFamily,
    letterSpacing: 0.15,
  },
  rowHint: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: typography.bodySmall.fontFamily,
    marginTop: 2,
  },
  infoBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  infoText: {
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    lineHeight: 20,
  },
});
