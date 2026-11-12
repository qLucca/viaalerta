import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "ViaAlerta · Ruas mais seguras",
    template: "%s · ViaAlerta",
  },
  description:
    "Um olhar para a rua. Uma cidade melhor para todos. Registre e acompanhe registros nas vias públicas.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
