import { supabase } from "@/integrations/supabase/client";

export type StockMovementType = "in" | "out" | "use" | "waste" | "return" | "adjust";

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