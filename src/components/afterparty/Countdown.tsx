"use client";

import { useEffect, useState } from "react";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  const d = Math.floor(ms / 86400_000);
  const h = Math.floor((ms % 86400_000) / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { d, h, m, s, done: ms === 0 };
}

const Unit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <span className="text-2xl font-bold tabular-nums sm:text-3xl">{String(value).padStart(2, "0")}</span>
    <span className="text-[10px] uppercase tracking-widest text-white/60">{label}</span>
  </div>
);

export function Countdown({ dissolvesAt }: { dissolvesAt: string }) {
  const target = new Date(dissolvesAt).getTime();
  const [t, setT] = useState(() => diff(target));

  useEffect(() => {
    const id = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-widest text-white/60">
        This afterparty dissolves in
      </p>
      <div className="mt-3 flex items-center justify-center gap-4">
        <Unit value={t.d} label="days" />
        <span className="text-2xl text-white/30">:</span>
        <Unit value={t.h} label="hrs" />
        <span className="text-2xl text-white/30">:</span>
        <Unit value={t.m} label="min" />
        <span className="text-2xl text-white/30">:</span>
        <Unit value={t.s} label="sec" />
      </div>
      <p className="mt-3 text-xs text-white/50">
        Then it&apos;s gone for good — your data isn&apos;t kept a day longer than the memory.
      </p>
    </div>
  );
}
