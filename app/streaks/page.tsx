import { StreaksManager } from "@/components/streaks/StreaksManager";
import { getStreaks } from "@/lib/data";

export const metadata = { title: "Streaks · TimeFlow" };

// Always reflect the live local database (no build-time prerender snapshot).
export const dynamic = "force-dynamic";

export default async function StreaksPage() {
  const streaks = await getStreaks();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Streaks</h1>
      </header>

      <p className="mb-6 text-sm text-muted-foreground">
        Mark a streak done once a day to keep it alive. Miss a full day and
        it resets to zero.
      </p>

      <StreaksManager streaks={streaks} today={new Date()} />
    </div>
  );
}
