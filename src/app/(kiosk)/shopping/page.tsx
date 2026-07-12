import { listShoppingItems } from "@/lib/meals";
import { MobileShoppingList } from "@/components/MobileShoppingList";

export const dynamic = "force-dynamic";

// First-class Shopping route (reachable on every screen size). Reuses the
// mobile-first list, centered to a comfortable width on the wall display.
export default function ShoppingPage() {
  const items = listShoppingItems();
  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <div className="px-4 lg:px-6 py-3 border-b border-zinc-200 bg-white shrink-0">
        <div className="text-xl lg:text-2xl font-semibold">🛒 Shopping</div>
      </div>
      <div className="flex-1 min-h-0 w-full max-w-3xl mx-auto flex flex-col">
        <MobileShoppingList items={items} />
      </div>
    </div>
  );
}
