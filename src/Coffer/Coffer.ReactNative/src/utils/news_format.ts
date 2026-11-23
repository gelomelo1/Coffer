export type NewsDateLabels = {
  today: string;
  yesterday: string;
  daysAgo: (days: number) => string;
  date: (date: Date) => string;
};

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** A post's date by calendar day: today, yesterday, "N days ago" within a week, then the date itself. */
export function newsDate(publishedAt: string, editedAt: string | null | undefined, now: Date, labels: NewsDateLabels) {
  const published = new Date(publishedAt);
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(published)) / DAY));
  const date = days === 0 ? labels.today : days === 1 ? labels.yesterday : days < 7 ? labels.daysAgo(days) : labels.date(published);
  return { date, edited: !!editedAt };
}

export function newsImageUrl(base: string, name: string) {
  return `${base.replace(/\/+$/, "")}/api/News/Image/${name}`;
}
