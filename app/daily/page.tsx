import type { Metadata } from "next";
import { Daily } from "@/components/world/Daily";

export const metadata: Metadata = { title: "Daily Challenge — Kernel Clash" };

export default function DailyPage() {
  return <Daily />;
}
