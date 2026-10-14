"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RoastLevel } from "@kudos/shared";
import { RoastDial } from "@/components/roast-dial";
import { SiteShell } from "@/components/site-shell";
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
    <SiteShell>
      <main className="kudos-main">
        <h1 className="kudos-title">Map your group</h1>
        <p className="kudos-lede">Name the chat, set the roast, and decide who gets a kudos.</p>
        <div className="kudos-stack">
          <label>
            <span className="kudos-label">Group title</span>
            <input
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
              className="kudos-field"
            />
          </label>
          <RoastDial value={roastLevel} onChange={setRoastLevel} />
          <ul className="kudos-list">
            {members.map((member) => (
              <li key={member.id} className="kudos-card kudos-member">
                <div className="kudos-member-row">
                  <span className="kudos-avatar" aria-hidden="true">
                    <span>{initials(member.displayName)}</span>
                  </span>
                  <input
                    value={member.displayName}
                    onChange={(event) =>
                      setMembers((current) =>
                        current.map((row) =>
                          row.id === member.id ? { ...row, displayName: event.target.value } : row,
                        ),
                      )
                    }
                    className="kudos-field"
                    aria-label={`Display name for ${member.displayName}`}
                  />
                  <span className="kudos-meta">{member.messageCount} msgs</span>
                </div>
                <div className="kudos-inline">
                  <label className="kudos-text-link">
                    {member.hasAvatar ? "Photo added" : "Add photo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="sr-only"
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
                <label className="kudos-check">
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
                <label className="kudos-check">
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
          <label className="kudos-check">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>
              I am 16 or older. I confirm I have permission to upload this chat and share awards about these people, or
              I have removed members who haven&apos;t agreed. I understand Kudos AI will process message text with AI
              (Jev) and a video provider (Magic Hour).
            </span>
          </label>
          <p className="kudos-note">Quotes stay off the public link unless you turn them on from the awards page.</p>
          <button
            type="button"
            disabled={!consent || activeCount < 2}
            onClick={() => void saveAndContinue()}
            className="kudos-btn kudos-btn-primary kudos-fit"
          >
            Continue to awards
          </button>
          {activeCount < 2 ? <p className="kudos-warn">Keep at least two members in the awards.</p> : null}
          {error ? <p className="kudos-error">{error}</p> : null}
        </div>
      </main>
    </SiteShell>
  );
}
