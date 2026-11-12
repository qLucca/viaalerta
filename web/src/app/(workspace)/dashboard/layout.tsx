import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Visão geral" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
