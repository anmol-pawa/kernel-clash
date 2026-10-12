import type { Metadata } from "next";
import { SpriteViewer } from "@/components/dev/SpriteViewer";

export const metadata: Metadata = { title: "Sprites — Kernel Clash" };

export default function SpritesPage() {
  return <SpriteViewer />;
}
