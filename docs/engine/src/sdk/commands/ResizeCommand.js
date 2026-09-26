// ── ResizeCommand ────────────────────────────────────────────────
import { Command } from '../Commands.js';

export class ResizeCommand extends Command {
  async execute(context) {
    const { width, height } = this.payload;
    if (!width || !height) throw new Error('ResizeCommand requires width and height');
    context.engine.resize(width, height);
    return { width, height };
  }
}