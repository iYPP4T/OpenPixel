import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGesture } from '@use-gesture/react';
import { Upload, Download, Check, Settings2, Image as ImageIcon, ZoomIn, ZoomOut, Undo, Redo, ChevronDown, Pipette, Hand, Pen, Sun, Moon, PaintBucket, Wand2, Trash2, Lightbulb, Clock, Library, X, Share2, Volume2, VolumeX, Maximize, EyeOff, Eye, Search, Keyboard, SkipForward, Focus, FileUp, Gauge } from 'lucide-react';
import confetti from 'canvas-confetti';
import { loadImage, downsampleImage } from './lib/pixelate';
import { kMeans, mapToPalette } from './lib/quantize';
import { OpenPixelFormat, RGB } from './lib/types';
import { rgbToHex, getContrastColor } from './lib/utils';
import { audio } from './lib/audio';
import { PaletteName, PRESET_PALETTES } from './lib/palettes';
import { GALLERY_ITEMS, GalleryItem } from './lib/gallery';

export default function App() {
  // --- State ---
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [gridSize, setGridSize] = useState<number>(32);
  const [colorCount, setColorCount] = useState<number | 'auto'>('auto');
  const [useDithering, setUseDithering] = useState<boolean>(false);
  const [useSmoothing, setUseSmoothing] = useState<boolean>(false);
  const [selectedPalette, setSelectedPalette] = useState<PaletteName>('auto');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [openPixelData, setOpenPixelData] = useState<OpenPixelFormat | null>(null);
  
  // Game State
  const [selectedColorIdx, setSelectedColorIdx] = useState<number>(0);
  const [filledPixels, setFilledPixels] = useState<Set<number>>(new Set());
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showGallery, setShowGallery] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [hasDismissedCompletion, setHasDismissedCompletion] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<'draw' | 'picker' | 'pan' | 'wand' | 'eraser'>('draw');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hideCompletedColors, setHideCompletedColors] = useState<boolean>(false);
  const [focusSelectedColor, setFocusSelectedColor] = useState<boolean>(false);
  const [hintPixel, setHintPixel] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const keyboardShortcuts = useMemo(() => ([
    { key: 'B', action: 'Draw tool' },
    { key: 'W', action: 'Magic wand tool' },
    { key: 'E', action: 'Eraser tool' },
    { key: 'V', action: 'Pan tool' },
    { key: 'I', action: 'Color picker tool' },
    { key: 'F', action: 'Fill selected color' },
    { key: 'H', action: 'Hint (fill one pixel)' },
    { key: 'S', action: 'Find next pixel of selected color' },
    { key: 'C', action: 'Clear board' },
    { key: 'N', action: 'Jump to next incomplete color' },
    { key: 'G', action: 'Toggle grid lines' },
    { key: '+ / -', action: 'Zoom in / out' },
    { key: '0', action: 'Reset zoom' },
    { key: 'Ctrl/Cmd + Z', action: 'Undo' },
    { key: 'Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y', action: 'Redo' },
    { key: '?', action: 'Open/close shortcuts' },
    { key: 'Esc', action: 'Close open dialogs/menus' }
  ]), []);

  // History State
  const [history, setHistory] = useState<Set<number>[]>([new Set()]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const pendingChanges = useRef(false);

  // --- Persistence ---
  useEffect(() => {
    const savedData = localStorage.getItem('openPixelSave');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.openPixelData) {
          setOpenPixelData(parsed.openPixelData);
          const savedFilled = new Set<number>(parsed.filledPixels || []);
          setFilledPixels(savedFilled);
          setHistory([savedFilled]);
          setHistoryIndex(0);
          if (parsed.gridSize) setGridSize(parsed.gridSize);
          if (parsed.colorCount) setColorCount(parsed.colorCount);
          if (parsed.useDithering !== undefined) setUseDithering(parsed.useDithering);
          if (parsed.useSmoothing !== undefined) setUseSmoothing(parsed.useSmoothing);
          if (parsed.startTime) setStartTime(parsed.startTime);
          if (parsed.endTime) setEndTime(parsed.endTime);
        }
      } catch (e) {
        console.error("Failed to load save", e);
      }
    }
  }, []);

  useEffect(() => {
    const savedPrefs = localStorage.getItem('openPixelPrefs');
    if (!savedPrefs) return;
    try {
      const parsed = JSON.parse(savedPrefs);
      if (parsed.theme === 'light' || parsed.theme === 'dark') setTheme(parsed.theme);
      if (typeof parsed.isMuted === 'boolean') {
        audio.isMuted = parsed.isMuted;
        setIsMuted(parsed.isMuted);
      }
      if (typeof parsed.showGridLines === 'boolean') setShowGridLines(parsed.showGridLines);
      if (typeof parsed.hideCompletedColors === 'boolean') setHideCompletedColors(parsed.hideCompletedColors);
      if (typeof parsed.focusSelectedColor === 'boolean') setFocusSelectedColor(parsed.focusSelectedColor);
    } catch (e) {
      console.error("Failed to load preferences", e);
    }
  }, []);

  useEffect(() => {
    if (openPixelData) {
      localStorage.setItem('openPixelSave', JSON.stringify({
        openPixelData,
        filledPixels: Array.from(filledPixels),
        gridSize,
        colorCount,
        useDithering,
        useSmoothing,
        startTime,
        endTime
      }));
    }
  }, [openPixelData, filledPixels, gridSize, colorCount, useDithering, useSmoothing, startTime, endTime]);

  useEffect(() => {
    localStorage.setItem('openPixelPrefs', JSON.stringify({
      theme,
      isMuted,
      showGridLines,
      hideCompletedColors,
      focusSelectedColor
    }));
  }, [theme, isMuted, showGridLines, hideCompletedColors, focusSelectedColor]);

  // --- Timer ---
  useEffect(() => {
    let interval: number;
    if (startTime && !endTime) {
      interval = window.setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
    } else if (startTime && endTime) {
      setElapsedTime(endTime - startTime);
    } else {
      setElapsedTime(0);
    }
    return () => window.clearInterval(interval);
  }, [startTime, endTime]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // --- Processing ---
  const processImage = async (img: HTMLImageElement, size: number, colors: number | 'auto', dither: boolean, smooth: boolean, paletteName: PaletteName) => {
    setIsProcessing(true);
    try {
      // Allow UI to update before heavy processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const aspectRatio = img.width / img.height;
      let gridW = size;
      let gridH = size;
      if (aspectRatio > 1) {
        gridH = Math.max(1, Math.round(size / aspectRatio));
      } else {
        gridW = Math.max(1, Math.round(size * aspectRatio));
      }
      
      const pixels = downsampleImage(img, gridW, gridH);
      
      let finalColorCount = 16;
      let palette: RGB[];
      
      if (paletteName !== 'auto') {
        palette = PRESET_PALETTES[paletteName];
      } else {
        if (colors === 'auto') {
          const uniqueColors = new Set(pixels.map(p => p.join(','))).size;
          // Heuristic: scale color count based on unique colors in downsampled image, bounded between 8 and 24
          finalColorCount = Math.min(24, Math.max(8, Math.round(uniqueColors / 5)));
        } else {
          finalColorCount = colors;
        }
        palette = kMeans(pixels, finalColorCount);
      }
      
      const mappedPixels = mapToPalette(pixels, palette, gridW, gridH, dither, smooth);
      
      setOpenPixelData({
        version: "1.0.0",
        width: gridW,
        height: gridH,
        palette,
        pixels: mappedPixels
      });
      
      const initialPixels = new Set<number>();
      setFilledPixels(initialPixels);
      setHistory([initialPixels]);
      setHistoryIndex(0);
      pendingChanges.current = false;
      completedColorsRef.current = new Set();
      setSelectedColorIdx(0);
      setZoom(1);
      setStartTime(null);
      setEndTime(null);
    } catch (error) {
      console.error("Error processing image:", error);
      alert("Failed to process image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isValidOpenPixelFormat = (data: unknown): data is OpenPixelFormat => {
    if (!data || typeof data !== 'object') return false;
    const payload = data as Record<string, unknown>;

    if (typeof payload.version !== 'string') return false;
    if (typeof payload.width !== 'number' || payload.width <= 0) return false;
    if (typeof payload.height !== 'number' || payload.height <= 0) return false;
    if (!Array.isArray(payload.palette) || !Array.isArray(payload.pixels)) return false;

    const paletteValid = payload.palette.every((entry) =>
      Array.isArray(entry) &&
      entry.length === 3 &&
      entry.every((c) => typeof c === 'number' && c >= 0 && c <= 255)
    );
    if (!paletteValid) return false;

    const pixelCount = payload.width * payload.height;
    if (payload.pixels.length !== pixelCount) return false;

    const maxPaletteIdx = payload.palette.length - 1;
    return payload.pixels.every((idx) => typeof idx === 'number' && idx >= 0 && idx <= maxPaletteIdx);
  };

  const handleOpenPixelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      if (!isValidOpenPixelFormat(parsed)) {
        alert('Invalid OpenPixel JSON format. Please import a valid .openpixel.json file.');
        return;
      }

      setImage(null);
      setOpenPixelData(parsed);
      const initialPixels = new Set<number>();
      setFilledPixels(initialPixels);
      setHistory([initialPixels]);
      setHistoryIndex(0);
      pendingChanges.current = false;
      completedColorsRef.current = new Set();
      setSelectedColorIdx(0);
      setZoom(1);
      setShowExportMenu(false);
      setStartTime(null);
      setEndTime(null);
      setHintPixel(null);
      setHasDismissedCompletion(false);
    } catch (error) {
      console.error('Failed to import OpenPixel JSON:', error);
      alert('Failed to import file. Make sure the file is valid JSON.');
    } finally {
      e.target.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const img = await loadImage(file);
      setImage(img);
      processImage(img, gridSize, colorCount, useDithering, useSmoothing, selectedPalette);
    } catch (error) {
      console.error("Error loading image:", error);
      alert("Failed to load image.");
    }
  };

  const loadGalleryItem = async (item: GalleryItem) => {
    setIsProcessing(true);
    setShowGallery(false);
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const file = new File([blob], `${item.id}.jpg`, { type: blob.type });
      const img = await loadImage(file);
      setImage(img);
      
      // Set appropriate grid size based on difficulty
      let newGridSize = 32;
      if (item.difficulty === 'easy') newGridSize = 16;
      if (item.difficulty === 'hard') newGridSize = 48;
      setGridSize(newGridSize);
      
      processImage(img, newGridSize, colorCount, useDithering, useSmoothing, selectedPalette);
    } catch (error) {
      console.error("Error loading gallery item:", error);
      alert("Failed to load gallery image.");
      setIsProcessing(false);
    }
  };

  // Re-process if settings change and we have an image
  useEffect(() => {
    if (image) {
      const timeoutId = setTimeout(() => {
        processImage(image, gridSize, colorCount, useDithering, useSmoothing, selectedPalette);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [gridSize, colorCount, image, useDithering, useSmoothing, selectedPalette]);

  // --- Game Logic ---
  const handlePixelInteract = (index: number) => {
    if (!openPixelData) return;
    
    if (activeTool === 'picker') {
      setSelectedColorIdx(openPixelData.pixels[index]);
      setActiveTool('draw');
      return;
    }
    
    if (activeTool === 'pan') return;

    if (activeTool === 'eraser') {
      setFilledPixels(prev => {
        if (!prev.has(index)) return prev;
        const next = new Set(prev);
        next.delete(index);
        pendingChanges.current = true;
        return next;
      });
      return;
    }

    if (activeTool === 'wand') {
      const targetColorIdx = openPixelData.pixels[index];
      if (targetColorIdx !== selectedColorIdx) return;
      if (!startTime) setStartTime(Date.now());

      setFilledPixels(prev => {
        if (prev.has(index)) return prev;
        const next = new Set(prev);
        
        const width = openPixelData.width;
        const height = openPixelData.height;
        const visited = new Set<number>();
        const queue = [index];

        while (queue.length > 0) {
          const idx = queue.shift()!;
          if (visited.has(idx)) continue;
          visited.add(idx);

          if (openPixelData.pixels[idx] === targetColorIdx && !next.has(idx)) {
            next.add(idx);
            
            const x = idx % width;
            const y = Math.floor(idx / width);

            if (x > 0) queue.push(idx - 1);
            if (x < width - 1) queue.push(idx + 1);
            if (y > 0) queue.push(idx - width);
            if (y < height - 1) queue.push(idx + width);
          }
        }
        
        pendingChanges.current = true;
        audio.playPop();
        return next;
      });
      return;
    }
    
    // Only fill if the selected color matches the target color
    if (openPixelData.pixels[index] === selectedColorIdx) {
      if (!startTime) setStartTime(Date.now());
      
      setFilledPixels(prev => {
        if (prev.has(index)) return prev;
        const next = new Set(prev);
        next.add(index);
        pendingChanges.current = true;
        return next;
      });
      audio.playPop();
    }
  };

  // Commit to history when dragging stops
  useEffect(() => {
    if (!isDragging && pendingChanges.current) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(filledPixels);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      pendingChanges.current = false;
    }
  }, [isDragging, filledPixels, history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setFilledPixels(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setFilledPixels(history[historyIndex + 1]);
    }
  };

  const handleFillColor = () => {
    if (!openPixelData) return;
    
    if (!startTime) setStartTime(Date.now());
    setFilledPixels(prev => {
      const next = new Set(prev);
      let changed = false;
      openPixelData.pixels.forEach((colorIdx, index) => {
        if (colorIdx === selectedColorIdx && !next.has(index)) {
          next.add(index);
          changed = true;
        }
      });
      
      if (changed) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(next);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        audio.playPop();
      }
      return next;
    });
  };

  const handleFillAll = () => {
    if (!openPixelData) return;
    
    if (!startTime) setStartTime(Date.now());
    setFilledPixels(prev => {
      const next = new Set(openPixelData.pixels.map((_, i) => i));
      if (next.size !== prev.size) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(next);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        audio.playPop();
      }
      return next;
    });
  };

  const handleFindPixel = () => {
    if (!openPixelData) return;
    
    // Find the first missing pixel of the currently selected color
    const targetIdx = openPixelData.pixels.findIndex((colorIdx, i) => colorIdx === selectedColorIdx && !filledPixels.has(i));
    
    if (targetIdx !== -1) {
      setHintPixel(targetIdx);
      
      // Clear hint after 3 seconds
      setTimeout(() => setHintPixel(null), 3000);
      
      // Center the pixel in the view
      if (containerRef.current) {
        const x = targetIdx % openPixelData.width;
        const y = Math.floor(targetIdx / openPixelData.width);
        
        // Calculate pixel position in the container
        // Base pixel size is 24px (w-6 h-6) * zoom
        const pixelSize = 24 * zoom;
        const pixelX = x * pixelSize;
        const pixelY = y * pixelSize;
        
        // Calculate center of container
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        
        // Scroll to center the pixel
        containerRef.current.scrollTo({
          left: pixelX - containerWidth / 2 + pixelSize / 2,
          top: pixelY - containerHeight / 2 + pixelSize / 2,
          behavior: 'smooth'
        });
      }
    }
  };

  const handleClearAll = () => {
    if (!openPixelData) return;
    
    setFilledPixels(prev => {
      if (prev.size > 0) {
        const next = new Set<number>();
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(next);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setStartTime(null);
        setEndTime(null);
        completedColorsRef.current = new Set();
        return next;
      }
      return prev;
    });
  };

  const handleHint = () => {
    if (!openPixelData) return;
    
    const unfilled: number[] = [];
    openPixelData.pixels.forEach((colorIdx, index) => {
      if (colorIdx === selectedColorIdx && !filledPixels.has(index)) {
        unfilled.push(index);
      }
    });
    
    if (unfilled.length > 0) {
      if (!startTime) setStartTime(Date.now());
      const randomIdx = unfilled[Math.floor(Math.random() * unfilled.length)];
      setFilledPixels(prev => {
        const next = new Set(prev);
        next.add(randomIdx);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(next);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        audio.playPop();
        return next;
      });
    }
  };

  const selectNextIncompleteColor = useCallback(() => {
    if (!openPixelData) return;
    const totalColors = openPixelData.palette.length;
    if (totalColors === 0) return;

    const counts = new Array(totalColors).fill(0);
    const filled = new Array(totalColors).fill(0);

    openPixelData.pixels.forEach((colorIdx, idx) => {
      counts[colorIdx]++;
      if (filledPixels.has(idx)) filled[colorIdx]++;
    });

    const isIncomplete = (idx: number) => counts[idx] > 0 && filled[idx] < counts[idx];
    if (!isIncomplete(selectedColorIdx)) {
      const firstIncomplete = counts.findIndex((_, idx) => isIncomplete(idx));
      if (firstIncomplete !== -1) {
        setSelectedColorIdx(firstIncomplete);
      }
      return;
    }

    for (let step = 1; step <= totalColors; step++) {
      const idx = (selectedColorIdx + step) % totalColors;
      if (isIncomplete(idx)) {
        setSelectedColorIdx(idx);
        return;
      }
    }
  }, [openPixelData, filledPixels, selectedColorIdx]);

  // Keyboard shortcuts for Tools and Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;

      if (e.key === 'Escape') {
        setShowExportMenu(false);
        setShowGallery(false);
        setShowShortcuts(false);
        return;
      }

      if (!isTypingField && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (!isTypingField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        switch(e.key.toLowerCase()) {
          case 'b': setActiveTool('draw'); break;
          case 'v': setActiveTool('pan'); break;
          case 'i': setActiveTool('picker'); break;
          case 'w': setActiveTool('wand'); break;
          case 'e': setActiveTool('eraser'); break;
          case 'f': handleFillColor(); break;
          case 'h': handleHint(); break;
          case 's': handleFindPixel(); break;
          case 'c': handleClearAll(); break;
          case 'n': selectNextIncompleteColor(); break;
          case 'g': setShowGridLines(prev => !prev); break;
          case '+':
          case '=': setZoom(z => Math.min(5, z + 0.25)); break;
          case '-':
          case '_': setZoom(z => Math.max(0.1, z - 0.25)); break;
          case '0': setZoom(1); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, activeTool, selectedColorIdx, openPixelData, filledPixels, selectNextIncompleteColor]);

  const containerRef = useRef<HTMLDivElement>(null);

  useGesture(
    {
      onDrag: ({ offset: [x, y], memo, active }) => {
        if (activeTool !== 'pan') return memo;
        if (containerRef.current) {
          if (memo) {
            containerRef.current.scrollLeft -= x - memo[0];
            containerRef.current.scrollTop -= y - memo[1];
          }
        }
        return [x, y];
      },
      onPinch: ({ offset: [d] }) => {
        setZoom(d);
      },
      onWheel: ({ event, delta: [dx, dy], ctrlKey }) => {
        if (ctrlKey) {
          event.preventDefault();
          setZoom(z => Math.max(0.1, Math.min(5, z - dy * 0.01)));
        } else if (containerRef.current) {
          containerRef.current.scrollLeft += dx;
          containerRef.current.scrollTop += dy;
        }
      }
    },
    {
      target: containerRef,
      drag: { filterTaps: true },
      pinch: { scaleBounds: { min: 0.1, max: 5 }, modifierKey: 'ctrlKey' },
      wheel: { eventOptions: { passive: false } }
    }
  );

  const handlePointerDown = (index: number) => {
    setIsDragging(true);
    handlePixelInteract(index);
  };

  const handlePointerEnter = (index: number) => {
    if (isDragging) {
      handlePixelInteract(index);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, []);

  // --- Derived State ---
  const colorProgress = useMemo(() => {
    if (!openPixelData) return [];
    
    const counts = new Array(openPixelData.palette.length).fill(0);
    const filled = new Array(openPixelData.palette.length).fill(0);
    
    openPixelData.pixels.forEach((colorIdx, i) => {
      counts[colorIdx]++;
      if (filledPixels.has(i)) {
        filled[colorIdx]++;
      }
    });
    
    return counts.map((total, idx) => ({
      total,
      filled: filled[idx],
      isComplete: total > 0 && total === filled[idx]
    }));
  }, [openPixelData, filledPixels]);

  const isLevelComplete = useMemo(() => {
    if (!openPixelData) return false;
    return filledPixels.size === openPixelData.pixels.length && openPixelData.pixels.length > 0;
  }, [openPixelData, filledPixels]);

  const remainingPixels = useMemo(() => {
    if (!openPixelData) return 0;
    return Math.max(0, openPixelData.pixels.length - filledPixels.size);
  }, [openPixelData, filledPixels]);

  const completedColorCount = useMemo(() => colorProgress.filter((p) => p.isComplete).length, [colorProgress]);
  const completionPercent = useMemo(() => {
    if (!openPixelData || openPixelData.pixels.length === 0) return 0;
    return Math.round((filledPixels.size / openPixelData.pixels.length) * 100);
  }, [openPixelData, filledPixels]);
  const pixelsPerMinute = useMemo(() => {
    if (!startTime || elapsedTime <= 0) return 0;
    return (filledPixels.size / elapsedTime) * 60_000;
  }, [startTime, elapsedTime, filledPixels]);
  const estimatedMinutesLeft = useMemo(() => {
    if (!openPixelData || pixelsPerMinute <= 0) return null;
    const remaining = Math.max(0, openPixelData.pixels.length - filledPixels.size);
    return remaining / pixelsPerMinute;
  }, [openPixelData, filledPixels, pixelsPerMinute]);

  useEffect(() => {
    if (!isLevelComplete) {
      setHasDismissedCompletion(false);
    }
  }, [isLevelComplete]);

  const completedColorsRef = useRef<Set<number>>(new Set());

  // Sync completedColorsRef with colorProgress (handles undo/redo)
  useEffect(() => {
    colorProgress.forEach((p, idx) => {
      if (!p.isComplete && completedColorsRef.current.has(idx)) {
        completedColorsRef.current.delete(idx);
      } else if (p.isComplete && !completedColorsRef.current.has(idx)) {
        // We don't add it here because we want the chime to play in the other effect
        // But if it's already complete on load, we should add it
      }
    });
  }, [colorProgress]);

  // Auto-switch color when current is complete
  useEffect(() => {
    if (!openPixelData || selectedColorIdx === null) return;
    const currentProgress = colorProgress[selectedColorIdx];
    if (currentProgress && currentProgress.isComplete) {
      if (!completedColorsRef.current.has(selectedColorIdx)) {
        completedColorsRef.current.add(selectedColorIdx);
        if (!isLevelComplete) {
          audio.playChime();
        }
      }
      const nextColorIdx = colorProgress.findIndex(p => !p.isComplete && p.total > 0);
      if (nextColorIdx !== -1 && nextColorIdx !== selectedColorIdx) {
        setSelectedColorIdx(nextColorIdx);
      }
    }
  }, [colorProgress, selectedColorIdx, openPixelData, isLevelComplete]);

  // Confetti on complete
  useEffect(() => {
    if (isLevelComplete) {
      audio.playFanfare();
      if (!endTime) setEndTime(Date.now());
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b']
      });
    }
  }, [isLevelComplete, endTime]);

  // --- Export ---
  const exportOpenPixel = () => {
    if (!openPixelData) return;
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(openPixelData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "design.openpixel.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const createExportCanvas = (format: 'png' | 'jpeg' | 'webp') => {
    if (!openPixelData) return null;
    
    const canvas = document.createElement('canvas');
    const scale = 30; // Export at a higher resolution
    canvas.width = openPixelData.width * scale;
    canvas.height = openPixelData.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (showGridLines) {
      ctx.fillStyle = theme === 'dark' ? '#27272a' : '#e4e4e7'; // zinc-800 / zinc-200
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (format === 'jpeg') {
      ctx.fillStyle = theme === 'dark' ? '#18181b' : '#ffffff'; // zinc-900 / white
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const gap = showGridLines ? 1 : 0;

    openPixelData.pixels.forEach((colorIdx, i) => {
      const x = (i % openPixelData.width) * scale;
      const y = Math.floor(i / openPixelData.width) * scale;
      
      const isFilled = filledPixels.has(i);
      if (isFilled) {
        const rgb = openPixelData.palette[colorIdx];
        ctx.fillStyle = rgbToHex(rgb);
      } else {
        ctx.fillStyle = theme === 'dark' ? '#18181b' : '#ffffff'; // zinc-900 / white
      }
      ctx.fillRect(x, y, scale - gap, scale - gap);

      if (!isFilled && zoom >= 0.8) {
        const isTargetColor = selectedColorIdx === colorIdx;
        ctx.fillStyle = isTargetColor ? (theme === 'dark' ? '#d4d4d8' : '#3f3f46') : (theme === 'dark' ? '#71717a' : '#a1a1aa');
        ctx.font = `bold ${scale * 0.4}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((colorIdx + 1).toString(), x + (scale - gap) / 2, y + (scale - gap) / 2);
      }
    });

    return canvas;
  };

  const exportImage = (format: 'png' | 'jpeg' | 'webp') => {
    const canvas = createExportCanvas(format);
    if (!canvas) return;

    const dataUrl = canvas.toDataURL(`image/${format}`, 0.9);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataUrl);
    downloadAnchorNode.setAttribute("download", `pixel-art.${format}`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleShare = async () => {
    const canvas = createExportCanvas('png');
    if (!canvas) return;
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'pixel-art.png', { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'My Pixel Art',
            text: 'Check out my masterpiece on OpenPixel!',
            files: [file]
          });
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            console.error('Share failed:', err);
          }
        }
      } else {
        // Fallback to Twitter intent
        const text = encodeURIComponent('I just completed a pixel art masterpiece on OpenPixel! 🎨✨');
        const url = encodeURIComponent(window.location.href);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
      }
    }, 'image/png');
  };

  const exportTimelapse = async () => {
    if (!openPixelData || history.length === 0) return;
    setIsProcessing(true);
    
    try {
      // Dynamic import to avoid loading gif.js until needed
      const GIF = (await import('gif.js')).default;
      
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: openPixelData.width * 10,
        height: openPixelData.height * 10,
        workerScript: '/gif.worker.js' // We need to ensure this exists, or use a blob worker
      });

      const canvas = document.createElement('canvas');
      const scale = 10;
      canvas.width = openPixelData.width * scale;
      canvas.height = openPixelData.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Render each history state as a frame
      for (let h = 0; h <= historyIndex; h++) {
        const state = history[h];
        
        ctx.fillStyle = theme === 'dark' ? '#18181b' : '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        openPixelData.pixels.forEach((colorIdx, i) => {
          const x = (i % openPixelData.width) * scale;
          const y = Math.floor(i / openPixelData.width) * scale;
          
          if (state.has(i)) {
            const rgb = openPixelData.palette[colorIdx];
            ctx.fillStyle = rgbToHex(rgb);
            ctx.fillRect(x, y, scale, scale);
          }
        });

        // Add frame to gif (delay in ms)
        gif.addFrame(ctx, {copy: true, delay: h === historyIndex ? 2000 : 100});
      }

      gif.on('finished', (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'timelapse.gif';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsProcessing(false);
      });

      gif.render();
    } catch (error) {
      console.error("Failed to generate timelapse:", error);
      alert("Failed to generate timelapse. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-indigo-500/30 flex flex-col ${theme === 'dark' ? 'dark bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-indigo-500 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">OpenPixel</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {startTime && (
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-mono text-sm bg-white/50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                <Clock className="w-4 h-4" />
                {formatTime(elapsedTime)}
              </div>
            )}
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                const newMuted = audio.toggleMute();
                setIsMuted(newMuted);
              }}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              title={isMuted ? "Unmute Sounds" : "Mute Sounds"}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowGallery(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800 rounded-md transition-colors"
              title="Open Gallery"
            >
              <Library className="w-4 h-4" />
              <span className="hidden sm:inline">Gallery</span>
            </button>
            {openPixelData && (
              <div className="relative">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800 rounded-md transition-colors"
                  title="Export Options"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xl z-50 overflow-hidden">
                    <button onClick={() => { exportOpenPixel(); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white" title="Export as OpenPixel JSON format">OpenPixel JSON</button>
                    <button onClick={() => { exportImage('png'); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white" title="Export as PNG image">Image (PNG)</button>
                    <button onClick={() => { exportImage('jpeg'); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white" title="Export as JPEG image">Image (JPEG)</button>
                    <button onClick={() => { exportImage('webp'); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white" title="Export as WebP image">Image (WebP)</button>
                    <button onClick={() => { exportTimelapse(); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white" title="Export timelapse as GIF">Timelapse (GIF)</button>
                  </div>
                )}
              </div>
            )}
            
            <label 
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md cursor-pointer transition-colors shadow-sm"
              title="Upload a new image to start a project"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Image</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </label>
            <label
              className="flex items-center gap-2 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 text-sm font-medium rounded-md cursor-pointer transition-colors"
              title="Import a previously exported OpenPixel JSON file"
            >
              <FileUp className="w-4 h-4" />
              <span className="hidden md:inline">Import JSON</span>
              <input
                type="file"
                accept=".json,.openpixel.json,application/json"
                className="hidden"
                onChange={handleOpenPixelImport}
              />
            </label>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Sidebar Settings */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 bg-white/30 dark:bg-zinc-900/30 p-4 flex flex-col gap-6 overflow-y-auto shrink-0">
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Engine Settings
            </h2>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Grid Size</label>
                  <span className="text-xs text-zinc-500 font-mono">{gridSize}x{gridSize}</span>
                </div>
                <input 
                  type="range" 
                  min="16" max="64" step="8"
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                  title="Adjust the resolution of the pixel grid"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Color Palette</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setColorCount('auto')}
                      className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold transition-colors ${colorCount === 'auto' ? 'bg-indigo-500 text-white' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'}`}
                      title="Automatically determine the best number of colors"
                    >
                      Auto
                    </button>
                    <span className="text-xs text-zinc-500 font-mono w-16 text-right">
                      {colorCount === 'auto' ? 'Auto' : `${colorCount} colors`}
                    </span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="8" max="32" step="4"
                  value={colorCount === 'auto' ? 16 : colorCount}
                  onChange={(e) => setColorCount(Number(e.target.value))}
                  className={`w-full accent-indigo-500 transition-opacity ${colorCount === 'auto' ? 'opacity-50' : ''}`}
                  title="Adjust the number of colors in the generated palette"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/50">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Palette</label>
                  <select
                    value={selectedPalette}
                    onChange={(e) => setSelectedPalette(e.target.value as PaletteName)}
                    className="text-sm bg-zinc-100 dark:bg-zinc-800 border-none rounded-md px-2 py-1 text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="auto">Auto (K-Means)</option>
                    <option value="gameboy">Gameboy</option>
                    <option value="nes">NES</option>
                    <option value="c64">Commodore 64</option>
                    <option value="pico8">PICO-8</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/50">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Show Grid Lines</label>
                  <button
                    onClick={() => setShowGridLines(!showGridLines)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showGridLines ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    title="Toggle the visibility of grid lines on the canvas"
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showGridLines ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/50">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Dithering</label>
                  <button
                    onClick={() => setUseDithering(!useDithering)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useDithering ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    title="Apply Floyd-Steinberg dithering for smoother gradients"
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${useDithering ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/50">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Smoothing</label>
                  <button
                    onClick={() => setUseSmoothing(!useSmoothing)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useSmoothing ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    title="Apply a median filter to remove stray pixels"
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${useSmoothing ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {openPixelData && (
            <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              {/* Minimap */}
              <div className="w-full aspect-square bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden relative">
                <div 
                  className="absolute inset-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${openPixelData.width}, 1fr)`,
                    gridTemplateRows: `repeat(${openPixelData.height}, 1fr)`,
                  }}
                >
                  {openPixelData.pixels.map((colorIdx, i) => {
                    const isFilled = filledPixels.has(i);
                    const rgb = openPixelData.palette[colorIdx];
                    const hexColor = rgbToHex(rgb);
                    return (
                      <div 
                        key={`mini-${i}`} 
                        style={{ backgroundColor: isFilled ? hexColor : (theme === 'dark' ? '#18181b' : '#ffffff') }}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Progress</span>
                  <span className="font-mono text-indigo-500 dark:text-indigo-400">
                    {completionPercent}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPercent}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="px-2.5 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300">
                    Remaining
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">{remainingPixels}</div>
                  </div>
                  <div className="px-2.5 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300">
                    Colors done
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">{completedColorCount}/{openPixelData.palette.length}</div>
                  </div>
                </div>
                <div className="mt-3 px-2.5 py-2 rounded-md bg-indigo-50/70 dark:bg-indigo-500/10 text-zinc-600 dark:text-zinc-300 border border-indigo-100 dark:border-indigo-500/20">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-indigo-600 dark:text-indigo-300">
                    <Gauge className="w-3.5 h-3.5" />
                    Session Pace
                  </div>
                  <div className="mt-1.5 text-xs flex justify-between">
                    <span>Speed</span>
                    <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{pixelsPerMinute > 0 ? `${pixelsPerMinute.toFixed(1)} px/min` : '—'}</span>
                  </div>
                  <div className="mt-1 text-xs flex justify-between">
                    <span>ETA</span>
                    <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      {estimatedMinutesLeft !== null ? `${Math.max(1, Math.round(estimatedMinutesLeft))} min` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Game Area */}
        <section className="flex-1 relative bg-zinc-100 dark:bg-zinc-950 overflow-hidden flex flex-col">
          {/* Toolbar */}
          {openPixelData && (
            <div className="h-14 border-b border-zinc-200 dark:border-zinc-800/50 flex items-center justify-end px-4 gap-3 bg-white/30 dark:bg-zinc-900/30 shrink-0">
              {/* Tools */}
              <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm overflow-hidden">
                <button 
                  onClick={() => setActiveTool('draw')}
                  className={`p-2 transition-colors ${activeTool === 'draw' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}`}
                  title="Draw Tool (Click to fill pixels)"
                >
                  <Pen className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setActiveTool('wand')}
                  className={`p-2 transition-colors ${activeTool === 'wand' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}`}
                  title="Magic Wand (Fill contiguous area of same color)"
                >
                  <Wand2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setActiveTool('eraser')}
                  className={`p-2 transition-colors ${activeTool === 'eraser' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}`}
                  title="Eraser (Remove filled pixel)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setActiveTool('pan')}
                  className={`p-2 transition-colors ${activeTool === 'pan' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}`}
                  title="Pan Tool (Drag to move around)"
                >
                  <Hand className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setActiveTool('picker')}
                  className={`p-2 transition-colors ${activeTool === 'picker' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}`}
                  title="Color Picker (Select a color from the grid)"
                >
                  <Pipette className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleFillColor}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
                  title="Fill Color (Auto-fill all pixels of the selected color)"
                >
                  <PaintBucket className="w-4 h-4" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm overflow-hidden">
                <button 
                  onClick={handleHint}
                  className="p-2 text-zinc-500 hover:text-amber-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-amber-400 dark:hover:bg-zinc-800 transition-colors"
                  title="Hint (Fills one random pixel of the selected color)"
                >
                  <Lightbulb className="w-4 h-4" />
                </button>
                <div className="w-px bg-zinc-200 dark:bg-zinc-800" />
                <button 
                  onClick={handleFillAll}
                  className="p-2 text-zinc-500 hover:text-indigo-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-indigo-400 dark:hover:bg-zinc-800 transition-colors"
                  title="Fill Entire Image (Completes the puzzle)"
                >
                  <Check className="w-4 h-4" />
                </button>
                <div className="w-px bg-zinc-200 dark:bg-zinc-800" />
                <button 
                  onClick={handleClearAll}
                  className="p-2 text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-zinc-800 transition-colors"
                  title="Clear All (Resets the board)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="w-px bg-zinc-200 dark:bg-zinc-800" />
                <button 
                  onClick={handleFindPixel}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
                  title="Find Pixel (Locate next pixel of selected color)"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  onClick={selectNextIncompleteColor}
                  className="p-2 text-zinc-500 hover:text-indigo-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-indigo-400 dark:hover:bg-zinc-800 transition-colors"
                  title="Next Incomplete Color (N)"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setFocusSelectedColor(prev => !prev)}
                  className={`p-2 transition-colors ${focusSelectedColor ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}`}
                  title={focusSelectedColor ? 'Focus Mode On (emphasize selected color)' : 'Focus Mode Off'}
                >
                  <Focus className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setZoom(1);
                    if (containerRef.current) {
                      containerRef.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
                    }
                  }}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
                  title="Reset Zoom & Pan"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              </div>

              {/* Undo/Redo */}
              <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm overflow-hidden">
                <button 
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo className="w-4 h-4" />
                </button>
                <div className="w-px bg-zinc-200 dark:bg-zinc-800" />
                <button 
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo className="w-4 h-4" />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm overflow-hidden">
                <button 
                  onClick={() => setZoom(z => Math.max(0.1, z - 0.25))}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <div className="px-2 py-2 text-xs font-mono text-zinc-500 border-x border-zinc-200 dark:border-zinc-800 flex items-center justify-center min-w-[3rem]">
                  {Math.round(zoom * 100)}%
                </div>
                <button 
                  onClick={() => setZoom(z => Math.min(5, z + 0.25))}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Grid Container */}
          <div 
            ref={containerRef}
            className={`flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 ${activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing touch-none' : 'touch-none'}`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-4 text-zinc-500">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium animate-pulse">Quantizing colors...</p>
              </div>
            ) : !openPixelData ? (
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-sm">
                  <ImageIcon className="w-8 h-8 text-zinc-400 dark:text-zinc-600" />
                </div>
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-300 mb-2">No Image Loaded</h3>
                <p className="text-sm text-zinc-500">Upload an image to generate a color-by-number pixel grid.</p>
              </div>
            ) : (
              <motion.div 
                className="relative select-none"
                style={{ 
                  display: 'grid',
                  gridTemplateColumns: `repeat(${openPixelData.width}, 1fr)`,
                  gridTemplateRows: `repeat(${openPixelData.height}, 1fr)`,
                  gap: showGridLines ? '1px' : '0px',
                  backgroundColor: showGridLines ? (theme === 'dark' ? '#27272a' : '#e4e4e7') : 'transparent',
                  border: showGridLines ? `1px solid ${theme === 'dark' ? '#27272a' : '#e4e4e7'}` : 'none'
                }}
                animate={{ 
                  width: openPixelData.width * 24 * zoom, 
                  height: openPixelData.height * 24 * zoom,
                }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                layout
              >
                {openPixelData.pixels.map((colorIdx, i) => {
                  const isFilled = filledPixels.has(i);
                  const isTargetColor = selectedColorIdx === colorIdx;
                  const rgb = openPixelData.palette[colorIdx];
                  const hexColor = rgbToHex(rgb);
                  
                  return (
                    <div
                      key={i}
                      onPointerDown={(e) => {
                        if (activeTool === 'pan') return;
                        e.preventDefault();
                        handlePointerDown(i);
                      }}
                      onPointerEnter={() => {
                        if (activeTool === 'pan') return;
                        handlePointerEnter(i);
                      }}
                      className={`relative flex items-center justify-center transition-all duration-300 ${activeTool === 'picker' ? 'cursor-pointer' : activeTool === 'pan' ? 'pointer-events-none' : 'cursor-crosshair'} ${!isFilled && isTargetColor ? 'animate-pulse ring-1 ring-inset ring-indigo-500/50' : ''} ${hintPixel === i ? 'ring-4 ring-rose-500 z-10 animate-bounce' : ''}`}
                      style={{
                        backgroundColor: isFilled ? hexColor : (theme === 'dark' ? '#18181b' : '#ffffff'),
                        transform: isFilled ? 'scale(1)' : 'scale(0.95)',
                        opacity: focusSelectedColor && !isTargetColor ? (isFilled ? 0.3 : 0.15) : (isFilled ? 1 : 0.9),
                      }}
                    >
                      {!isFilled && zoom >= 0.8 && (
                        <span 
                          className={`text-[10px] sm:text-xs font-mono font-bold select-none pointer-events-none ${
                            isTargetColor ? (theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600') : (theme === 'dark' ? 'text-zinc-700' : 'text-zinc-300')
                          }`}
                          style={{
                            transform: `scale(${Math.min(1, zoom)})`,
                            transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                          }}
                        >
                          {colorIdx + 1}
                        </span>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>

          {/* Palette Dock */}
          {openPixelData && (
            <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-4 shrink-0 overflow-x-auto">
              <div className="max-w-4xl mx-auto min-w-max">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Palette</h3>
                  <button
                    onClick={() => setHideCompletedColors(!hideCompletedColors)}
                    className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                    title={hideCompletedColors ? "Show all colors" : "Hide completed colors"}
                  >
                    {hideCompletedColors ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {hideCompletedColors ? "Show All" : "Hide Completed"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {openPixelData.palette.map((rgb, idx) => {
                    const hexColor = rgbToHex(rgb);
                    const contrastColor = getContrastColor(rgb);
                    const progress = colorProgress[idx];
                    const isSelected = selectedColorIdx === idx;
                    
                    if (progress.total === 0) return null;
                    if (hideCompletedColors && progress.isComplete && !isSelected) return null;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedColorIdx(idx);
                          if (activeTool === 'picker') setActiveTool('draw');
                        }}
                        className={`
                          relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-mono text-sm font-bold
                          transition-all duration-200 overflow-hidden group shrink-0
                          ${isSelected ? 'ring-2 ring-indigo-500 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 scale-110 z-10' : 'hover:scale-105 opacity-90 hover:opacity-100'}
                          ${progress.isComplete ? 'opacity-50 grayscale' : ''}
                        `}
                        style={{ 
                          backgroundColor: hexColor,
                          color: contrastColor
                        }}
                        title={`Select color ${idx + 1}`}
                      >
                        {/* Progress Background */}
                        {!progress.isComplete && (
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-black/20 transition-all duration-300"
                            style={{ height: `${(progress.filled / progress.total) * 100}%` }}
                          />
                        )}
                        
                        <span className="relative z-10">
                          {progress.isComplete ? <Check className="w-5 h-5" /> : idx + 1}
                        </span>

                        {!progress.isComplete && (
                          <span className="absolute top-0 right-0 bg-black/40 text-white text-[9px] px-1 rounded-bl-md font-sans leading-tight">
                            {progress.total - progress.filled}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Level Complete Overlay */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Keyboard Shortcuts</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Speed up your workflow while painting.</p>
                </div>
                <button
                  onClick={() => setShowShortcuts(false)}
                  className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-2 overflow-y-auto max-h-[65vh]">
                {keyboardShortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between gap-4 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/50"
                  >
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{shortcut.action}</span>
                    <kbd className="text-xs font-mono font-semibold px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLevelComplete && !hasDismissedCompletion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-2xl text-center max-w-md w-full mx-4"
            >
              <div className="w-20 h-20 mx-auto bg-emerald-500/20 text-emerald-600 dark:text-emerald-500 rounded-full flex items-center justify-center mb-6">
                <Check className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Masterpiece!</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8">You've successfully colored all the pixels.</p>
              
              <div className="flex flex-col gap-3">
                <div className="flex gap-3 justify-center">
                  <button 
                    onClick={() => exportImage('png')}
                    className="flex-1 px-4 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    title="Export completed design as PNG"
                  >
                    <Download className="w-5 h-5" />
                    Export
                  </button>
                  <button 
                    onClick={handleShare}
                    className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    title="Share your masterpiece"
                  >
                    <Share2 className="w-5 h-5" />
                    Share
                  </button>
                </div>
                <button 
                  onClick={() => {
                    handleClearAll();
                    setShowGallery(true);
                  }}
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  title="Choose a new puzzle from the gallery"
                >
                  <Library className="w-5 h-5" />
                  Gallery
                </button>
                <button 
                  onClick={() => setHasDismissedCompletion(true)}
                  className="w-full px-4 py-3 bg-transparent hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  title="View the completed puzzle"
                >
                  <ImageIcon className="w-5 h-5" />
                  View Result
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery Modal */}
      <AnimatePresence>
        {showGallery && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Puzzle Gallery</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Choose a template or daily challenge to start coloring.</p>
                </div>
                <button 
                  onClick={() => setShowGallery(false)}
                  className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {GALLERY_ITEMS.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => loadGalleryItem(item)}
                      className="group cursor-pointer bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:shadow-md"
                    >
                      <div className="aspect-square overflow-hidden relative bg-zinc-200 dark:bg-zinc-800">
                        <img 
                          src={item.url} 
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          crossOrigin="anonymous"
                        />
                        <div className="absolute top-3 right-3">
                          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full text-white shadow-sm backdrop-blur-md ${
                            item.difficulty === 'easy' ? 'bg-emerald-500/80' : 
                            item.difficulty === 'medium' ? 'bg-amber-500/80' : 
                            'bg-rose-500/80'
                          }`}>
                            {item.difficulty}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-zinc-900 dark:text-white truncate">{item.title}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">by {item.author}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
