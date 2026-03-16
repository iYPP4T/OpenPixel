/**
 * @license MIT
 * OpenPixel Format Types
 * This file defines the machine-readable JSON format for exported pixel art.
 */

export type RGB = [number, number, number];

export interface OpenPixelFormat {
  /** Format version */
  version: string;
  /** Grid width in pixels */
  width: number;
  /** Grid height in pixels */
  height: number;
  /** Array of RGB colors used in the image */
  palette: RGB[];
  /** 1D array of palette indices corresponding to each pixel (row-major order) */
  pixels: number[];
}
