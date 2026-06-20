import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MenuService } from '../../services/menu.service';

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
  mercadonaWarehouse = '146';
  geminiApiKey = '';
  groqApiKey = '';
  mercadonaCustomerUuid = '';
  mercadonaAccessToken = '';

  saved = false;
  testingCookidoo = false;
  cookidooTestResult: string | null = null;

  constructor(
    private menuService: MenuService,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.menuService.getSettings().subscribe((settings) => {
      this.cookidooEmail = settings['cookidoo_email'] || '';
      this.cookidooPassword = settings['cookidoo_password'] || '';
      this.cookidooCountry = settings['cookidoo_country'] || 'es';
      this.cookidooLanguage = settings['cookidoo_language'] || 'es-ES';
      this.mercadonaWarehouse = settings['mercadona_warehouse'] || '146';
      this.geminiApiKey = settings['gemini_api_key'] || '';
      this.groqApiKey = settings['groq_api_key'] || '';
      this.mercadonaCustomerUuid = settings['mercadona_customer_uuid'] || '';
      this.mercadonaAccessToken = settings['mercadona_access_token'] || '';
    });
  }

  private saveAllSettings() {
    const entries = [
      { key: 'cookidoo_email', value: this.cookidooEmail },
      { key: 'cookidoo_password', value: this.cookidooPassword },
      { key: 'cookidoo_country', value: this.cookidooCountry },
      { key: 'cookidoo_language', value: this.cookidooLanguage },
      { key: 'gemini_api_key', value: this.geminiApiKey },
      { key: 'groq_api_key', value: this.groqApiKey },
      { key: 'mercadona_warehouse', value: this.mercadonaWarehouse },
      { key: 'mercadona_customer_uuid', value: this.mercadonaCustomerUuid },
      { key: 'mercadona_access_token', value: this.mercadonaAccessToken },
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
