// ── SelectObjectCommand ──────────────────────────────────────────
import { Command } from '../Commands.js';

export class SelectObjectCommand extends Command {
  async execute(context) {
    const { id, addToSelection } = this.payload;
    if (id === undefined) {
      context.engine.clearSelection();
      return { cleared: true };
    }
    const result = context.engine.selectObject(id, addToSelection);
    return { id, selected: result };
  }

  async undo(context) {
    context.engine.clearSelection();
  }
}