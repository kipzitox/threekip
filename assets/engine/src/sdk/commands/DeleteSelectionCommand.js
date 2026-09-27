// ── DeleteSelectionCommand ───────────────────────────────────────
import { Command } from '../Commands.js';

export class DeleteSelectionCommand extends Command {
  async execute(context) {
    const count = context.engine.getSelectionCount();
    if (count === 0) return { deleted: 0 };
    context.engine.deleteSelection();
    return { deleted: count };
  }

  async undo(context) {
    // Undo is handled by history manager
    await context.bridge.undo();
  }
}