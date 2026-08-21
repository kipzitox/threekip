// ── Commands — base class and registry ───────────────────────────
// Each command is a self-contained action that can be executed, undone, redone.
// Commands receive the engine context (bridge) and payload.

import { EventBusInstance } from './Events.js';

export class Command {
  constructor(payload = {}) {
    this.payload = payload;
    this.id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    this.timestamp = Date.now();
    this._executed = false;
  }

  async execute(context) {
    throw new Error('Command.execute() must be implemented');
  }

  async undo(context) {
    throw new Error('Command.undo() must be implemented');
  }

  canUndo() {
    return true;
  }

  getDescription() {
    return this.constructor.name;
  }
}

export class CommandRegistry {
  constructor() {
    this._commands = new Map();
    this._history = [];
    this._historyIndex = -1;
    this._maxHistory = 100;
  }

  register(name, commandClass) {
    this._commands.set(name, commandClass);
  }

  get(name) {
    return this._commands.get(name);
  }

  has(name) {
    return this._commands.has(name);
  }

  list() {
    return Array.from(this._commands.keys());
  }

  async execute(name, payload, context) {
    const CommandClass = this._commands.get(name);
    if (!CommandClass) {
      throw new Error(`Command not found: ${name}`);
    }

    const command = new CommandClass(payload);
    const result = await command.execute(context);

    if (command.canUndo()) {
      this._history = this._history.slice(0, this._historyIndex + 1);
      this._history.push(command);
      if (this._history.length > this._maxHistory) {
        this._history.shift();
      } else {
        this._historyIndex++;
      }
    }

    EventBusInstance.emit('commandExecuted', { name, payload, result, command });
    return result;
  }

  async undo(context) {
    if (this._historyIndex < 0) return false;
    const command = this._history[this._historyIndex];
    await command.undo(context);
    this._historyIndex--;
    EventBusInstance.emit('commandUndone', { command });
    return true;
  }

  async redo(context) {
    if (this._historyIndex >= this._history.length - 1) return false;
    this._historyIndex++;
    const command = this._history[this._historyIndex];
    await command.execute(context);
    EventBusInstance.emit('commandRedone', { command });
    return true;
  }

  canUndo() {
    return this._historyIndex >= 0;
  }

  canRedo() {
    return this._historyIndex < this._history.length - 1;
  }

  getHistory() {
    return this._history.map((c, i) => ({
      index: i,
      name: c.constructor.name,
      description: c.getDescription(),
      timestamp: c.timestamp,
      current: i === this._historyIndex
    }));
  }

  clear() {
    this._history = [];
    this._historyIndex = -1;
  }
}

const CommandRegistryInstance = new CommandRegistry();

export { CommandRegistryInstance };
export default CommandRegistryInstance;