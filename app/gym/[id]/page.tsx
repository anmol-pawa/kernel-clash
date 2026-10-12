import type { Metadata } from "next";
import { GymBattle } from "@/components/battle/GymBattle";
import { GYMS } from "@/content/gyms";

/** One static page per gym; any other id is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return GYMS.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const gym = GYMS.find((g) => g.id === id);
  return { title: `${gym?.name ?? "Gym"} — Kernel Clash` };
}

export default async function GymPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GymBattle gymId={id} />;
}
