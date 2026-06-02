"use client";

import { useState, useTransition } from "react";
import { ingestAttendeeList, type IngestResult } from "@/lib/attendees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COMING_SOON = [
  { name: "Discord export", note: "interaction data" },
  { name: "Session recordings", note: "transcripts" },
  { name: "Photos", note: "face grouping" },
  { name: "Tweet archive", note: "social graph" },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export default function UploadPage() {
  const [result, setResult] = useState<IngestResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => setResult(await ingestAttendeeList(formData)));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Start an afterparty</h1>
      <p className="mt-2 text-muted-foreground">
        Upload your event&apos;s attendee list. Every attendee gets a personal page —
        who was in their room and who they should reach out to.
      </p>

      {/* Source tiles */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-primary bg-primary/5 p-3">
          <div className="text-sm font-medium">Attendee list</div>
          <div className="text-xs text-muted-foreground">CSV or JSON</div>
        </div>
        {COMING_SOON.map((s) => (
          <div
            key={s.name}
            className="rounded-lg border border-dashed p-3 opacity-60"
            aria-disabled
          >
            <div className="flex items-center gap-1 text-sm font-medium">{s.name}</div>
            <div className="text-xs text-muted-foreground">{s.note}</div>
            <Badge variant="secondary" className="mt-1 text-[10px]">
              Coming soon
            </Badge>
          </div>
        ))}
      </div>

      {/* Form */}
      <form action={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="eventName">Event name</Label>
          <Input id="eventName" name="eventName" placeholder="DeveloperWeek 2026" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="file">Attendee list (.csv / .json)</Label>
          <Input id="file" name="file" type="file" accept=".csv,.tsv,.json" required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Processing…" : "Generate afterparty"}
        </Button>
      </form>

      {/* Result */}
      {result && !result.ok && (
        <p className="mt-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">
              Ingested {result.count} attendees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {result.withInterests} have interest tags. Sample pages:
            </p>
            <ul className="space-y-1">
              {result.sample?.map((s) => (
                <li key={s.page_token} className="flex flex-col">
                  <span className="font-medium">
                    {s.name}
                    {s.title ? <span className="text-muted-foreground"> · {s.title}</span> : null}
                  </span>
                  <code className="text-xs text-muted-foreground">
                    {APP_URL}/p/{s.page_token}
                  </code>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
