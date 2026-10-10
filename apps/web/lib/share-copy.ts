export function suggestedShareCopy(funniestDisplayName: string | null, sharePath: string): string {
  const name = funniestDisplayName?.trim() || "the funniest";
  return `We ran our group chat through Kudos AI. I'm allegedly ${name}. Your turn: ${sharePath}`;
}

export function formatCeremonyStage(stage: string | null): string {
  switch (stage) {
    case "pending":
      return "Queued";
    case "tts_batch":
      return "Recording voiceovers";
    case "mh_clips_running":
      return "Filming winner moments";
    case "concatenating":
      return "Stitching the show";
    case "uploading":
      return "Saving your video";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    default:
      return stage ?? "Starting";
  }
}
