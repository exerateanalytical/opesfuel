import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface FormModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const FormModal: React.FC<FormModalProps> = ({
  open,
  title,
  subtitle,
  onClose,
  size = 'md',
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass =
    size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${widthClass} bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        <div className="px-5 py-4 bg-[#0F172A] text-white flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-white leading-snug">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto bg-white">{children}</div>
      </div>
    </div>
  );
};
