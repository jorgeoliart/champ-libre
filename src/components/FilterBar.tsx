import { Search, X } from 'lucide-react';
import { CATEGORIES, type Category } from '../shared/types.ts';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: 'Tout' | Category;
  onCategoryChange: (category: 'Tout' | Category) => void;
  selectedSource: string;
  onSourceChange: (source: string) => void;
  sources: string[];
  totalMatching: number;
  isLoading: boolean;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedSource,
  onSourceChange,
  sources,
  totalMatching,
  isLoading,
}: FilterBarProps) {
  const categoryItems: Array<'Tout' | Category> = ['Tout', ...CATEGORIES];

  return (
    <section
      aria-label="Filtres et recherche"
      className="mx-auto max-w-7xl px-4 pt-6 pb-2 sm:px-6 lg:px-8"
    >
      {/* Search + Source row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#73685B] dark:text-[#8E8477]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un article, un sujet, un média…"
            aria-label="Rechercher un article, un sujet, un média"
            className="min-h-[44px] w-full rounded-lg border border-[#E5DDD0] bg-[#FFFFFF] py-2.5 pr-11 pl-10 text-sm text-[#1E1915] placeholder-[#73685B] transition-colors duration-150 focus:border-[#B87A24] focus:outline-none dark:border-[#362D26] dark:bg-[#221C18] dark:text-[#F2ECE1] dark:placeholder-[#8E8477] dark:focus:border-[#DFA24E]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Effacer la recherche"
              className="absolute top-1/2 right-1 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-[#73685B] hover:text-[#1E1915] dark:text-[#8E8477] dark:hover:text-[#F2ECE1]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="source-filter" className="sr-only">
            Filtrer par média
          </label>
          <select
            id="source-filter"
            value={selectedSource}
            onChange={(e) => onSourceChange(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-[#E5DDD0] bg-[#FFFFFF] px-3.5 py-2 text-sm text-[#1E1915] transition-colors duration-150 focus:border-[#B87A24] focus:outline-none md:w-64 dark:border-[#362D26] dark:bg-[#221C18] dark:text-[#F2ECE1] dark:focus:border-[#DFA24E]"
          >
            <option value="">Toutes les sources</option>
            {sources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category pills with flex-wrap (no horizontal scrollbar) */}
      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Catégories">
        {categoryItems.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryChange(category)}
              aria-pressed={isActive}
              className={`min-h-[44px] min-w-[44px] whitespace-nowrap shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B87A24] dark:focus-visible:outline-[#DFA24E] ${
                isActive
                  ? 'border-[#B87A24] bg-[#B87A24] text-white dark:border-[#DFA24E] dark:bg-[#DFA24E] dark:text-[#171310]'
                  : 'border-[#E5DDD0] bg-[#FFFFFF] text-[#4F473E] hover:border-[#B87A24]/60 hover:text-[#1E1915] dark:border-[#362D26] dark:bg-[#221C18] dark:text-[#C7BEB0] dark:hover:border-[#DFA24E]/60 dark:hover:text-[#F2ECE1]'
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Subtle article count */}
      {!isLoading && (
        <div className="mt-4 flex items-center justify-between border-b border-[#E5DDD0] pb-3 text-xs text-[#73685B] dark:border-[#362D26] dark:text-[#8E8477]">
          <span className="tabular-nums">
            {totalMatching}{' '}
            {totalMatching > 1 ? 'articles affichés' : 'article affiché'}
          </span>
          {(searchQuery || selectedCategory !== 'Tout' || selectedSource) && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onCategoryChange('Tout');
                onSourceChange('');
              }}
              className="min-h-[44px] px-2 font-medium text-[#B87A24] hover:underline dark:text-[#DFA24E]"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}
    </section>
  );
}
