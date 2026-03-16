# OpenPixel 🎨

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC.svg)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vitejs.dev/)

**OpenPixel** is a free, open-source, and modular web application that converts any image into an interactive color-by-number pixel art game. It runs entirely in your browser, utilizing Canvas APIs and AI color quantization (K-Means clustering) to generate beautiful, playable pixel art from your photos.

## ✨ Features

- **Image to Pixel Art Engine**: Downsamples uploaded images into customizable grids (e.g., 32x32, 64x64) while preserving aspect ratios.
- **AI Color Quantization**: Uses K-Means clustering to automatically extract an optimal color palette from the image. Includes an "Auto" mode to intelligently determine the best number of colors.
- **Interactive Game Grid**: A performant, zoomable, and pannable grid where users can paint pixels by their corresponding color ID.
- **Smart Palette System**: A responsive, bottom-docked UI that tracks progress and shows a completion checkmark when all pixels of a specific color are filled.
- **Advanced Tooling**: Includes a Draw tool, Pan tool, Color Picker (Pipette), and full Undo/Redo history support.
- **Light & Dark Mode**: Fully responsive UI with seamless theme switching.
- **Export Options**: Export your generated pixel art designs as PNG, JPEG, WebP, or as machine-readable `OpenPixel JSON` files.
- **Privacy First**: All image processing happens locally in your browser. No images are uploaded to any server.

## 🚀 Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Motion](https://motion.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)

## 📦 Installation & Setup

To run OpenPixel locally on your machine:

1. **Clone the repository**
   ```bash
   git clone https://github.com/iYPP4T/openpixel.git
   cd openpixel
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Build for production**
   ```bash
   npm run build
   ```

## 📄 The `OpenPixel` JSON Format

This application introduces the `OpenPixel` JSON format for sharing and storing pixel art designs. This allows developers to easily parse and render pixel art in other engines or applications.

```json
{
  "version": "1.0.0",
  "width": 32,
  "height": 32,
  "palette": [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255]
  ],
  "pixels": [0, 1, 2, 0] // Indices pointing to the palette array
}
```

## 🤝 Contributing

Contributions are highly welcome! Whether it's bug reports, feature requests, or pull requests, we'd love your help making OpenPixel better.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

The core pixelation and quantization logic is isolated in the `src/lib/` directory and is heavily commented to facilitate open-source collaboration.

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
