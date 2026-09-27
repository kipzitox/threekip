// ── EventBus — internal pub/sub for SDK ──────────────────────────
// Usage:
//   import { EventBus } from './Events.js';
//   EventBus.on('toolChanged', (tool) => console.log(tool));
//   EventBus.emit('toolChanged', 'brush');
//   EventBus.off('toolChanged', handler);

class EventBus {
  constructor() {
    this._events = new Map();
    this._onceEvents = new Map();
  }

  on(event, handler) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    if (!this._onceEvents.has(event)) {
      this._onceEvents.set(event, new Set());
    }
    this._onceEvents.get(event).add(handler);
    return () => this.offOnce(event, handler);
  }

  off(event, handler) {
    const handlers = this._events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this._events.delete(event);
      }
    }
  }

  offOnce(event, handler) {
    const handlers = this._onceEvents.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this._onceEvents.delete(event);
      }
    }
  }

  emit(event, ...args) {
    const handlers = this._events.get(event);
    if (handlers) {
      handlers.forEach(h => {
        try { h(...args); } catch (e) { console.error('[EventBus] handler error:', e); }
      });
    }
    const onceHandlers = this._onceEvents.get(event);
    if (onceHandlers) {
      onceHandlers.forEach(h => {
        try { h(...args); } catch (e) { console.error('[EventBus] once handler error:', e); }
      });
      this._onceEvents.delete(event);
    }
  }

  clear(event) {
    if (event) {
      this._events.delete(event);
      this._onceEvents.delete(event);
    } else {
      this._events.clear();
      this._onceEvents.clear();
    }
  }

  hasListeners(event) {
    const handlers = this._events.get(event);
    const onceHandlers = this._onceEvents.get(event);
    return (handlers && handlers.size > 0) || (onceHandlers && onceHandlers.size > 0);
  }

  listenerCount(event) {
    const handlers = this._events.get(event);
    const onceHandlers = this._onceEvents.get(event);
    return (handlers?.size || 0) + (onceHandlers?.size || 0);
  }
}

const EventBusInstance = new EventBus();

export { EventBus, EventBusInstance };
export default EventBusInstance;