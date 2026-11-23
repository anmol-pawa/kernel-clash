import type { Metadata } from "next";
import { ConcLab } from "@/components/world/ConcLab";

export const metadata: Metadata = { title: "Concurrency Lab — Kernel Clash" };

export default function ConcLabPage() {
  return <ConcLab />;
}
