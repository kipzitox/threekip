// ── Bridge — command dispatcher between SDK and Engine ───────────
// Receives commands, routes to engine, manages command history.

import { CommandRegistryInstance } from './Commands.js';
import { EventBusInstance } from './Events.js';
import { AppStateInstance } from './AppState.js';

// Import all commands
import { SetToolCommand } from './commands/SetToolCommand.js';
import { SetColorCommand } from './commands/SetColorCommand.js';
import { SetBrushCommand } from './commands/SetBrushCommand.js';
import { UndoCommand } from './commands/UndoCommand.js';
import { RedoCommand } from './commands/RedoCommand.js';
import { ExportCommand } from './commands/ExportCommand.js';
import { LoadProjectCommand } from './commands/LoadProjectCommand.js';
import { SaveProjectCommand } from './commands/SaveProjectCommand.js';
import { SelectObjectCommand } from './commands/SelectObjectCommand.js';
import { DeleteSelectionCommand } from './commands/DeleteSelectionCommand.js';
import { DuplicateSelectionCommand } from './commands/DuplicateSelectionCommand.js';
import { CameraCommand } from './commands/CameraCommand.js';
import { AddStrokeCommand } from './commands/AddStrokeCommand.js';
import { SetLayerCommand } from './commands/SetLayerCommand.js';
import { PageCommand } from './commands/PageCommand.js';
import { ViewCommand } from './commands/ViewCommand.js';
import { ResizeCommand } from './commands/ResizeCommand.js';

class Bridge {
  constructor() {
    this._engine = null;
    this._initialized = false;
    this._commandMap = new Map();
    this._registerCommands();
  }

  _registerCommands() {
    this._commandMap.set('setTool', SetToolCommand);
    this._commandMap.set('setColor', SetColorCommand);
    this._commandMap.set('setBrush', SetBrushCommand);
    this._commandMap.set('undo', UndoCommand);
    this._commandMap.set('redo', RedoCommand);
    this._commandMap.set('export', ExportCommand);
    this._commandMap.set('loadProject', LoadProjectCommand);
    this._commandMap.set('saveProject', SaveProjectCommand);
    this._commandMap.set('selectObject', SelectObjectCommand);
    this._commandMap.set('deleteSelection', DeleteSelectionCommand);
    this._commandMap.set('duplicateSelection', DuplicateSelectionCommand);
    this._commandMap.set('setCamera', CameraCommand);
    this._commandMap.set('addStroke', AddStrokeCommand);
    this._commandMap.set('setLayer', SetLayerCommand);
    this._commandMap.set('page', PageCommand);
    this._commandMap.set('view', ViewCommand);
    this._commandMap.set('resize', ResizeCommand);

    // Register with command registry
    for (const [name, CommandClass] of this._commandMap) {
      CommandRegistryInstance.register(name, CommandClass);
    }
  }

  setEngine(engine) {
    this._engine = engine;
  }

  getEngine() {
    return this._engine;
  }

  initialize() {
    if (this._initialized) return;
    this._initialized = true;
    EventBusInstance.emit('bridgeReady', this);
  }

  execute(commandName, payload = {}) {
    if (!this._engine) {
      throw new Error('Bridge: Engine not set. Call bridge.setEngine(engine) first.');
    }

    const CommandClass = this._commandMap.get(commandName);
    if (!CommandClass) {
      throw new Error(`Bridge: Unknown command: ${commandName}`);
    }

    const command = new CommandClass(payload);
    const context = {
      engine: this._engine,
      bridge: this,
      appState: AppStateInstance
    };

    return command.execute(context);
  }

  async undo() {
    if (!this._engine) return false;
    return await CommandRegistryInstance.undo({ engine: this._engine, bridge: this, appState: AppStateInstance });
  }

  async redo() {
    if (!this._engine) return false;
    return await CommandRegistryInstance.redo({ engine: this._engine, bridge: this, appState: AppStateInstance });
  }

  canUndo() {
    return CommandRegistryInstance.canUndo();
  }

  canRedo() {
    return CommandRegistryInstance.canRedo();
  }

  getHistory() {
    return CommandRegistryInstance.getHistory();
  }

  clearHistory() {
    CommandRegistryInstance.clear();
  }

  registerCommand(name, CommandClass) {
    this._commandMap.set(name, CommandClass);
    CommandRegistryInstance.register(name, CommandClass);
  }

  getCommand(name) {
    return this._commandMap.get(name);
  }

  listCommands() {
    return Array.from(this._commandMap.keys());
  }
}

const BridgeInstance = new Bridge();

export { Bridge, BridgeInstance };
export default BridgeInstance;