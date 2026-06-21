export interface Ingredient {
  id?: number;
  recipe_id?: number;
  name: string;
  category: string;
  quantity: string;
  unit: string;
}

export interface MercadonaProduct {
  id: string;
  slug: string;
  display_name: string;
  packaging: string;
  price_instructions: {
    unit_price: string;
    unit_size: string;
    size_format: string;
    reference_price: string;
    reference_format: string;
  };
  thumbnail: string;
  categories: Array<{ id: number; name: string }>;
  brand: string | null;
}

export interface ShoppingItem {
  ingredient: string;
  matchedProduct?: MercadonaProduct;
  skipped: boolean;
  reason?: string;
}
