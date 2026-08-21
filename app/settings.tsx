import React from 'react';
import { View, Text, Switch, ScrollView, StyleSheet } from 'react-native';
import { ScreenContainer } from './components/ScreenContainer';
import { Icon, SectionTitle } from './ui/primitives';
import { useUIStore } from './stores/UIStore';
import { useSettingsStore } from './stores/SettingsStore';
import { useTheme } from './theme/ThemeProvider';
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
      <View style={[styles.rowIcon, { backgroundColor: t.surfaceAlt }]}>
        <Icon name={icon} size={18} color={t.primary} />
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowLabel, { color: t.text }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: t.textMuted }]}>{hint}</Text> : null}
      </View>
      {value !== undefined && onValueChange ? (
        <Switch value={value} onValueChange={onValueChange} />
      ) : null}
    </View>
  );
}

export default function Settings() {
  const t = useTheme();
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionTitle>General</SectionTitle>
        <Row
          icon="Cpu"
          label="Aceleración de hardware"
          value={hardwareAcceleration}
          onValueChange={setHardwareAcceleration}
          hint="Usa la GPU del dispositivo para el render del motor."
        />

        <SectionTitle>Apariencia</SectionTitle>
        <Row
          icon="Moon"
          label="Modo oscuro"
          value={themeMode === 'dark'}
          onValueChange={toggleTheme}
          hint="Cambia entre los temas claro y oscuro de la interfaz."
        />

        <SectionTitle>Editor</SectionTitle>
        <Row
          icon="Locate"
          label="Restaurar cámara al abrir"
          value={resetCamOnOpen}
          onValueChange={setResetCamOnOpen}
          hint="Vuelve a la vista por defecto cada vez que abres un proyecto."
        />
        <Row
          icon="AlertTriangle"
          label="Confirmar al salir"
          value={confirmExit}
          onValueChange={setConfirmExit}
          hint="Pide confirmación antes de volver a la Biblioteca."
        />

        <SectionTitle>Gestos</SectionTitle>
        <View style={[styles.infoBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={[styles.infoText, { color: t.textMuted }]}>
            • Un dedo: dibujar / seleccionar{'\n'}
            • Dos dedos: orbitar / desplazar{'\n'}
            • Pellizco: zoom{'\n'}
            Los gestos son gestionados por el motor 3D.
          </Text>
        </View>

        <SectionTitle>Exportación</SectionTitle>
        <View style={[styles.infoBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={[styles.infoText, { color: t.textMuted }]}>
            Los archivos exportados (PNG, GLB, OBJ, USD, USDZ) se guardan en el
            almacenamiento de la app y pueden compartirse desde la Biblioteca.
          </Text>
        </View>

        <SectionTitle>Información</SectionTitle>
        <View style={[styles.infoBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={[styles.infoText, { color: t.text }]}>
            ThreeKip{'\n'}
            Versión 1.0 (preview){'\n'}
            Motor de modelado 3D independiente.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowMain: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: typography.body.fontFamily },
  rowHint: { fontSize: 12, marginTop: 2 },
  infoBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  infoText: { fontSize: 13, lineHeight: 19 },
});
