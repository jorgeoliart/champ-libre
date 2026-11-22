import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, RefreshCw } from 'lucide-react';
import { ArticleCard } from './components/ArticleCard.tsx';
import { ArticleModal } from './components/ArticleModal.tsx';
import { FilterBar } from './components/FilterBar.tsx';
import { Header } from './components/Header.tsx';
import type { Article, ArticlesResponse, Category } from './shared/types.ts';
import type { TextScale } from './utils/format.ts';

const THEME_STORAGE_KEY = 'champ-libre-theme';
const TEXT_SCALE_STORAGE_KEY = 'champ-libre-text-scale';

function getInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'dark';
}

function getInitialTextScale(): TextScale {
  try {
    const saved = localStorage.getItem(TEXT_SCALE_STORAGE_KEY);
    if (saved === 'sm' || saved === 'md' || saved === 'lg') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'sm';
}

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [textScale, setTextScale] = useState<TextScale>(getInitialTextScale);

  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'Tout' | Category>('Tout');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Sync theme to <html> and localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      document.body.className = 'bg-[#171310] text-[#F2ECE1] antialiased';
    } else {
      root.classList.remove('dark');
      document.body.className = 'bg-[#FAF7F2] text-[#1E1915] antialiased';
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage access errors
    }
  }, [theme]);

  // Persist text scale to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TEXT_SCALE_STORAGE_KEY, textScale);
    } catch {
      // Ignore storage access errors
    }
  }, [textScale]);

  const loadArticles = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const endpoint = forceRefresh ? '/api/articles?refresh=true' : '/api/articles';
      console.log('[Frontend] Fetching /api/articles...');
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error(`Réponse inattendue du serveur (${response.status})`);
      }
      const data: ArticlesResponse = await response.json();
      console.log('[Frontend] Received:', data);
      setArticles(data.articles || []);
      setSources(data.sources || []);
    } catch (err) {
      console.error('Erreur lors du chargement des articles:', err);
      setErrorMessage(
        'Une erreur est survenue lors du chargement des articles. Veuillez réessayer dans un instant.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadArticles(false);
  }, [loadArticles]);

  const filteredArticles = useMemo(() => {
    const normQuery = normalizeSearch(searchQuery.trim());

    return articles.filter((article) => {
      if (selectedCategory !== 'Tout' && article.category !== selectedCategory) {
        return false;
      }
      if (selectedSource && article.source !== selectedSource) {
        return false;
      }
      if (normQuery) {
        const haystack = normalizeSearch(
          `${article.title} ${article.excerpt} ${article.source} ${article.category}`
        );
        if (!haystack.includes(normQuery)) {
          return false;
        }
      }
      return true;
    });
  }, [articles, searchQuery, selectedCategory, selectedSource]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Tout');
    setSelectedSource('');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F2] text-[#1E1915] transition-colors duration-150 dark:bg-[#171310] dark:text-[#F2ECE1]">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        textScale={textScale}
        onChangeTextScale={setTextScale}
        onRefresh={() => void loadArticles(true)}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 pb-16">
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedSource={selectedSource}
          onSourceChange={setSelectedSource}
          sources={sources}
          totalMatching={filteredArticles.length}
          isLoading={isLoading}
        />

        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          {/* Loading state */}
          {isLoading && (
            <div>
              <p className="mb-6 text-sm font-medium text-[#73685B] dark:text-[#8E8477]">
                Chargement des articles…
              </p>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="overflow-hidden rounded-xl border border-[#E5DDD0] bg-[#FFFFFF] dark:border-[#362D26] dark:bg-[#221C18]"
                  >
                    <div className="aspect-[16/10] w-full animate-pulse bg-[#EFE7DA] dark:bg-[#2C241E]" />
                    <div className="space-y-3 p-5">
                      <div className="h-5 w-28 animate-pulse rounded bg-[#EFE7DA] dark:bg-[#2C241E]" />
                      <div className="h-3.5 w-44 animate-pulse rounded bg-[#EFE7DA] dark:bg-[#2C241E]" />
                      <div className="h-6 w-full animate-pulse rounded bg-[#EFE7DA] dark:bg-[#2C241E]" />
                      <div className="h-6 w-4/5 animate-pulse rounded bg-[#EFE7DA] dark:bg-[#2C241E]" />
                      <div className="h-4 w-full animate-pulse rounded bg-[#EFE7DA] dark:bg-[#2C241E]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {!isLoading && errorMessage && articles.length === 0 && (
            <div className="mx-auto my-12 max-w-lg rounded-xl border border-[#E5DDD0] bg-[#FFFFFF] p-8 text-center dark:border-[#362D26] dark:bg-[#221C18]">
              <AlertCircle
                className="mx-auto mb-3 h-8 w-8 text-[#B87A24] dark:text-[#DFA24E]"
                aria-hidden="true"
              />
              <h2 className="font-editorial text-xl font-semibold text-[#1E1915] dark:text-[#F2ECE1]">
                Chargement impossible
              </h2>
              <p className="mt-2 text-sm text-[#4F473E] dark:text-[#C7BEB0]">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => void loadArticles(true)}
                className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#B87A24] px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#9E661A] dark:bg-[#DFA24E] dark:text-[#171310] dark:hover:bg-[#E8B56B]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Réessayer</span>
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !errorMessage && filteredArticles.length === 0 && (
            <div className="mx-auto my-12 max-w-lg rounded-xl border border-[#E5DDD0] bg-[#FFFFFF] p-8 text-center dark:border-[#362D26] dark:bg-[#221C18]">
              <BookOpen
                className="mx-auto mb-3 h-8 w-8 text-[#73685B] dark:text-[#8E8477]"
                aria-hidden="true"
              />
              <p className="text-base font-medium text-[#1E1915] dark:text-[#F2ECE1]">
                Aucun article ne correspond à votre recherche.
              </p>
              {(searchQuery || selectedCategory !== 'Tout' || selectedSource) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#E5DDD0] bg-[#FAF7F2] px-5 py-2.5 text-sm font-medium text-[#1E1915] transition-colors duration-150 hover:border-[#B87A24] hover:text-[#B87A24] dark:border-[#362D26] dark:bg-[#171310] dark:text-[#F2ECE1] dark:hover:border-[#DFA24E] dark:hover:text-[#DFA24E]"
                >
                  Afficher tous les articles
                </button>
              )}
            </div>
          )}

          {/* Article grid */}
          {!isLoading && filteredArticles.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  textScale={textScale}
                  onSelect={setSelectedArticle}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-[#E5DDD0] bg-[#FAF7F2] py-6 dark:border-[#362D26] dark:bg-[#171310]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-center text-xs text-[#73685B] sm:flex-row sm:px-6 sm:text-left lg:px-8 dark:text-[#8E8477]">
          <p>Champ Libre — L’info sans péage. Les idées qui comptent.</p>
          <p>Articles issus de médias francophones en accès libre.</p>
        </div>
      </footer>

      <ArticleModal
        article={selectedArticle}
        textScale={textScale}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
