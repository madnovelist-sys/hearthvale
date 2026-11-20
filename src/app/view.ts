// The live map renderer, shared so panels can point the camera at things.
import type { Renderer } from '../render/renderer';

export const view: { renderer: Renderer | null } = { renderer: null };
