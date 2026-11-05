import React from 'react';
import { View, Text, Switch, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { ScreenContainer } from './components/ScreenContainer';
import { Button, Icon, SectionTitle } from './ui/primitives';
import { useUIStore } from './stores/UIStore';
import { useSettingsStore } from './stores/SettingsStore';
import { useTheme } from './theme/ThemeProvider';
import { useI18n } from './i18n';
import { contentMaxWidth, radius, spacing, typography } from './theme';

/**
 * Pagina de donaciones del autor. Vive fuera del motor 3D y de la logica de la
 * app: solo se abre en el navegador del sistema, sin pedir datos al usuario.
 */
const DONATION_URL = 'https://ko-fi.com/kipzitox';

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

  const openDonationPage = React.useCallback(() => {
    // Si el dispositivo no puede abrir el navegador, el enlace simplemente no
    // hace nada: no hay nada que el usuario pueda resolver desde aqui.
    Linking.openURL(DONATION_URL).catch(() => undefined);
  }, []);

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.innerWrapper}>
          <View style={styles.pageHeader}>
            <Text style={[styles.pageTitle, { color: t.text }]}>{tr.settings.title}</Text>
          </View>

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
            icon="TriangleAlert"
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

          <SectionTitle>{tr.settings.supportSection}</SectionTitle>
          <View style={[styles.supportCard, { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant }]}>
            <View style={styles.supportHeader}>
              <View style={[styles.rowIcon, { backgroundColor: t.secondaryContainer }]}>
                <Icon name="Heart" size={18} color={t.onSecondaryContainer} />
              </View>
              <View style={styles.rowMain}>
                <Text style={[styles.rowLabel, { color: t.text }]}>{tr.settings.supportTitle}</Text>
                <Text style={[styles.rowHint, { color: t.textMuted }]}>{tr.settings.supportDesc}</Text>
              </View>
            </View>
            <Button
              label={tr.settings.supportCta}
              icon="Heart"
              variant="tonal"
              onPress={openDonationPage}
              style={styles.supportBtn}
            />
            <Text style={[styles.supportNote, { color: t.textMuted }]}>
              {tr.settings.supportNote}
            </Text>
          </View>

          <SectionTitle>{tr.settings.infoSection}</SectionTitle>
          <View style={[styles.infoBox, { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant }]}>
            <Text style={[styles.infoText, { color: t.text }]}>
              {tr.settings.infoDesc}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 0 },
  scrollContent: { paddingBottom: spacing.xxl + 20 },
  innerWrapper: {
    width: '100%',
    maxWidth: contentMaxWidth.narrow,
    alignSelf: 'center',
  },
  pageHeader: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  pageTitle: {
    fontSize: typography.headlineMedium.fontSize,
    fontFamily: typography.headlineMedium.fontFamily,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  langCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.xs,
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
    flexWrap: 'wrap',
  },
  langBtn: {
    flex: 1,
    minWidth: 120,
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
    gap: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, paddingRight: spacing.xs },
  rowLabel: {
    fontSize: typography.bodyLarge.fontSize,
    fontFamily: typography.bodyLarge.fontFamily,
    letterSpacing: 0.15,
    fontWeight: '500',
  },
  rowHint: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: typography.bodySmall.fontFamily,
    marginTop: 2,
    lineHeight: 16,
  },
  infoBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  supportCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  supportBtn: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  supportNote: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: typography.bodySmall.fontFamily,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 16,
  },
  infoText: {
    fontSize: typography.bodyMedium.fontSize,
    fontFamily: typography.bodyMedium.fontFamily,
    lineHeight: 20,
  },
});
