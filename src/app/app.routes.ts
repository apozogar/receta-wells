import { Routes } from '@angular/router';
import { Calendar } from './components/calendar/calendar';
import { RecipeManager } from './components/recipe-manager/recipe-manager';
import { Settings } from './components/settings/settings';
import { ShoppingList } from './components/shopping-list/shopping-list';
import { Login } from './components/login/login';
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: '', component: Calendar, canActivate: [AuthGuard] },
  { path: 'recipes', component: RecipeManager, canActivate: [AuthGuard] },
  { path: 'shopping-list', component: ShoppingList, canActivate: [AuthGuard] },
  { path: 'settings', component: Settings, canActivate: [AuthGuard] },
];