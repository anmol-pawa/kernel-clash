import type { Metadata } from "next";
import { VmLab } from "@/components/world/VmLab";

export const metadata: Metadata = { title: "Address Translation Lab — Kernel Clash" };

export default function VmLabPage() {
  return <VmLab />;
}
