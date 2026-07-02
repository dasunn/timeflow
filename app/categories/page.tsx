import { CategoriesManager } from "@/components/categories/CategoriesManager";
import { getCategories } from "@/lib/data";

export const metadata = { title: "Categories · TimeFlow" };

// Always reflect the live local database (no build-time prerender snapshot).
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-6">
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
