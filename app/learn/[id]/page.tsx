import type { Metadata } from "next";
import { LessonHall } from "@/components/lesson/LessonHall";
import { GYMS } from "@/content/gyms";
import { lessonsOf } from "@/content/lessons";

/** One static lecture hall per gym that has lessons; any other id is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return GYMS.filter((g) => lessonsOf(g.id).length > 0).map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const gym = GYMS.find((g) => g.id === id);
  return { title: `${gym?.chapter ?? "Lessons"} lessons — Kernel Clash` };
}

export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LessonHall gymId={id} />;
}
