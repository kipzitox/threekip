// ── SetColorCommand ──────────────────────────────────────────────
import { Command } from '../Commands.js';

export class SetColorCommand extends Command {
  async execute(context) {
    const { color } = this.payload;
    if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new Error('Invalid color format. Expected #RRGGBB');
    }
    const prevColor = context.engine.getState().color;
    context.engine.setColor(color);
    this.payload._prevColor = prevColor;
    return { color };
  }

  async undo(context) {
    if (this.payload._prevColor) {
      context.engine.setColor(this.payload._prevColor);
    }
  }
}