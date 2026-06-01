import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { CategoriesManager } from "@/components/categories/CategoriesManager";
import { buttonVariants } from "@/components/ui/button";
import { getCategories } from "@/lib/data";

export const metadata = { title: "Categories · TimeFlow" };

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back to calendar"
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronLeftIcon />
        </Link>
        <h1 className="text-xl font-semibold">Categories</h1>
      </header>

      <p className="mb-6 text-sm text-muted-foreground">
        Categories color-code tasks on the calendar. Deleting one keeps its
        tasks but removes their color.
      </p>

      <CategoriesManager categories={categories} />
    </div>
  );
}
