/**
 * @license MIT
 * AI Color Mapping (Quantization)
 * Implements K-Means clustering to reduce an image to a limited color palette.
 */

import { RGB } from './types';

/**
 * Calculates the Euclidean distance between two RGB colors.
 */
function euclideanDistance(color1: RGB, color2: RGB): number {
  return Math.sqrt(
    Math.pow(color1[0] - color2[0], 2) +
    Math.pow(color1[1] - color2[1], 2) +
    Math.pow(color1[2] - color2[2], 2)
  );
}

/**
 * Performs K-Means clustering to find the dominant colors (palette) in an array of pixels.
 * 
 * @param pixels Array of RGB pixels
 * @param k Number of colors in the target palette
 * @param maxIterations Maximum number of iterations for the algorithm
 * @returns Array of RGB colors representing the palette
 */
export function kMeans(pixels: RGB[], k: number, maxIterations = 10): RGB[] {
  if (pixels.length === 0) return [];
  if (k >= pixels.length) return Array.from(new Set(pixels.map(p => p.join(',')))).map(s => s.split(',').map(Number) as RGB);

  // 1. Initialize centroids using K-Means++
  const centroids: RGB[] = [];
  
  // Choose first centroid randomly
  const firstIdx = Math.floor(Math.random() * pixels.length);
  centroids.push([...pixels[firstIdx]]);
  
  const distances = new Float32Array(pixels.length).fill(Infinity);
  
  while (centroids.length < k && centroids.length < pixels.length) {
    let sumSqDist = 0;
    const lastCentroid = centroids[centroids.length - 1];
    
    // Update distances to the nearest centroid
    for (let i = 0; i < pixels.length; i++) {
      const dist = euclideanDistance(pixels[i], lastCentroid);
      const sqDist = dist * dist;
      if (sqDist < distances[i]) {
        distances[i] = sqDist;
      }
      sumSqDist += distances[i];
    }
    
    // Choose next centroid based on probability proportional to squared distance
    let r = Math.random() * sumSqDist;
    let nextIdx = pixels.length - 1;
    
    for (let i = 0; i < pixels.length; i++) {
      r -= distances[i];
      if (r <= 0) {
        nextIdx = i;
        break;
      }
    }
    
    centroids.push([...pixels[nextIdx]]);
  }

  const assignments = new Array(pixels.length).fill(0);

  // 2. Iterate to refine centroids
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // Assign each pixel to the nearest centroid
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let bestCentroid = 0;
      
      for (let j = 0; j < centroids.length; j++) {
        const dist = euclideanDistance(pixels[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCentroid = j;
        }
      }
      
      if (assignments[i] !== bestCentroid) {
        assignments[i] = bestCentroid;
        changed = true;
      }
    }

    // Early stopping if no pixels changed clusters
    if (!changed) break;

    // Recalculate centroids as the mean of assigned pixels
    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array(k).fill(0);

    for (let i = 0; i < pixels.length; i++) {
      const centroidIdx = assignments[i];
      sums[centroidIdx][0] += pixels[i][0];
      sums[centroidIdx][1] += pixels[i][1];
      sums[centroidIdx][2] += pixels[i][2];
      counts[centroidIdx]++;
    }

    for (let j = 0; j < k; j++) {
      if (counts[j] > 0) {
        centroids[j] = [
          Math.round(sums[j][0] / counts[j]),
          Math.round(sums[j][1] / counts[j]),
          Math.round(sums[j][2] / counts[j])
        ];
      }
    }
  }

  return centroids;
}

/**
 * Maps an array of pixels to the closest colors in a given palette.
 * Supports optional Floyd-Steinberg dithering and median smoothing.
 * 
 * @param pixels Array of RGB pixels
 * @param palette Array of RGB colors (the palette)
 * @param width Width of the image (needed for dithering/smoothing)
 * @param height Height of the image (needed for dithering/smoothing)
 * @param useDithering Whether to apply Floyd-Steinberg dithering
 * @param useSmoothing Whether to apply a simple median filter to remove noise
 * @returns Array of indices corresponding to the closest palette color for each pixel
 */
export function mapToPalette(
  pixels: RGB[], 
  palette: RGB[], 
  width: number, 
  height: number, 
  useDithering = false,
  useSmoothing = false
): number[] {
  const result = new Array(pixels.length).fill(0);
  
  // Clone pixels if dithering so we can modify them
  const workPixels = useDithering ? pixels.map(p => [...p] as RGB) : pixels;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const pixel = workPixels[i];
      
      let minDist = Infinity;
      let bestIdx = 0;
      
      for (let j = 0; j < palette.length; j++) {
        const dist = euclideanDistance(pixel, palette[j]);
        if (dist < minDist) {
          minDist = dist;
          bestIdx = j;
        }
      }
      
      result[i] = bestIdx;
      
      if (useDithering) {
        const bestColor = palette[bestIdx];
        const errR = pixel[0] - bestColor[0];
        const errG = pixel[1] - bestColor[1];
        const errB = pixel[2] - bestColor[2];
        
        const distributeError = (dx: number, dy: number, factor: number) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const ni = ny * width + nx;
            workPixels[ni][0] += errR * factor;
            workPixels[ni][1] += errG * factor;
            workPixels[ni][2] += errB * factor;
          }
        };
        
        distributeError(1, 0, 7/16);
        distributeError(-1, 1, 3/16);
        distributeError(0, 1, 5/16);
        distributeError(1, 1, 1/16);
      }
    }
  }

  if (useSmoothing) {
    const smoothed = new Array(pixels.length).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              neighbors.push(result[ny * width + nx]);
            }
          }
        }
        // Find most common neighbor
        const counts = new Map<number, number>();
        let maxCount = 0;
        let mostCommon = result[i];
        for (const n of neighbors) {
          const count = (counts.get(n) || 0) + 1;
          counts.set(n, count);
          if (count > maxCount) {
            maxCount = count;
            mostCommon = n;
          }
        }
        smoothed[i] = mostCommon;
      }
    }
    return smoothed;
  }

  return result;
}
