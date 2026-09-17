import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workbench | Formulation Workspace",
  description: "AI-assisted formulation and laboratory validation workspace for cosmetic R&D teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
