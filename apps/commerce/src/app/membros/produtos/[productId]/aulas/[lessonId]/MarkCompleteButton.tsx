"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function MarkCompleteButton({
  lessonId,
  initiallyCompleted,
}: {
  lessonId: string;
  initiallyCompleted: boolean;
}) {
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function markComplete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/members/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, completed: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Erro ao salvar progresso");
      setCompleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack-sm">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {completed ? (
        <Alert tone="success">Aula concluída</Alert>
      ) : (
        <Button disabled={loading} onClick={markComplete}>
          {loading ? "Salvando…" : "Marcar como concluída"}
        </Button>
      )}
    </div>
  );
}
