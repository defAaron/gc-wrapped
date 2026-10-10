type CeremonyPlayerProps = {
  src: string;
  downloadFileName?: string;
  fallbackUsed?: boolean;
};

export function CeremonyPlayer({ src, downloadFileName = "kudos-ceremony.mp4", fallbackUsed }: CeremonyPlayerProps) {
  return (
    <div className="space-y-4">
      {fallbackUsed ? (
        <p className="text-sm text-amber-800">The stage lights glitched—we still have your kudos.</p>
      ) : null}
      <video
        controls
        playsInline
        className="mx-auto aspect-[9/16] w-full max-w-sm rounded-2xl bg-stone-900"
        src={src}
      />
      <a
        href={src}
        download={downloadFileName}
        className="inline-block rounded-full border border-stone-300 px-4 py-2 text-sm"
      >
        Download MP4
      </a>
    </div>
  );
}
