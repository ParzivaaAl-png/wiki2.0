import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BookIconProps {
  isOpen: boolean;
  onClick?: () => void;
}

export function BookIcon({ isOpen, onClick }: BookIconProps) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 flex items-center justify-center relative cursor-pointer focus:outline-none select-none group"
      aria-label="Toggle navigation book"
    >
      {/* 3D Perspective Container */}
      <div 
        className="w-8 h-8 relative [perspective:800px] [transform-style:preserve-3d]"
      >
        {/* Soft shadow below the book cover */}
        <motion.div 
          className="absolute inset-0 bg-black/10 dark:bg-black/35 rounded-sm blur-[3px]"
          animate={{
            scale: isOpen ? [1, 1.1, 1] : 1,
            x: isOpen ? -2 : 0,
            y: isOpen ? 2 : 1,
            opacity: isOpen ? 0.3 : 0.2
          }}
          transition={{ duration: 0.5 }}
        />

        {/* 1. RIGHT WING (Back Cover & Right Pages - stays on the right side) */}
        <div 
          className="absolute left-[16px] top-0 w-[16px] h-[32px] origin-left [transform-style:preserve-3d]"
          style={{ transform: 'rotateY(0deg)' }}
        >
          {/* Back Cover (outer skin, visible when book is closed or looking from behind) */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-indigo-800 dark:from-indigo-800 dark:to-indigo-900 rounded-r border-t border-b border-r border-indigo-900 dark:border-indigo-950 [backface-visibility:hidden]" />
          
          {/* Right Page Body (visible when open) */}
          <div className="absolute inset-[1px] bg-gradient-to-r from-amber-50 to-amber-100/90 dark:from-neutral-800 dark:to-neutral-900 rounded-r border-t border-b border-r border-amber-250/20 dark:border-neutral-700 flex flex-col justify-around py-1 px-1 pl-1.5 shadow-inner">
            {/* Page text lines representation */}
            <div className="h-[2px] w-[90%] bg-neutral-350 dark:bg-neutral-700 rounded-full" />
            <div className="h-[2px] w-[70%] bg-neutral-350 dark:bg-neutral-700 rounded-full" />
            <div className="h-[2px] w-[80%] bg-neutral-350 dark:bg-neutral-700 rounded-full" />
            <div className="h-[2px] w-[60%] bg-neutral-350 dark:bg-neutral-700 rounded-full" />
          </div>
        </div>

        {/* 2. LEFT WING (Front Cover & Left Pages - rotates from right (180deg) to left (0deg)) */}
        <motion.div 
          className="absolute left-[16px] top-0 w-[16px] h-[32px] origin-left [transform-style:preserve-3d] z-20"
          animate={{
            rotateY: isOpen ? 0 : -180
          }}
          whileHover={!isOpen ? { rotateY: -165 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
        >
          {/* Front Cover Front-Side (visible when book is CLOSED - is on back of the left wing after opening) */}
          <div 
            className="absolute inset-0 bg-gradient-to-l from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 rounded-r border-t border-b border-r border-indigo-900 dark:border-indigo-950 shadow-md flex flex-col justify-between p-0.5 select-none"
            style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
          >
            {/* Gold foil lines on closed book cover */}
            <div className="h-[1.5px] w-full bg-amber-400/40 rounded-full" />
            <div className="flex justify-center items-center flex-1">
              <span className="text-[8px] text-amber-400 dark:text-amber-300 font-serif font-bold tracking-widest">W</span>
            </div>
            <div className="h-[1.5px] w-full bg-amber-400/40 rounded-full" />
            
            {/* Closed page edges on the side */}
            <div className="absolute right-[-2px] top-[1px] bottom-[1px] w-[2px] bg-amber-50 dark:bg-amber-100 rounded-r shadow-[1px_0_2px_rgba(0,0,0,0.1)]" />
          </div>

          {/* Left Page Body (visible when OPEN - face of the left wing) */}
          <div 
            className="absolute inset-[1px] bg-gradient-to-l from-amber-50 to-amber-100/90 dark:from-neutral-800 dark:to-neutral-900 rounded-l border-t border-b border-l border-amber-250/20 dark:border-neutral-700 flex flex-col justify-around py-1 px-1 pr-1.5 shadow-inner"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {/* Page text lines representation */}
            <div className="h-[2px] w-[80%] bg-neutral-350 dark:bg-neutral-700 rounded-full ml-auto" />
            <div className="h-[2px] w-[95%] bg-neutral-350 dark:bg-neutral-700 rounded-full ml-auto" />
            <div className="h-[2px] w-[70%] bg-neutral-350 dark:bg-neutral-700 rounded-full ml-auto" />
            <div className="h-[2px] w-[85%] bg-neutral-350 dark:bg-neutral-700 rounded-full ml-auto" />
          </div>
        </motion.div>

        {/* 3. MIDDLE FLIPPING PAGE (visible briefly during open/close transitions) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ rotateY: 0 }}
              animate={{ rotateY: -180 }}
              exit={{ rotateY: 0 }}
              transition={{ duration: 0.45, ease: 'easeInOut', delay: 0.05 }}
              className="absolute left-[16px] top-0 w-[15.5px] h-[31px] origin-left bg-gradient-to-r from-amber-50/95 to-amber-100/95 dark:from-neutral-800 dark:to-neutral-850 rounded-r border-t border-b border-r border-amber-200/50 dark:border-neutral-700 shadow-md z-10 pointer-events-none"
              style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
            >
              {/* Backside of flipping page */}
              <div 
                className="absolute inset-0 bg-gradient-to-l from-amber-50/95 to-amber-100/95 dark:from-neutral-800 dark:to-neutral-850 rounded-l border-t border-b border-l border-amber-200/50 dark:border-neutral-700"
                style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. SPINE (vertical center line when open) */}
        <motion.div 
          className="absolute left-[15.5px] top-[1px] w-[1px] h-[30px] bg-indigo-900/40 dark:bg-black/50 z-30"
          animate={{
            opacity: isOpen ? 1 : 0
          }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </button>
  );
}
