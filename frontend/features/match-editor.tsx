"use client";
import { toUtc } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { mutate } from "@/services/api";
import type { Tournament } from "@/types";

export function MatchEditor({
  t,
  onSaved,
}: {
  t: Tournament;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        O‘yin yaratish
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="O‘yin yaratish"
        description={t.name}
      >
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await mutate("/matches", {
                tournament_id: t.id,
                home_id: t.game === "pubg" ? null : Number(f.get("home")),
                away_id: t.game === "pubg" ? null : Number(f.get("away")),
                group_id: f.get("group") ? Number(f.get("group")) : null,
                round: f.get("round"),
                scheduled_at: toUtc(String(f.get("at"))),
              });
              toast.success("O‘yin rejalashtirildi");
              onSaved();
              setOpen(false);
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.game !== "pubg" && (
            <>
              <div className="form-grid">
                {["home", "away"].map((side) => (
                  <label key={side}>
                    {side === "home" ? "1-ishtirokchi (Mezbon)" : "2-ishtirokchi (Mehmon)"}
                    <select name={side} required>
                      <option value="">O‘yinchi / jamoani tanlang</option>
                      {t.participant_list.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <label>
                Guruh
                <select name="group" required={t.format === "groups_playoffs"}>
                  <option value="">Liga / guruhi yo‘q</option>
                  {t.groups.map((g) => (
                    <option value={g.id} key={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            Bosqich / xarita nomi
            <input name="round" required minLength={2} maxLength={64} />
          </label>
          <label>
            Rejalashtirilgan vaqt (Toshkent, UTC+5)
            <input name="at" type="datetime-local" required />
          </label>
          <Button disabled={busy}>{busy ? "Saqlanmoqda…" : "O‘yinni rejalashtirish"}</Button>
        </form>
      </Modal>
    </>
  );
}
