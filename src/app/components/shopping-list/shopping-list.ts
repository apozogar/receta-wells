import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, lastValueFrom } from 'rxjs';
import { MenuService } from '../../services/menu.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { MercadonaService } from '../../services/mercadona.service';
import { ShoppingItem } from '../../models/ingredient';

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

  showMercadonaModal = false;
  mercadonaLoading = false;
  mercadonaError = '';
  mercadonaResults: ShoppingItem[] = [];

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
    private mercadona: MercadonaService,
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

  async sendToMercadona() {
    const unchecked = this.groups.flatMap(g => g.items.filter(i => !i.checked));
    if (unchecked.length === 0) {
      this.toast.info('Todos los ingredientes están marcados como comprados');
      return;
    }

    this.showMercadonaModal = true;
    this.mercadonaLoading = true;
    this.mercadonaError = '';
    this.mercadonaResults = [];

    const settings = await lastValueFrom(this.menuService.getSettings());
    const customerUuid = settings['mercadona_customer_uuid'] || '';
    const accessToken = settings['mercadona_access_token'] || '';
    const warehouse = settings['mercadona_warehouse'] || '146';

    if (!customerUuid || !accessToken) {
      this.mercadonaError = 'Configura los datos de Mercadona en Ajustes primero.';
      this.mercadonaLoading = false;
      return;
    }

    const ingredientNames = [...new Set(unchecked.map(i => i.name))];
    const allItems: ShoppingItem[] = [];
    for (const name of ingredientNames) {
      const product = await this.mercadona.searchIngredient(name);
      if (product) {
        allItems.push({ ingredient: name, matchedProduct: product, skipped: false });
      } else {
        allItems.push({ ingredient: name, skipped: true, reason: 'No encontrado' });
      }
    }

    const toAdd = allItems
      .filter(i => !i.skipped && i.matchedProduct)
      .map(i => ({ id: i.matchedProduct!.id, quantity: 1 }));

    if (toAdd.length > 0) {
      try {
        await lastValueFrom(this.mercadona.addToCart(toAdd, { customerUuid, warehouse, accessToken }));
        this.toast.success(`${toAdd.length} productos añadidos al carrito`);
      } catch (e: any) {
        this.toast.error('Error al añadir al carrito: ' + (e.message || 'Desconocido'));
      }
    }

    this.mercadonaResults = allItems;
    this.mercadonaLoading = false;
  }

  closeMercadonaModal() {
    this.showMercadonaModal = false;
    this.mercadonaResults = [];
  }

  print() {
    window.print();
  }
}
