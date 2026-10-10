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
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-stone-700">Roast level</p>
      <div className="grid grid-cols-3 gap-2">
        {LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            onClick={() => onChange(level.id)}
            className={`rounded-xl border px-3 py-2 text-left ${
              value === level.id ? "border-stone-900 bg-white" : "border-stone-200 bg-stone-50"
            }`}
          >
            <span className="block text-sm font-semibold">{level.label}</span>
            <span className="block text-xs text-stone-500">{level.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
