import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService, Menu } from './services/auth.service';
import { ToastService } from './services/toast.service';
import { ConfirmService } from './services/confirm.service';
import { ToastContainer } from './components/toast-container/toast-container';
import { ConfirmModal } from './components/confirm-modal/confirm-modal';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterModule, ToastContainer, ConfirmModal],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  user: { username: string } | null = null;
  menus: Menu[] = [];
  currentMenuId = 1;

  navItems = [
    { path: '/', label: 'Calendario', icon: '📅' },
    { path: '/recipes', label: 'Recetas', icon: '📖' },
    { path: '/settings', label: 'Ajustes', icon: '⚙️' },
  ];

  showMenuDropdown = false;
  showMenuModal = false;
  menuModalMode: 'create' | 'rename' = 'create';
  menuModalName = '';
  menuModalLoading = false;
  editingMenu: Menu | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private toast: ToastService,
    private confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.auth.user$.subscribe(u => {
      this.user = u;
    });
    this.auth.menus$.subscribe(m => {
      this.menus = m;
    });
    this.auth.currentMenuId$.subscribe(id => {
      this.currentMenuId = id;
    });
    if (this.auth.isLoggedIn()) {
      this.auth.loadMenus();
    }
  }

  get currentMenuName(): string {
    return this.menus.find(m => m.id === this.currentMenuId)?.name ?? 'Seleccionar menú';
  }

  selectMenu(menuId: number) {
    this.auth.setCurrentMenu(menuId);
    this.showMenuDropdown = false;
  }

  toggleMenuDropdown() {
    this.showMenuDropdown = !this.showMenuDropdown;
  }

  closeMenuDropdown() {
    this.showMenuDropdown = false;
  }

  openCreateMenu() {
    this.menuModalMode = 'create';
    this.menuModalName = '';
    this.editingMenu = null;
    this.showMenuModal = true;
    this.showMenuDropdown = false;
  }

  openRenameMenu(menu: Menu, event: Event) {
    event.stopPropagation();
    this.menuModalMode = 'rename';
    this.menuModalName = menu.name;
    this.editingMenu = menu;
    this.showMenuModal = true;
    this.showMenuDropdown = false;
  }

  closeMenuModal() {
    this.showMenuModal = false;
    this.menuModalLoading = false;
  }

  async confirmMenuAction() {
    const name = this.menuModalName.trim();
    if (!name || this.menuModalLoading) return;
    this.menuModalLoading = true;
    if (this.menuModalMode === 'create') {
      await this.auth.createMenu(name);
    } else if (this.menuModalMode === 'rename' && this.editingMenu) {
      await this.auth.renameMenu(this.editingMenu.id, name);
    }
    this.showMenuModal = false;
    this.menuModalLoading = false;
  }

  async deleteMenu(menu: Menu, event: Event) {
    event.stopPropagation();
    const ok = await this.confirm.confirm(`¿Eliminar "${menu.name}"?`);
    if (!ok) return;
    await this.auth.deleteMenu(menu.id);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.showMenuDropdown) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.menu-dropdown')) {
      this.showMenuDropdown = false;
    }
  }

  logout() {
    this.auth.logout();
  }

  isLoginPage(): boolean {
    return this.router.url === '/login';
  }

  isActive(path: string): boolean {
    if (path === '/') {
      return this.router.url === '/' || this.router.url === '';
    }
    return this.router.url.startsWith(path);
  }
}