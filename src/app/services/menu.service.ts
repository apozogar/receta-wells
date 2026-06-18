import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { Recipe } from '../models/recipe';
import { Ingredient } from '../models/ingredient';

export interface CalendarEntry {
  day: number;
  month: number;
  year: number;
  lunchId: number | null;
  dinnerId: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) { }

  getRecipes(): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(`${this.apiUrl}/recipes`).pipe(timeout(15000));
  }

  getCalendar(month: number, year: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/calendar?month=${month}&year=${year}`).pipe(timeout(15000));
  }

  saveCalendar(entries: CalendarEntry[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/calendar`, entries);
  }

  createRecipe(recipe: Omit<Recipe, 'id'>): Observable<Recipe> {
    return this.http.post<Recipe>(`${this.apiUrl}/recipes`, recipe);
  }

  updateRecipe(id: number, recipe: Omit<Recipe, 'id'>): Observable<Recipe> {
    return this.http.put<Recipe>(`${this.apiUrl}/recipes/${id}`, recipe);
  }

  deleteRecipe(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/recipes/${id}`);
  }

  getIngredients(recipeId: number): Observable<Ingredient[]> {
    return this.http.get<Ingredient[]>(`${this.apiUrl}/recipes/${recipeId}/ingredients`);
  }

  saveIngredients(recipeId: number, ingredients: { name: string; category?: string }[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/recipes/${recipeId}/ingredients`, { ingredients });
  }

  scrapeIngredients(recipeId: number): Observable<{ ingredients: Ingredient[] }> {
    return this.http.get<{ ingredients: Ingredient[] }>(`${this.apiUrl}/recipes/${recipeId}/ingredients/scrape`);
  }

  getCalendarIngredients(month: number, year: number): Observable<{ name: string; category: string; recipe_name: string; recipe_type: string }[]> {
    return this.http.get<{ name: string; category: string; recipe_name: string; recipe_type: string }[]>(
      `${this.apiUrl}/ingredients/from-calendar?month=${month}&year=${year}`
    );
  }

  getSettings(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(`${this.apiUrl}/settings`);
  }

  saveSetting(key: string, value: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/settings`, { key, value });
  }

  saveSettingsBatch(entries: { key: string; value: string }[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/settings/batch`, entries);
  }
}
