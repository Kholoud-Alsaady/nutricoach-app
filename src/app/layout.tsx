import type { Metadata } from "next";
import "./globals.css";
import { NutriCoachProvider } from "@/components/NutriCoachContext";

export const metadata: Metadata = {
  title: "NutriCoach — Adaptive AI Nutrition for Gyms",
  description: "Continuous adaptive nutrition planning and operations agent for Egyptian gym athletes and coaches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-canvas">
      <body className="h-full bg-canvas text-ink-primary font-sans antialiased">
        <NutriCoachProvider>{children}</NutriCoachProvider>
      </body>
    </html>
  );
}
