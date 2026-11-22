export const CATEGORIES = [
  'Monde & Politique',
  'Enquêtes & Justice',
  'Sciences & Climat',
  'Tech & Société',
  'Santé & Esprit',
  'Économie & Travail',
  'Culture & Idées',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  fullExcerpt: string;
  url: string;
  source: string;
  category: Category;
  publishedAt: string;
  imageUrl: string | null;
  readingTime: number | null;
}

export interface ArticlesResponse {
  articles: Article[];
  sources: string[];
  categories: readonly Category[];
  fetchedAt: string;
  cached: boolean;
  stats: {
    totalSources: number;
    activeSources: number;
    totalArticles: number;
  };
}
