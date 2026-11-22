import { useState, type KeyboardEvent } from 'react';
import type { Article } from '../shared/types.ts';
import {
  formatFrenchRelativeDate,
  formatReadingTime,
  getSourceInitials,
  isSafeHttpUrl,
  type TextScale,
} from '../utils/format.ts';

interface ArticleCardProps {
  article: Article;
  textScale: TextScale;
  onSelect: (article: Article) => void;
}

const HEADLINE_SIZE: Record<TextScale, string> = {
  sm: 'text-lg leading-snug',
  md: 'text-xl leading-snug',
  lg: 'text-2xl leading-snug',
};

const EXCERPT_SIZE: Record<TextScale, string> = {
  sm: 'text-sm leading-relaxed',
  md: 'text-base leading-relaxed',
  lg: 'text-lg leading-relaxed',
};

export function ArticleCard({ article, textScale, onSelect }: ArticleCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const safeImageUrl = isSafeHttpUrl(article.imageUrl);
  const showImage = Boolean(safeImageUrl && !imgFailed);
  const formattedDate = formatFrenchRelativeDate(article.publishedAt);
  const readingTimeLabel = formatReadingTime(article.readingTime);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(article);
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(article)}
      onKeyDown={handleKeyDown}
      aria-label={`Lire l’aperçu de : ${article.title}`}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[#E5DDD0] bg-[#FFFFFF] transition-colors duration-150 hover:border-[#B87A24]/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B87A24] dark:border-[#362D26] dark:bg-[#221C18] dark:hover:border-[#DFA24E]/70 dark:focus-visible:outline-[#DFA24E]"
    >
      {/* Thumbnail with clean fallback */}
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-[#E5DDD0] bg-[#F3EDE3] dark:border-[#362D26] dark:bg-[#1B1612]">
        {showImage ? (
          <img
            src={safeImageUrl!}
            alt={article.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#EFE7DA] to-[#E5D9C6] px-6 text-center dark:from-[#2A221C] dark:to-[#1B1612]">
            <span className="font-editorial text-3xl font-semibold tracking-tight text-[#B87A24]/80 dark:text-[#DFA24E]/80">
              {getSourceInitials(article.source)}
            </span>
            <span className="mt-1.5 text-xs font-medium tracking-wide text-[#73685B] dark:text-[#8E8477]">
              {article.source}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-5">
        {/* Category badge */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="inline-block rounded-md border border-[#E5DDD0] bg-[#FAF7F2] px-2.5 py-0.5 text-xs font-medium text-[#B87A24] whitespace-nowrap dark:border-[#362D26] dark:bg-[#171310] dark:text-[#DFA24E]">
            {article.category}
          </span>
        </div>

        {/* Source, date & reading time metadata */}
        <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#73685B] dark:text-[#8E8477]">
          <span className="font-semibold text-[#4F473E] dark:text-[#C7BEB0]">
            {article.source}
          </span>
          {formattedDate && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={article.publishedAt}>{formattedDate}</time>
            </>
          )}
          {readingTimeLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{readingTimeLabel}</span>
            </>
          )}
        </div>

        {/* Headline */}
        <h2
          className={`font-editorial text-balance font-semibold text-[#1E1915] transition-colors duration-150 group-hover:text-[#B87A24] dark:text-[#F2ECE1] dark:group-hover:text-[#DFA24E] ${HEADLINE_SIZE[textScale]}`}
        >
          {article.title}
        </h2>

        {/* Short excerpt */}
        {article.excerpt && (
          <p
            className={`mt-2.5 line-clamp-3 text-[#4F473E] dark:text-[#C7BEB0] ${EXCERPT_SIZE[textScale]}`}
          >
            {article.excerpt}
          </p>
        )}
      </div>
    </article>
  );
}
