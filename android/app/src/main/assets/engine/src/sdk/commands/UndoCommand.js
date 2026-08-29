// ── UndoCommand ──────────────────────────────────────────────────
import { Command } from '../Commands.js';

export class UndoCommand extends Command {
  async execute(context) {
    const result = await context.engine.undo();
    return { success: result };
  }
}