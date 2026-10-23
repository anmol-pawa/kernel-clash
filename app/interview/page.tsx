import type { Metadata } from "next";
import { Interview } from "@/components/world/Interview";

export const metadata: Metadata = { title: "Mock Interview — Kernel Clash" };

export default function InterviewPage() {
  return <Interview />;
}
