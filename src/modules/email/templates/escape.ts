export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const escapeHtmlAttr = (value: string): string => escapeHtml(value);

export const formatTtlDescription = (ttlSeconds: number): string => {
  if (ttlSeconds < 60) {
    return ttlSeconds === 1 ? '1 second' : `${ttlSeconds} seconds`;
  }
  if (ttlSeconds < 3_600) {
    const minutes = Math.round(ttlSeconds / 60);
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  if (ttlSeconds < 86_400) {
    const hours = Math.round(ttlSeconds / 3_600);
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  const days = Math.round(ttlSeconds / 86_400);
  return days === 1 ? '1 day' : `${days} days`;
};
