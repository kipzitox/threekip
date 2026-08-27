import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import type { WebViewProps as RNWebViewProps } from 'react-native-webview';

export type AppWebViewHandle = {
  injectJavaScript: (code: string) => void;
  postMessage: (msg: string) => void;
};

export type AppWebViewProps = RNWebViewProps & {
  injectedJavaScript?: string;
  source?: { uri?: string; html?: string };
  style?: any;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  onLoadEnd?: () => void;
};

const WebIframeView = forwardRef<AppWebViewHandle, AppWebViewProps>((props, ref) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const runCodeInIframe = (code: string) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const win = iframeRef.current.contentWindow as any;
        win.eval?.(code);
      }
    } catch (e) {
      console.warn('[WebIframeView] runCodeInIframe error', e);
    }
  };

  useImperativeHandle(ref, () => ({
    injectJavaScript: (code: string) => {
      runCodeInIframe(code);
    },
    postMessage: (msg: string) => {
      try {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          const win = iframeRef.current.contentWindow as any;
          if (win.__rnTransport && typeof win.__rnTransport.onMessage === 'function') {
            win.__rnTransport.onMessage(msg);
          } else {
            win.postMessage(msg, '*');
          }
        }
      } catch (e) {
        console.warn('[WebIframeView] postMessage error', e);
      }
    },
  }));

  const handleIframeLoad = () => {
    try {
      const win = iframeRef.current?.contentWindow as any;
      if (win) {
        // Provide standard ReactNativeWebView mock in web iframe
        win.ReactNativeWebView = {
          postMessage: (msg: string) => {
            window.postMessage(msg, '*');
          },
        };
        // Execute injected JavaScript on initial load
        if (props.injectedJavaScript) {
          try {
            win.eval(props.injectedJavaScript);
          } catch (err) {
            console.warn('[WebIframeView] eval injectedJavaScript error', err);
          }
        }
      }
    } catch (e) {
      console.warn('[WebIframeView] handleIframeLoad error', e);
    }
    props.onLoadEnd?.();
  };

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!props.onMessage || !e.data) return;
      const data = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && parsed.type) {
          props.onMessage({ nativeEvent: { data } });
        }
      } catch {
        // ignore non-json messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [props.onMessage]);

  const src = props.source?.uri || '/engine/index.html';

  return (
    <View style={[styles.container, props.style]}>
      {/* @ts-ignore */}
      <iframe
        ref={iframeRef}
        src={src}
        onLoad={handleIframeLoad}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#FEF7FF',
        }}
        allow="accelerometer; camera; gyroscope; microphone"
      />
    </View>
  );
});

let ExportedWebView: any;

if (Platform.OS === 'web') {
  ExportedWebView = WebIframeView;
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require('react-native-webview');
  ExportedWebView = WebView;
}

export const AppWebView = ExportedWebView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
