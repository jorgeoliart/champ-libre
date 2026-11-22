import { Moon, RefreshCw, Sun } from 'lucide-react';
import type { TextScale } from '../utils/format.ts';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  textScale: TextScale;
  onChangeTextScale: (scale: TextScale) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const SCALE_OPTIONS: Array<{ value: TextScale; label: string; ariaLabel: string }> = [
  { value: 'sm', label: 'A', ariaLabel: 'Taille de texte standard' },
  { value: 'md', label: 'A+', ariaLabel: 'Taille de texte moyenne' },
  { value: 'lg', label: 'A++', ariaLabel: 'Grande taille de texte' },
];

export function Header({
  theme,
  onToggleTheme,
  textScale,
  onChangeTextScale,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  return (
    <header className="border-b border-[#E5DDD0] bg-[#FAF7F2] dark:border-[#362D26] dark:bg-[#171310] transition-colors duration-150">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <h1 className="font-editorial text-2xl font-semibold tracking-tight text-[#1E1915] dark:text-[#F2ECE1] sm:text-3xl">
            Champ Libre
          </h1>
          <p className="mt-1 text-sm text-[#73685B] dark:text-[#8E8477]">
            L’info sans péage. Les idées qui comptent.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
          {/* Text size A / A+ / A++ toggle */}
          <div
            role="group"
            aria-label="Taille du texte"
            className="inline-flex items-center rounded-lg border border-[#E5DDD0] bg-[#FFFFFF] p-0.5 dark:border-[#362D26] dark:bg-[#221C18]"
          >
            {SCALE_OPTIONS.map((option) => {
              const active = textScale === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChangeTextScale(option.value)}
                  aria-label={option.ariaLabel}
                  aria-pressed={active}
                  className={`min-h-[44px] min-w-[44px] rounded-md px-2.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B87A24] dark:focus-visible:outline-[#DFA24E] ${
                    active
                      ? 'bg-[#B87A24] text-white dark:bg-[#DFA24E] dark:text-[#171310]'
                      : 'text-[#4F473E] hover:text-[#1E1915] dark:text-[#C7BEB0] dark:hover:text-[#F2ECE1]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {/* Refresh feed button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Actualiser les articles"
            title="Actualiser les flux"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-[#E5DDD0] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1E1915] transition-colors duration-150 hover:border-[#B87A24] hover:text-[#B87A24] disabled:opacity-60 dark:border-[#362D26] dark:bg-[#221C18] dark:text-[#F2ECE1] dark:hover:border-[#DFA24E] dark:hover:text-[#DFA24E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B87A24] dark:focus-visible:outline-[#DFA24E]"
          >
            <RefreshCw
              className={`h-4 w-4 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden md:inline whitespace-nowrap">Actualiser</span>
          </button>

          {/* Dark / Light theme toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'
            }
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#E5DDD0] bg-[#FFFFFF] text-[#1E1915] transition-colors duration-150 hover:border-[#B87A24] hover:text-[#B87A24] dark:border-[#362D26] dark:bg-[#221C18] dark:text-[#F2ECE1] dark:hover:border-[#DFA24E] dark:hover:text-[#DFA24E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B87A24] dark:focus-visible:outline-[#DFA24E]"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
