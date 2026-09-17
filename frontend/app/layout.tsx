import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spontan | Formulation Workspace",
  description: "Demo workspace untuk tim R&D formulasi kosmetik.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}
