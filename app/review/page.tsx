import type { Metadata } from "next";
import { ReviewBox } from "@/components/world/ReviewBox";

export const metadata: Metadata = { title: "Leitner Box — Kernel Clash" };

export default function ReviewPage() {
  return <ReviewBox />;
}
