import { supabase } from "@/integrations/supabase/client";

export type StockMovementType = "in" | "out" | "use" | "waste" | "return" | "adjust";
export type SimpleMovementRow = { product_id: string; movement_type: string; quantity: number };
export type ProductRecipeRow = { product_id: string; ingredient_id: string; qty_per_unit: number };

const incomingTypes = ["in", "return", "adjust"];

export const calculateStockFromMovements = (
  movements: Array<{ movement_type: string; quantity: number }>,
) => {
  return movements.reduce((sum, movement) => {
    const sign = incomingTypes.includes(movement.movement_type) ? 1 : -1;
    return sum + sign * movement.quantity;
  }, 0);
};

export const readItemStock = async (itemId: string) => {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("movement_type,quantity")
    .eq("product_id", itemId);

  if (error) {
    throw error;
  }

  return calculateStockFromMovements(data || []);
};

export const canReduceStock = async (itemId: string, quantity: number) => {
  const currentStock = await readItemStock(itemId);
  return {
    currentStock,
    allowed: currentStock - quantity >= 0,
  };
};

export const buildStockMapFromMovements = (movements: SimpleMovementRow[]) => {
  const map = new Map<string, number>();

  movements.forEach((movement) => {
    if (!movement.product_id) return;
    const sign = incomingTypes.includes(movement.movement_type) ? 1 : -1;
    map.set(movement.product_id, (map.get(movement.product_id) || 0) + sign * movement.quantity);
  });

  return map;
};

export const calculateProductStockFromRecipe = (
  productId: string,
  recipeRows: ProductRecipeRow[],
  ingredientStockMap: Map<string, number>,
) => {
  const rows = recipeRows.filter((row) => row.product_id === productId && row.qty_per_unit > 0);

  if (!rows.length) return 0;

  let minPossible = Number.POSITIVE_INFINITY;
  rows.forEach((row) => {
    const ingredientStock = ingredientStockMap.get(row.ingredient_id) || 0;
    const possible = Math.floor(ingredientStock / row.qty_per_unit);
    minPossible = Math.min(minPossible, possible);
  });

  if (!Number.isFinite(minPossible)) return 0;
  return Math.max(0, minPossible);
};