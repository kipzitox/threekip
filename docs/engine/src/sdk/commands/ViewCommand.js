// ── ViewCommand ──────────────────────────────────────────────────
import { Command } from '../Commands.js';

export class ViewCommand extends Command {
  async execute(context) {
    const { action, index, viewData } = this.payload;
    let result;

    switch (action) {
      case 'save':
        result = context.engine.saveView();
        break;
      case 'load':
        if (index === undefined) throw new Error('View load requires index');
        result = context.engine.recallView(index);
        break;
      case 'delete':
        if (index === undefined) throw new Error('View delete requires index');
        result = context.engine.deleteView(index);
        break;
      default:
        throw new Error(`Unknown view action: ${action}`);
    }

    return { action, index, result };
  }
}