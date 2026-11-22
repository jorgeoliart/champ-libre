import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { Article } from '../shared/types.ts';
import {
  formatFrenchRelativeDate,
  formatReadingTime,
  getSourceInitials,
  isSafeHttpUrl,
  type TextScale,
} from '../utils/format.ts';

interface ArticleModalProps {
  article: Article | null;
  textScale: TextScale;
  onClose: () => void;
}

const MODAL_HEADLINE_SIZE: Record<TextScale, string> = {
  sm: 'text-2xl sm:text-3xl leading-tight',
  md: 'text-3xl sm:text-[2rem] leading-tight',
  lg: 'text-3xl sm:text-4xl leading-tight',
};

const MODAL_BODY_SIZE: Record<TextScale, string> = {
  sm: 'text-base leading-relaxed',
  md: 'text-lg leading-relaxed',
  lg: 'text-xl leading-relaxed',
};

export function ArticleModal({ article, textScale, onClose }: ArticleModalProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [article?.id]);

  useEffect(() => {
    if (!article) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [article, onClose]);

  if (!article) return null;

  const safeImageUrl = isSafeHttpUrl(article.imageUrl);
  const safeArticleUrl = isSafeHttpUrl(article.url);
  const showImage = Boolean(safeImageUrl && !imgFailed);
  const formattedDate = formatFrenchRelativeDate(article.publishedAt);
  const readingTimeLabel = formatReadingTime(article.readingTime);
  const paragraphs = (article.fullExcerpt || article.excerpt || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-article-title"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E5DDD0] bg-[#FAF7F2] text-[#1E1915] shadow-2xl dark:border-[#362D26] dark:bg-[#221C18] dark:text-[#F2ECE1]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[#E5DDD0] px-5 py-3 dark:border-[#362D26] sm:px-7">
          <span className="inline-block rounded-md border border-[#E5DDD0] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#B87A24] whitespace-nowrap dark:border-[#362D26] dark:bg-[#171310] dark:text-[#DFA24E]">
            {article.category}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l’aperçu"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#73685B] transition-colors duration-150 hover:bg-[#E5DDD0]/40 hover:text-[#1E1915] dark:text-[#8E8477] dark:hover:bg-[#362D26] dark:hover:text-[#F2ECE1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B87A24] dark:focus-visible:outline-[#DFA24E]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable reading content */}
        <div className="overflow-y-auto px-5 py-6 sm:px-8 sm:py-7">
          {/* Thumbnail */}
          <div className="mb-6 aspect-[16/9] w-full overflow-hidden rounded-xl border border-[#E5DDD0] bg-[#F3EDE3] dark:border-[#362D26] dark:bg-[#171310]">
            {showImage ? (
              <img
                src={safeImageUrl!}
                alt={article.title}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#EFE7DA] to-[#E5D9C6] px-6 text-center dark:from-[#2A221C] dark:to-[#171310]">
                <span className="font-editorial text-4xl font-semibold text-[#B87A24]/80 dark:text-[#DFA24E]/80">
                  {getSourceInitials(article.source)}
                </span>
                <span className="mt-2 text-sm font-medium text-[#73685B] dark:text-[#8E8477]">
                  {article.source}
                </span>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[#73685B] dark:text-[#8E8477]">
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
            id="modal-article-title"
            className={`font-editorial text-balance font-semibold text-[#1E1915] dark:text-[#F2ECE1] ${MODAL_HEADLINE_SIZE[textScale]}`}
          >
            {article.title}
          </h2>

          {/* Excerpt / Reader preview */}
          {paragraphs.length > 0 && (
            <div className={`mt-5 space-y-4 text-[#4F473E] dark:text-[#C7BEB0] ${MODAL_BODY_SIZE[textScale]}`}>
              {paragraphs.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="flex flex-col items-start justify-between gap-3 border-t border-[#E5DDD0] bg-[#FFFFFF] px-5 py-4 sm:flex-row sm:items-center sm:px-8 dark:border-[#362D26] dark:bg-[#171310]">
          <p className="text-xs text-[#73685B] dark:text-[#8E8477]">
            Ouvrir sur {article.source} dans un nouvel onglet
          </p>
          {safeArticleUrl && (
            <a
              href={safeArticleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#B87A24] px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#9E661A] sm:w-auto whitespace-nowrap dark:bg-[#DFA24E] dark:text-[#171310] dark:hover:bg-[#E8B56B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B87A24] dark:focus-visible:outline-[#DFA24E]"
            >
              <span>Lire l’article complet sur {article.source} ↗</span>
              <ExternalLink className="sr-only h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
