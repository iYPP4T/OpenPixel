import { RGB } from './types';

export function rgbToHex(rgb: RGB): string {
  return '#' + rgb.map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

export function getContrastColor(rgb: RGB): string {
  // Calculate relative luminance to determine if text should be black or white
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
