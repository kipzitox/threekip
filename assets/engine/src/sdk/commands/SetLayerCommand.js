// ── SetLayerCommand ──────────────────────────────────────────────
import { Command } from '../Commands.js';

export class SetLayerCommand extends Command {
  async execute(context) {
    const { layer, visible } = this.payload;
    const prevLayer = context.engine.getState().activeLayer;
    const prevVisibility = [...context.engine.getState().layerVisibility];

    if (layer !== undefined) {
      const l = Math.max(0, Math.min(3, Number(layer)));
      context.engine.setActiveLayer(l);
    }
    if (visible !== undefined) {
      // visible can be array or { index, value }
      if (Array.isArray(visible)) {
        visible.forEach((v, i) => context.engine.setLayerVisible(i, v));
      } else if (typeof visible === 'object' && visible.index !== undefined) {
        context.engine.setLayerVisible(visible.index, visible.value);
      }
    }

    this.payload._prev = { layer: prevLayer, visibility: prevVisibility };
    return { layer: context.engine.getState().activeLayer };
  }

  async undo(context) {
    if (this.payload._prev) {
      context.engine.setActiveLayer(this.payload._prev.layer);
      this.payload._prev.visibility.forEach((v, i) => context.engine.setLayerVisible(i, v));
    }
  }
}