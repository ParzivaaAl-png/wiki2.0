import * as React from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Calendar, User, Pin, FileText, Download, 
  ChevronLeft, ChevronRight, Maximize2, ExternalLink 
} from 'lucide-react';
import { News, NewsAttachment } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

interface NewsCardProps {
  news: News;
  onClose: () => void;
}

export function NewsCard({ news, onClose }: NewsCardProps) {
  const [currentPhotoIdx, setCurrentPhotoIdx] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

  const hasImages = news.images && news.images.length > 0;
  const imageCount = news.images?.length || 0;

  // Touch Swipe Handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentPhotoIdx < imageCount - 1) {
      setCurrentPhotoIdx(prev => prev + 1);
    } else if (isRightSwipe && currentPhotoIdx > 0) {
      setCurrentPhotoIdx(prev => prev - 1);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Keyboard navigation for desktop
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentPhotoIdx < imageCount - 1) {
        setCurrentPhotoIdx(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentPhotoIdx > 0) {
        setCurrentPhotoIdx(prev => prev - 1);
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPhotoIdx, imageCount, isFullscreen, onClose]);

  // Format file size helper
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date helper
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Attachment icon resolver
  const getAttachmentIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return <span className="p-2 bg-rose-500/10 text-rose-500 rounded-lg"><FileText className="w-5 h-5" /></span>;
      case 'docx':
      case 'doc':
        return <span className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><FileText className="w-5 h-5" /></span>;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><FileText className="w-5 h-5" /></span>;
      case 'zip':
      case 'rar':
      case '7z':
        return <span className="p-2 bg-amber-500/10 text-amber-500 rounded-lg"><FileText className="w-5 h-5" /></span>;
      default:
        return <span className="p-2 bg-neutral-500/10 text-neutral-500 rounded-lg"><FileText className="w-5 h-5" /></span>;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-neutral-950/60 backdrop-blur-sm overflow-hidden select-text">
      {/* Detail Window Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 15 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-3xl bg-white dark:bg-neutral-950 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-neutral-200/50 dark:border-neutral-900"
      >
        
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-neutral-200/50 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-900/30 px-5 py-3 sm:py-4 shrink-0">
          <div className="flex items-center gap-2">
            {news.is_pinned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Pin className="w-3 h-3 fill-current" />
                Закреплено
              </span>
            )}
            <span className="text-xs text-neutral-400 font-medium">Центр новостей</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable details content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
          
          {/* Metadata Block */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white leading-tight font-outfit">
              {news.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 font-medium pb-2 border-b border-neutral-100 dark:border-neutral-900/60">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(news.published_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {news.author_name || 'Администрация'}
              </span>
            </div>
          </div>

          {/* PREMIUM INSTAGRAM / TELEGRAM IMAGE GALLERY */}
          {hasImages && (
            <div className="space-y-2">
              <div 
                className="relative aspect-video sm:rounded-xl overflow-hidden bg-neutral-950 flex items-center justify-center group"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Photo Counter */}
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-medium px-2 py-1 rounded-full z-10 select-none">
                  Фото {currentPhotoIdx + 1} из {imageCount}
                </div>

                {/* Main Image View */}
                <img
                  src={news.images[currentPhotoIdx]}
                  alt={`Фото ${currentPhotoIdx + 1}`}
                  className="max-h-full max-w-full object-contain cursor-zoom-in"
                  onClick={() => setIsFullscreen(true)}
                />

                {/* Left Button */}
                {currentPhotoIdx > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCurrentPhotoIdx(prev => prev - 1); }}
                    className="absolute left-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all backdrop-blur-sm opacity-100 group-hover:scale-105 hidden sm:inline-flex"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {/* Right Button */}
                {currentPhotoIdx < imageCount - 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCurrentPhotoIdx(prev => prev + 1); }}
                    className="absolute right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all backdrop-blur-sm opacity-100 group-hover:scale-105 hidden sm:inline-flex"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}

                {/* Maximize Button */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
                  className="absolute bottom-3 right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                  title="На весь экран"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Description summary (italic, styled) */}
          {news.description && (
            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900/40 rounded-xl border border-neutral-200/40 dark:border-neutral-900 italic text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed font-light">
              {news.description}
            </div>
          )}

          {/* NOTION-STYLE ARTICLE BODY */}
          <div 
            className="prose-custom prose dark:prose-invert max-w-none text-neutral-800 dark:text-neutral-200"
            dangerouslySetInnerHTML={{ __html: news.content }}
          />

          {/* FILE ATTACHMENTS SECTION */}
          {news.attachments && news.attachments.length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">Вложения</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {news.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 border border-neutral-200/50 dark:border-neutral-900 rounded-xl bg-white dark:bg-neutral-900/20 hover:border-neutral-350 dark:hover:border-neutral-800 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {getAttachmentIcon(att.file_name)}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate" title={att.file_name}>
                          {att.file_name}
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          {formatSize(att.file_size)} • {formatDate(att.created_at).split(' в ')[0]}
                        </p>
                      </div>
                    </div>

                    <a
                      href={att.file_url}
                      download={att.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-neutral-450 hover:text-indigo-600 dark:text-neutral-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 rounded-lg transition-colors ml-2 shrink-0"
                      title="Скачать файл"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAGS FOOTER */}
          {news.tags && news.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-4">
              {news.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 rounded text-[10px] font-bold uppercase tracking-wider"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

        </div>
      </motion.div>

      {/* FULLSCREEN GALLERY OVERLAY */}
      <AnimatePresence>
        {isFullscreen && hasImages && (
          <div 
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Close fullscreen */}
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md z-55"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Left navigation fullscreen */}
            {currentPhotoIdx > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCurrentPhotoIdx(prev => prev - 1); }}
                className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md z-50 hidden sm:inline-flex"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            {/* Right navigation fullscreen */}
            {currentPhotoIdx < imageCount - 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCurrentPhotoIdx(prev => prev + 1); }}
                className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md z-50 hidden sm:inline-flex"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}

            {/* Image Viewer */}
            <motion.img
              key={`fs-img-${currentPhotoIdx}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              src={news.images[currentPhotoIdx]}
              alt={`Фото ${currentPhotoIdx + 1}`}
              className="max-h-screen max-w-screen object-contain select-none"
            />

            {/* Indicator bottom */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full select-none font-bold">
              Фото {currentPhotoIdx + 1} из {imageCount}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
