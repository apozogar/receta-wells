import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MenuService } from '../../services/menu.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit {
  cookidooEmail = '';
  cookidooPassword = '';
  cookidooCountry = 'es';
  cookidooLanguage = 'es-ES';
  geminiApiKey = '';
  groqApiKey = '';

  changePwCurrent = '';
  changePwNew = '';
  changePwConfirm = '';
  changingPw = false;
  changePwResult: string | null = null;

  saved = false;
  testingCookidoo = false;
  cookidooTestResult: string | null = null;

  weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
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
  boardRules: { lunch: string; dinner: string }[] = [
    { lunch: 'legumbres', dinner: 'cena' },
    { lunch: 'verduras', dinner: 'cena' },
    { lunch: 'pescado', dinner: 'cena' },
    { lunch: 'pasta', dinner: 'cena' },
    { lunch: 'carne', dinner: 'free' },
    { lunch: 'free', dinner: 'free' },
    { lunch: 'arroz', dinner: 'cena' },
  ];

  constructor(
    private menuService: MenuService,
    private authService: AuthService,
    private http: HttpClient,
  ) {}

  async changePassword() {
    if (!this.changePwCurrent || !this.changePwNew || !this.changePwConfirm) {
      this.changePwResult = '❌ Rellena todos los campos';
      return;
    }
    if (this.changePwNew !== this.changePwConfirm) {
      this.changePwResult = '❌ Las contraseñas no coinciden';
      return;
    }
    if (this.changePwNew.length < 6) {
      this.changePwResult = '❌ Mínimo 6 caracteres';
      return;
    }
    this.changingPw = true;
    this.changePwResult = null;
    const result = await this.authService.changePassword(this.changePwCurrent, this.changePwNew);
    this.changePwResult = result.ok ? '✅ Contraseña cambiada' : `❌ ${result.error}`;
    this.changingPw = false;
    if (result.ok) {
      this.changePwCurrent = '';
      this.changePwNew = '';
      this.changePwConfirm = '';
    }
  }

  ngOnInit() {
    this.menuService.getSettings().subscribe((settings) => {
      this.cookidooEmail = settings['cookidoo_email'] || '';
      this.cookidooPassword = settings['cookidoo_password'] || '';
      this.cookidooCountry = settings['cookidoo_country'] || 'es';
      this.cookidooLanguage = settings['cookidoo_language'] || 'es-ES';
      this.geminiApiKey = settings['gemini_api_key'] || '';
      this.groqApiKey = settings['groq_api_key'] || '';
      const saved = settings['board_rules'];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const defaultRules = [
            { lunch: 'legumbres', dinner: 'cena' },
            { lunch: 'verduras', dinner: 'cena' },
            { lunch: 'pescado', dinner: 'cena' },
            { lunch: 'pasta', dinner: 'cena' },
            { lunch: 'carne', dinner: 'free' },
            { lunch: 'free', dinner: 'free' },
            { lunch: 'arroz', dinner: 'cena' },
          ];
          this.boardRules = defaultRules.map((d, i) => ({
            lunch: parsed[i]?.lunch || d.lunch,
            dinner: parsed[i]?.dinner || d.dinner,
          }));
        } catch {}
      }
    });
  }

  private saveAllSettings() {
    const rulesObj: any = {};
    for (let i = 0; i < 6; i++) {
      rulesObj[i + 1] = { lunch: this.boardRules[i].lunch, dinner: this.boardRules[i].dinner };
    }
    rulesObj[0] = { lunch: this.boardRules[6].lunch, dinner: this.boardRules[6].dinner };

    const entries = [
      { key: 'cookidoo_email', value: this.cookidooEmail },
      { key: 'cookidoo_password', value: this.cookidooPassword },
      { key: 'cookidoo_country', value: this.cookidooCountry },
      { key: 'cookidoo_language', value: this.cookidooLanguage },
      { key: 'gemini_api_key', value: this.geminiApiKey },
      { key: 'groq_api_key', value: this.groqApiKey },
      { key: 'board_rules', value: JSON.stringify(rulesObj) },
    ];
    // Intenta batch, fallback a individual
    const batch = this.menuService.saveSettingsBatch(entries);
    batch.subscribe({
      next: () => this.onSaved(),
      error: () => {
        // Fallback: guardar uno por uno
        let done = 0;
        entries.forEach(({ key, value }) => {
          this.menuService.saveSetting(key, value).subscribe({
            next: () => { done++; if (done === entries.length) this.onSaved(); },
            error: () => { done++; if (done === entries.length) this.onSaved(); },
          });
        });
      },
    });
  }

  private onSaved() {
    this.saved = true;
    this.cookidooTestResult = null;
    setTimeout(() => (this.saved = false), 3000);
  }

  save() { this.saveAllSettings(); }

  private done(result: string) {
    this.cookidooTestResult = result;
    this.testingCookidoo = false;
    
  }

  testCookidoo() {
    this.testingCookidoo = true;
    this.cookidooTestResult = null;
    

    this.http.post<{ ok: boolean }>('/api/cookidoo/login', {
      email: this.cookidooEmail,
      password: this.cookidooPassword,
    }).subscribe({
      next: () => {
        this.menuService.saveSettingsBatch([
          { key: 'cookidoo_email', value: this.cookidooEmail },
          { key: 'cookidoo_password', value: this.cookidooPassword },
          { key: 'cookidoo_country', value: this.cookidooCountry },
          { key: 'cookidoo_language', value: this.cookidooLanguage },
        ]).subscribe({
          next: () => this.done('✅ Conexión correcta'),
          error: () => {
            // Fallback individual
            this.menuService.saveSetting('cookidoo_email', this.cookidooEmail).subscribe(() => {
              this.menuService.saveSetting('cookidoo_password', this.cookidooPassword).subscribe(() => {
                this.menuService.saveSetting('cookidoo_country', this.cookidooCountry).subscribe(() => {
                  this.menuService.saveSetting('cookidoo_language', this.cookidooLanguage).subscribe(() => {
                    this.done('✅ Conexión correcta');
                  });
                });
              });
            });
          },
        });
      },
      error: (e: any) => this.done(`❌ ${e.error?.error || e.message || 'Error de conexión'}`),
    });
  }
}
