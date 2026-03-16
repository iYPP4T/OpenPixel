# Contributing to OpenPixel 🎨

First off, thank you for considering contributing to OpenPixel! It's people like you that make open-source software such a great community. We welcome all contributions, from bug reports and feature requests to code improvements and documentation updates.

## How to Contribute

### 1. Reporting Bugs
If you find a bug, please open an issue on GitHub. Include as much detail as possible:
* A clear and descriptive title.
* Steps to reproduce the bug.
* Expected behavior vs. actual behavior.
* Your browser and operating system.

### 2. Suggesting Enhancements
Have an idea for a new feature or an improvement? Open an issue and use the "Feature Request" label if available. Describe the feature, why it would be useful, and how you envision it working.

### 3. Submitting Pull Requests
If you want to contribute code, follow these steps:

#### Fork & Create a Branch
1. Fork the OpenPixel repository.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/iYPP4T/openpixel.git
   cd openpixel
   ```
3. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Development Setup
1. Install the project dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser to see your changes live.

#### Project Structure
When making changes, it helps to understand how the project is organized:
* `src/App.tsx`: The main React component containing the UI, state management, and game logic.
* `src/lib/pixelate.ts`: Core logic for loading and downsampling images using the HTML5 Canvas API.
* `src/lib/quantize.ts`: The K-Means clustering algorithm used to extract the optimal color palette.
* `src/lib/types.ts`: Shared TypeScript interfaces (including the `OpenPixelFormat`).
* `src/lib/utils.ts`: Helper functions for color conversion and contrast calculations.

#### Coding Guidelines
* **TypeScript**: This project uses TypeScript. Please ensure your contributions are properly typed and pass the compiler checks (`npm run lint`).
* **Styling**: We use Tailwind CSS v4. Please stick to the existing design language (zinc, indigo, and emerald color palettes) and ensure your UI changes support both Light and Dark modes.
* **Keep it focused**: Try to keep your pull requests small and focused on a single feature or bug fix.

#### Commit & Push
1. Commit your changes with a clear, descriptive commit message:
   ```bash
   git commit -m "Add: New export format for OpenPixel"
   ```
2. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
3. Open a Pull Request against the `main` branch of the original repository.

## License

By contributing to OpenPixel, you agree that your contributions will be licensed under its [MIT License](LICENSE).
