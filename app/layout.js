import { Geist, Playfair_Display } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "900"],
  style: ["normal", "italic"],
});

export const metadata = {
  title: "Cinephile — Find that movie you can't quite remember",
  description: "Describe a movie you vaguely remember and find it",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geist.variable} ${playfair.variable} antialiased`}>
      <body className="min-h-dvh flex flex-col text-foreground font-sans relative overflow-x-hidden">
        <div className="fixed inset-0 -z-10 bg-[#080608]" />
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.12),transparent_60%)]" />
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_right,rgba(234,179,8,0.08),transparent_60%)]" />
        <div className="fixed inset-0 -z-10 opacity-[0.025] pointer-events-none film-grain" />
        {children}
      </body>
    </html>
  );
}
