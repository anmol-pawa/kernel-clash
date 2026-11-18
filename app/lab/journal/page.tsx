import type { Metadata } from "next";
import { JournalLab } from "@/components/world/JournalLab";

export const metadata: Metadata = { title: "Journaling Lab — Kernel Clash" };

export default function JournalLabPage() {
  return <JournalLab />;
}
