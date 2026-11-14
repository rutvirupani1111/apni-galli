"use client";
import { useEffect, useState } from "react";

export default function Report() {
  const [lane, setLane] = useState("");
  useEffect(() => setLane(new URLSearchParams(location.search).get("lane") ?? ""), []);
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <a href={lane ? `/w/${lane}` : "/"} className="mono underline">
        Wapas
      </a>
      <h1 className="mast t-mast mt-4">Report a lane</h1>
      {state === "done" ? (
        <p className="mt-4" role="status">
          Report mil gaya. A person reads every report. Impersonation and scams get the lane suspended.
        </p>
      ) : (
        <form
          className="mt-4 grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setState("busy");
            const r = await fetch("/api/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lane: f.get("lane"), reason: f.get("reason"), detail: f.get("detail") || undefined, website: f.get("website") || "" }) }).catch(() => null);
            if (r?.ok) setState("done");
            else {
              setState("err");
              setMsg((await r?.json().catch(() => ({})))?.error ?? "Nahi hua");
            }
          }}
        >
          <label className="text-sm">
            Lane handle <input name="lane" value={lane} onChange={(e) => setLane(e.target.value)} required className="input" />
          </label>
          <label className="text-sm">
            Why
            <select name="reason" className="input">
              <option value="impersonation">Pretending to be someone else</option>
              <option value="scam">Scam or fake payment</option>
              <option value="abuse">Abusive content</option>
              <option value="other">Something else</option>
            </select>
          </label>
          <label className="text-sm">
            Details <textarea name="detail" className="input" rows={4} maxLength={1000} />
          </label>
          <input name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px]" aria-hidden="true" />
          {state === "err" && <p className="err">{msg}</p>}
          <button className="cta" disabled={state === "busy"}>
            Report bhejo
          </button>
        </form>
      )}
    </main>
  );
}
