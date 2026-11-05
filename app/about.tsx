import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ScreenContainer } from './components/ScreenContainer';
import { Icon } from './ui/primitives';
import { useTheme } from './theme/ThemeProvider';
import { useI18n } from './i18n';
import { contentMaxWidth, radius, spacing, typography, useResponsive } from './theme';

export default function About() {
  const t = useTheme();
  const { t: tr } = useI18n();
  // En tablet la columna se queda centrada: una tarjeta de 1400 px de ancho
  // deja parrafos ilegibles.
  const { isTablet } = useResponsive();

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.innerWrapper}>
          <View
            style={[
              styles.headerCard,
              { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: t.primaryContainer,
                  width: isTablet ? 88 : 72,
                  height: isTablet ? 88 : 72,
                },
              ]}
            >
              <Icon
                name="mdi-cube"
                size={isTablet ? 48 : 40}
                color={t.onPrimaryContainer}
                strokeWidth={2}
              />
            </View>
            <Text style={[styles.title, { color: t.text }]}>{tr.about.title}</Text>
            <Text style={[styles.body, { color: t.text }]}>
              {tr.about.subtitle}
            </Text>
            <View style={[styles.versionBadge, { backgroundColor: t.secondaryContainer }]}>
              <Text style={[styles.versionText, { color: t.onSecondaryContainer }]}>
                {tr.about.version}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.infoCard,
              { backgroundColor: t.surfaceContainerLow, borderColor: t.outlineVariant },
            ]}
          >
            <Text style={[styles.infoTitle, { color: t.primary }]}>
              {tr.settings.infoSection}
            </Text>
            <Text style={[styles.muted, { color: t.textMuted }]}>
              {tr.about.runtimeDesc}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.md },
  scrollContent: { paddingBottom: spacing.xxl },
  innerWrapper: {
    width: '100%',
    maxWidth: contentMaxWidth.narrow,
    alignSelf: 'center',
  },
  headerCard: {
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  iconWrap: {
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.headlineSmall.fontSize,
    fontFamily: typography.headlineSmall.fontFamily,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  body: {
    fontSize: typography.bodyLarge.fontSize,
    fontFamily: typography.bodyLarge.fontFamily,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  versionBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  versionText: {
    fontSize: typography.labelMedium.fontSize,
    fontFamily: typography.labelMedium.fontFamily,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  infoTitle: {
    fontSize: typography.titleSmall.fontSize,
    fontFamily: typography.titleSmall.fontFamily,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  muted: {
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    lineHeight: 20,
  },
});
