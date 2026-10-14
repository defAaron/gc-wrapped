type CeremonyPlayerProps = {
  src: string;
  downloadFileName?: string;
  fallbackUsed?: boolean;
};

export function CeremonyPlayer({ src, downloadFileName = "kudos-ceremony.mp4", fallbackUsed }: CeremonyPlayerProps) {
  return (
    <div className="kudos-stack">
      {fallbackUsed ? <p className="kudos-warn">The stage lights glitched—we still have your kudos.</p> : null}
      <video controls playsInline className="kudos-video" src={src} />
      <a className="kudos-btn kudos-btn-secondary kudos-fit" href={src} download={downloadFileName}>
        Download MP4
      </a>
    </div>
  );
}
