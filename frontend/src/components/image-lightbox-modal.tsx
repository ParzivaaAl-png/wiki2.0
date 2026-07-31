import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight 
} from 'lucide-react';

export interface LightboxImage {
  src: string;
  alt?: string;
  title?: string;
}

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: LightboxImage[];
  initialIndex?: number;
}

export function ImageLightboxModal({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
}: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [naturalSize, setNaturalSize] = React.useState<{ width: number; height: number } | null>(null);
  const [initialFitPercent, setInitialFitPercent] = React.useState<number>(100);
  const [zoomPercent, setZoomPercent] = React.useState<number>(100);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // Sync initial index when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)));
      setNaturalSize(null);
      setPosition({ x: 0, y: 0 });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialIndex, images.length]);

  // Reset zoom & pan when image changes
  React.useEffect(() => {
    setNaturalSize(null);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const currentImage = images[currentIndex];

  // Calculate actual display dimensions
  const scale = zoomPercent / 100;
  const displayWidth = naturalSize ? Math.round(naturalSize.width * scale) : undefined;
  const displayHeight = naturalSize ? Math.round(naturalSize.height * scale) : undefined;

  // Zoom handlers (25% to 400% with 25% steps)
  const handleZoomIn = React.useCallback(() => {
    setZoomPercent((prev) => Math.min(prev + 25, 400));
  }, []);

  const handleZoomOut = React.useCallback(() => {
    setZoomPercent((prev) => {
      const next = Math.max(prev - 25, 25);
      if (next <= initialFitPercent) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  }, [initialFitPercent]);

  const handleResetZoom = React.useCallback(() => {
    setZoomPercent(initialFitPercent);
    setPosition({ x: 0, y: 0 });
  }, [initialFitPercent]);

  // Navigation handlers
  const handlePrev = React.useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = React.useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Keyboard navigation & hotkeys
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleResetZoom]);

  // Mouse wheel zoom (Require Ctrl or Cmd key)
  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Dragging / Pan when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomPercent <= initialFitPercent) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomPercent <= initialFitPercent) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen || !currentImage) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md select-none overflow-hidden"
        onClick={onClose}
      >
        {/* Top Action Bar */}
        <div 
          className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-50 bg-gradient-to-b from-black/80 to-transparent"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image Counter */}
          <div className="text-white/90 text-sm font-semibold tracking-wide flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
            <span>{currentIndex + 1} из {images.length}</span>
          </div>

          {/* Action Tools: [-] 100% [+] and Close */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Zoom Out (-) */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomPercent <= 25}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Уменьшить (-)"
            >
              <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Reset / Current Percent Badge */}
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-3 py-1.5 text-xs font-extrabold text-white bg-white/15 hover:bg-white/25 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-white/10"
              title="Сбросить масштаб (По размеру экрана)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span>{zoomPercent}%</span>
            </button>

            {/* Zoom In (+) */}
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomPercent >= 400}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Увеличить (+)"
            >
              <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/90 hover:text-white bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-xl transition-all cursor-pointer ml-2"
              title="Закрыть (Esc)"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Gallery Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/25 backdrop-blur-md rounded-full transition-all cursor-pointer z-50 border border-white/10 shadow-2xl hover:scale-110"
              title="Предыдущее изображение (←)"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/25 backdrop-blur-md rounded-full transition-all cursor-pointer z-50 border border-white/10 shadow-2xl hover:scale-110"
              title="Следующее изображение (→)"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          </>
        )}

        {/* Scrollable Viewport Area */}
        <div
          className="absolute inset-0 top-16 bottom-12 overflow-auto flex items-center justify-center p-4 sm:p-8"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-w-full min-h-full items-center justify-center">
            <div
              className="relative shrink-0 transition-all duration-100 ease-out"
              style={{
                width: displayWidth ? `${displayWidth}px` : 'auto',
                height: displayHeight ? `${displayHeight}px` : 'auto',
                transform: `translate(${position.x}px, ${position.y}px)`,
                cursor: zoomPercent > initialFitPercent ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
            >
              <img
                src={currentImage.src}
                alt={currentImage.alt || 'Изображение статьи'}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const nw = img.naturalWidth || 800;
                  const nh = img.naturalHeight || 600;
                  setNaturalSize({ width: nw, height: nh });

                  const availableW = window.innerWidth * 0.85;
                  const availableH = window.innerHeight * 0.75;
                  const ratio = Math.min(availableW / nw, availableH / nh, 1);
                  const fit = Math.max(15, Math.round(ratio * 100));
                  setInitialFitPercent(fit);
                  setZoomPercent(fit);
                }}
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  objectFit: 'initial',
                }}
                className="rounded-xl shadow-2xl select-none block"
              />
            </div>
          </div>
        </div>

        {/* Caption Bar */}
        {(currentImage.title || currentImage.alt) && (
          <div 
            className="absolute bottom-0 left-0 right-0 p-4 text-center z-50 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none"
          >
            <p className="text-sm font-medium text-white/90 max-w-2xl mx-auto px-4 py-1.5 rounded-xl bg-black/40 backdrop-blur-md inline-block">
              {currentImage.title || currentImage.alt}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
