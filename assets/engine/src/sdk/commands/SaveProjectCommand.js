// ── SaveProjectCommand ───────────────────────────────────────────
import { Command } from '../Commands.js';

export class SaveProjectCommand extends Command {
  async execute(context) {
    const { name } = this.payload;
    const data = context.engine.saveProject();
    if (name) {
      await context.engine.saveProjectAs(name);
    }
    return { data, name };
  }
}