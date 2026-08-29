// ── CameraCommand ────────────────────────────────────────────────
import { Command } from '../Commands.js';

export class CameraCommand extends Command {
  async execute(context) {
    const { theta, phi, radius, target, ortho, orthoZoom } = this.payload;
    const prev = context.engine.getCamera();
    const camera = {};

    if (theta !== undefined) camera.theta = Number(theta);
    if (phi !== undefined) camera.phi = Number(phi);
    if (radius !== undefined) camera.radius = Math.max(0.1, Number(radius));
    if (target) camera.target = { ...prev.target, ...target };
    if (ortho !== undefined) camera.ortho = Boolean(ortho);
    if (orthoZoom !== undefined) camera.orthoZoom = Number(orthoZoom);

    this.payload._prev = prev;
    context.engine.setCamera(camera);
    return { camera, prev };
  }

  async undo(context) {
    if (this.payload._prev) {
      context.engine.setCamera(this.payload._prev);
    }
  }
}