import React from 'react';
import type {
  CommandName,
  CommandMessage,
  BridgeEvent,
  EventMessage,
  ResponseMessage,
  InboundMessage,
} from './bridge-types';

export type WebViewHandleLike = {
  postMessage?: (msg: string) => void;
  injectJavaScript?: (script: string) => void;
};

// In-app Bridge client. Mirrors the protocol implemented by js/rn-transport.js
// (loaded inside the WebView). RN UI components talk ONLY to the engine through
// this client — never directly to the engine.
//
//   RN  → WebView : { type:'cmd', id, name, payload }
//   Web → RN     : { type:'res', id, ok, result? }
//                : { type:'evt', event, data }
//                : { type:'ready', version }
//
// The contract (command/event names + payloads) lives in ./bridge-types.

type EventListener = (data: unknown) => void;

export class SketchbookBridge {
  private handle: WebViewHandleLike | null = null;
  private webRef: React.RefObject<WebViewHandleLike | any> | null = null;
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private listeners = new Map<string, Set<EventListener>>();
  private seq = 0;
  private _ready = false;

  setWebRef(ref: React.RefObject<WebViewHandleLike | any> | null): void {
    this.webRef = ref;
  }

  attach(handle: WebViewHandleLike | null): void {
    this.handle = handle;
  }
  detach(): void {
    this.handle = null;
    this.pending.forEach((p) => p.reject(new Error('Bridge detached')));
    this.pending.clear();
  }
  isReady(): boolean {
    return this._ready;
  }

  getHandle(): WebViewHandleLike | null {
    if (this.handle && typeof this.handle.postMessage === 'function') {
      return this.handle;
    }
    if (this.webRef && this.webRef.current && typeof this.webRef.current.postMessage === 'function') {
      return this.webRef.current;
    }
    return null;
  }

  handleMessage(raw: string): void {
    let msg: InboundMessage;
    try {
      msg = JSON.parse(raw) as InboundMessage;
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      this._ready = true;
      this.emit('ready', msg.version);
      return;
    }
    if (msg.type === 'error') {
      this.emit('error', msg.error);
      return;
    }
    if (msg.type === 'evt') {
      const e = msg as EventMessage;
      this.emit(e.event, e.data);
      return;
    }
    if (msg.type === 'res') {
      const r = msg as ResponseMessage;
      const p = this.pending.get(r.id);
      if (!p) return;
      this.pending.delete(r.id);
      if (r.ok) p.resolve(r.result);
      else p.reject(new Error(r.error || 'Command failed'));
    }
  }

  send<T = unknown>(name: CommandName, payload?: Record<string, unknown>): Promise<T> {
    const handle = this.getHandle();
    if (!handle || typeof handle.postMessage !== 'function') {
      return Promise.reject(new Error('WebView not attached'));
    }
    const id = `c${++this.seq}`;
    const message: CommandMessage = { type: 'cmd', id, name, payload };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      handle.postMessage!(JSON.stringify(message));
    });
  }

  on(event: BridgeEvent, cb: EventListener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  private emit(event: BridgeEvent, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('[SketchbookBridge] listener error', e);
      }
    });
  }
}

export function useSketchbookBridge(
  webRef: React.RefObject<WebViewHandleLike | any>
): SketchbookBridge {
  const bridgeRef = React.useRef<SketchbookBridge>();
  if (!bridgeRef.current) bridgeRef.current = new SketchbookBridge();
  const bridge = bridgeRef.current;

  bridge.setWebRef(webRef);

  React.useEffect(() => {
    bridge.setWebRef(webRef);
    if (webRef.current) bridge.attach(webRef.current);
  });

  return bridge;
}

// Re-export the contract so consumers can import everything bridge-related
// from a single module.
export type {
  CommandName,
  CommandMessage,
  BridgeEvent,
  EventName,
  EventMessage,
  ReadyMessage,
  ResponseMessage,
  InboundMessage,
  SetToolPayload,
  SetColorPayload,
  SetBrushPayload,
  AddStrokePayload,
  SetCameraPayload,
  ExportPayload,
} from './bridge-types';
