import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  editingRecipe: Recipe | null = null;
  isNew = false;
  loading = true;
  errorMessage = '';

  form: Omit<Recipe, 'id'> = {
    name: '',
    type: 'cena',
    slot: 'any',
    tags: [],
    cookidooId: '',
  };
  tagInput = '';

  searchQuery = '';
  searchResults: { name: string; id: string }[] = [];
  searching = false;

  readonly typeOptions = ['legumbres', 'verduras', 'pescado', 'pasta', 'carne', 'cena'];
  readonly slotOptions: { value: Recipe['slot']; label: string }[] = [
    { value: 'any', label: 'Cualquiera' },
    { value: 'lunch', label: 'Solo comida' },
    { value: 'dinner', label: 'Solo cena' },
  ];

  constructor(
    private menuService: MenuService,
    private auth: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
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
    this.cdr.detectChanges();
    console.log('RecipeManager: fetching recipes...');
    this.http.get<Recipe[]>('/api/recipes').subscribe({
      next: (recipes) => {
        console.log('RecipeManager: recipes received', recipes?.length);
        this.recipes = recipes;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error('RecipeManager: error fetching recipes', e);
        this.errorMessage = 'Error: ' + (e.message || e.status || 'conexión');
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  startNew() {
    this.isNew = true;
    this.editingRecipe = null;
    this.form = { name: '', type: 'cena', slot: 'any', tags: [], cookidooId: '' };
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
    this.cdr.detectChanges();
    this.http.get<{ results: { name: string; id: string }[] }>(
      `/api/cookidoo/search?q=${encodeURIComponent(q)}`,
    ).subscribe({
      next: (res) => {
        this.searchResults = res.results;
        this.searching = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.searching = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectCookidooResult(r: { name: string; id: string }) {
    this.form.cookidooId = r.id;
    this.form.name = r.name;
    this.searchResults = [];
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
