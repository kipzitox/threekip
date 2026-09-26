// ── RedoCommand ──────────────────────────────────────────────────
import { Command } from '../Commands.js';

export class RedoCommand extends Command {
  async execute(context) {
    const result = await context.engine.redo();
    return { success: result };
  }
}