import { Pixelify_Sans, Press_Start_2P } from "next/font/google";

/** Chunky 8×8 pixel face for titles, labels and HP boxes. */
export const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-pixel" });
/** Readable pixel face for body text and lesson copy. */
export const body = Pixelify_Sans({ subsets: ["latin"], variable: "--font-body" });
