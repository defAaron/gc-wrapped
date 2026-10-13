export type MagicHourProjectStatus = "pending" | "complete" | "failed";

export type MagicHourClient = {
  createVoiceLine(input: { lineId: string; text: string }): Promise<{ projectId: string; credits?: number }>;
  createTextToVideo(input: { lineId: string; prompt: string }): Promise<{ projectId: string; credits?: number }>;
  createTalkingPhoto(input: {
    lineId: string;
    imageUrl: string;
    audioUrl: string;
    endSeconds?: number;
  }): Promise<{ projectId: string; credits?: number }>;
  uploadAsset?(input: {
    bytes: Buffer;
    type: "image" | "audio";
    extension: string;
  }): Promise<{ filePath: string }>;
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

const DEFAULT_HOST_VOICE = "Morgan Freeman";

function hostVoiceName(): string {
  const configured = process.env.MAGIC_HOUR_HOST_VOICE?.trim();
  return configured || DEFAULT_HOST_VOICE;
}

function textToVideoModel(): string {
  const configured = process.env.MAGIC_HOUR_TTV_MODEL?.trim();
  return configured || "ltx-2.5";
}

function textToVideoResolution(): string {
  const configured = process.env.MAGIC_HOUR_TTV_RESOLUTION?.trim();
  return configured || "480p";
}

type MagicHourErrorBody = { code?: string; message?: string };

async function readMagicHourError(response: Response): Promise<MagicHourErrorBody> {
  const text = await response.text();
  try {
    return JSON.parse(text) as MagicHourErrorBody;
  } catch {
    return { message: text.slice(0, 180) };
  }
}

type MagicHourProjectJson = {
  status: string;
  downloads?: { url: string }[];
  error?: string | null;
};

function parseProjectPoll(json: MagicHourProjectJson): {
  status: MagicHourProjectStatus;
  downloadUrl?: string;
  error?: string;
} {
  if (json.status === "complete") {
    const url = json.downloads?.[0]?.url;
    return url ? { status: "complete", downloadUrl: url } : { status: "complete" };
  }
  if (json.status === "failed") return { status: "failed", error: json.error ?? "failed" };
  return { status: "pending" };
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

  async function pollProject(projectId: string): Promise<{
    status: MagicHourProjectStatus;
    downloadUrl?: string;
    error?: string;
  }> {
    const controllers = ["audio-projects", "video-projects"].map(() => new AbortController());
    try {
      return await new Promise((resolve, reject) => {
        let pending = controllers.length;
        const finishMiss = () => {
          pending -= 1;
          if (pending === 0) reject(new MagicHourClipError("poll_not_found"));
        };
        for (const [index, collection] of ["audio-projects", "video-projects"].entries()) {
          const controller = controllers[index];
          if (!controller) continue;
          void fetch(`${base}/${collection}/${projectId}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal,
          })
            .then(async (res) => {
              if (res.status === 404) {
                finishMiss();
                return;
              }
              if (!res.ok) {
                reject(new MagicHourClipError(`poll_${res.status}`));
                return;
              }
              const json = (await res.json()) as MagicHourProjectJson;
              resolve(parseProjectPoll(json));
            })
            .catch((error: unknown) => {
              if (error instanceof Error && error.name === "AbortError") return;
              finishMiss();
            });
        }
      });
    } finally {
      for (const controller of controllers) controller.abort();
    }
  }

  return {
    async createVoiceLine({ lineId, text }) {
      const res = await mhFetch("/ai-voice-generator", {
        name: `kudos-tts-${lineId}`,
        style: {
          prompt: text,
          voice_name: hostVoiceName(),
        },
      });
      if (res.status === 402) {
        const error = await readMagicHourError(res);
        if (error.code === "plan_upgrade_required") {
          throw new MagicHourClipError(`tts_402:${error.message ?? error.code}`);
        }
        throw new InsufficientCreditsError();
      }
      if (!res.ok) {
        const error = await readMagicHourError(res);
        throw new MagicHourClipError(`tts_${res.status}:${error.code ?? "error"}`);
      }
      const json = (await res.json()) as { id: string; credits_charged?: number };
      return json.credits_charged !== undefined
        ? { projectId: json.id, credits: json.credits_charged }
        : { projectId: json.id };
    },
    async createTextToVideo({ lineId, prompt }) {
      const requested = {
        model: textToVideoModel(),
        resolution: textToVideoResolution(),
      };
      const attempts = [
        requested,
        { model: "ltx-2.5", resolution: "480p" },
      ];
      let lastStatus = 0;
      let lastCode = "";
      for (const [index, attempt] of attempts.entries()) {
        if (index > 0 && attempt.model === requested.model && attempt.resolution === requested.resolution) break;
        const res = await mhFetch("/text-to-video", {
          name: `kudos-ttv-${lineId}`,
          end_seconds: 5,
          aspect_ratio: "9:16",
          resolution: attempt.resolution,
          model: attempt.model,
          style: { prompt },
        });
        if (res.ok) {
          const json = (await res.json()) as { id: string; credits_charged?: number };
          return json.credits_charged !== undefined
            ? { projectId: json.id, credits: json.credits_charged }
            : { projectId: json.id };
        }
        const error = await readMagicHourError(res);
        lastStatus = res.status;
        lastCode = error.code ?? "";
        const planLimited = res.status === 402 && error.code === "plan_upgrade_required";
        if (!planLimited) break;
      }
      if (lastStatus === 402 && lastCode !== "plan_upgrade_required") throw new InsufficientCreditsError();
      throw new MagicHourClipError(`ttv_${lastStatus}:${lastCode || "error"}`);
    },
    async uploadAsset({ bytes, type, extension }) {
      const res = await mhFetch("/files/upload-urls", {
        items: [{ type, extension }],
      });
      if (!res.ok) throw new MagicHourClipError(`upload_url_${res.status}`);
      const json = (await res.json()) as { items?: { upload_url: string; file_path: string }[] };
      const item = json.items?.[0];
      if (!item?.upload_url || !item.file_path) throw new MagicHourClipError("upload_url_missing");
      const uploaded = await fetch(item.upload_url, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Uint8Array(bytes),
      });
      if (!uploaded.ok) throw new MagicHourClipError(`upload_put_${uploaded.status}`);
      return { filePath: item.file_path };
    },
    async createTalkingPhoto({ lineId, imageUrl, audioUrl, endSeconds }) {
      const res = await mhFetch("/ai-talking-photo", {
        name: `kudos-talk-${lineId}`,
        start_seconds: 0,
        end_seconds: endSeconds ?? 5,
        assets: { image_file_path: imageUrl, audio_file_path: audioUrl },
        style: { generation_mode: "realistic" },
        max_resolution: 480,
      });
      if (res.status === 402) {
        const error = await readMagicHourError(res);
        if (error.code === "plan_upgrade_required") {
          throw new MagicHourClipError(`talk_402:${error.message ?? error.code}`);
        }
        throw new InsufficientCreditsError();
      }
      if (!res.ok) {
        const error = await readMagicHourError(res);
        throw new MagicHourClipError(`talk_${res.status}:${error.code ?? "error"}`);
      }
      const json = (await res.json()) as { id: string; credits_charged?: number };
      return json.credits_charged !== undefined
        ? { projectId: json.id, credits: json.credits_charged }
        : { projectId: json.id };
    },
    async getProject(projectId) {
      return pollProject(projectId);
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
