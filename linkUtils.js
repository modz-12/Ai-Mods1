const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;

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
 * يحلل رابط ويرجع بيانات العرض المناسبة
 * override: 'auto' | 'image' | 'video'
 */
function resolveLink(url, override = 'auto') {
  const ytId = parseYouTube(url);
  if (ytId && override !== 'image') {
    return {
      type: 'video',
      source: 'embed',
      src: url,
      embedUrl: `https://www.youtube.com/embed/${ytId}`,
      thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    };
  }

  const vimeoId = parseVimeo(url);
  if (vimeoId && override !== 'image') {
    return {
      type: 'video',
      source: 'embed',
      src: url,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      thumbnail: null,
    };
  }

  if (override === 'image' || (override === 'auto' && IMAGE_EXT.test(url))) {
    return { type: 'image', source: 'direct', src: url, embedUrl: null, thumbnail: url };
  }

  if (override === 'video' || (override === 'auto' && VIDEO_EXT.test(url))) {
    return { type: 'video', source: 'direct', src: url, embedUrl: null, thumbnail: null };
  }

  // مش عارفين نوعه بالظبط: لو المستخدم مختار نوع يدوي نمشي بيه كرابط مباشر
  if (override === 'video') {
    return { type: 'video', source: 'direct', src: url, embedUrl: null, thumbnail: null };
  }
  if (override === 'image') {
    return { type: 'image', source: 'direct', src: url, embedUrl: null, thumbnail: url };
  }

  return null; // فشل التحديد التلقائي
}

module.exports = { resolveLink };
