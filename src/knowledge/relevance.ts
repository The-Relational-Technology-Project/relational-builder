/**
 * Client-side TF-IDF relevance scorer for knowledge base items.
 *
 * Given a user query, scores each KB item by term overlap with IDF weighting.
 * Works entirely in-browser — no API calls, no embeddings cost.
 */

export interface ScoredItem<T> {
  item: T;
  score: number;
}

// Common English stop words to exclude from scoring
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'between',
  'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down',
  'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too',
  'very', 'just', 'because', 'if', 'when', 'while', 'how', 'what',
  'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me',
  'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
  'it', 'its', 'they', 'them', 'their', 'build', 'make', 'create',
  'want', 'need', 'like', 'get', 'use', 'app', 'tool', 'help',
]);

/** Tokenize text into meaningful terms */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/** Build a term frequency map for a token list */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  // Normalize by document length
  const len = tokens.length || 1;
  for (const [term, count] of tf) {
    tf.set(term, count / len);
  }
  return tf;
}

/**
 * Score a collection of documents against a query using TF-IDF.
 *
 * @param query - The user's message
 * @param documents - Items to score, each with a getText function
 * @param topK - Number of top results to return
 */
export function scoreRelevance<T>(
  query: string,
  documents: { item: T; text: string }[],
  topK: number,
): ScoredItem<T>[] {
  if (documents.length === 0 || !query.trim()) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Build IDF: log(N / df) where df = number of docs containing the term
  const N = documents.length;
  const docFrequency = new Map<string, number>();

  const docTFs = documents.map(doc => {
    const tokens = tokenize(doc.text);
    const tf = termFrequency(tokens);
    // Count unique terms for IDF
    for (const term of tf.keys()) {
      docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
    }
    return { item: doc.item, tf };
  });

  const idf = new Map<string, number>();
  for (const term of queryTokens) {
    const df = docFrequency.get(term) ?? 0;
    // Smoothed IDF to avoid division by zero
    idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
  }

  // Score each document
  const scored: ScoredItem<T>[] = docTFs.map(({ item, tf }) => {
    let score = 0;
    for (const term of queryTokens) {
      const tfVal = tf.get(term) ?? 0;
      const idfVal = idf.get(term) ?? 0;
      score += tfVal * idfVal;
    }
    return { item, score };
  });

  // Sort by score descending and take top K
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter(s => s.score > 0);
}
