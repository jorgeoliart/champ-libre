import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import net from 'net';
import { CATEGORIES, type Article, type ArticlesResponse, type Category } from '../src/shared/types.ts';

interface FeedSource {
  name: string;
  feedUrls: string[];
}

export interface FailedFeedDiagnostic {
  name: string;
  error: string;
}

const FEED_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

export const FEED_SOURCES: FeedSource[] = [
  {
    name: 'The Conversation France',
    feedUrls: ['https://theconversation.com/fr/articles.atom'],
  },
  {
    name: 'CNRS Le Journal',
    feedUrls: ['https://lejournal.cnrs.fr/rss'],
  },
  {
    name: 'La Vie des idées',
    feedUrls: ['https://laviedesidees.fr/spip.php?page=backend'],
  },
  {
    name: 'Le Grand Continent',
    feedUrls: ['https://legrandcontinent.eu/fr/feed/'],
  },
  {
    name: 'France Culture',
    feedUrls: [
      'https://www.radiofrance.fr/franceculture/rss',
      'https://www.radiofrance.fr/rss',
      'https://radiofrance-podcast.net/podcast09/rss_10076.xml',
    ],
  },
  {
    name: 'Revue Ballast',
    feedUrls: ['https://www.revue-ballast.fr/feed/'],
  },
  {
    name: 'Bon Pote',
    feedUrls: ['https://bonpote.com/feed/'],
  },
  {
    name: 'Disclose',
    feedUrls: ['https://disclose.ngo/feed/'],
  },
  {
    name: 'Reporterre',
    feedUrls: ['https://reporterre.net/spip.php?page=backend'],
  },
  {
    name: 'Basta!',
    feedUrls: ['https://basta.media/spip.php?page=backend'],
  },
  {
    name: 'Blast',
    feedUrls: [
      'https://www.blast-info.fr/rss.xml',
      'https://api.blast-info.fr/rss.xml',
      'https://www.blast-info.fr/feed',
    ],
  },
  {
    name: 'Orient XXI',
    feedUrls: [
      'https://orientxxi.info/spip.php?page=backend',
      'https://orientxxi.info/?page=backend',
      'https://orientxxi.info/spip.php?page=backend&lang=fr',
    ],
  },
  {
    name: 'Franceinfo',
    feedUrls: [
      'https://www.franceinfo.fr/titres.rss',
      'https://www.francetvinfo.fr/titres.rss',
    ],
  },
  {
    name: 'France 24',
    feedUrls: ['https://www.france24.com/fr/rss'],
  },
  {
    name: 'RFI',
    feedUrls: ['https://www.rfi.fr/fr/rss'],
  },
  {
    name: 'RTS Info',
    feedUrls: [
      'https://www.rts.ch/info/rss/',
      'https://www.rts.ch/info/?format=rss/2.0',
      'https://www.rts.ch/info/monde/?format=rss/2.0',
      'https://www.rts.ch/info/toute-info/?format=rss/news',
    ],
  },
  {
    name: 'Radio-Canada Info',
    feedUrls: [
      'https://ici.radio-canada.ca/rss/4159',
      'https://ici.radio-canada.ca/rss/92',
    ],
  },
  {
    name: 'RTBF Actus',
    feedUrls: [
      'https://rss.rtbf.be/article/rss/highlight_rtbf_info.xml',
      'https://www.rtbf.be/rss/actualite',
    ],
  },
  {
    name: 'TV5MONDE',
    feedUrls: ['https://information.tv5monde.com/rss.xml'],
  },
  {
    name: 'Slate.fr',
    feedUrls: ['https://www.slate.fr/rss.xml'],
  },
];

const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes
const FEED_TIMEOUT_MS = 12000; // 12s per feed request
const HTML_TIMEOUT_MS = 2500; // lightweight 2.5s HTML fetch
const ENRICHMENT_DEADLINE_MS = 3200; // cap total enrichment wall time so API responds swiftly
const MAX_ITEMS_PER_FEED = 8;
const ENRICHMENT_CONCURRENCY = 16;
const MAX_ENRICHMENT_ARTICLES = 64;
const MAX_HTML_BYTES = 250_000;
const WORDS_PER_MINUTE = 220;

interface CustomRssItem {
  title?: string;
  link?: string;
  id?: string;
  guid?: string;
  pubDate?: string;
  isoDate?: string;
  published?: string;
  updated?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  categories?: Array<string | { _?: string; $?: { term?: string } }>;
  enclosure?: { url?: string; type?: string };
  mediaContent?: Array<{ $?: { url?: string; medium?: string; type?: string } }>;
  mediaThumbnail?: Array<{ $?: { url?: string } }>;
  mediaGroup?: {
    'media:content'?: Array<{ $?: { url?: string; medium?: string; type?: string } }>;
    'media:thumbnail'?: Array<{ $?: { url?: string } }>;
  };
  contentEncoded?: string;
  descriptionHtml?: string;
  summaryHtml?: string;
}

const parser = new Parser<Record<string, unknown>, CustomRssItem>({
  headers: FEED_HEADERS,
  timeout: FEED_TIMEOUT_MS,
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['media:group', 'mediaGroup'],
      ['content:encoded', 'contentEncoded'],
      ['description', 'descriptionHtml'],
      ['summary', 'summaryHtml'],
    ],
  },
});

let cachedPayload: Omit<ArticlesResponse, 'cached'> | null = null;
let cacheTimestamp = 0;
let inFlightPromise: Promise<Omit<ArticlesResponse, 'cached'>> | null = null;
let lastFailedFeeds: FailedFeedDiagnostic[] = [];
let lastActiveFeedsCount = 0;

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::1'
  ) {
    return true;
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  if (ipVersion === 6) {
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
      return true;
    }
  }
  return false;
}

function sanitizeHttpUrl(rawUrl: string | undefined | null, baseUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('javascript:')) {
    return null;
  }
  try {
    const parsed = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (isPrivateOrLocalHost(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function stripHtmlToText(html: string | undefined | null): string {
  if (!html) return '';
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, svg').remove();
  $('p, br, div, li, h1, h2, h3, h4, blockquote').each((_, el) => {
    $(el).append(' ');
  });
  return $.text().replace(/\s+/g, ' ').trim();
}

function extractParagraphsFromHtml(html: string | undefined | null): string[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, svg, figure, figcaption').remove();
  const paragraphs: string[] = [];
  $('p').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length >= 25) {
      paragraphs.push(text);
    }
  });
  if (paragraphs.length === 0) {
    const plain = stripHtmlToText(html);
    if (plain.length > 0) paragraphs.push(plain);
  }
  return paragraphs;
}

function truncateCleanly(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[,;:\s]+$/, '') + '…';
}

function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  'Monde & Politique': [
    'géopolitique', 'international', 'élection', 'élections', 'gouvernement', 'diplomatie',
    'europe', 'européen', 'européenne', 'guerre', 'onu', 'moyen-orient', 'afrique',
    'parlement', 'président', 'ministre', 'assemblée', 'sénat', 'ukraine', 'russie',
    'gaza', 'israël', 'palestine', 'liban', 'syrie', 'iran', 'chine', 'états-unis',
    'trump', 'macron', 'politique', 'démocratie', 'constitution', 'vote', 'scrutin',
    'député', 'premier ministre', 'otan', 'souveraineté', 'conflit', 'frontière',
    'réfugié', 'migration', 'immigration', 'ambassade', 'sommet', 'suisse', 'belgique',
    'canada', 'québec', 'maghreb', 'sahel',
  ],
  'Enquêtes & Justice': [
    'enquête', 'justice', 'police', 'corruption', 'procès', 'droits humains', 'scandale',
    'révélations', 'révélation', 'tribunal', 'juge', 'parquet', 'condamnation', 'prison',
    'garde à vue', 'plainte', 'fraude', 'évasion fiscale', 'blanchiment', 'pesticide',
    'violence policière', 'violences', 'harcèlement', 'agression', 'avocat', 'pénal',
    'détournement', 'lanceur d’alerte', 'lanceur d\'alerte', 'investigation', 'impunité',
    'milice', 'armement', 'trafic', 'crime',
  ],
  'Sciences & Climat': [
    'climat', 'climatique', 'écologie', 'écologique', 'biodiversité', 'giec', 'énergie',
    'espace', 'physique', 'biologie', 'recherche', 'cnrs', 'environnement', 'carbone',
    'réchauffement', 'gaz à effet de serre', 'océan', 'forêt', 'nucléaire', 'renouvelable',
    'solaire', 'éolien', 'sécheresse', 'inondation', 'glacier', 'espèce', 'faune',
    'flore', 'astronomie', 'galaxie', 'télescope', 'planète', 'scientifique', 'science',
    'laboratoire', 'chimie', 'archéologie', 'fossile', 'quantique', 'eau', 'pollution',
  ],
  'Tech & Société': [
    'intelligence artificielle', 'numérique', 'algorithme', 'cybersécurité', 'réseaux sociaux',
    'tech', 'données', 'internet', 'ia ', ' ia', 'chatgpt', 'openai', 'logiciel',
    'smartphone', 'plateforme', 'surveillance', 'robot', 'informatique', 'piratage',
    'cyberattaque', 'vie privée', 'rgpd', 'gafam', 'meta', 'google', 'apple', 'tiktok',
    'désinformation', 'deepfake', 'spatial', 'satellite', 'startup', 'cloud',
  ],
  'Santé & Esprit': [
    'santé', 'médecine', 'hôpital', 'hôpitaux', 'psychiatrie', 'psychologie', 'bien-être',
    'alimentation', 'épidémie', 'pandémie', 'vaccin', 'maladie', 'cancer', 'soin',
    'médecin', 'infirmier', 'sommeil', 'cerveau', 'nutrition', 'santé mentale',
    'dépression', 'anxiété', 'addiction', 'médicament', 'antibiotique', 'virus',
    'covid', 'grossesse', 'pédiatrie', 'vieillissement', 'espérance de vie', 'oms',
  ],
  'Économie & Travail': [
    'économie', 'économique', 'inflation', 'travail', 'grève', 'salaire', 'entreprise',
    'finance', 'retraite', 'retraites', 'syndicat', 'logement', 'emploi', 'chômage',
    'impôt', 'budget', 'bourse', 'dette', 'pib', 'commerce', 'usine', 'industrie',
    'patronat', 'smic', 'pouvoir d’achat', 'pouvoir d\'achat', 'banque', 'tarif',
    'droits de douane', 'croissance', 'récession', 'pauvreté', 'précarité', 'loyer',
    'immobilier', 'agriculteur', 'agriculture', 'transport',
  ],
  'Culture & Idées': [
    'philosophie', 'histoire', 'littérature', 'cinéma', 'art', 'essai', 'sociologie',
    'débat', 'éducation', 'livre', 'roman', 'théâtre', 'musique', 'musée', 'exposition',
    'université', 'école', 'pensée', 'penseur', 'intellectuel', 'auteur', 'autrice',
    'réalisateur', 'festival', 'cannes', 'poésie', 'peinture', 'architecture', 'patrimoine',
    'langue', 'média', 'journalisme', 'féminisme', 'racisme', 'colonialisme', 'mémoire',
  ],
};

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[’']/g, "'");
}

function classifyArticle(
  title: string,
  excerpt: string,
  rssCategories: string[]
): Category {
  const normTitle = normalizeForMatch(title);
  const normCats = normalizeForMatch(rssCategories.join(' '));
  const normExcerpt = normalizeForMatch(excerpt);

  const scores = new Map<Category, number>();
  for (const cat of CATEGORIES) {
    scores.set(cat, 0);
  }

  for (const cat of CATEGORIES) {
    let score = 0;
    const keywords = CATEGORY_KEYWORDS[cat];
    for (const kw of keywords) {
      if (normTitle.includes(kw)) score += 3;
      if (normCats.includes(kw)) score += 2.5;
      if (normExcerpt.includes(kw)) score += 1;
    }
    scores.set(cat, score);
  }

  let bestCategory: Category = 'Culture & Idées';
  let bestScore = 0;
  for (const cat of CATEGORIES) {
    const s = scores.get(cat) ?? 0;
    if (s > bestScore) {
      bestScore = s;
      bestCategory = cat;
    }
  }

  if (bestScore === 0) {
    return 'Monde & Politique';
  }

  return bestCategory;
}

function extractRssCategories(item: CustomRssItem): string[] {
  if (!Array.isArray(item.categories)) return [];
  const result: string[] = [];
  for (const c of item.categories) {
    if (typeof c === 'string') {
      result.push(c);
    } else if (c && typeof c === 'object') {
      if (typeof c._ === 'string') result.push(c._);
      if (c.$ && typeof c.$.term === 'string') result.push(c.$.term);
    }
  }
  return result;
}

function isLikelyDecorativeImage(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.svg') ||
    lower.includes('pixel') ||
    lower.includes('tracking') ||
    lower.includes('1x1') ||
    lower.includes('favicon')
  );
}

function extractImageFromRssItem(item: CustomRssItem, baseUrl: string): string | null {
  if (item.enclosure?.url) {
    const type = (item.enclosure.type || '').toLowerCase();
    if (!type || type.startsWith('image/')) {
      const safe = sanitizeHttpUrl(item.enclosure.url, baseUrl);
      if (safe && !isLikelyDecorativeImage(safe)) return safe;
    }
  }

  if (Array.isArray(item.mediaContent)) {
    for (const mc of item.mediaContent) {
      const url = mc?.$?.url;
      const medium = (mc?.$?.medium || '').toLowerCase();
      const type = (mc?.$?.type || '').toLowerCase();
      if (url && (!medium || medium === 'image') && (!type || type.startsWith('image/'))) {
        const safe = sanitizeHttpUrl(url, baseUrl);
        if (safe && !isLikelyDecorativeImage(safe)) return safe;
      }
    }
  }

  if (Array.isArray(item.mediaThumbnail)) {
    for (const mt of item.mediaThumbnail) {
      const safe = sanitizeHttpUrl(mt?.$?.url, baseUrl);
      if (safe && !isLikelyDecorativeImage(safe)) return safe;
    }
  }

  if (item.mediaGroup) {
    const groupContents = item.mediaGroup['media:content'] || [];
    for (const mc of groupContents) {
      const safe = sanitizeHttpUrl(mc?.$?.url, baseUrl);
      if (safe && !isLikelyDecorativeImage(safe)) return safe;
    }
    const groupThumbs = item.mediaGroup['media:thumbnail'] || [];
    for (const mt of groupThumbs) {
      const safe = sanitizeHttpUrl(mt?.$?.url, baseUrl);
      if (safe && !isLikelyDecorativeImage(safe)) return safe;
    }
  }

  const htmlCandidates = [
    item.contentEncoded,
    item.content,
    item.descriptionHtml,
    item.summaryHtml,
    item.summary,
  ];
  for (const html of htmlCandidates) {
    if (!html) continue;
    const $ = cheerio.load(html);
    const imgs = $('img');
    for (let i = 0; i < imgs.length; i++) {
      const el = imgs.eq(i);
      const src = el.attr('src') || el.attr('data-src') || el.attr('data-lazy-src');
      const width = Number(el.attr('width') || 0);
      const height = Number(el.attr('height') || 0);
      if ((width > 0 && width <= 5) || (height > 0 && height <= 5)) continue;
      const safe = sanitizeHttpUrl(src, baseUrl);
      if (safe && !isLikelyDecorativeImage(safe)) return safe;
    }
  }

  return null;
}

async function readLimitedText(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) {
    return (await res.text()).slice(0, maxBytes);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let received = 0;
  let result = '';

  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
  } finally {
    void reader.cancel().catch(() => {});
  }
  return result;
}

async function fetchHtmlForEnrichment(
  articleUrl: string,
  parentSignal: AbortSignal
): Promise<{ ogImage: string | null; extractedParagraphs: string[]; wordCount: number }> {
  const safeUrl = sanitizeHttpUrl(articleUrl);
  if (!safeUrl || parentSignal.aborted) {
    return { ogImage: null, extractedParagraphs: [], wordCount: 0 };
  }

  const combinedSignal = AbortSignal.any([
    parentSignal,
    AbortSignal.timeout(HTML_TIMEOUT_MS),
  ]);

  try {
    const res = await fetch(safeUrl, {
      signal: combinedSignal,
      headers: {
        'User-Agent': FEED_HEADERS['User-Agent'],
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return { ogImage: null, extractedParagraphs: [], wordCount: 0 };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { ogImage: null, extractedParagraphs: [], wordCount: 0 };
    }

    const html = await readLimitedText(res, MAX_HTML_BYTES);
    const $ = cheerio.load(html);

    const rawOg =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="og:image:url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[property="twitter:image"]').attr('content') ||
      null;

    const ogImage = sanitizeHttpUrl(rawOg, safeUrl);

    $('script, style, noscript, nav, header, footer, aside, form, .comments, .related, .newsletter').remove();

    const selectors = [
      'article',
      '[itemprop="articleBody"]',
      '.article-content',
      '.entry-content',
      '.post-content',
      'main',
    ];

    let paragraphs: string[] = [];
    for (const sel of selectors) {
      const container = $(sel).first();
      if (container.length > 0) {
        const found: string[] = [];
        container.find('p').each((_, el) => {
          const text = $(el).text().replace(/\s+/g, ' ').trim();
          if (text.length >= 25) found.push(text);
        });
        if (found.length >= 2) {
          paragraphs = found;
          break;
        }
      }
    }

    if (paragraphs.length === 0) {
      $('p').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.length >= 35) paragraphs.push(text);
      });
    }

    const fullText = paragraphs.join(' ');
    const wordCount = countWords(fullText);

    return {
      ogImage: ogImage && !isLikelyDecorativeImage(ogImage) ? ogImage : null,
      extractedParagraphs: paragraphs,
      wordCount,
    };
  } catch {
    return { ogImage: null, extractedParagraphs: [], wordCount: 0 };
  }
}

interface PrelimArticle {
  article: Article;
  needsImage: boolean;
  needsReadingText: boolean;
}

async function fetchCandidateFeedUrl(
  sourceName: string,
  feedUrl: string
): Promise<PrelimArticle[]> {
  const res = await fetch(feedUrl, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    headers: FEED_HEADERS,
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText || ''}`.trim());
  }

  const xml = await res.text();
  const feed = await parser.parseString(xml);
  const rawItems = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

  if (rawItems.length === 0) {
    throw new Error('0 articles dans le flux');
  }

  const prelim: PrelimArticle[] = [];

  for (const item of rawItems) {
    const safeLink = sanitizeHttpUrl(item.link, feedUrl);
    const title = stripHtmlToText(item.title || '');
    if (!safeLink || !title) continue;

    const rawDate = item.isoDate || item.pubDate || item.published || item.updated;
    let publishedAt: string;
    if (rawDate) {
      const parsedDate = new Date(rawDate);
      publishedAt = Number.isNaN(parsedDate.getTime())
        ? new Date().toISOString()
        : parsedDate.toISOString();
    } else {
      publishedAt = new Date().toISOString();
    }

    const richHtml = item.contentEncoded || item.content || '';
    const summaryHtml = item.descriptionHtml || item.summaryHtml || item.summary || '';

    const richParagraphs = extractParagraphsFromHtml(richHtml);
    const summaryParagraphs = extractParagraphsFromHtml(summaryHtml);
    const bestParagraphs =
      richParagraphs.join(' ').length >= summaryParagraphs.join(' ').length
        ? richParagraphs
        : summaryParagraphs;

    const rawText = bestParagraphs.join(' ') || item.contentSnippet || '';
    const cleanExcerpt = truncateCleanly(rawText, 210);
    const extendedText =
      bestParagraphs.length > 0
        ? truncateCleanly(bestParagraphs.slice(0, 6).join('\n\n'), 1300)
        : cleanExcerpt;

    const rssWordCount = countWords(stripHtmlToText(richHtml));
    const hasSubstantialRssText = rssWordCount >= 120;
    const initialReadingTime = hasSubstantialRssText
      ? Math.max(1, Math.round(rssWordCount / WORDS_PER_MINUTE))
      : null;

    const imageUrl = extractImageFromRssItem(item, safeLink);
    const rssCategories = extractRssCategories(item);
    const category = classifyArticle(title, rawText, rssCategories);

    const id = crypto
      .createHash('sha1')
      .update(`${sourceName}::${safeLink}`)
      .digest('hex')
      .slice(0, 16);

    prelim.push({
      article: {
        id,
        title,
        excerpt: cleanExcerpt,
        fullExcerpt: extendedText,
        url: safeLink,
        source: sourceName,
        category,
        publishedAt,
        imageUrl,
        readingTime: initialReadingTime,
      },
      needsImage: !imageUrl,
      needsReadingText: !hasSubstantialRssText,
    });
  }

  if (prelim.length === 0) {
    throw new Error('Aucun article exploitable dans le flux');
  }

  return prelim;
}

async function fetchSingleFeedWithFallbacks(source: FeedSource): Promise<PrelimArticle[]> {
  let lastError = 'Flux inaccessible';

  for (const url of source.feedUrls) {
    try {
      const items = await fetchCandidateFeedUrl(source.name, url);
      return items;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      lastError = reason;
      console.warn(`[RSS] Échec tentative flux ${source.name} (${url}): ${reason}`);
    }
  }

  throw new Error(lastError);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  signal: AbortSignal,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length && !signal.aborted) {
      const currentIndex = index++;
      await worker(items[currentIndex]);
    }
  });
  await Promise.all(runners);
}

async function aggregateAllFeeds(): Promise<Omit<ArticlesResponse, 'cached'>> {
  const results = await Promise.allSettled(
    FEED_SOURCES.map((source) => fetchSingleFeedWithFallbacks(source))
  );

  const allPrelim: PrelimArticle[] = [];
  const activeSourceSet = new Set<string>();
  const failedDiagnostics: FailedFeedDiagnostic[] = [];

  results.forEach((result, idx) => {
    const source = FEED_SOURCES[idx];
    if (result.status === 'fulfilled' && result.value.length > 0) {
      activeSourceSet.add(source.name);
      allPrelim.push(...result.value);
    } else {
      const reason =
        result.status === 'rejected'
          ? result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
          : '0 articles';
      console.error(
        `[RSS] Source indisponible — ${source.name} (${source.feedUrls.join(', ')}): ${reason}`
      );
      failedDiagnostics.push({ name: source.name, error: reason });
    }
  });

  lastFailedFeeds = failedDiagnostics;
  lastActiveFeedsCount = activeSourceSet.size;

  // Sort newest-first and deduplicate by URL BEFORE HTML enrichment
  allPrelim.sort(
    (a, b) =>
      new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime()
  );

  const seenUrls = new Set<string>();
  const deduped: PrelimArticle[] = [];
  for (const item of allPrelim) {
    if (!seenUrls.has(item.article.url)) {
      seenUrls.add(item.article.url);
      deduped.push(item);
    }
  }

  // Enrich the newest articles missing og:image or readingTime within a strict global time budget
  const toEnrich = deduped
    .filter((entry) => entry.needsImage || entry.needsReadingText)
    .slice(0, MAX_ENRICHMENT_ARTICLES);

  if (toEnrich.length > 0) {
    const enrichmentSignal = AbortSignal.timeout(ENRICHMENT_DEADLINE_MS);
    await Promise.race([
      runWithConcurrency(toEnrich, ENRICHMENT_CONCURRENCY, enrichmentSignal, async (entry) => {
        const enriched = await fetchHtmlForEnrichment(entry.article.url, enrichmentSignal);
        if (entry.needsImage && enriched.ogImage) {
          entry.article.imageUrl = enriched.ogImage;
        }
        if (entry.needsReadingText) {
          if (enriched.wordCount >= 50) {
            entry.article.readingTime = Math.max(
              1,
              Math.round(enriched.wordCount / WORDS_PER_MINUTE)
            );
          } else {
            entry.article.readingTime = null;
          }
          if (
            enriched.extractedParagraphs.length > 0 &&
            enriched.extractedParagraphs.join(' ').length > entry.article.fullExcerpt.length
          ) {
            entry.article.fullExcerpt = truncateCleanly(
              enriched.extractedParagraphs.slice(0, 6).join('\n\n'),
              1300
            );
          }
          if (!entry.article.excerpt && enriched.extractedParagraphs.length > 0) {
            entry.article.excerpt = truncateCleanly(enriched.extractedParagraphs[0], 210);
          }
        }
      }),
      new Promise<void>((resolve) => {
        enrichmentSignal.addEventListener('abort', () => resolve(), { once: true });
      }),
    ]);
  }

  const articles = deduped.map((entry) => entry.article);
  const sources = FEED_SOURCES.map((s) => s.name).filter((name) =>
    activeSourceSet.has(name)
  );

  return {
    articles,
    sources: sources.length > 0 ? sources : FEED_SOURCES.map((s) => s.name),
    categories: CATEGORIES,
    fetchedAt: new Date().toISOString(),
    stats: {
      totalSources: FEED_SOURCES.length,
      activeSources: activeSourceSet.size,
      totalArticles: articles.length,
    },
  };
}

export async function getAggregatedArticles(
  forceRefresh = false
): Promise<ArticlesResponse> {
  const now = Date.now();
  const isCacheValid =
    !forceRefresh && cachedPayload !== null && now - cacheTimestamp < CACHE_TTL_MS;

  if (isCacheValid && cachedPayload) {
    return {
      ...cachedPayload,
      cached: true,
    };
  }

  if (!inFlightPromise) {
    inFlightPromise = aggregateAllFeeds()
      .then((payload) => {
        if (payload.articles.length > 0 || cachedPayload === null) {
          cachedPayload = payload;
          cacheTimestamp = Date.now();
        }
        return cachedPayload ?? payload;
      })
      .finally(() => {
        inFlightPromise = null;
      });
  }

  const data = await inFlightPromise;
  return {
    ...data,
    cached: false,
  };
}

export function getCacheHealth() {
  return {
    status: 'ok',
    activeFeedsCount: lastActiveFeedsCount,
    totalFeedsCount: FEED_SOURCES.length,
    failedFeeds: lastFailedFeeds,
    cachedArticles: cachedPayload?.articles.length ?? 0,
    lastFetchedAt: cachedPayload?.fetchedAt ?? null,
    cacheAgeSeconds: cacheTimestamp ? Math.floor((Date.now() - cacheTimestamp) / 1000) : null,
  };
}
