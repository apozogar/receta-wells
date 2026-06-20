import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { lastValueFrom, Subscription } from 'rxjs';
import { CalendarEntry, MenuService } from '../../services/menu.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { Recipe } from '../../models/recipe';
import { Thermomix } from '../../services/thermomix';
import { MercadonaService } from '../../services/mercadona.service';
import { ShoppingItem } from '../../models/ingredient';
import { HttpClient } from '@angular/common/http';

interface CalendarDay {
  day: number | null;
  dayName: string;
  isToday: boolean;
  isPast: boolean;
  lunch?: Recipe;
  dinner?: Recipe;
  isEmpty: boolean;
}

@Component({
  selector: 'app-calendar',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
})
export class Calendar implements OnInit, OnDestroy {
  weekDays: string[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  monthNames: string[] = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  calendarDays: CalendarDay[] = [];
  recipes: Recipe[] = [];

  currentMonth: number;
  currentYear: number;
  private loadVersion = 0;

  // Estado para edición
  editingDay: CalendarDay | null = null;
  editingSlot: 'lunch' | 'dinner' | null = null;
  availableRecipesForSlot: Recipe[] = [];
  showRecipePicker = false;

  loading = true;
  loadError = '';
  aiLoading = false;
  aiError = '';
  showSyncModal = false;
  syncLoading = false;
  syncShoppingRecipes: string[] = [];
  syncAgendaItems: { name: string; date: string }[] = [];
  syncSkippedRecipes: { name: string; reason: string }[] = [];
  syncIngredients: { name: string; recipe_name: string }[] = [];
  syncError = '';
  private menuSub?: Subscription;

  constructor(
    private menuService: MenuService,
    private auth: AuthService,
    private thermomix: Thermomix,
    private mercadona: MercadonaService,
    private http: HttpClient,
    private toast: ToastService,
    private confirmSvc: ConfirmService,
  ) {
    const now = new Date();
    this.currentMonth = now.getMonth();
    this.currentYear = now.getFullYear();
  }

  // Reglas de la pizarra
  rules: { [key: number]: { lunch: string; dinner: string } } = {
    1: { lunch: 'legumbres', dinner: 'cena' }, // Lunes
    2: { lunch: 'verduras', dinner: 'cena' }, // Martes
    3: { lunch: 'pescado', dinner: 'cena' }, // Miércoles
    4: { lunch: 'pasta', dinner: 'cena' }, // Jueves
    5: { lunch: 'carne', dinner: 'free' }, // Viernes
    6: { lunch: 'free', dinner: 'free' }, // Sábado
    0: { lunch: 'arroz', dinner: 'cena' }, // Domingo (Arroz o Batch Cooking)
  };

  ngOnInit() {
    this.menuSub = this.auth.currentMenuId$.subscribe(() => {
      this.loadRecipesAndCalendar();
    });
  }

  ngOnDestroy() {
    this.menuSub?.unsubscribe();
  }

  private loadRecipesAndCalendar() {
    this.loadVersion++;
    this.menuService.getRecipes().subscribe({
      next: (recipes) => {
        this.recipes = recipes;
        this.loadCalendar();
      },
      error: (err) => {
        this.loading = false;
        const msg = err.name === 'TimeoutError'
          ? 'Tiempo de espera agotado. El servidor no responde.'
          : 'Error al cargar recetas: ' + (err.error?.error || err.statusText || 'Error de conexión');
        this.loadError = msg;
        
        console.error('Error loading recipes:', err);
      },
    });
  }

  private navigateMonth(delta: number) {
    this.currentMonth += delta;
    if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
    if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
    this.loadVersion++;
    this.loadCalendar();
  }

  prevMonth() { this.navigateMonth(-1); }
  nextMonth() { this.navigateMonth(1); }

  private usedIdsByType: Map<string, number[]> = new Map();

  private getSpecialRecipe(type: string): Recipe | null {
    if (type === 'free')
      return { name: '✨ Libre / Fuera', id: -1, type: 'free', slot: 'any', tags: [] };
    if (type === 'arroz')
      return { name: '🍚 Arroz / Batch Cooking', id: -2, type: 'arroz', slot: 'lunch', tags: ['Tupper'] };
    if (type === 'improvisar')
      return { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any', tags: [] };
    return null;
  }

  getRandomRecipe(type: string, isDinner = false): Recipe {
    const special = this.getSpecialRecipe(type);
    if (special) return special;

    let pool = this.recipes.filter((r) => {
      if (r.type !== type && !(type === 'cena' && r.type === 'cena')) return false;
      if (isDinner && r.slot === 'lunch') return false;
      if (!isDinner && r.slot === 'dinner') return false;
      return true;
    });

    // Excluir usados recientemente del mismo tipo
    const used = this.usedIdsByType.get(type) || [];
    let available = pool.filter((r) => !used.includes(r.id));

    // Si no quedan, resetear el tracking de ese tipo
    if (available.length === 0) {
      this.usedIdsByType.delete(type);
      available = pool;
    }

    if (available.length === 0)
      return { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any', tags: [] };

    const picked = available[Math.floor(Math.random() * available.length)];
    const newUsed = this.usedIdsByType.get(type) || [];
    newUsed.push(picked.id);
    this.usedIdsByType.set(type, newUsed);
    return picked;
  }

  generateCalendar() {
    this.aiError = '';
    this.calendarDays = [];
    this.usedIdsByType = new Map();
    const { currentYear: year, currentMonth: month } = this;
    const now = new Date();

    const firstDay = new Date(year, month, 1);
    let startingDay = firstDay.getDay();
    if (startingDay === 0) startingDay = 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 1; i < startingDay; i++) {
      this.calendarDays.push({ day: null, dayName: '', isToday: false, isPast: false, isEmpty: true });
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let d = 1; d <= daysInMonth; d++) {
      const currentDayDate = new Date(year, month, d);
      const dayOfWeek = currentDayDate.getDay();
      const dayNameIndex = (dayOfWeek + 6) % 7;
      const rule = this.rules[dayOfWeek];

      const lunch = this.getRandomRecipe(rule.lunch, false);
      const dinner = this.getRandomRecipe(rule.dinner, true);

      const isToday =
        d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
      const isPast = currentDayDate < todayStart;

      this.calendarDays.push({
        day: d,
        dayName: this.weekDays[dayNameIndex],
        isToday,
        isPast,
        lunch,
        dinner,
        isEmpty: false,
      });
    }
    this.saveCalendar(true);
  }

  private buildCalendarGrid(entries: any[], month: number, year: number) {
    const now = new Date();
    this.calendarDays = [];
    const firstDay = new Date(year, month, 1);
    let startingDay = firstDay.getDay();
    if (startingDay === 0) startingDay = 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 1; i < startingDay; i++) {
      this.calendarDays.push({ day: null, dayName: '', isToday: false, isPast: false, isEmpty: true });
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let d = 1; d <= daysInMonth; d++) {
      const entry = entries?.find((e: any) => e.day === d);
      const lunch = entry ? this.getRecipeById(entry.lunch_recipe_id) : undefined;
      const dinner = entry ? this.getRecipeById(entry.dinner_recipe_id) : undefined;

      const currentDayDate = new Date(year, month, d);
      const dayNameIndex = (currentDayDate.getDay() + 6) % 7;
      const isToday =
        d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
      const isPast = currentDayDate < todayStart;

      this.calendarDays.push({
        day: d,
        dayName: this.weekDays[dayNameIndex],
        isToday,
        isPast,
        lunch,
        dinner,
        isEmpty: false,
      });
    }
  }

  loadCalendar() {
    this.loading = true;
    this.loadError = '';
    
    const version = this.loadVersion;
    const { currentYear: year, currentMonth: month } = this;
    this.menuService.getCalendar(month, year).subscribe({
      next: (entries) => {
        this.loading = false;
        if (this.loadVersion !== version) return;
        this.buildCalendarGrid(entries || [], month, year);
        
      },
      error: (err) => {
        this.loading = false;
        if (this.loadVersion !== version) return;
        const msg = err.name === 'TimeoutError'
          ? 'Tiempo de espera agotado. El servidor no responde.'
          : 'Error al cargar calendario: ' + (err.error?.error || err.statusText || 'Error de conexión');
        this.loadError = msg;
        
        console.error('Error loading calendar:', err);
      },
    });
  }

  getRecipeById(id: number): Recipe | undefined {
    if (id === -1) return { name: '✨ Libre / Fuera', id: -1, type: 'free', slot: 'any', tags: [] };
    if (id === -2)
      return {
        name: '🍚 Arroz / Batch Cooking',
        id: -2,
        type: 'arroz',
        slot: 'lunch',
        tags: ['Tupper'],
      };
    if (id === -3)
      return { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any', tags: [] };
    return this.recipes.find((r) => r.id === id);
  }

  saveCalendar(silent = false) {
    const entries: CalendarEntry[] = this.calendarDays
      .filter((d) => d.day !== null)
      .map((d) => ({
        day: d.day!,
        month: this.currentMonth,
        year: this.currentYear,
        lunchId: d.lunch?.id || null,
        dinnerId: d.dinner?.id || null,
      }));

    this.menuService.saveCalendar(entries).subscribe({
      next: () => {
        if (!silent) this.toast.success('Calendario guardado');
      },
      error: (err) => {
        console.error('Error al guardar calendario:', err);
        this.toast.error('Error al guardar: ' + (err.error?.error || err.statusText || 'Error de conexión'));
      },
    });
  }

  typeLabels: Record<string, string> = {
    legumbres: 'Legumbres',
    verduras: 'Verduras',
    pescado: 'Pescado',
    pasta: 'Pasta',
    carne: 'Carne',
    cena: 'Cena / Rápida',
    arroz: 'Arroz',
    free: 'Especiales',
  };

  groupedRecipes: { label: string; recipes: Recipe[] }[] = [];

  startEdit(day: CalendarDay, slot: 'lunch' | 'dinner') {
    if (day.isPast) return;
    this.editingDay = day;
    this.editingSlot = slot;
    const all = [
      ...this.recipes,
      { name: '✨ Libre', id: -1, type: 'free', slot: 'any', tags: [] } as Recipe,
    ];
    this.availableRecipesForSlot = all;

    const groups = new Map<string, Recipe[]>();
    for (const r of all) {
      const key = r.type || 'otro';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    this.groupedRecipes = [];
    for (const [type, recipes] of groups) {
      this.groupedRecipes.push({ label: this.typeLabels[type] || type, recipes });
    }
    this.showRecipePicker = true;
    
  }

  selectRecipe(recipe: Recipe) {
    if (!this.editingDay || !this.editingSlot) return;
    this.editingDay[this.editingSlot] = recipe;
    this.showRecipePicker = false;
    this.editingDay = null;
    this.editingSlot = null;
    this.availableRecipesForSlot = [];
    this.groupedRecipes = [];
    this.saveCalendar();
    
  }

  cancelEdit() {
    this.showRecipePicker = false;
    this.editingDay = null;
    this.editingSlot = null;
    this.availableRecipesForSlot = [];
    this.groupedRecipes = [];
    
  }

  print() {
    window.print();
  }

  generateAiCalendar() {
    this.aiLoading = true;
    this.aiError = '';
    

    const now = new Date();
    const isCurrentMonth = this.currentMonth === now.getMonth() && this.currentYear === now.getFullYear();
    const startDay = isCurrentMonth ? now.getDate() : 1;

    const call = isCurrentMonth
      ? this.menuService.generateAiMenuFrom(this.currentMonth, this.currentYear, startDay)
      : this.menuService.generateAiMenu(this.currentMonth, this.currentYear);

    call.subscribe({
      next: (res) => {
        this.aiLoading = false;
        this.usedIdsByType = new Map();
        this.buildCalendarFromAi(res.days, this.currentMonth, this.currentYear);
        this.saveCalendar(true);
        this.toast.success('Menú generado por IA');
        
      },
      error: (err) => {
        this.aiLoading = false;
        this.aiError = err.error?.error || err.statusText || 'Error al generar menú con IA';
        
      },
    });
  }

  private buildCalendarFromAi(days: CalendarEntry[], month: number, year: number) {
    const now = new Date();
    this.calendarDays = [];
    const firstDay = new Date(year, month, 1);
    let startingDay = firstDay.getDay();
    if (startingDay === 0) startingDay = 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 1; i < startingDay; i++) {
      this.calendarDays.push({ day: null, dayName: '', isToday: false, isPast: false, isEmpty: true });
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let d = 1; d <= daysInMonth; d++) {
      const entry = days.find((e: any) => e.day === d);
      const lunch = entry?.lunchId ? this.getRecipeById(entry.lunchId) : undefined;
      const dinner = entry?.dinnerId ? this.getRecipeById(entry.dinnerId) : undefined;

      const currentDayDate = new Date(year, month, d);
      const dayNameIndex = (currentDayDate.getDay() + 6) % 7;
      const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
      const isPast = currentDayDate < todayStart;

      this.calendarDays.push({
        day: d,
        dayName: this.weekDays[dayNameIndex],
        isToday,
        isPast,
        lunch: isPast ? undefined : (lunch || { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any', tags: [] }),
        dinner: isPast ? undefined : (dinner || { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any', tags: [] }),
        isEmpty: false,
      });
    }
  }

  async addToShoppingList() {
    this.syncShoppingRecipes = [];
    this.syncAgendaItems = [];
    this.syncSkippedRecipes = [];
    this.syncIngredients = [];
    this.syncError = '';
    this.syncLoading = true;
    this.showSyncModal = true;
    

    const recipeIds = new Set<string>();
    const agendaEntries: { cookidooId: string; date: string; name: string }[] = [];

    for (const day of this.calendarDays) {
      if (!day.day) continue;
      const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
      for (const recipe of [day.lunch, day.dinner]) {
        if (!recipe || recipe.id < 0) continue;
        if (recipe.cookidooId) {
          recipeIds.add(recipe.cookidooId);
          agendaEntries.push({ cookidooId: recipe.cookidooId, date: dateStr, name: recipe.name });
        } else {
          this.syncSkippedRecipes.push({ name: recipe.name, reason: 'Sin Cookidoo ID' });
        }
      }
    }

    if (recipeIds.size === 0) {
      this.syncError = 'Ninguna receta tiene ID de Cookidoo. Ve a Recetas para asignarlos.';
      this.syncLoading = false;
      
      return;
    }

    // 1. Añadir a la lista de la compra
    const shopResult = await this.thermomix.autoAddToShoppingList(recipeIds);
    if (shopResult.ok) {
      this.syncShoppingRecipes = agendaEntries.map(e => e.name);
    } else {
      this.syncError = 'Error al añadir a la lista de la compra: ' + (shopResult.error || 'desconocido');
    }

    // 2. Añadir a la agenda de Thermomix (por día)
    if (agendaEntries.length > 0) {
      try {
        const agendaResult = await lastValueFrom(
          this.http.post<{ results: { cookidooId: string; date: string; ok: boolean; error?: string }[] }>(
            '/api/cookidoo/add-to-calendar',
            { entries: agendaEntries.map(e => ({ cookidooId: e.cookidooId, date: e.date })) },
          ),
        );
        for (const r of agendaResult.results) {
          const entry = agendaEntries.find(e => e.cookidooId === r.cookidooId && e.date === r.date);
          if (r.ok && entry) {
            this.syncAgendaItems.push({ name: entry.name, date: r.date });
          } else if (!r.ok && entry) {
            this.syncSkippedRecipes.push({ name: entry.name, reason: 'Agenda: ' + (r.error || 'error') });
          }
        }
      } catch (err: any) {
        this.syncSkippedRecipes.push(...agendaEntries.map(entry => ({
          name: entry.name,
          reason: 'Agenda: ' + (err.message || 'error de conexión'),
        })));
      }
    }

    // 3. Obtener ingredientes del mes
    try {
      const ings = await lastValueFrom(
        this.menuService.getCalendarIngredients(this.currentMonth, this.currentYear),
      );
      this.syncIngredients = ings;
    } catch { }

    this.syncLoading = false;
    
  }

  closeSyncModal() {
    this.showSyncModal = false;
    
  }

  async addToMercadona() {
    // Cargar settings guardadas
    const settings = await lastValueFrom(this.menuService.getSettings());
    let customerUuid = settings['mercadona_customer_uuid'] || '';
    let accessToken = settings['mercadona_access_token'] || '';
    let warehouse = settings['mercadona_warehouse'] || '146';

    // Si faltan, pedirlas al usuario
    if (!customerUuid) {
      customerUuid = prompt('Customer UUID (de MO-user > customerUuid):') || '';
      if (!customerUuid) return;
    }
    if (!accessToken) {
      accessToken = prompt('Token de acceso de Mercadona (de MO-user > accessToken):') || '';
      if (!accessToken) return;
    }
    warehouse = prompt(`Código de almacén (wh) [${warehouse}]:`) || warehouse;

    const ingredients = new Map<string, number>();

    for (const day of this.calendarDays) {
      if (!day.day) continue;
      for (const meal of [day.lunch, day.dinner]) {
        if (!meal || meal.id == null || meal.id < 0) continue;
        try {
          let ings = await lastValueFrom(this.menuService.getIngredients(meal.id));
          if (ings.length === 0) {
            const scraped = await lastValueFrom(this.menuService.scrapeIngredients(meal.id));
            ings = scraped.ingredients;
            if (ings.length > 0) {
              await lastValueFrom(this.menuService.saveIngredients(meal.id, ings));
            }
          }
          for (const ing of ings) {
            const key = ing.name.toLowerCase();
            ingredients.set(key, (ingredients.get(key) || 0) + 1);
          }
        } catch { }
      }
    }

    if (ingredients.size === 0) {
      this.toast.error('No se pudieron obtener ingredientes de las recetas.');
      return;
    }

    const allItems: ShoppingItem[] = [];
    for (const [name] of ingredients) {
      const product = await this.mercadona.searchIngredient(name);
      if (product) {
        allItems.push({ ingredient: name, matchedProduct: product, skipped: false });
      } else {
        allItems.push({ ingredient: name, skipped: true, reason: 'No encontrado o es fruta/verdura' });
      }
    }

    const toAdd = allItems
      .filter(i => !i.skipped && i.matchedProduct)
      .map(i => ({ id: i.matchedProduct!.id, quantity: 1 }));

    if (toAdd.length === 0) {
      this.toast.error('No se encontraron productos en Mercadona.');
      return;
    }

    try {
      const result = await lastValueFrom(this.mercadona.addToCart(toAdd, {
        customerUuid,
        warehouse,
        accessToken,
      }));
      // Guardar settings si se usaron nuevas
      await lastValueFrom(this.menuService.saveSettingsBatch([
        { key: 'mercadona_customer_uuid', value: customerUuid },
        { key: 'mercadona_access_token', value: accessToken },
        { key: 'mercadona_warehouse', value: warehouse },
      ]));
      const skipped = allItems.filter(i => i.skipped).map(i => i.ingredient);
      this.toast.success(`${toAdd.length} productos añadidos al carrito`);
      if (skipped.length > 0) {
        this.toast.info('No se añadieron: ' + skipped.join(', '));
      }
    } catch (e: any) {
      this.toast.error('Error al añadir al carrito: ' + (e.message || 'Desconocido'));
    }
  }
}
