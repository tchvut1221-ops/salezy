"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Analysis, AnalysisStatus } from "@/types";

const STEPS: { key: AnalysisStatus; label: string }[] = [
  { key: "uploaded", label: "הועלה" },
  { key: "transcribing", label: "מתמלל" },
  { key: "analyzing", label: "מנתח" },
  { key: "completed", label: "מוכן" },
];

function stepIndex(status: AnalysisStatus): number {
  const i = STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

export function AnalysisView({ initial }: { initial: Analysis }) {
  const [analysis, setAnalysis] = useState<Analysis>(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`analysis-${initial.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "analyses",
          filter: `id=eq.${initial.id}`,
        },
        (payload) => setAnalysis(payload.new as Analysis)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initial.id]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">{analysis.file_name}</h1>

      {analysis.status === "failed" ? (
        <p className="mt-6 rounded-lg bg-red-950 p-4 text-sm text-red-300">
          הניתוח נכשל. נסה להעלות את הקובץ שוב.
        </p>
      ) : analysis.status === "completed" && analysis.result ? (
        <Result result={analysis.result} />
      ) : (
        <Progress status={analysis.status} />
      )}
    </div>
  );
}

function Progress({ status }: { status: AnalysisStatus }) {
  const current = stepIndex(status);
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex flex-1 flex-col items-center">
            <div
              className={`h-2 w-full rounded-full ${
                i <= current ? "bg-emerald-500" : "bg-zinc-800"
              }`}
            />
            <span
              className={`mt-2 text-xs ${
                i <= current ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 animate-pulse text-center text-sm text-zinc-400">
        מעבד את השיחה... אפשר להישאר בדף, הוא יתעדכן אוטומטית.
      </p>
    </div>
  );
}

function Result({ result }: { result: NonNullable<Analysis["result"]> }) {
  return (
    <div className="mt-8 space-y-5">
      <Card title="סוג אישיות הלקוח">
        <p className="text-emerald-400">{result.customerPersonality.type}</p>
        <p className="mt-1 text-sm text-zinc-300">
          {result.customerPersonality.explanation}
        </p>
      </Card>

      <Card title="ביצועי איש המכירות">
        <List label="מה עבד" items={result.salespersonPerformance.whatWorked} />
        <List label="מה פספס" items={result.salespersonPerformance.whatDidnt} />
        <List label="טיפים" items={result.salespersonPerformance.tips} />
      </Card>

      <Card title="צרכי הלקוח">
        <List label="גלוי" items={result.customerNeeds.explicit} />
        <List label="סמוי" items={result.customerNeeds.implicit} />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-zinc-200">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
