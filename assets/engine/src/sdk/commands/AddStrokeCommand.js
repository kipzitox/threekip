// ── AddStrokeCommand ─────────────────────────────────────────────
import { Command } from '../Commands.js';

export class AddStrokeCommand extends Command {
  async execute(context) {
    const { points, color, size, opacity, flat, layer } = this.payload;
    const strokeId = context.engine.addStroke({
      points,
      color: color || context.engine.getState().color,
      size: size || context.engine.getState().brushSize,
      opacity: opacity || context.engine.getState().brushOpacity,
      flat: flat !== undefined ? flat : context.engine.getState().flatBrush,
      layer: layer !== undefined ? layer : context.engine.getState().activeLayer
    });
    return { strokeId };
  }

  async undo(context) {
    await context.bridge.undo();
  }
}