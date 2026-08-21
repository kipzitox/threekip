export interface Theme {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  divider: string;
  primary: string;
  onPrimary: string;
  error: string;
  success: string;
  overlay: string;
  shadowColor: string;
}

export const light: Theme = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F5',
  text: '#15181E',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  divider: '#ECEEF1',
  primary: '#4F46E5',
  onPrimary: '#FFFFFF',
  error: '#DC2626',
  success: '#16A34A',
  overlay: 'rgba(17,24,39,0.42)',
  shadowColor: '#0F172A',
};

export const dark: Theme = {
  background: '#0E1116',
  surface: '#171B22',
  surfaceAlt: '#1F242D',
  text: '#E8EAED',
  textMuted: '#9AA4B2',
  border: '#2A313C',
  divider: '#222831',
  primary: '#6366F1',
  onPrimary: '#FFFFFF',
  error: '#F87171',
  success: '#4ADE80',
  overlay: 'rgba(0,0,0,0.55)',
  shadowColor: '#000000',
};

export const shadows = {
  sm: { shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  md: { shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  lg: { shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
};
