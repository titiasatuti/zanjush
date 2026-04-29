import { supabase } from "@/integrations/supabase/client";

type LogAction =
  | "create_product"
  | "update_product"
  | "delete_product"
  | "create_ingredient"
  | "update_ingredient"
  | "delete_ingredient"
  | "stock_in"
  | "stock_out"
  | "create_label"
  | "add_recipe_ingredient"
  | "remove_recipe_ingredient"
  | "scan_stock_in"
  | "scan_stock_out"
  | "blocked_negative_stock";

export const logActivity = async (action: LogAction, description: string) => {
  await supabase.from("activity_logs").insert({
    action,
    description,
  });
};