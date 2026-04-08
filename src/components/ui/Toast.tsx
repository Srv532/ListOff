import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface ToastProps {
  message: string | null;
  type: 'error' | 'info';
  onClose: () => void;
}

export const Toast = ({ message, type, onClose }: ToastProps) => (
  <AnimatePresence>
    {message && (
      <motion.div
        initial={{ opacity: 0, y: 30 }} 
        animate={{ opacity: 1, y: 0 }} 
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "fixed bottom-8 right-8 p-5 border-4 border-black font-bold uppercase tracking-wider z-[100] shadow-[8px_8px_0_0_rgba(0,0,0,1)] max-w-sm text-sm",
          type === 'error' ? "bg-red-500 text-white" : "bg-[#00FF00] text-black"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="leading-snug">{message}</span>
          <button onClick={onClose} className="hover:opacity-50 transition-opacity mt-0.5 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
