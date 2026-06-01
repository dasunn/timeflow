import { Loader2Icon } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}
