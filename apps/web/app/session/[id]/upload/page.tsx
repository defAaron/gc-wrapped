"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";
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
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Upload your chat JSON</h1>
        <p className="mt-2 text-stone-600">One `.json` file. We delete the raw file after analysis.</p>
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
          className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
            uploading
              ? "cursor-not-allowed border-stone-200 bg-stone-50 opacity-70"
              : dragging
                ? "border-stone-900 bg-stone-100"
                : "border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-50"
          }`}
        >
          <p className="text-sm font-medium text-stone-800">
            {uploading ? "Uploading…" : dragging ? "Drop your file here" : "Drag and drop your JSON here"}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {uploading ? "Please wait" : "or click to choose a file"}
          </p>
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
        {warning ? <p className="mt-3 text-sm text-amber-700">{warning}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </main>
    </div>
  );
}
