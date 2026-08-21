// ── LoadProjectCommand ───────────────────────────────────────────
import { Command } from '../Commands.js';

export class LoadProjectCommand extends Command {
  async execute(context) {
    const { data } = this.payload;
    if (!data) throw new Error('LoadProjectCommand requires data payload');
    await context.engine.loadProject(data);
    return { success: true };
  }
}