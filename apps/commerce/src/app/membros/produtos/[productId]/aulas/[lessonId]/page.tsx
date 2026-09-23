import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/session";
import { userHasProductAccess } from "@/lib/entitlements";
import { getBunnyEmbedUrl } from "@/lib/storage";
import { MarkCompleteButton } from "./MarkCompleteButton";

type Props = {
  params: Promise<{ productId: string; lessonId: string }>;
};

export default async function LessonPage({ params }: Props) {
  const session = await requireBuyer();
  const { productId, lessonId } = await params;

  const hasAccess = await userHasProductAccess(session.user.id, productId);
  if (!hasAccess) notFound();

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: true },
  });
  if (!lesson || lesson.module.productId !== productId) notFound();

  const progress = await prisma.lessonProgress.findUnique({
    where: {
      userId_lessonId: { userId: session.user.id, lessonId: lesson.id },
    },
  });

  const embedUrl = lesson.bunnyVideoId ? getBunnyEmbedUrl(lesson.bunnyVideoId) : null;

  return (
    <div className="stack">
      <div className="text-[var(--text-sm)]">
        <Link href={`/membros/produtos/${productId}`} className="text-[var(--muted)]">
          ← Voltar ao produto
        </Link>
      </div>
      <PageHeader title={lesson.title} description={lesson.module.title} />

      {embedUrl ? (
        <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--color-void)]">
          <iframe
            src={embedUrl}
            title={lesson.title}
            className="h-full w-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}

      {lesson.content ? (
        <Panel>
          <div className="whitespace-pre-wrap text-[var(--ink-soft)]">{lesson.content}</div>
        </Panel>
      ) : null}

      <MarkCompleteButton
        lessonId={lesson.id}
        initiallyCompleted={Boolean(progress?.completedAt)}
      />
    </div>
  );
}
