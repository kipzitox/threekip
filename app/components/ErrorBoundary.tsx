import React from 'react';
import { Text, View, Pressable, ScrollView } from 'react-native';

type Props = {
  children: React.ReactNode;
  /** Shown instead of the default screen. Used by tests/storybook. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
};

class ErrorBoundaryImpl extends React.Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: '#f7f5f9',
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: '#1d1b20',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          Algo falló
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: '#4a4750',
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          La app se ha detenido. Puedes reintentarlo.
        </Text>
        <ScrollView
          style={{
            maxHeight: 180,
            alignSelf: 'stretch',
            backgroundColor: '#eceaf0',
            borderRadius: 10,
            padding: 12,
            marginBottom: 20,
          }}
        >
          <Text
            selectable
            style={{ fontSize: 11, color: '#4a4750', fontFamily: 'monospace' }}
          >
            {error.message}
          </Text>
        </ScrollView>
        <Pressable
          onPress={this.reset}
          accessibilityRole="button"
          style={{
            backgroundColor: '#1d1b20',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15 }}>
            Reintentar
          </Text>
        </Pressable>
      </View>
    );
  }
}

export function ErrorBoundary({ children, fallback }: Props) {
  return <ErrorBoundaryImpl fallback={fallback}>{children}</ErrorBoundaryImpl>;
}
