"use client";

import type { RoastLevel } from "@kudos/shared";

const LEVELS: { id: RoastLevel; label: string; hint: string }[] = [
  { id: "gentle", label: "Gentle", hint: "Soft tease" },
  { id: "medium", label: "Medium", hint: "Default roast" },
  { id: "spicy", label: "Spicy", hint: "Edgier, still kind" },
];

export function RoastDial({
  value,
  onChange,
}: {
  value: RoastLevel;
  onChange: (level: RoastLevel) => void;
}) {
  return (
    <div>
      <p className="kudos-label">Roast level</p>
      <div className="kudos-choice-grid">
        {LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            onClick={() => onChange(level.id)}
            className={`kudos-choice ${value === level.id ? "is-selected" : ""}`}
            aria-pressed={value === level.id}
          >
            <span className="kudos-choice-label">{level.label}</span>
            <span className="kudos-choice-hint">{level.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
