import type { Metadata } from "next";
import { TrainerBattle } from "@/components/battle/TrainerBattle";
import { GYMS } from "@/content/gyms";

/** One static trainer battle page per gym that has a trainer; any other id is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return GYMS.filter((g) => g.trainer).map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const gym = GYMS.find((g) => g.id === id);
  return { title: `${gym?.trainer?.name ?? "Trainer"} — ${gym?.name ?? "Gym"} — Kernel Clash` };
}

export default async function TrainerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrainerBattle gymId={id} />;
}
