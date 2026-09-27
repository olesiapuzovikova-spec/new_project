import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  @Output() loginSuccess = new EventEmitter<unknown>();

  email = '';
  password = '';
  loading = false;
  error = '';

  async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error = '';

    if (!this.email.trim() || !this.password) {
      this.error = 'Введи email і пароль.';
      return;
    }

    this.loading = true;

    try {
      const response = await fetch(
        'https://frontend53.somee.com/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: this.email.trim(),
            password: this.password,
          }),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        this.error =
          result?.message || result?.title || 'Не вдалося увійти. Перевір дані.';
        return;
      }

      this.loginSuccess.emit(result);
    } catch {
      this.error = 'Не вдалося з’єднатися із сервером.';
    } finally {
      this.loading = false;
    }
  }
}