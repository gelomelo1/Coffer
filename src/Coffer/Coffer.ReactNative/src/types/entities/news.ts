/** A news card: no content (the post page loads it). Dates are ISO strings (UTC). */
export interface NewsCard {
  id: string;
  title: string;
  heroImage: string | null;
  publishedAt: string;
  editedAt: string | null;
}

export interface NewsPost extends NewsCard {
  /** Markdown; images are "coffer-image:{name}", app links "coffer://…". */
  content: string;
}
