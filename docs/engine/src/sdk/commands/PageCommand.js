// ── PageCommand ──────────────────────────────────────────────────
import { Command } from '../Commands.js';

export class PageCommand extends Command {
  async execute(context) {
    const { action, index } = this.payload;
    let result;

    switch (action) {
      case 'add':
        result = context.engine.addPage();
        break;
      case 'delete':
        if (index === undefined) throw new Error('Page delete requires index');
        result = context.engine.deletePage(index);
        break;
      case 'load':
        if (index === undefined) throw new Error('Page load requires index');
        result = context.engine.loadPage(index);
        break;
      case 'save':
        result = context.engine.saveCurrentPage();
        break;
      default:
        throw new Error(`Unknown page action: ${action}`);
    }

    return { action, index, result };
  }
}