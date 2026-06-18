import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Thermomix {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  async addToShoppingList(cookies: string, recipeIds: Set<string>): Promise<{ ok: boolean; curl?: string }> {
    const payload = { recipeIDs: Array.from(recipeIds) };

    try {
      const response = await fetch('https://cookidoo.es/shopping/es-ES/add-recipes', {
        method: 'POST',
        headers: {
          accept: '*/*',
          'content-type': 'application/json',
          'x-requested-with': 'xmlhttprequest',
          Cookie: cookies,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) return { ok: true };
      throw new Error(`Error ${response.status}`);
    } catch {
      return { ok: false, curl: this.generateCurlCommand(cookies, recipeIds) };
    }
  }

  generateCurlCommand(cookies: string, recipeIds: Set<string>): string {
    const payload = { recipeIDs: Array.from(recipeIds) };
    return `curl "https://cookidoo.es/shopping/es-ES/add-recipes" ^
  -H "accept: */*" ^
  -H "content-type: application/json" ^
  -H "cookie: ${cookies.replace(/"/g, '\\"')}" ^
  -H "origin: https://cookidoo.es" ^
  -H "x-requested-with: xmlhttprequest" ^
  --data-raw "${JSON.stringify(payload).replace(/"/g, '\\"')}"`;
  }

  async autoAddToShoppingList(recipeIds: Set<string>): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await lastValueFrom(
        this.http.post<{ ok: boolean }>(`${this.apiUrl}/cookidoo/add-to-shopping-list`, {
          recipeIds: Array.from(recipeIds),
        }),
      );
      return result;
    } catch (e: any) {
      return { ok: false, error: e.error?.error || e.message || 'Error al añadir a Cookidoo' };
    }
  }

  getRecipeIdsFromCalendar(
    calendarDays: { lunch?: { cookidooId?: string }; dinner?: { cookidooId?: string } }[],
  ): Set<string> {
    const ids = new Set<string>();
    calendarDays.forEach((day) => {
      if (day.lunch?.cookidooId) ids.add(day.lunch.cookidooId);
      if (day.dinner?.cookidooId) ids.add(day.dinner.cookidooId);
    });
    return ids;
  }
}
