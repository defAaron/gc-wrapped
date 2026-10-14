"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { uploadJson } from "@/lib/api";

function isJsonFile(file: File) {
  return file.type === "application/json" || file.name.toLowerCase().endsWith(".json");
}

export default function UploadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    setError(null);
    setWarning(null);
    if (!isJsonFile(file)) {
      setError("Please upload a .json file.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setWarning("This file is over 25 MB. The server allows up to 50 MB.");
    }
    setUploading(true);
    try {
      await uploadJson(id, file);
      router.push(`/session/${id}/setup`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setUploading(false);
    }
  }

  function onDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!uploading) setDragging(true);
  }

  function onDragLeave(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (uploading) return;
    const file = event.dataTransfer.files[0];
    if (!file) return;
    void onFile(file);
  }

  return (
    <SiteShell>
      <main className="kudos-main">
        <h1 className="kudos-title">Upload your chat JSON</h1>
        <p className="kudos-lede">
          One <span className="kudos-inline-code">.json</span> file. We delete the raw file after analysis.
        </p>
        <div
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-disabled={uploading}
          aria-label="Upload JSON file"
          onKeyDown={(event) => {
            if (uploading) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onClick={() => {
            if (!uploading) inputRef.current?.click();
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`kudos-drop ${uploading ? "is-busy" : ""} ${dragging ? "is-dragging" : ""}`}
        >
          <span className="kudos-drop-mark" aria-hidden="true">
            ✦
          </span>
          <p className="kudos-drop-title">
            {uploading ? "Uploading…" : dragging ? "Drop your file here" : "Drag and drop your JSON here"}
          </p>
          <p className="kudos-note">{uploading ? "Please wait" : "or click to choose a file"}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
            event.target.value = "";
          }}
        />
        {warning ? <p className="kudos-warn kudos-spaced">{warning}</p> : null}
        {error ? <p className="kudos-error kudos-spaced">{error}</p> : null}
      </main>
    </SiteShell>
  );
}
