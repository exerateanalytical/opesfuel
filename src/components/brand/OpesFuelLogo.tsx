import React from 'react';

interface OpesFuelLogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showSubline?: boolean;
  className?: string;
}

export const OpesFuelLogo: React.FC<OpesFuelLogoProps> = ({
  variant = 'dark',
  size = 'md',
  showSubline = false,
  className = '',
}) => {
  const iconBoxSize =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const titleSize =
    size === 'sm'
      ? 'text-[16px]'
      : size === 'lg'
        ? 'text-[22px]'
        : 'text-[18px]';
  const sublineSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  const textPrimary = variant === 'light' ? 'text-white' : 'text-slate-950';
  const textSubtle = variant === 'light' ? 'text-slate-300' : 'text-slate-500';
  const emblemBg =
    variant === 'light'
      ? 'bg-slate-800/90 border border-slate-700'
      : 'bg-slate-900 border border-slate-800';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div
        className={`${iconBoxSize} ${emblemBg} rounded-lg flex items-center justify-center shrink-0 shadow-xs`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[70%] h-[70%]"
        >
          {/* Outer octagonal energy shield */}
          <path
            d="M11 3H25L33 11V25L25 33H11L3 25V11L11 3Z"
            stroke="#F59E0B"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          {/* Precision fuel droplet + forecourt metering core */}
          <path
            d="M18 8.5C18 8.5 11.5 15.8 11.5 20.6C11.5 24.19 14.41 27.1 18 27.1C21.59 27.1 24.5 24.19 24.5 20.6C24.5 15.8 18 8.5 18 8.5Z"
            fill="#F59E0B"
          />
          {/* Inner high-contrast calibration dial mark */}
          <path
            d="M15.2 20.8C15.2 22.35 16.45 23.6 18 23.6"
            stroke="#0F172A"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="18" cy="18.2" r="1.4" fill="#0F172A" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span
          className={`font-bold tracking-tight ${titleSize} ${textPrimary}`}
        >
          Opes<span className="text-amber-500">Fuel</span>
        </span>
        {showSubline && (
          <span
            className={`font-mono uppercase tracking-[0.14em] ${sublineSize} ${textSubtle} mt-0.5`}
          >
            Station OS · FCFA
          </span>
        )}
      </div>
    </div>
  );
};
