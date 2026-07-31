import * as React from 'react';
import { createPortal } from 'react-dom';

export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}

interface ModalWrapperProps {
  children: React.ReactNode;
  onClose: () => void;
  hasUnsavedChanges?: boolean;
  className?: string;
  backdropBlur?: boolean;
}

export function ModalWrapper({
  children,
  onClose,
  hasUnsavedChanges = false,
  className = '',
  backdropBlur = true,
}: ModalWrapperProps) {
  const backdropRef = React.useRef<HTMLDivElement>(null);
  const mouseDownTargetRef = React.useRef<EventTarget | null>(null);

  // Safe Close Handler with Unsaved Changes Prompt
  const handleSafeClose = React.useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmClose = window.confirm('Есть несохранённые изменения. Закрыть окно без сохранения?');
      if (!confirmClose) return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  // Esc Key Listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleSafeClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleSafeClose]);

  // Track MouseDown target to prevent accidental closing on text drag/selection
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownTargetRef.current = e.target;
  };

  // Handle Backdrop Click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target === backdropRef.current &&
      mouseDownTargetRef.current === backdropRef.current
    ) {
      handleSafeClose();
    }
  };

  return (
    <ModalPortal>
      <div
        ref={backdropRef}
        onMouseDown={handleMouseDown}
        onClick={handleBackdropClick}
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 ${
          backdropBlur ? 'backdrop-blur-sm' : ''
        } animate-fadeIn ${className}`}
      >
        {children}
      </div>
    </ModalPortal>
  );
}

