import type { Metadata } from "next";
import { AllocLab } from "@/components/world/AllocLab";

export const metadata: Metadata = { title: "Allocator Lab — Kernel Clash" };

export default function AllocLabPage() {
  return <AllocLab />;
}
