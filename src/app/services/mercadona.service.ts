import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, lastValueFrom } from 'rxjs';
import { MercadonaProduct, ShoppingItem } from '../models/ingredient';

const FRUIT_VEG_CATEGORY_ID = 1;

@Injectable({
  providedIn: 'root',
})
export class MercadonaService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  searchProduct(query: string): Observable<{ hits: MercadonaProduct[]; nbHits: number }> {
    return this.http.post<{ hits: MercadonaProduct[]; nbHits: number }>(
      `${this.apiUrl}/mercadona/search`,
      { query }
    );
  }

  async searchIngredient(ingredient: string): Promise<MercadonaProduct | null> {
    try {
      const result = await lastValueFrom(this.searchProduct(ingredient));
      if (result.hits && result.hits.length > 0) {
        const hit = result.hits[0];
        const isFruitOrVeg = hit.categories?.some(c => c.id === FRUIT_VEG_CATEGORY_ID);
        if (isFruitOrVeg) return null;
        return hit;
      }
      return null;
    } catch {
      return null;
    }
  }

  isFruitOrVegetable(product: MercadonaProduct): boolean {
    return product.categories?.some(c => c.id === FRUIT_VEG_CATEGORY_ID) ?? false;
  }

  async buildShoppingList(ingredients: string[]): Promise<ShoppingItem[]> {
    const items: ShoppingItem[] = [];
    for (const ingredient of ingredients) {
      if (!ingredient.trim()) continue;
      const product = await this.searchIngredient(ingredient);
      if (product) {
        items.push({ ingredient, matchedProduct: product, skipped: false });
      } else {
        items.push({ ingredient, skipped: true, reason: 'No encontrado o es fruta/verdura' });
      }
    }
    return items;
  }
}
