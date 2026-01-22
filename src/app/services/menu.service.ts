import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Recipe {
  id: number;
  name: string;
  type: string;
  slot: string;
  tags: string[];
  cookidooId?: string;
}

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
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  getRecipes(): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(`${this.apiUrl}/recipes`);
  }

  getCalendar(month: number, year: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/calendar?month=${month}&year=${year}`);
  }

  saveCalendar(entries: CalendarEntry[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/calendar`, entries);
  }
}
