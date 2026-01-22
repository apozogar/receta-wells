import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarEntry, MenuService, Recipe } from '../../services/menu.service';

interface CalendarDay {
  day: number | null;
  isToday: boolean;
  lunch?: Recipe;
  dinner?: Recipe;
  isEmpty: boolean;
}

@Component({
  selector: 'app-calendar',
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
})
export class Calendar implements OnInit {
  weekDays: string[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  calendarDays: CalendarDay[] = [];
  recipes: Recipe[] = [];

  // Estado para edición
  editingDay: CalendarDay | null = null;
  editingSlot: 'lunch' | 'dinner' | null = null;
  availableRecipesForSlot: Recipe[] = [];

  constructor(private menuService: MenuService) {}

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
    this.menuService.getRecipes().subscribe((recipes) => {
      this.recipes = recipes;
      this.loadSavedCalendar();
    });
  }

  getRandomRecipe(type: string, excludeIds: (number | null)[], isDinner = false): Recipe {
    if (type === 'free')
      return { name: '✨ Libre / Fuera', id: -1, type: 'free', slot: 'any', tags: [] };
    if (type === 'arroz')
      return {
        name: '🍚 Arroz / Batch Cooking',
        id: -2,
        type: 'arroz',
        slot: 'lunch',
        tags: ['Tupper'],
      };
    if (type === 'improvisar')
      return { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any', tags: [] };

    let pool = this.recipes.filter((r) => {
      if (isDinner && r.slot === 'lunch') return false; // No pasta pesada de noche
      return (
        (r.type === type || (type === 'cena' && r.type === 'cena')) && !excludeIds.includes(r.id)
      );
    });

    // Si se nos acaban las recetas de un tipo, reseteamos el filtro de exclusión para ese tipo
    if (pool.length === 0) {
      pool = this.recipes.filter((r) => r.type === type || (type === 'cena' && r.type === 'cena'));
    }

    if (pool.length === 0)
      return { name: 'Improvisar (Verde+Prot)', id: -3, type: 'improvisar', slot: 'any', tags: [] };

    const random = pool[Math.floor(Math.random() * pool.length)];
    return random;
  }

  generateCalendar() {
    this.calendarDays = []; // Limpiar
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    // Primer día del mes
    const firstDay = new Date(year, month, 1);
    // Ajustar para que Lunes sea 1 (JS devuelve Domingo = 0)
    let startingDay = firstDay.getDay();
    if (startingDay === 0) startingDay = 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayDate = now.getDate();

    // Rellenar huecos vacíos antes del día 1
    for (let i = 1; i < startingDay; i++) {
      this.calendarDays.push({ day: null, isToday: false, isEmpty: true });
    }

    let usedIds: (number | null)[] = [];

    // Generar días
    for (let d = 1; d <= daysInMonth; d++) {
      const currentDayDate = new Date(year, month, d);
      const dayOfWeek = currentDayDate.getDay(); // 0 (Dom) - 6 (Sab)

      const rule = this.rules[dayOfWeek];

      // Generar recetas
      const lunch = this.getRandomRecipe(rule.lunch, usedIds, false);
      if (lunch.id) usedIds.push(lunch.id);

      const dinner = this.getRandomRecipe(rule.dinner, usedIds, true);
      if (dinner.id) usedIds.push(dinner.id);

      this.calendarDays.push({
        day: d,
        isToday: d === todayDate,
        lunch: lunch,
        dinner: dinner,
        isEmpty: false,
      });
    }
    this.saveCalendar();
  }

  loadSavedCalendar() {
    const now = new Date();
    this.menuService.getCalendar(now.getMonth(), now.getFullYear()).subscribe((entries) => {
      if (entries && entries.length > 0) {
        // Reconstruir calendario desde BD
        this.calendarDays = [];
        const year = now.getFullYear();
        const month = now.getMonth();
        const firstDay = new Date(year, month, 1);
        let startingDay = firstDay.getDay();
        if (startingDay === 0) startingDay = 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayDate = now.getDate();

        for (let i = 1; i < startingDay; i++) {
          this.calendarDays.push({ day: null, isToday: false, isEmpty: true });
        }

        for (let d = 1; d <= daysInMonth; d++) {
          const entry = entries.find((e) => e.day === d);
          const lunch = entry ? this.getRecipeById(entry.lunch_recipe_id) : undefined;
          const dinner = entry ? this.getRecipeById(entry.dinner_recipe_id) : undefined;

          this.calendarDays.push({
            day: d,
            isToday: d === todayDate,
            lunch: lunch,
            dinner: dinner,
            isEmpty: false,
          });
        }
      } else {
        this.generateCalendar();
      }
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

  saveCalendar() {
    const now = new Date();
    const entries: CalendarEntry[] = this.calendarDays
      .filter((d) => d.day !== null)
      .map((d) => ({
        day: d.day!,
        month: now.getMonth(),
        year: now.getFullYear(),
        lunchId: d.lunch?.id || null,
        dinnerId: d.dinner?.id || null,
      }));

    this.menuService.saveCalendar(entries).subscribe(() => {
      alert('Calendario guardado correctamente en la base de datos.');
    });
  }

  startEdit(day: CalendarDay, slot: 'lunch' | 'dinner') {
    this.editingDay = day;
    this.editingSlot = slot;
    // Cargar todas las recetas para el combo
    // Podríamos filtrar por tipo si quisiéramos ser estrictos, pero mejor mostrar todas
    this.availableRecipesForSlot = [
      ...this.recipes,
      { name: '✨ Libre', id: -1, type: 'free', slot: 'any', tags: [] } as Recipe,
    ];
  }

  finishEdit() {
    this.editingDay = null;
    this.editingSlot = null;
    this.saveCalendar();
  }

  print() {
    window.print();
  }

  async addToShoppingList() {
    const recipeIds = new Set<string>();
    this.calendarDays.forEach((day) => {
      if (day.lunch?.cookidooId) recipeIds.add(day.lunch.cookidooId);
      if (day.dinner?.cookidooId) recipeIds.add(day.dinner.cookidooId);
    });

    if (recipeIds.size === 0) {
      alert('No hay recetas con ID de Cookidoo en el menú generado.');
      return;
    }

    // Pedimos las cookies al usuario
    const cookies = prompt(
      "Para añadir las recetas, pega aquí tus cookies de sesión de Cookidoo (el valor del header 'Cookie'):",
    );
    if (!cookies) return;

    const payload = { recipeIDs: Array.from(recipeIds) };

    try {
      // Intentamos la petición directa (nota: el navegador suele bloquear el header 'Cookie' manual)
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

      if (response.ok) {
        alert('¡Recetas añadidas correctamente a la lista de la compra!');
      } else {
        throw new Error(`Error ${response.status}`);
      }
    } catch (error) {
      console.error('No se pudo realizar la petición directa (CORS/Seguridad). Generando CURL...');

      // Generamos el comando CURL para Windows (usando ^ para saltos de línea)
      const curl = `curl "https://cookidoo.es/shopping/es-ES/add-recipes" ^
  -H "accept: */*" ^
  -H "content-type: application/json" ^
  -H "cookie: ${cookies.replace(/"/g, '\\"')}" ^
  -H "origin: https://cookidoo.es" ^
  -H "x-requested-with: xmlhttprequest" ^
  --data-raw "${JSON.stringify(payload).replace(/"/g, '\\"')}"`;

      console.log(
        '%c Copia y pega este comando en tu terminal:',
        'color: green; font-weight: bold; font-size: 12px',
      );
      console.log(curl);

      alert(
        `El navegador bloqueó la petición automática (es normal por seguridad). He generado un comando CURL con las ${recipeIds.size} recetas en la consola (F12) para que lo copies y pegues.`,
      );
    }
  }
}
