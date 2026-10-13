"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createSession } from "@/lib/api";

const reactions = [
  { emoji: "👏", className: "reaction reaction-one" },
  { emoji: "✨", className: "reaction reaction-two" },
  { emoji: "💜", className: "reaction reaction-three" },
  { emoji: "🙌", className: "reaction reaction-four" },
  { emoji: "🌈", className: "reaction reaction-five" },
  { emoji: "⭐", className: "reaction reaction-six" },
  { emoji: "🎉", className: "reaction reaction-seven" },
  { emoji: "😊", className: "reaction reaction-eight" },
];

const letters = "Kudos".split("");

export function KudosLanding({ fontClassName }: { fontClassName: string }) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5, active: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePointerMove = (event: PointerEvent<HTMLHeadingElement>) => {
    const bounds = headingRef.current?.getBoundingClientRect();
    if (!bounds) return;

    setPointer({
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
      active: true,
    });
  };

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const { sessionId } = await createSession();
      router.push(`/session/${sessionId}/upload`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start a session.");
      setLoading(false);
    }
  }

  return (
    <main className={`kudos-landing ${fontClassName}`}>
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <div className="reaction-field" aria-hidden="true">
        {reactions.map(({ emoji, className }) => (
          <div className={className} key={emoji}>
            <span>{emoji}</span>
          </div>
        ))}
      </div>

      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="Kudos AI home">
          <span className="brand-mark">
            <span>✦</span>
          </span>
          <span>Kudos AI</span>
        </Link>
      </nav>

      <section className="hero">
        <h1
          ref={headingRef}
          className={`hero-heading ${pointer.active ? "is-active" : ""}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setPointer({ x: 0.5, y: 0.5, active: false })}
          style={
            {
              "--pointer-x": pointer.x,
              "--pointer-y": pointer.y,
            } as CSSProperties
          }
        >
          <span className="heading-line">
            Give a little{" "}
            <span className="heading-spark" aria-hidden="true">
              ✦
            </span>
          </span>
          <span className="interactive-word">
            <span className="sr-only">Kudos</span>
            {letters.map((letter, index) => {
              const letterPosition = (index + 0.5) / letters.length;
              const proximity = Math.max(0, 1 - Math.abs(pointer.x - letterPosition) * 3.4);
              const lift = pointer.active ? proximity * -18 : 0;
              const twist = pointer.active ? (pointer.y - 0.5) * proximity * 14 : 0;

              return (
                <span
                  className="reactive-letter"
                  key={`${letter}-${index}`}
                  style={{
                    transform: `translateY(${lift}px) rotate(${twist}deg)`,
                  }}
                  aria-hidden="true"
                >
                  {letter}
                </span>
              );
            })}
          </span>
          <span className="heading-line">Get a lot back.</span>
        </h1>

        <p className="hero-copy">
          Turn everyday wins into meaningful moments. Kudos AI helps your team celebrate the good
          stuff—thoughtfully, instantly, and together.
        </p>

        <div className="hero-actions" id="get-started">
          <button className="primary-button" type="button" onClick={start} disabled={loading}>
            {loading ? "Starting…" : "Start spreading joy"}
            <span className="button-icon" aria-hidden="true">
              ↗
            </span>
          </button>
          <Link className="secondary-button" href="/export">
            <span className="play-icon" aria-hidden="true">
              ▶
            </span>
            See how it works
          </Link>
        </div>
        {error ? <p className="hero-error">{error}</p> : null}
      </section>

      <footer className="mini-footer">
        <span>Powered by the Magic Hour API</span>
      </footer>
    </main>
  );
}
