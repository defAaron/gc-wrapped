"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RoastLevel } from "@kudos/shared";
import { RoastDial } from "@/components/roast-dial";
import { SiteHeader } from "@/components/site-header";
import { getSession, patchSession, uploadMemberAvatar, type SessionMember } from "@/lib/api";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}

export default function SetupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [roastLevel, setRoastLevel] = useState<RoastLevel>("medium");
  const [groupTitle, setGroupTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [mergePick, setMergePick] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSession(id).then((session) => {
      setMembers(session.members);
      setRoastLevel(session.roastLevel as RoastLevel);
      setGroupTitle(session.groupTitle ?? "");
    });
  }, [id]);

  const activeCount = useMemo(() => members.filter((member) => !member.excluded).length, [members]);

  async function saveAndContinue() {
    setError(null);
    try {
      const merge = mergePick.length === 2 ? [mergePick] : undefined;
      await patchSession(id, {
        roastLevel,
        groupTitle,
        consent: consent ? true : undefined,
        members: members.map((member) => ({
          id: member.id,
          displayName: member.displayName,
          excluded: member.excluded,
        })),
        merge,
      });
      router.push(`/session/${id}/preview`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save setup.");
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Map your group</h1>
        <div className="mt-6 space-y-6">
          <label className="block">
            <span className="text-sm font-medium">Group title</span>
            <input
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
            />
          </label>
          <RoastDial value={roastLevel} onChange={setRoastLevel} />
          <ul className="space-y-3">
            {members.map((member) => (
              <li key={member.id} className="rounded-xl border border-stone-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <input
                    value={member.displayName}
                    onChange={(event) =>
                      setMembers((current) =>
                        current.map((row) =>
                          row.id === member.id ? { ...row, displayName: event.target.value } : row,
                        ),
                      )
                    }
                    className="flex-1 rounded-lg border border-stone-200 px-2 py-1"
                  />
                  <span className="text-xs text-stone-500">{member.messageCount} msgs</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700">
                    {initials(member.displayName)}
                  </span>
                  <label className="cursor-pointer text-stone-600 underline">
                    {member.hasAvatar ? "Photo added" : "Add photo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void uploadMemberAvatar(id, member.id, file)
                          .then(() => {
                            setError(null);
                            setMembers((current) =>
                              current.map((row) => (row.id === member.id ? { ...row, hasAvatar: true } : row)),
                            );
                          })
                          .catch((caught: unknown) =>
                            setError(caught instanceof Error ? caught.message : "Could not upload photo."),
                          );
                      }}
                    />
                  </label>
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={member.excluded}
                    onChange={(event) =>
                      setMembers((current) =>
                        current.map((row) =>
                          row.id === member.id ? { ...row, excluded: event.target.checked } : row,
                        ),
                      )
                    }
                  />
                  Remove from awards
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={mergePick.includes(member.id)}
                    onChange={(event) => {
                      setMergePick((current) => {
                        if (!event.target.checked) return current.filter((value) => value !== member.id);
                        const next = [...current, member.id];
                        return next.slice(-2);
                      });
                    }}
                  />
                  Select to merge (pick two)
                </label>
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>
              I am 16 or older. I confirm I have permission to upload this chat and share awards about these people, or
              I have removed members who haven&apos;t agreed. I understand Kudos AI will process message text with AI
              (Jev) and a video provider (Magic Hour).
            </span>
          </label>
          <p className="text-xs text-stone-500">
            Quotes stay off the public link unless you turn them on from the awards page.
          </p>
          <button
            type="button"
            disabled={!consent || activeCount < 2}
            onClick={() => void saveAndContinue()}
            className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Continue to awards
          </button>
          {activeCount < 2 ? <p className="text-sm text-amber-700">Keep at least two members in the awards.</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
      </main>
    </div>
  );
}
