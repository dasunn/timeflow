"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/actions/categories";
import type { Category } from "@/lib/domain/types";
import type { CategoryInput } from "@/lib/domain/validation";
import { CategoryForm } from "./CategoryForm";

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Category | null>(null);

  function handleCreate(values: CategoryInput) {
    startTransition(async () => {
      await createCategory(values.name, values.color);
      router.refresh();
    });
  }

  function handleUpdate(values: CategoryInput) {
    if (!editing) return;
    const id = editing.id;
    startTransition(async () => {
      await updateCategory(id, values.name, values.color);
      router.refresh();
      setEditing(null);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Add a category
        </h2>
        <CategoryForm
          submitLabel="Add"
          pending={pending}
          resetAfterSubmit
          onSubmit={handleCreate}
        />
      </section>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <ul className="space-y-2">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} onEdit={() => setEditing(c)} />
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          {editing && (
            <CategoryForm
              key={editing.id}
              defaultValues={{ name: editing.name, color: editing.color }}
              submitLabel="Save"
              pending={pending}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
}: {
  category: Category;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function del() {
    startTransition(async () => {
      await deleteCategory(category.id);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
      <span
        className="size-5 shrink-0 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: category.color }}
      />
      <span className="flex-1 truncate font-medium">{category.name}</span>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Delete?</span>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={del}
          >
            Yes
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
            No
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Edit category"
            onClick={onEdit}
          >
            <PencilIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete category"
            onClick={() => setConfirming(true)}
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
    </li>
  );
}
