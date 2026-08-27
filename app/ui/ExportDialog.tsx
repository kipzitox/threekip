import React, { useState } from 'react';
import { Text, Pressable, TextInput, StyleSheet, Alert, Platform, View, useWindowDimensions } from 'react-native';
import { Icon, Sheet } from './primitives';
import { useTheme } from '../theme/ThemeProvider';
import { useI18n } from '../i18n';
import type { SketchbookBridge } from '../services/sketchbookBridge';
import { radius, spacing, typography } from '../theme';

type ExportFormat = 'png' | 'glb' | 'obj' | 'usd' | 'usdz' | 'json';

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
  const { t: tr } = useI18n();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [name, setName] = useState('threekip');
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);

  const formats: { id: ExportFormat; label: string; icon: string; desc: string }[] = [
    { id: 'png', label: tr.export.pngLabel, icon: 'Image', desc: tr.export.pngDesc },
    { id: 'glb', label: tr.export.glbLabel, icon: 'Box', desc: tr.export.glbDesc },
    { id: 'obj', label: tr.export.objLabel, icon: 'Box', desc: tr.export.objDesc },
    { id: 'usd', label: tr.export.usdLabel, icon: 'Box', desc: tr.export.usdDesc },
    { id: 'usdz', label: tr.export.usdzLabel, icon: 'Box', desc: tr.export.usdzDesc },
    { id: 'json', label: tr.export.jsonLabel, icon: 'FileText', desc: tr.export.jsonDesc },
  ];

  const handleExport = async (format: ExportFormat) => {
    const safeName = (name || 'threekip').trim().replace(/[^\w.-]+/g, '_');
    setLoadingFormat(format);
    try {
      if (format === 'json') {
        const res = (await bridge.send('saveProject', { name: safeName })) as any;
        const projectData = res?.data ?? res ?? {};
        const jsonStr = typeof projectData === 'string' ? projectData : JSON.stringify(projectData, null, 2);
        
        if (Platform.OS === 'web') {
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${safeName}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const NativeFS = require('expo-file-system');
          const NativeSharing = require('expo-sharing');
          const dir = `${NativeFS.cacheDirectory || NativeFS.documentDirectory || ''}exports/`;
          await NativeFS.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
          const path = `${dir}${safeName}.json`;
          await NativeFS.writeAsStringAsync(path, jsonStr);
          if (NativeSharing && (await NativeSharing.isAvailableAsync())) {
            await NativeSharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: `${tr.common.appName} - JSON` });
          } else {
            Alert.alert(tr.export.exportSuccess, `${tr.export.savedTo}\n${path}`);
          }
        }
        onClose();
        return;
      }

      const res = await bridge.send<any>(
        'export',
        { format, name: safeName }
      );
      const payload = res?.result ?? res;
      if (!payload || !payload.data) {
        Alert.alert(tr.export.exportErrorTitle, tr.export.noStrokesError);
        return;
      }

      const { data, ext, mime } = payload;
      const fileExt = ext || format;
      const mimeType = mime || (format === 'png' ? 'image/png' : 'application/octet-stream');

      if (Platform.OS === 'web') {
        // Direct browser file download
        const byteCharacters = atob(data.replace(/^data:[^;]+;base64,/, ''));
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.${fileExt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Native mobile file storage and share sheet
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const NativeFS = require('expo-file-system');
        const NativeSharing = require('expo-sharing');
        const dir = `${NativeFS.cacheDirectory || NativeFS.documentDirectory || ''}exports/`;
        await NativeFS.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
        const path = `${dir}${safeName}.${fileExt}`;
        await NativeFS.writeAsStringAsync(path, data, {
          encoding: NativeFS.EncodingType.Base64,
        });
        if (NativeSharing && (await NativeSharing.isAvailableAsync())) {
          await NativeSharing.shareAsync(path, { mimeType, dialogTitle: `${tr.common.appName} - ${fileExt.toUpperCase()}` });
        } else {
          Alert.alert(tr.export.exportSuccess, `${tr.export.savedTo}\n${path}`);
        }
      }
      onClose();
    } catch (e: any) {
      console.error('[ExportDialog] error', e);
      Alert.alert(tr.export.exportErrorTitle, String(e?.message || e));
    } finally {
      setLoadingFormat(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={tr.export.dialogTitle} maxWidth={620}>
      <Text style={[styles.inputLabel, { color: t.primary }]}>{tr.export.fileNameLabel}</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: t.surfaceContainerHighest,
            color: t.text,
            borderColor: t.outlineVariant,
          },
        ]}
        placeholder={tr.export.fileNamePlaceholder}
        placeholderTextColor={t.textMuted}
        value={name}
        onChangeText={setName}
        autoCapitalize="none"
      />

      <Text style={[styles.inputLabel, { color: t.primary, marginTop: spacing.sm }]}>
        {tr.export.formatLabel}
      </Text>
      <View style={isTablet ? styles.formatGridTablet : styles.formatList}>
        {formats.map((f) => (
          <Pressable
            key={f.id}
            style={({ pressed }) => [
              styles.item,
              isTablet && styles.itemTablet,
              {
                backgroundColor: pressed ? t.surfaceContainerHigh : t.surfaceContainerLow,
                borderColor: t.outlineVariant,
                opacity: loadingFormat === f.id ? 0.6 : 1,
              },
            ]}
            onPress={() => handleExport(f.id)}
            disabled={loadingFormat !== null}
          >
            <View style={[styles.iconWrap, { backgroundColor: t.primaryContainer }]}>
              <Icon name={f.icon} size={18} color={t.onPrimaryContainer} />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.itemLabel, { color: t.text }]}>{f.label}</Text>
              <Text style={[styles.itemDesc, { color: t.textMuted }]}>{f.desc}</Text>
            </View>
            {loadingFormat === f.id && (
              <Text style={[styles.loadingText, { color: t.primary }]}>{tr.export.exporting}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  inputLabel: {
    fontSize: typography.labelMedium.fontSize,
    fontWeight: '600',
    fontFamily: typography.labelMedium.fontFamily,
    marginBottom: spacing.xs,
    letterSpacing: 0.2,
  },
  input: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    fontSize: typography.bodyLarge.fontSize,
    fontFamily: typography.bodyLarge.fontFamily,
  },
  formatList: {
    flexDirection: 'column',
  },
  formatGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs + 2,
  },
  itemTablet: {
    width: '48.5%',
    marginBottom: 0,
    minHeight: 64,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  itemLabel: {
    fontSize: typography.bodyLarge.fontSize,
    fontWeight: '600',
    fontFamily: typography.bodyLarge.fontFamily,
  },
  itemDesc: {
    fontSize: typography.bodySmall.fontSize,
    marginTop: 2,
    fontFamily: typography.bodySmall.fontFamily,
  },
  loadingText: {
    fontSize: typography.labelMedium.fontSize,
    fontWeight: '600',
    fontFamily: typography.labelMedium.fontFamily,
  },
});
