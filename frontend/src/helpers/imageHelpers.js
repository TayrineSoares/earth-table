// Ask the image host for a smaller file so cards do not download the original.
export function sizedImageUrl(url, width) {
  if (!url) return url;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('unsplash.com')) {
      parsed.searchParams.set('w', String(width));
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      return parsed.toString();
    }

    if (parsed.pathname.includes('/storage/v1/object/public/')) {
      parsed.pathname = parsed.pathname.replace(
        '/storage/v1/object/public/',
        '/storage/v1/render/image/public/'
      );
      parsed.searchParams.set('width', String(width));
      parsed.searchParams.set('quality', '70');
      return parsed.toString();
    }
  } catch {
    return url;
  }

  return url;
}
