import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Recipe {
  id: number | null;
  name: string;
  type: string;
  slot: string;
  tags: string[];
  cookidooId?: string;
}

interface CalendarDay {
  day: number | null;
  isToday: boolean;
  lunch?: Recipe;
  dinner?: Recipe;
  isEmpty: boolean;
}

@Component({
  selector: 'app-calendar',
  imports: [CommonModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
})
export class Calendar implements OnInit {
  weekDays: string[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  calendarDays: CalendarDay[] = [];

  // --- 1. BASE DE DATOS DE RECETAS ---
  recipes: Recipe[] = [
    // LUNES: LEGUMBRES
    { id: 1, name: "Lentejas estofadas con verduras", type: "legumbres", slot: "lunch", tags: ["HP"], cookidooId: "r255618" },
    { id: 2, name: "Garbanzos con espinacas y bacalao", type: "legumbres", slot: "lunch", tags: ["HP"] },
    { id: 3, name: "Alubias blancas con almejas", type: "legumbres", slot: "lunch", tags: ["Bajo Grasa"] },
    // MARTES: VERDURAS
    { id: 4, name: "Judías verdes + Huevo poché", type: "verduras", slot: "any", tags: ["Cena Top"] },
    { id: 5, name: "Crema de calabacín (con queso batido)", type: "verduras", slot: "any", tags: ["Ligero"] },
    { id: 6, name: "Menestra de verduras con jamón", type: "verduras", slot: "lunch", tags: ["Vit"] },
    // MIÉRCOLES: PESCADO
    { id: 7, name: "Dorada a la sal (Varoma)", type: "pescado", slot: "any", tags: ["Clean"] },
    { id: 8, name: "Merluza en salsa verde", type: "pescado", slot: "lunch", tags: ["Prot"] },
    { id: 9, name: "Salmón vapor + trigueros", type: "pescado", slot: "dinner", tags: ["Grasas"] },
    // JUEVES: PASTA
    { id: 10, name: "Pasta integral boloñesa pavo", type: "pasta", slot: "lunch", tags: ["Energía"] },
    { id: 11, name: "Zoodles (Calabacín) con gambas", type: "pasta", slot: "dinner", tags: ["Low Carb"] },
    // VIERNES: CARNE
    { id: 12, name: "Pollo al chilindrón", type: "carne", slot: "lunch", tags: ["Clásico"] },
    { id: 13, name: "Solomillo cerdo mostaza", type: "carne", slot: "lunch", tags: ["Gourmet"] },
    { id: 14, name: "Pavo estofado setas", type: "carne", slot: "any", tags: ["Saciante"] },
    // CENAS LIGERAS
    { id: 15, name: "Huevos rellenos atún (sin mayo)", type: "cena", slot: "dinner", tags: ["Rápido"] },
    { id: 16, name: "Crema calabaza y jengibre", type: "cena", slot: "dinner", tags: ["Detox"] },
    { id: 17, name: "Mejillones vapor picadillo", type: "cena", slot: "dinner", tags: ["Varoma"] },
    { id: 18, name: "Tortilla francesa + Gazpacho", type: "cena", slot: "dinner", tags: ["Express"] },
    { id: 19, name: "Revuelto setas y gambas", type: "cena", slot: "dinner", tags: ["Prot"] },
    { id: 20, name: "Sepia plancha + Ensalada", type: "cena", slot: "dinner", tags: ["Clean"] },
    // NUEVAS RECETAS THERMOMIX
    { id: 21, name: "Lentejas curry y pollo", type: "legumbres", slot: "lunch", tags: ["Exótico"] },
    { id: 22, name: "Vichyssoise ligera", type: "verduras", slot: "any", tags: ["Clásico"] },
    { id: 23, name: "Coliflor ajoarriero", type: "verduras", slot: "dinner", tags: ["Low Carb"] },
    { id: 24, name: "Marmitako de bonito", type: "pescado", slot: "lunch", tags: ["Cuchara"] },
    { id: 25, name: "Calamares en su tinta", type: "pescado", slot: "lunch", tags: ["Tradición"] },
    { id: 26, name: "Fideuá de marisco", type: "pasta", slot: "lunch", tags: ["Top"] },
    { id: 27, name: "Carrilladas vino tinto", type: "carne", slot: "lunch", tags: ["Tierno"] },
    { id: 28, name: "Pollo Tikka Masala", type: "carne", slot: "lunch", tags: ["Especias"] },
    { id: 29, name: "Sopa Juliana", type: "cena", slot: "dinner", tags: ["Detox"] },
    { id: 30, name: "Pastel calabacín y atún", type: "cena", slot: "dinner", tags: ["Varoma"] }
  ];

  // Reglas de la pizarra
  rules: { [key: number]: { lunch: string, dinner: string } } = {
    1: { lunch: "legumbres", dinner: "cena" }, // Lunes
    2: { lunch: "verduras", dinner: "cena" },  // Martes
    3: { lunch: "pescado", dinner: "cena" },   // Miércoles
    4: { lunch: "pasta", dinner: "cena" },     // Jueves
    5: { lunch: "carne", dinner: "free" },     // Viernes
    6: { lunch: "free", dinner: "free" },      // Sábado
    0: { lunch: "arroz", dinner: "cena" }      // Domingo (Arroz o Batch Cooking)
  };

  ngOnInit() {
    this.generateCalendar();
  }

  getRandomRecipe(type: string, excludeIds: (number | null)[], isDinner = false): Recipe {
    if (type === "free") return { name: "✨ Libre / Fuera", id: null, type: 'free', slot: 'any', tags: [] };
    if (type === "arroz") return { name: "🍚 Arroz / Batch Cooking", id: null, type: 'arroz', slot: 'lunch', tags: ["Tupper"] };

    let pool = this.recipes.filter(r => {
      if (isDinner && r.slot === 'lunch') return false; // No pasta pesada de noche
      return (r.type === type || (type === 'cena' && r.type === 'cena')) && !excludeIds.includes(r.id);
    });

    // Si se nos acaban las recetas de un tipo, reseteamos el filtro de exclusión para ese tipo
    if (pool.length === 0) {
      pool = this.recipes.filter(r => r.type === type || (type === 'cena' && r.type === 'cena'));
    }

    if (pool.length === 0) return { name: "Improvisar (Verde+Prot)", id: null, type: 'improvisar', slot: 'any', tags: [] };

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
        isEmpty: false
      });
    }
  }

  print() {
    window.print();
  }

  async addToShoppingList() {
    const recipeIds = new Set<string>();
    this.calendarDays.forEach(day => {
      if (day.lunch?.cookidooId) recipeIds.add(day.lunch.cookidooId);
      if (day.dinner?.cookidooId) recipeIds.add(day.dinner.cookidooId);
    });

    if (recipeIds.size === 0) {
      alert('No hay recetas con ID de Cookidoo en el menú generado.');
      return;
    }

    // Pedimos las cookies al usuario
    const cookies = prompt("Para añadir las recetas, pega aquí tus cookies de sesión de Cookidoo (el valor del header 'Cookie'):");
    if (!cookies) return;

    const payload = { recipeIDs: Array.from(recipeIds) };

    try {
      // Intentamos la petición directa (nota: el navegador suele bloquear el header 'Cookie' manual)
      const response = await fetch("https://cookidoo.es/shopping/es-ES/add-recipes", {
        method: "POST",
        headers: {
          "accept": "*/*",
          "content-type": "application/json",
          "x-requested-with": "xmlhttprequest",
          "Cookie": cookies
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("¡Recetas añadidas correctamente a la lista de la compra!");
      } else {
        throw new Error(`Error ${response.status}`);
      }
    } catch (error) {
      console.error("No se pudo realizar la petición directa (CORS/Seguridad). Generando CURL...");
      
      // Generamos el comando CURL para Windows (usando ^ para saltos de línea)
      const curl = `curl "https://cookidoo.es/shopping/es-ES/add-recipes" ^
  -H "accept: */*" ^
  -H "content-type: application/json" ^
  -H "cookie: ${cookies.replace(/"/g, '\\"')}" ^
  -H "origin: https://cookidoo.es" ^
  -H "x-requested-with: xmlhttprequest" ^
  --data-raw "${JSON.stringify(payload).replace(/"/g, '\\"')}"`;

      console.log("%c Copia y pega este comando en tu terminal:", "color: green; font-weight: bold; font-size: 12px");
      console.log(curl);
      
      alert(`El navegador bloqueó la petición automática (es normal por seguridad). He generado un comando CURL con las ${recipeIds.size} recetas en la consola (F12) para que lo copies y pegues.`);
    }
  }
}
