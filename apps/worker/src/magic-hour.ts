export type MagicHourProjectStatus = "pending" | "complete" | "failed";

export type MagicHourClient = {
  createVoiceLine(input: { lineId: string; text: string }): Promise<{ projectId: string; credits?: number }>;
  createTextToVideo(input: { lineId: string; prompt: string }): Promise<{ projectId: string; credits?: number }>;
  createTalkingPhoto(input: {
    lineId: string;
    imageUrl: string;
    audioUrl: string;
  }): Promise<{ projectId: string; credits?: number }>;
  getProject(projectId: string): Promise<{ status: MagicHourProjectStatus; downloadUrl?: string; error?: string }>;
};

export class InsufficientCreditsError extends Error {
  constructor() {
    super("insufficient_credits");
    this.name = "InsufficientCreditsError";
  }
}

export class MagicHourClipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MagicHourClipError";
  }
}

export function createMagicHourClient(): MagicHourClient {
  const apiKey = process.env.MAGIC_HOUR_API_KEY;
  if (!apiKey) {
    throw new Error("MAGIC_HOUR_NOT_CONFIGURED");
  }
  const base = "https://api.magichour.ai/v1";

  async function mhFetch(path: string, body: unknown): Promise<Response> {
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  return {
    async createVoiceLine({ lineId, text }) {
      const res = await mhFetch("/ai-voice-generator", {
        name: `kudos-tts-${lineId}`,
        text,
      });
      if (res.status === 402) throw new InsufficientCreditsError();
      if (!res.ok) throw new MagicHourClipError(`tts_${res.status}`);
      const json = (await res.json()) as { id: string; credits_charged?: number };
      return json.credits_charged !== undefined
        ? { projectId: json.id, credits: json.credits_charged }
        : { projectId: json.id };
    },
    async createTextToVideo({ lineId, prompt }) {
      const res = await mhFetch("/text-to-video", {
        name: `kudos-ttv-${lineId}`,
        prompt,
        aspect_ratio: "9:16",
        end_seconds: 6,
        resolution: "720p",
      });
      if (res.status === 402) throw new InsufficientCreditsError();
      if (!res.ok) throw new MagicHourClipError(`ttv_${res.status}`);
      const json = (await res.json()) as { id: string; credits_charged?: number };
      return json.credits_charged !== undefined
        ? { projectId: json.id, credits: json.credits_charged }
        : { projectId: json.id };
    },
    async createTalkingPhoto({ lineId, imageUrl, audioUrl }) {
      const res = await mhFetch("/ai-talking-photo", {
        name: `kudos-talk-${lineId}`,
        start_seconds: 0,
        end_seconds: 5,
        assets: { image_file_path: imageUrl, audio_file_path: audioUrl },
        style: { generation_mode: "realistic" },
        max_resolution: 720,
      });
      if (res.status === 402) throw new InsufficientCreditsError();
      if (!res.ok) throw new MagicHourClipError(`talk_${res.status}`);
      const json = (await res.json()) as { id: string; credits_charged?: number };
      return json.credits_charged !== undefined
        ? { projectId: json.id, credits: json.credits_charged }
        : { projectId: json.id };
    },
    async getProject(projectId) {
      const res = await fetch(`${base}/video-projects/${projectId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new MagicHourClipError(`poll_${res.status}`);
      const json = (await res.json()) as {
        status: string;
        downloads?: { url: string }[];
        error?: string;
      };
      if (json.status === "complete") {
        const url = json.downloads?.[0]?.url;
        return url ? { status: "complete", downloadUrl: url } : { status: "complete" };
      }
      if (json.status === "failed") return { status: "failed", error: json.error ?? "failed" };
      return { status: "pending" };
    },
  };
}

/** Always fails — drives slideshow fallback in tests. */
export function createFailingMagicHourClient(): MagicHourClient {
  return {
    async createVoiceLine() {
      throw new InsufficientCreditsError();
    },
    async createTextToVideo() {
      throw new InsufficientCreditsError();
    },
    async createTalkingPhoto() {
      throw new InsufficientCreditsError();
    },
    async getProject() {
      return { status: "failed", error: "fake" };
    },
  };
}
