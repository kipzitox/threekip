// ── SetToolCommand ───────────────────────────────────────────────
import { Command } from '../Commands.js';

export class SetToolCommand extends Command {
  async execute(context) {
    const { tool } = this.payload;
    const validTools = ['draw', 'erase', 'select', 'pan', 'orbit'];
    if (!validTools.includes(tool)) {
      throw new Error(`Invalid tool: ${tool}. Valid: ${validTools.join(', ')}`);
    }
    context.engine.setTool(tool);
    return { tool };
  }

  async undo(context) {
    // Tool changes don't have a meaningful undo - would need previous tool
    const prevTool = context.engine.getState().prevDrawMode || 'draw';
    context.engine.setTool(prevTool);
  }
}