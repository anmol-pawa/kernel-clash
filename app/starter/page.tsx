import type { Metadata } from "next";
import { StarterChoice } from "@/components/world/StarterChoice";

export const metadata: Metadata = { title: "Choose a partner — Kernel Clash" };

export default function StarterPage() {
  return <StarterChoice />;
}
