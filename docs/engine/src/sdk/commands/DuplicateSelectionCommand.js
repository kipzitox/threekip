// ── DuplicateSelectionCommand ────────────────────────────────────
import { Command } from '../Commands.js';

export class DuplicateSelectionCommand extends Command {
  async execute(context) {
    const count = context.engine.getSelectionCount();
    if (count === 0) return { duplicated: 0 };
    context.engine.duplicateSelection();
    return { duplicated: count };
  }

  async undo(context) {
    await context.bridge.undo();
  }
}