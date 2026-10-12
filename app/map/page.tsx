import type { Metadata } from "next";
import { RegionMap } from "@/components/world/RegionMap";

export const metadata: Metadata = { title: "Region map — Kernel Clash" };

export default function MapPage() {
  return <RegionMap />;
}
