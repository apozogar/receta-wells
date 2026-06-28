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

  viewMode: 'month' | 'week' = 'month';
  weekOffset = 0;
  weekDaysList: CalendarDay[] = [];

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
  hasAiKeys = false;
  showRulesModal = false;
  showSyncModal = false;

  typeOptions = [
    { value: 'legumbres', label: 'Legumbres' },
    { value: 'verduras', label: 'Verduras' },
    { value: 'pescado', label: 'Pescado' },
    { value: 'pasta', label: 'Pasta' },
    { value: 'carne', label: 'Carne' },
    { value: 'arroz', label: 'Arroz' },
    { value: 'cena', label: 'Cena / Rápida' },
    { value: 'free', label: 'Especiales / Libre' },
  ];
  editBoardRules: { lunch: string; dinner: string }[] = [];
  presetModes = [
    {
      name: 'Equilibrado',
      desc: 'Por defecto. Alterna legumbres, verduras, pescado, pasta, carne.',
      rules: [
        { lunch: 'legumbres', dinner: 'cena' },
        { lunch: 'verduras', dinner: 'cena' },
        { lunch: 'pescado', dinner: 'cena' },
        { lunch: 'pasta', dinner: 'cena' },
        { lunch: 'carne', dinner: 'free' },
        { lunch: 'free', dinner: 'free' },
        { lunch: 'arroz', dinner: 'cena' },
      ],
    },
    {
      name: 'Alto rendimiento',
      desc: 'Más proteína. Carne y pescado como fuentes principales.',
      rules: [
        { lunch: 'carne', dinner: 'cena' },
        { lunch: 'pescado', dinner: 'cena' },
        { lunch: 'carne', dinner: 'cena' },
        { lunch: 'pescado', dinner: 'cena' },
        { lunch: 'carne', dinner: 'free' },
        { lunch: 'free', dinner: 'free' },
        { lunch: 'arroz', dinner: 'cena' },
      ],
    },
    {
      name: 'Pérdida de peso',
      desc: 'Platos ligeros. Más verduras y legumbres, menos hidratos.',
      rules: [
        { lunch: 'verduras', dinner: 'cena' },
        { lunch: 'legumbres', dinner: 'cena' },
        { lunch: 'verduras', dinner: 'cena' },
        { lunch: 'pescado', dinner: 'cena' },
        { lunch: 'verduras', dinner: 'free' },
        { lunch: 'free', dinner: 'free' },
        { lunch: 'verduras', dinner: 'cena' },
      ],
    },
    {
      name: 'Competición',
      desc: 'Máxima proteína. Plan estricto para preparación.',
      rules: [
        { lunch: 'pescado', dinner: 'cena' },
        { lunch: 'carne', dinner: 'cena' },
        { lunch: 'pescado', dinner: 'cena' },
        { lunch: 'carne', dinner: 'cena' },
        { lunch: 'pescado', dinner: 'free' },
        { lunch: 'free', dinner: 'free' },
        { lunch: 'carne', dinner: 'cena' },
      ],
    },
  ];
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
    private http: HttpClient,
    private toast: ToastService,
    private confirmSvc: ConfirmService,
  ) {
    const now = new Date();
    this.currentMonth = now.getMonth();
    this.currentYear = now.getFullYear();
  }

  // Reglas de la pizarra (se sobrescriben desde settings al cargar)
  private readonly defaultRules: { [key: number]: { lunch: string; dinner: string } } = {
    1: { lunch: 'legumbres', dinner: 'cena' },
    2: { lunch: 'verduras', dinner: 'cena' },
    3: { lunch: 'pescado', dinner: 'cena' },
    4: { lunch: 'pasta', dinner: 'cena' },
    5: { lunch: 'carne', dinner: 'free' },
    6: { lunch: 'free', dinner: 'free' },
    0: { lunch: 'arroz', dinner: 'cena' },
  };
  rules: { [key: number]: { lunch: string; dinner: string } } = { ...this.defaultRules };

  ngOnInit() {
    this.menuSub = this.auth.currentMenuId$.subscribe(() => {
      this.loadRecipesAndCalendar();
    });
    this.menuService.getSettings().subscribe(settings => {
      this.hasAiKeys = !!(settings['gemini_api_key'] || settings['groq_api_key']);
      this.loadBoardRules(settings);
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

  switchToWeekly() {
    this.viewMode = 'week';
    this.weekOffset = 0;
    this.calculateWeekDays();
  }

  switchToMonthly() { this.viewMode = 'month'; }

  prevWeek() {
    this.weekOffset--;
    this.calculateWeekDays();
  }

  nextWeek() {
    this.weekOffset++;
    this.calculateWeekDays();
  }

  private getMondayOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getWeekSpan(): { start: Date; end: Date } {
    const now = new Date();
    const baseMonday = this.getMondayOfWeek(new Date(this.currentYear, this.currentMonth, now.getDate()));
    const monday = new Date(baseMonday);
    monday.setDate(monday.getDate() + this.weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  }

  weekSpanLabel(): string {
    const { start, end } = this.getWeekSpan();
    const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
    const weekNum = Math.ceil((start.getDate() + 6 - start.getDay()) / 7) || 1;
    let label = fmt(start) + ' - ' + fmt(end);
    const mStart = this.monthNames[start.getMonth()];
    const mEnd = this.monthNames[end.getMonth()];
    if (mStart !== mEnd) label += ` (${mStart} - ${mEnd} ${start.getFullYear()})`;
    else label += ` (sem. ${weekNum}, ${mStart} ${start.getFullYear()})`;
    return label;
  }

  calculateWeekDays() {
    const { start } = this.getWeekSpan();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    this.weekDaysList = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dm = d.getMonth();
      const dy = d.getFullYear();
      const dd = d.getDate();
      const dayNameIndex = (d.getDay() + 6) % 7;
      const isToday = dd === new Date().getDate() && dm === new Date().getMonth() && dy === new Date().getFullYear();
      const isPast = d < todayStart;

      this.weekDaysList.push({
        day: dd,
        dayName: this.weekDays[dayNameIndex],
        isToday,
        isPast,
        isEmpty: false,
        lunch: undefined,
        dinner: undefined,
      });
    }

    const minMonth = this.weekDaysList[0].day !== null ? start.getMonth() : 0;
    const minYear = start.getFullYear();
    const maxMonth = this.weekDaysList[6].day !== null ? start.getMonth() + Math.floor((start.getDate() + 6) / 31) : 11;
    const maxYear = start.getFullYear();

    this.menuService.getCalendar(minMonth, minYear).subscribe(entries => {
      for (const wd of this.weekDaysList) {
        if (wd.day === null) continue;
        const entry = entries.find((e: any) => e.day === wd.day && e.month === start.getMonth() && e.year === minYear);
        if (entry) {
          wd.lunch = this.getRecipeById(entry.lunch_recipe_id);
          wd.dinner = this.getRecipeById(entry.dinner_recipe_id);
        }
      }
    });
  }

  private usedIdsByType: Map<string, number[]> = new Map();

  private getSpecialRecipe(type: string): Recipe | null {
    if (type === 'free')
      return { name: '✨ Libre / Fuera', id: -1, type: 'free', slot: 'any', tags: [], servings: 4, image_url: '' };
    if (type === 'arroz')
      return { name: '🍚 Arroz / Batch Cooking', id: -2, type: 'arroz', slot: 'lunch', tags: ['Tupper'], servings: 4, image_url: '' };
    if (type === 'improvisar')
      return { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any', tags: [], servings: 4, image_url: '' };
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
      return { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any', tags: [], servings: 4, image_url: '' };

    const picked = available[Math.floor(Math.random() * available.length)];
    const newUsed = this.usedIdsByType.get(type) || [];
    newUsed.push(picked.id);
    this.usedIdsByType.set(type, newUsed);
    return picked;
  }

  private loadBoardRules(settings: Record<string, string>) {
    const saved = settings['board_rules'];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.rules = { ...this.defaultRules, ...parsed };
      } catch {}
    } else {
      this.rules = { ...this.defaultRules };
    }
  }

  openRulesModal() {
    const dayIndex = (dow: number) => dow === 0 ? 6 : dow - 1;
    this.editBoardRules = [];
    for (let i = 0; i < 7; i++) {
      const dow = i === 6 ? 0 : i + 1;
      const rule = this.rules[dow] || this.defaultRules[dow];
      this.editBoardRules.push({ lunch: rule.lunch, dinner: rule.dinner });
    }
    this.showRulesModal = true;
  }

  closeRulesModal() {
    this.showRulesModal = false;
  }

  applyPreset(mode: typeof this.presetModes[0]) {
    this.editBoardRules = mode.rules.map(r => ({ ...r }));
  }

  saveBoardRules() {
    const rulesObj: any = {};
    for (let i = 0; i < 6; i++) {
      rulesObj[i + 1] = { lunch: this.editBoardRules[i].lunch, dinner: this.editBoardRules[i].dinner };
    }
    rulesObj[0] = { lunch: this.editBoardRules[6].lunch, dinner: this.editBoardRules[6].dinner };
    this.rules = { ...this.rules, ...rulesObj };

    this.menuService.saveSetting('board_rules', JSON.stringify(rulesObj)).subscribe({
      next: () => {
        this.toast.success('Reglas guardadas');
        this.showRulesModal = false;
      },
      error: (err) => {
        this.toast.error('Error al guardar reglas');
        console.error(err);
      },
    });
  }

  generate() {
    if (this.hasAiKeys) {
      this.generateAiCalendar();
    } else {
      this.generateCalendar();
    }
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
    if (id === -1) return { name: '✨ Libre / Fuera', id: -1, type: 'free', slot: 'any', tags: [], servings: 4, image_url: '' };
    if (id === -2)
      return {
        name: '🍚 Arroz / Batch Cooking',
        id: -2,
        type: 'arroz',
        slot: 'lunch',
        tags: ['Tupper'],
        servings: 4,
        image_url: '',
      };
    if (id === -3)
      return { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any', tags: [], servings: 4, image_url: '' };
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
  recipeSearchText = '';

  get filteredGroupedRecipes(): { label: string; recipes: Recipe[] }[] {
    const q = this.recipeSearchText.toLowerCase().trim();
    if (!q) return this.groupedRecipes;
    return this.groupedRecipes
      .map(g => ({
        label: g.label,
        recipes: g.recipes.filter(r => r.name.toLowerCase().includes(q)),
      }))
      .filter(g => g.recipes.length > 0);
  }

  startEdit(day: CalendarDay, slot: 'lunch' | 'dinner') {
    if (day.isPast) return;
    this.editingDay = day;
    this.editingSlot = slot;
    const all = [
      ...this.recipes,
      { name: '✨ Libre', id: -1, type: 'free', slot: 'any', tags: [], servings: 4, image_url: '' } as Recipe,
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
    this.recipeSearchText = '';
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
    this.recipeSearchText = '';
    
  }

  print() {
    if (!this.calendarDays.length) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      @page { size: landscape; margin: 8mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
        color: #1e293b;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .header {
        text-align: center;
        margin-bottom: 6px;
      }
      .header h1 {
        font-size: 20pt;
        font-weight: 800;
        letter-spacing: 1px;
      }
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 3px;
      }
      .day-header {
        text-align: center;
        font-weight: 700;
        font-size: 8pt;
        padding: 5px 2px;
        background: #1e293b;
        color: white;
        border-radius: 3px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .day-card {
        border: 1px solid #d1d5db;
        border-radius: 4px;
        padding: 4px 5px;
        min-height: 72px;
        font-size: 7.5pt;
        line-height: 1.25;
      }
      .day-card.empty {
        background: #f3f4f6;
        border-color: #e5e7eb;
      }
      .day-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }
      .date-number {
        font-weight: 700;
        font-size: 10pt;
        background: #e5e7eb;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }
      .day-name {
        font-size: 6.5pt;
        color: #6b7280;
        font-weight: 600;
        text-transform: uppercase;
      }
      .meal { margin-bottom: 2px; }
      .meal strong {
        display: block;
        font-size: 5.5pt;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }
      .lunch strong { color: #0f3460; }
      .dinner strong { color: #27ae60; }
      .no-meal { color: #d1d5db; font-style: italic; }
    `;

    const monthName = this.monthNames[this.currentMonth];
    const year = this.currentYear;

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Menú ${monthName} ${year}</title><style>${styles}</style></head><body>`;
    html += `<div class="header"><h1>${monthName} ${year}</h1></div>`;
    html += `<div class="calendar-grid">`;

    for (const day of this.weekDays) {
      html += `<div class="day-header">${day}</div>`;
    }

    for (const day of this.calendarDays) {
      if (day.isEmpty) {
        html += `<div class="day-card empty"></div>`;
      } else {
        const lunchName = day.lunch?.name || '—';
        const dinnerName = day.dinner?.name || '—';
        html += `<div class="day-card">
          <div class="day-card-header">
            <span class="day-name">${day.dayName}</span>
            <span class="date-number">${day.day}</span>
          </div>
          <div class="meal lunch">
            <strong>COMIDA</strong>
            <span>${lunchName}</span>
          </div>
          <div class="meal dinner">
            <strong>CENA</strong>
            <span>${dinnerName}</span>
          </div>
        </div>`;
      }
    }

    html += `</div></body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    }, 300);
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
        lunch: isPast ? undefined : (lunch || { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any' as const, tags: [], servings: 4, image_url: '' }),
        dinner: isPast ? undefined : (dinner || { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any' as const, tags: [], servings: 4, image_url: '' }),
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
}
