import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, 
  ExternalLink, Link as LinkIcon, Check 
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
  const [scale, setScale] = React.useState(1.0);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [copiedLink, setCopiedLink] = React.useState(false);

  // Sync initial index when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)));
      setScale(1.0);
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
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const currentImage = images[currentIndex];

  // Zoom handlers (clamped between 0.5 and 4.0)
  const handleZoomIn = React.useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 4.0));
  }, []);

  const handleZoomOut = React.useCallback(() => {
    setScale((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetZoom = React.useCallback(() => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Navigation handlers
  const handlePrev = React.useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = React.useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Copy link
  const handleCopyLink = React.useCallback(async () => {
    if (!currentImage?.src) return;
    try {
      const fullUrl = new URL(currentImage.src, window.location.href).href;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  }, [currentImage?.src]);

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

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Dragging / Pan when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none"
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

          {/* Action Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Zoom Out */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-xl transition-all cursor-pointer"
              title="Уменьшить (-)"
            >
              <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Reset Zoom Badge */}
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2.5 py-1.5 text-xs font-bold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all cursor-pointer flex items-center gap-1"
              title="Сбросить масштаб (0)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{Math.round(scale * 100)}%</span>
            </button>

            {/* Zoom In */}
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 4.0}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-xl transition-all cursor-pointer"
              title="Увеличить (+)"
            >
              <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="w-px h-5 bg-white/20 mx-1" />

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all cursor-pointer flex items-center gap-1"
              title="Скопировать ссылку на изображение"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              ) : (
                <LinkIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>

            {/* Open in New Tab */}
            <a
              href={currentImage.src}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all cursor-pointer"
              title="Открыть оригинал в новой вкладке"
            >
              <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
            </a>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-xl transition-all cursor-pointer ml-1"
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

        {/* Main Image Stage */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center p-4 sm:p-12 overflow-hidden"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.img
            key={currentImage.src}
            src={currentImage.src}
            alt={currentImage.alt || 'Изображение статьи'}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
            }}
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl shadow-2xl transition-transform duration-75 select-none pointer-events-auto"
            draggable={false}
          />
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
