import type { Metadata } from "next";
import { DemoBattle } from "@/components/battle/DemoBattle";

export const metadata: Metadata = { title: "Battle — Kernel Clash" };

export default function BattlePage() {
  return <DemoBattle />;
}
