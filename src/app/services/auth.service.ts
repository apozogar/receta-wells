import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, lastValueFrom, race, timer } from 'rxjs';
import { timeout } from 'rxjs/operators';

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Menu {
  id: number;
  name: string;
  owner_id: number;
  role: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = '/api';
  private userSubject = new BehaviorSubject<User | null>(null);
  private menusSubject = new BehaviorSubject<Menu[]>([]);
  private currentMenuIdSubject = new BehaviorSubject<number>(this.getCurrentMenuId());
  private token: string | null = null;

  user$ = this.userSubject.asObservable();
  menus$ = this.menusSubject.asObservable();
  currentMenuId$ = this.currentMenuIdSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone,
  ) {
    this.token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (this.token && savedUser) {
      try {
        this.userSubject.next(JSON.parse(savedUser));
        this.loadMenus();
      } catch {
        this.logout();
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): User | null {
    return this.userSubject.value;
  }

  getCurrentMenuId(): number {
    const stored = localStorage.getItem('currentMenuId');
    const id = stored ? parseInt(stored) : 1;
    return isNaN(id) ? 1 : id;
  }

  private async requestWithTimeout<T>(obs: Observable<T>, ms = 15000): Promise<T> {
    return lastValueFrom(obs.pipe(timeout(ms)));
  }

  async login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await this.requestWithTimeout(
        this.http.post<{ token: string; user: User }>(`${this.apiUrl}/auth/login`, { username, password }),
      );
      this.token = result.token;
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      this.ngZone.run(() => this.userSubject.next(result.user));
      await this.loadMenus();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.error?.error || e.message || 'Error de conexión' };
    }
  }

  async register(username: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await this.requestWithTimeout(
        this.http.post<{ token: string; user: User; menuId: number }>(`${this.apiUrl}/auth/register`, { username, email, password }),
      );
      this.token = result.token;
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('currentMenuId', String(result.menuId));
      this.ngZone.run(() => {
        this.userSubject.next(result.user);
        this.currentMenuIdSubject.next(result.menuId);
      });
      await this.loadMenus();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.error?.error || e.message || 'Error de conexión' };
    }
  }

  async loadMenus(): Promise<void> {
    if (!this.token) return;
    try {
      const menus = await this.requestWithTimeout(
        this.http.get<Menu[]>(`${this.apiUrl}/menus`),
        10000,
      );
      this.ngZone.run(() => this.menusSubject.next(menus));
      const currentId = this.getCurrentMenuId();
      if (menus.length > 0 && !menus.find(m => m.id === currentId)) {
        this.setCurrentMenu(menus[0].id);
      }
    } catch {
      this.ngZone.run(() => this.menusSubject.next([]));
    }
  }

  setCurrentMenu(menuId: number) {
    localStorage.setItem('currentMenuId', String(menuId));
    this.ngZone.run(() => this.currentMenuIdSubject.next(menuId));
  }

  async createMenu(name: string): Promise<{ ok: boolean; menu?: Menu; error?: string }> {
    try {
      const menu = await this.requestWithTimeout(
        this.http.post<Menu>(`${this.apiUrl}/menus`, { name }),
      );
      await this.loadMenus();
      return { ok: true, menu };
    } catch (e: any) {
      return { ok: false, error: e.error?.error || e.message };
    }
  }

  async renameMenu(id: number, name: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.requestWithTimeout(
        this.http.put(`${this.apiUrl}/menus/${id}`, { name }),
      );
      await this.loadMenus();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.error?.error || e.message };
    }
  }

  async deleteMenu(id: number): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.requestWithTimeout(
        this.http.delete(`${this.apiUrl}/menus/${id}`),
      );
      const currentId = this.getCurrentMenuId();
      if (currentId === id) {
        const updated = this.menusSubject.value.filter(m => m.id !== id);
        if (updated.length > 0) {
          this.setCurrentMenu(updated[0].id);
        } else {
          localStorage.removeItem('currentMenuId');
          this.ngZone.run(() => this.currentMenuIdSubject.next(0));
        }
      }
      await this.loadMenus();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.error?.error || e.message };
    }
  }

  logout() {
    this.token = null;
    this.ngZone.run(() => {
      this.userSubject.next(null);
      this.menusSubject.next([]);
    });
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentMenuId');
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!this.token && !!this.userSubject.value;
  }
}