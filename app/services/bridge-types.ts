// ── ThreeKip / Sketchbook — shared bridge contract (single source of truth) ──
// Mirrors the protocol implemented by assets/engine/js/rn-transport.js and
// assets/engine/src/sdk/Bridge.js. Keep this in sync with those files and
// docs/bridge.md; any drift here is a contract break.
//
//   RN  → WebView : { type:'cmd', id, name, payload }
//   Web → RN     : { type:'res', id, ok, result? }
//                 : { type:'evt', event, data }
//                 : { type:'ready', version }

/** Commands RN can send to the engine (must match Bridge._registerCommands). */
export type CommandName =
  | 'setTool'
  | 'setColor'
  | 'setBrush'
  | 'undo'
  | 'redo'
  | 'export'
  | 'addStroke'
  | 'selectObject'
  | 'deleteSelection'
  | 'duplicateSelection'
  | 'setCamera'
  | 'setLayer'
  | 'page'
  | 'view'
  | 'resize'
  | 'loadProject'
  | 'saveProject';

/** Events the engine forwards to RN (must match rn-transport.js FORWARD_EVENTS). */
export type EventName =
  | 'toolChanged'
  | 'colorChanged'
  | 'brushChanged'
  | 'strokeAdded'
  | 'strokeRemoved'
  | 'strokeTransformed'
  | 'selectionChanged'
  | 'cameraChanged'
  | 'layerChanged'
  | 'pageChanged'
  | 'viewChanged'
  | 'projectLoaded'
  | 'projectSaved'
  | 'historyChanged'
  | 'renderFinished'
  | 'exportFinished'
  | 'error';

/** All events a listener can subscribe to (forwarded events + lifecycle). */
export type BridgeEvent = EventName | 'ready' | 'error' | 'tkState' | 'pngExport' | 'fileExport';

export interface CommandMessage {
  type: 'cmd';
  id: string;
  name: CommandName;
  payload?: Record<string, unknown>;
}
export interface ResponseMessage {
  type: 'res';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}
export interface EventMessage {
  type: 'evt';
  event: EventName;
  data?: unknown;
}
export interface ReadyMessage {
  type: 'ready';
  version: string;
}
export interface ErrorMessage {
  type: 'error';
  error: string;
}
export type InboundMessage = ResponseMessage | EventMessage | ReadyMessage | ErrorMessage;

// ── Strongly-typed command payloads (subset documented in docs/bridge.md) ──
export interface SetToolPayload {
  tool: 'draw' | 'erase' | 'select' | 'pan' | 'orbit';
}
export interface SetColorPayload {
  color: string;
}
export interface SetBrushPayload {
  size?: number;
  opacity?: number;
  flat?: boolean;
  smoothing?: boolean;
}
export interface AddStrokePayload {
  points: { x: number; y: number; z: number }[];
  color?: string;
  size?: number;
  opacity?: number;
  flat?: boolean;
  layer?: number;
}
export interface SetCameraPayload {
  theta?: number;
  phi?: number;
  radius?: number;
  target?: { x: number; y: number; z: number };
  ortho?: boolean;
  orthoZoom?: number;
}
export interface ExportPayload {
  format: 'png' | 'glb' | 'obj' | 'usd' | 'usdz';
  name?: string;
}

/** Runtime arrays for validation / cross-checking against the engine. */
export const COMMAND_NAMES: readonly CommandName[] = [
  'setTool', 'setColor', 'setBrush', 'undo', 'redo', 'export', 'addStroke',
  'selectObject', 'deleteSelection', 'duplicateSelection', 'setCamera', 'setLayer',
  'page', 'view', 'resize', 'loadProject', 'saveProject',
];
export const EVENT_NAMES: readonly EventName[] = [
  'toolChanged', 'colorChanged', 'brushChanged', 'strokeAdded', 'strokeRemoved',
  'strokeTransformed', 'selectionChanged', 'cameraChanged', 'layerChanged',
  'pageChanged', 'viewChanged', 'projectLoaded', 'projectSaved', 'historyChanged',
  'renderFinished', 'exportFinished', 'error',
];
