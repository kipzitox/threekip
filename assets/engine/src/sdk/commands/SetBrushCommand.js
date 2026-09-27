// ── SetBrushCommand ──────────────────────────────────────────────
import { Command } from '../Commands.js';

export class SetBrushCommand extends Command {
  async execute(context) {
    const { size, opacity, flat, smoothing } = this.payload;
    const state = context.engine.getState();
    const prev = {
      size: state.brushSize,
      opacity: state.brushOpacity,
      flat: state.flatBrush,
      smoothing: state.smoothing
    };

    if (size !== undefined) {
      const s = Math.max(0.1, Math.min(100, Number(size)));
      context.engine.setBrushSize(s);
    }
    if (opacity !== undefined) {
      const o = Math.max(0, Math.min(1, Number(opacity)));
      context.engine.setBrushOpacity(o);
    }
    if (flat !== undefined) {
      context.engine.setFlatBrush(Boolean(flat));
    }
    if (smoothing !== undefined) {
      context.engine.setSmoothing(Boolean(smoothing));
    }

    this.payload._prev = prev;
    return { ...prev, ...this.payload };
  }

  async undo(context) {
    if (this.payload._prev) {
      const { size, opacity, flat, smoothing } = this.payload._prev;
      if (size !== undefined) context.engine.setBrushSize(size);
      if (opacity !== undefined) context.engine.setBrushOpacity(opacity);
      if (flat !== undefined) context.engine.setFlatBrush(flat);
      if (smoothing !== undefined) context.engine.setSmoothing(smoothing);
    }
  }
}