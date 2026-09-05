const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i;

function parseYouTube(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function parseVimeo(url) {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/**
 * يحلل رابط فيديو خارجي ويرجع بيانات التضمين المناسبة، أو null لو مش عارف يتعرف عليه
 */
export function resolveVideoLink(url) {
  const ytId = parseYouTube(url);
  if (ytId) {
    return {
      source: 'embed',
      embedUrl: `https://www.youtube.com/embed/${ytId}`,
      thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    };
  }
  const vimeoId = parseVimeo(url);
  if (vimeoId) {
    return {
      source: 'embed',
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      thumbnail: null,
    };
  }
  if (VIDEO_EXT.test(url)) {
    return { source: 'direct', embedUrl: null, thumbnail: null };
  }
  return null;
}

export function isImageUrl(url) {
  return IMAGE_EXT.test(url);
}
