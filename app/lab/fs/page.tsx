import type { Metadata } from "next";
import { FsLab } from "@/components/world/FsLab";

export const metadata: Metadata = { title: "File-system Lab — Kernel Clash" };

export default function FsLabPage() {
  return <FsLab />;
}
