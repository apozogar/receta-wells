import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  isRegister = false;
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  loading = false;
  error = '';

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/']);
    }
  }

  toggleMode() {
    this.isRegister = !this.isRegister;
    this.error = '';
  }

  async submit() {
    this.error = '';
    if (!this.username || !this.password) {
      this.error = 'Completa todos los campos';
      
      return;
    }
    if (this.isRegister) {
      if (this.password !== this.confirmPassword) {
        this.error = 'Las contraseñas no coinciden';
        
        return;
      }
      if (!this.email) {
        this.error = 'El email es obligatorio';
        
        return;
      }
    }

    this.loading = true;
    
    const result = this.isRegister
      ? await this.auth.register(this.username, this.email, this.password)
      : await this.auth.login(this.username, this.password);

    this.loading = false;
    if (result.ok) {
      this.router.navigate(['/']);
    } else {
      this.error = result.error || 'Error desconocido';
    }
    
  }
}