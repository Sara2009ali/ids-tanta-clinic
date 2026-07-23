import Link from "next/link";
import { CalendarCheck2, Receipt, Users2 } from "lucide-react";
import { typography } from "@/lib/typography";

const HIGHLIGHTS = [
  { icon: Users2, text: "Patient records, history, and files in one chart" },
  { icon: CalendarCheck2, text: "Scheduling and reception, kept in sync in real time" },
  { icon: Receipt, text: "Billing, compensation, and inventory without spreadsheets" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div
        className="relative hidden grid-rows-[auto_1fr_auto] overflow-hidden bg-primary px-12 py-10 text-primary-foreground lg:grid"
        // Pinned to the brand's deep forest green in both themes — unlike buttons/links,
        // --primary flips to a bright accent tone in dark mode (for legibility on dark
        // surfaces), which would turn this hero panel a jarring mint green if left themed.
        style={{ "--primary": "oklch(0.32 0.09 158)", "--primary-foreground": "oklch(0.985 0 0)" } as React.CSSProperties}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_15%_0%,oklch(1_0_0/0.14)_0%,transparent_60%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(oklch(1_0_0)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0)_1px,transparent_1px)] [background-size:40px_40px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-24 size-96 rounded-full bg-[oklch(0.78_0.09_85/0.16)] blur-3xl"
        />

        <Link href="/login" className="relative flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gold text-lg font-heading font-medium text-gold-foreground shadow-elevation-low">
            D
          </div>
          <span className="font-heading text-xl font-medium">Dentra</span>
        </Link>

        <div className="relative flex max-w-md flex-col justify-center space-y-8">
          <p className="font-heading text-4xl leading-[1.15] font-medium text-balance">
            Everything your clinic runs on, in one calm workspace.
          </p>
          <ul className="space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-primary-foreground/80">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/15">
                  <Icon className="size-3.5" />
                </div>
                <span className="pt-0.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/45">
          Clinic management system for IDS Tanta.
        </p>
      </div>

      <div className="relative flex min-h-svh flex-1 items-center justify-center overflow-hidden bg-background p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,var(--primary)_0%,transparent_70%)] opacity-[0.06] lg:hidden"
        />
        <div className="relative w-full max-w-sm animate-in fade-in zoom-in-95 duration-500">
          <Link href="/login" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-lg font-heading font-medium text-primary-foreground shadow-elevation-low">
              D
            </div>
            <span className={typography.sectionTitle}>Dentra</span>
          </Link>

          {children}
        </div>
      </div>
    </div>
  );
}
