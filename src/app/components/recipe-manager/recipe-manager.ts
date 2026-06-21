import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MenuService } from '../../services/menu.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';
import { Recipe } from '../../models/recipe';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-recipe-manager',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './recipe-manager.html',
  styleUrl: './recipe-manager.css',
})
export class RecipeManager implements OnInit {
  recipes: Recipe[] = [];
  filteredRecipes: Recipe[] = [];
  editingRecipe: Recipe | null = null;
  isNew = false;
  loading = true;
  errorMessage = '';
  filterText = '';
  filterType = '';
  filterSlot = '';

  form: Omit<Recipe, 'id'> = {
    name: '',
    type: 'cena',
    slot: 'any',
    tags: [],
    cookidooId: '',
    servings: 4,
    image_url: '',
  };
  tagInput = '';

  searchQuery = '';
  searchResults: { name: string; id: string }[] = [];
  searching = false;

  readonly typeOptions = ['legumbres', 'verduras', 'pescado', 'pasta', 'carne', 'arroz', 'cena'];
  readonly slotOptions: { value: Recipe['slot']; label: string }[] = [
    { value: 'any', label: 'Cualquiera' },
    { value: 'lunch', label: 'Solo comida' },
    { value: 'dinner', label: 'Solo cena' },
  ];

  constructor(
    private menuService: MenuService,
    private auth: AuthService,
    private http: HttpClient,
    private toast: ToastService,
    private confirmSvc: ConfirmService,
  ) {}

  slotLabel(slot: string): string {
    const map: Record<string, string> = { lunch: 'Comida', dinner: 'Cena', any: 'Cualquiera' };
    return map[slot] || slot;
  }

  ngOnInit() {
    console.log('RecipeManager: ngOnInit called');
    this.loadRecipes();
  }

  loadRecipes() {
    this.loading = true;
    
    console.log('RecipeManager: fetching recipes...');
    this.http.get<Recipe[]>('/api/recipes').subscribe({
      next: (recipes) => {
        console.log('RecipeManager: recipes received', recipes?.length);
        this.recipes = recipes;
        this.applyFilter();
        this.loading = false;
        
      },
      error: (e) => {
        console.error('RecipeManager: error fetching recipes', e);
        this.errorMessage = 'Error: ' + (e.message || e.status || 'conexión');
        this.loading = false;
        
      },
    });
  }

  applyFilter() {
    let result = this.recipes;
    if (this.filterText) {
      const q = this.filterText.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q)));
    }
    if (this.filterType) {
      result = result.filter(r => r.type === this.filterType);
    }
    if (this.filterSlot) {
      result = result.filter(r => r.slot === this.filterSlot);
    }
    this.filteredRecipes = result;
  }

  startNew() {
    this.isNew = true;
    this.editingRecipe = null;
    this.form = { name: '', type: 'cena', slot: 'any', tags: [], cookidooId: '', servings: 4, image_url: '' };
    this.tagInput = '';
  }

  startEdit(recipe: Recipe) {
    this.isNew = false;
    this.editingRecipe = recipe;
    this.form = {
      name: recipe.name,
      type: recipe.type,
      slot: recipe.slot,
      tags: [...recipe.tags],
      cookidooId: recipe.cookidooId || '',
      servings: recipe.servings || 4,
      image_url: recipe.image_url || '',
    };
    this.tagInput = '';
  }

  cancelEdit() {
    this.editingRecipe = null;
    this.isNew = false;
  }

  addTag() {
    const tag = this.tagInput.trim();
    if (tag && !this.form.tags.includes(tag)) {
      this.form.tags.push(tag);
    }
    this.tagInput = '';
  }

  removeTag(tag: string) {
    this.form.tags = this.form.tags.filter((t) => t !== tag);
  }

  searchCookidoo() {
    const q = this.form.name.trim();
    if (!q) return;
    this.searching = true;
    this.searchResults = [];
    
    this.http.get<{ results: { name: string; id: string }[] }>(
      `/api/cookidoo/search?q=${encodeURIComponent(q)}`,
    ).subscribe({
      next: (res) => {
        this.searchResults = res.results;
        this.searching = false;
        
      },
      error: () => {
        this.searching = false;
        
      },
    });
  }

  selectCookidooResult(r: { name: string; id: string }) {
    this.form.cookidooId = r.id;
    this.form.name = r.name;
    this.searchResults = [];
  }

  // Importar recetas predefinidas desde Cookidoo
  showImportModal = false;
  importLoading = false;
  importError = '';
  importResults: { name: string; id: string; suggestedType: string; checked: boolean; alreadyImported: boolean }[] = [];
  importResultsGrouped: { type: string; items: { name: string; id: string; suggestedType: string; checked: boolean; alreadyImported: boolean }[] }[] = [];
  importing = false;

  openImportModal() {
    this.showImportModal = true;
    this.importLoading = true;
    this.importError = '';
    this.importResults = [];
    this.importResultsGrouped = [];
    

    this.http.post<{ results: { name: string; id: string; suggestedType: string; alreadyImported?: boolean }[] }>(
      '/api/cookidoo/predefined', {},
    ).subscribe({
      next: (res) => {
        this.importResults = res.results.map(r => ({
          ...r,
          alreadyImported: r.alreadyImported || false,
          checked: !r.alreadyImported,
        }));
        this.groupImportResults();
        this.importLoading = false;
        
      },
      error: (e) => {
        this.importError = e.error?.error || e.message || 'Error al conectar con Cookidoo';
        this.importLoading = false;
        
      },
    });
  }

  private groupImportResults() {
    const groups = new Map<string, typeof this.importResults>();
    for (const r of this.importResults) {
      const key = r.suggestedType;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    this.importResultsGrouped = Array.from(groups.entries()).map(([type, items]) => ({ type, items }));
  }

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      legumbres: 'Legumbres',
      verduras: 'Verduras',
      pescado: 'Pescado',
      pasta: 'Pasta',
      carne: 'Carne',
      cena: 'Cena / Rápida',
      arroz: 'Arroz',
    };
    return labels[type] || type;
  }

  closeImportModal() {
    this.showImportModal = false;
    this.importResults = [];
    this.importError = '';
  }

  toggleImportAll(checked: boolean) {
    this.importResults.forEach(r => { if (!r.alreadyImported) r.checked = checked; });
  }

  selectedImportCount(): number {
    return this.importResults.filter(r => r.checked && !r.alreadyImported).length;
  }

  importSelected() {
    const selected = this.importResults.filter(r => r.checked && !r.alreadyImported);
    if (selected.length === 0) return;

    this.importing = true;
    

    const menuId = this.auth.getCurrentMenuId();
    let completed = 0;
    let skipped = 0;

    for (const r of selected) {
      const recipeData = {
        name: r.name,
        type: r.suggestedType,
        slot: 'any' as const,
        tags: [] as string[],
        cookidooId: r.id,
        servings: 4,
        image_url: '',
        menuId,
      };
      this.menuService.createRecipe(recipeData).subscribe({
        next: () => {
          completed++;
          this.checkImportDone(completed + skipped, selected.length, skipped);
        },
        error: (e) => {
          skipped++;
          console.error('Error importing recipe:', r.name, e);
          this.checkImportDone(completed + skipped, selected.length, skipped);
        },
      });
    }
  }

  private checkImportDone(total: number, totalSelected: number, skipped: number) {
    if (total >= totalSelected) {
      this.importing = false;
      this.closeImportModal();
      const imported = total - skipped;
      if (skipped > 0 && imported > 0) {
        this.toast.success(`${imported} recetas importadas (${skipped} ya existían)`);
      } else if (imported > 0) {
        this.toast.success(`${imported} recetas importadas`);
      } else {
        this.toast.info('Todas las recetas ya estaban importadas');
      }
      this.loadRecipes();
    }
  }

  save() {
    if (!this.form.name || !this.form.type) return;

    const recipeData = { ...this.form, menuId: this.auth.getCurrentMenuId() };
    const obs = this.isNew
      ? this.menuService.createRecipe(recipeData)
      : this.menuService.updateRecipe(this.editingRecipe!.id, recipeData);

    obs.subscribe(() => {
      this.cancelEdit();
      this.loadRecipes();
    });
  }

  async deleteRecipe(recipe: Recipe) {
    const ok = await this.confirmSvc.confirm(`¿Eliminar "${recipe.name}"?`);
    if (!ok) return;
    this.menuService.deleteRecipe(recipe.id).subscribe(() => {
      this.toast.success('Receta eliminada');
      this.loadRecipes();
    });
  }
}
