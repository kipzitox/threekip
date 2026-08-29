// ── ExportCommand ────────────────────────────────────────────────
import { Command } from '../Commands.js';

export class ExportCommand extends Command {
  async execute(context) {
    const { format, name } = this.payload;
    const validFormats = ['png', 'glb', 'obj', 'usd', 'usdz'];
    if (!validFormats.includes(format)) {
      throw new Error(`Invalid export format: ${format}. Valid: ${validFormats.join(', ')}`);
    }

    let result;
    switch (format) {
      case 'png':
        result = await context.engine.exportPNG();
        break;
      case 'glb':
        result = await context.engine.exportGLB(name);
        break;
      case 'obj':
        result = await context.engine.exportOBJ(name);
        break;
      case 'usd':
        result = await context.engine.exportUSD(name);
        break;
      case 'usdz':
        result = await context.engine.exportUSDZ(name);
        break;
    }
    return { format, name, result };
  }
}