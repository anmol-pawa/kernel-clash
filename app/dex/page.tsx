import type { Metadata } from "next";
import { Kerneldex } from "@/components/world/Kerneldex";

export const metadata: Metadata = { title: "Kerneldex — Kernel Clash" };

export default function DexPage() {
  return <Kerneldex />;
}
