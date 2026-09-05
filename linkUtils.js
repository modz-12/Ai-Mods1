function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || null;
    }
  } catch {}
  return null;
}

function vimeoId(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('vimeo.com')) return null;
    const match = u.pathname.match(/\/(?:video\/)?(\d+)/);
    return match ? match[1] : null;
  } catch {}
  return null;
}

function isDirectMedia(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (/\.(jpe?g|png|gif|webp|avif|svg)$/.test(path)) return 'image';
    if (/\.(mp4|webm|ogg|mov|m4v)$/.test(path)) return 'video';
  } catch {}
  return null;
}

function resolveLink(url, requestedType = 'auto') {
  const direct = isDirectMedia(url);
  const yt = youtubeId(url);
  const vm = vimeoId(url);

  if (yt && (requestedType === 'auto' || requestedType === 'video')) {
    return {
      type: 'video',
      source: 'youtube',
      src: url,
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(yt)}`,
      thumbnail: `https://img.youtube.com/vi/${encodeURIComponent(yt)}/hqdefault.jpg`,
    };
  }

  if (vm && (requestedType === 'auto' || requestedType === 'video')) {
    return {
      type: 'video',
      source: 'vimeo',
      src: url,
      embedUrl: `https://player.vimeo.com/video/${encodeURIComponent(vm)}`,
      thumbnail: null,
    };
  }

  if (direct && (requestedType === 'auto' || requestedType === direct)) {
    return {
      type: direct,
      source: 'direct',
      src: url,
      embedUrl: null,
      thumbnail: direct === 'image' ? url : null,
    };
  }

  return null;
}

module.exports = { resolveLink };
