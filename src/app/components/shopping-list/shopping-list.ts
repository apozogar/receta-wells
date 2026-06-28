import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, lastValueFrom } from 'rxjs';
import { MenuService, CalendarEntry } from '../../services/menu.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Ingredient } from '../../models/ingredient';

interface CategorizedIngredient {
  name: string;
  quantity: string;
  unit: string;
  recipeName: string;
  recipeType: string;
  checked: boolean;
}

interface CategoryGroup {
  label: string;
  items: CategorizedIngredient[];
  collapsed: boolean;
}

@Component({
  selector: 'app-shopping-list',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './shopping-list.html',
  styleUrl: './shopping-list.css',
})
export class ShoppingList implements OnInit, OnDestroy {
  groups: CategoryGroup[] = [];
  currentMonth: number;
  currentYear: number;
  monthNames: string[] = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  loading = true;
  loadError = '';
  private menuSub?: Subscription;

  categoryOrder = [
    { key: 'verdura', label: '🥬 Verduras y hortalizas' },
    { key: 'fruta', label: '🍎 Frutas' },
    { key: 'carne', label: '🥩 Carnes' },
    { key: 'pescado', label: '🐟 Pescados' },
    { key: 'lacteo', label: '🥛 Lácteos' },
    { key: 'legumbre', label: '🫘 Legumbres' },
    { key: 'pasta', label: '🍝 Pasta y arroz' },
    { key: 'otro', label: '📦 Otros' },
  ];

  constructor(
    private menuService: MenuService,
    private auth: AuthService,
    private toast: ToastService,
  ) {
    const now = new Date();
    this.currentMonth = now.getMonth();
    this.currentYear = now.getFullYear();
  }

  ngOnInit() {
    this.menuSub = this.auth.currentMenuId$.subscribe(() => {
      this.loadShoppingList();
    });
  }

  ngOnDestroy() {
    this.menuSub?.unsubscribe();
  }

  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
    this.loadShoppingList();
  }

  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
    this.loadShoppingList();
  }

  private loadShoppingList() {
    this.loading = true;
    this.loadError = '';
    this.menuService.getCalendarIngredients(this.currentMonth, this.currentYear).subscribe({
      next: (ings) => {
        this.buildGroups(ings);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.loadError = 'Error al cargar: ' + (err.error?.error || err.statusText || 'Error de conexión');
      },
    });
  }

  private classifyCategory(category: string, name: string): string {
    const cat = (category || '').toLowerCase();
    const nm = name.toLowerCase();
    if (cat.includes('verdura') || cat.includes('hortaliza') || cat.includes('vegetal')) return 'verdura';
    if (cat.includes('fruta')) return 'fruta';
    if (cat.includes('carne') || cat.includes('pollo') || cat.includes('ternera') || cat.includes('cerdo')) return 'carne';
    if (cat.includes('pescado') || cat.includes('marisco') || nm.includes('salmon') || nm.includes('merluza') || nm.includes('atun')) return 'pescado';
    if (cat.includes('lacteo') || cat.includes('queso') || cat.includes('leche') || cat.includes('yogur') || cat.includes('nata')) return 'lacteo';
    if (cat.includes('legumbre') || nm.includes('lenteja') || nm.includes('garbanzo') || nm.includes('alubia')) return 'legumbre';
    if (cat.includes('pasta') || cat.includes('arroz') || nm.includes('espagueti') || nm.includes('macarrone')) return 'pasta';
    return 'otro';
  }

  private buildGroups(ings: { name: string; category: string; quantity: string; unit: string; recipe_name: string; recipe_type: string }[]) {
    const map = new Map<string, CategorizedIngredient[]>();
    for (const ing of ings) {
      const groupKey = this.classifyCategory(ing.category, ing.name);
      if (!map.has(groupKey)) map.set(groupKey, []);
      map.get(groupKey)!.push({
        name: ing.name,
        quantity: ing.quantity || '',
        unit: ing.unit || '',
        recipeName: ing.recipe_name,
        recipeType: ing.recipe_type,
        checked: false,
      });
    }

    this.groups = this.categoryOrder
      .filter(c => map.has(c.key))
      .map(c => ({
        label: c.label,
        items: map.get(c.key)!,
        collapsed: false,
      }));

    if (this.groups.length === 0) {
      const other = map.get('otro');
      if (other) {
        this.groups = [{ label: '📦 Todos los ingredientes', items: other, collapsed: false }];
      }
    }
  }

  toggleGroup(group: CategoryGroup) {
    group.collapsed = !group.collapsed;
  }

  get completedCount(): number {
    let count = 0;
    for (const g of this.groups) {
      count += g.items.filter(i => i.checked).length;
    }
    return count;
  }

  get totalCount(): number {
    let count = 0;
    for (const g of this.groups) {
      count += g.items.length;
    }
    return count;
  }

  uncheckAll() {
    for (const g of this.groups) {
      for (const item of g.items) item.checked = false;
    }
  }

  scrapingMissing = false;

  async scrapeMissing() {
    this.scrapingMissing = true;
    this.toast.info('Buscando ingredientes en Cookidoo...');
    try {
      const calendar = await lastValueFrom(
        this.menuService.getCalendar(this.currentMonth, this.currentYear),
      );
      const recipeIds = new Set<number>();
      for (const entry of calendar) {
        if (entry.lunch_recipe_id > 0) recipeIds.add(entry.lunch_recipe_id);
        if (entry.dinner_recipe_id > 0) recipeIds.add(entry.dinner_recipe_id);
      }

      let scraped = 0;
      let skipped = 0;
      for (const id of recipeIds) {
        const ings = await lastValueFrom(this.menuService.getIngredients(id));
        if (ings.length > 0) { skipped++; continue; }
        try {
          const result = await lastValueFrom(this.menuService.scrapeIngredients(id));
          if (result.ingredients.length > 0) {
            await lastValueFrom(this.menuService.saveIngredients(id, result.ingredients));
            scraped++;
          } else {
            skipped++;
          }
        } catch { skipped++; }
      }

      this.toast.success(`${scraped} recetas con ingredientes nuevos, ${skipped} sin cambios`);
      this.loadShoppingList();
    } catch (e: any) {
      this.toast.error('Error al obtener ingredientes: ' + (e.message || 'desconocido'));
    }
    this.scrapingMissing = false;
  }

  print() {
    window.print();
  }
}
