import { DM_Sans, Manrope } from "next/font/google";
import { KudosLanding } from "@/components/kudos-landing";
import "./landing.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-dm",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export default function HomePage() {
  return <KudosLanding fontClassName={`${dmSans.variable} ${manrope.variable}`} />;
}
