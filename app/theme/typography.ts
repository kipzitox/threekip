export const font = {
  regular: 'Roboto',
  medium: 'Roboto',
  semi: 'Roboto',
  bold: 'Roboto',
};

export const typography = {
  title: { fontSize: 24, fontFamily: font.bold, lineHeight: 30, fontWeight: '700' as const },
  subtitle: { fontSize: 18, fontFamily: font.semi, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 14, fontFamily: font.regular, lineHeight: 20, fontWeight: '400' as const },
  label: { fontSize: 14, fontFamily: font.medium, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 12, fontFamily: font.regular, lineHeight: 16, fontWeight: '400' as const },
};
