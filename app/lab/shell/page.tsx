import type { Metadata } from "next";
import { ShellLab } from "@/components/world/ShellLab";

export const metadata: Metadata = { title: "Shell and Process Lab — Kernel Clash" };

export default function ShellLabPage() {
  return <ShellLab />;
}
