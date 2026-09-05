export default function VideoPlayer({ video }) {
  if (!video) return null;

  if (video.videoType === 'embed' && video.embedUrl) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
        <iframe
          src={video.embedUrl}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <video
      src={video.videoUrl}
      controls
      autoPlay
      className="max-h-[80vh] w-full rounded-md bg-black"
    />
  );
}
