/**
 * @license MIT
 * Core Pixelation Engine
 * Handles image loading and downsampling to a specific grid size.
 */

import { RGB } from './types';

/**
 * Loads an image file into an HTMLImageElement.
 */
export async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Downsamples an image to a specific width and height, returning an array of RGB pixels.
 */
export function downsampleImage(img: HTMLImageElement, width: number, height: number): RGB[] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) {
    throw new Error("Could not get 2D canvas context");
  }

  // Draw the image scaled down to the target grid size
  // This inherently averages the pixels if the source is larger
  ctx.drawImage(img, 0, 0, width, height);
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const pixels: RGB[] = [];

  // Extract RGB values, ignoring alpha
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  return pixels;
}
