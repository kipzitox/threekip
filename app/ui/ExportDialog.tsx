import React, { useState } from 'react';
import { Text, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Icon, Sheet } from './primitives';
import { useTheme } from '../theme/ThemeProvider';
import type { SketchbookBridge } from '../services/sketchbookBridge';
import { radius, spacing, typography } from '../theme';

type ExportFormat = 'png' | 'glb' | 'obj' | 'usd' | 'usdz';

export function ExportDialog({
  bridge,
  visible,
  onClose,
}: {
  bridge: SketchbookBridge;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  const [name, setName] = useState('threekip');

  const formats: { id: ExportFormat; label: string; icon: string }[] = [
    { id: 'png', label: 'PNG (imagen)', icon: 'Image' },
    { id: 'glb', label: 'GLB (3D)', icon: 'Box' },
    { id: 'obj', label: 'OBJ (3D)', icon: 'Box' },
    { id: 'usd', label: 'USD (3D)', icon: 'Box' },
    { id: 'usdz', label: 'USDZ (3D)', icon: 'Box' },
  ];

  const handleExport = async (format: ExportFormat) => {
    const safeName = (name || 'threekip').trim().replace(/[^\w.-]+/g, '_');
    try {
      const res = await bridge.send<{ result?: { data: string; mime: string; ext: string } }>(
        'export',
        { format, name: safeName }
      );
      if (!res || !res.result || !res.result.data) {
        Alert.alert('Exportar', 'No hay nada que exportar.');
        return;
      }
      const { data, ext, mime } = res.result;
      const dir = `${FileSystem.documentDirectory}exports/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const path = `${dir}${safeName}.${ext}`;
      await FileSystem.writeAsStringAsync(path, data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: mime, dialogTitle: 'Exportar' });
      } else {
        Alert.alert('Exportado', path);
      }
    } catch (e: any) {
      Alert.alert('Error al exportar', String(e?.message || e));
    } finally {
      onClose();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Exportar">
      <TextInput
        style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }]}
        placeholder="Nombre del archivo"
        placeholderTextColor={t.textMuted}
        value={name}
        onChangeText={setName}
        autoCapitalize="none"
      />
      {formats.map((f) => (
        <Pressable
          key={f.id}
          style={[styles.item, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}
          onPress={() => handleExport(f.id)}
        >
          <Icon name={f.icon} size={18} color={t.primary} />
          <Text style={[styles.itemLabel, { color: t.text }]}>{f.label}</Text>
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  itemLabel: { fontSize: 15, fontFamily: typography.body.fontFamily },
});
