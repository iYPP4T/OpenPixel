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
  // Draw original image to get its raw pixel data
  const origCanvas = document.createElement('canvas');
  origCanvas.width = img.width;
  origCanvas.height = img.height;
  const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!origCtx) {
    throw new Error("Could not get 2D canvas context");
  }

  origCtx.drawImage(img, 0, 0);
  const origData = origCtx.getImageData(0, 0, img.width, img.height).data;
  const pixels: RGB[] = [];

  const blockWidth = img.width / width;
  const blockHeight = img.height / height;

  // Block averaging for better pixel art downsampling
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      
      const startX = Math.floor(x * blockWidth);
      const startY = Math.floor(y * blockHeight);
      const endX = Math.max(startX + 1, Math.floor((x + 1) * blockWidth));
      const endY = Math.max(startY + 1, Math.floor((y + 1) * blockHeight));

      for (let py = startY; py < endY && py < img.height; py++) {
        for (let px = startX; px < endX && px < img.width; px++) {
          const i = (py * img.width + px) * 4;
          // Only count pixels that aren't fully transparent
          if (origData[i + 3] > 10) {
            r += origData[i];
            g += origData[i + 1];
            b += origData[i + 2];
            count++;
          }
        }
      }

      if (count > 0) {
        let avgR = r / count;
        let avgG = g / count;
        let avgB = b / count;
        
        // Slight saturation and contrast boost to make pixel art pop
        const luminance = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
        const contrast = 1.1; // 10% contrast boost
        
        avgR = (avgR - luminance) * 1.2 + luminance; // Saturation boost
        avgG = (avgG - luminance) * 1.2 + luminance;
        avgB = (avgB - luminance) * 1.2 + luminance;

        avgR = (avgR - 128) * contrast + 128; // Contrast boost
        avgG = (avgG - 128) * contrast + 128;
        avgB = (avgB - 128) * contrast + 128;

        pixels.push([
          Math.min(255, Math.max(0, Math.round(avgR))),
          Math.min(255, Math.max(0, Math.round(avgG))),
          Math.min(255, Math.max(0, Math.round(avgB)))
        ]);
      } else {
        pixels.push([255, 255, 255]); // Fallback for transparent areas
      }
    }
  }

  return pixels;
}
