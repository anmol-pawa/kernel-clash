import type { Metadata } from "next";
import { SchedLab } from "@/components/world/SchedLab";

export const metadata: Metadata = { title: "Scheduler Lab — Kernel Clash" };

export default function SchedLabPage() {
  return <SchedLab />;
}
