import { Component, EventEmitter, Output } from '@angular/core';

export interface RegisteredProfile {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  @Output() registered = new EventEmitter<RegisteredProfile>();

  username = '';
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  loading = false;
  error = '';
  success = '';

  async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error = '';
    this.success = '';

    if (
      !this.username.trim() ||
      !this.firstName.trim() ||
      !this.lastName.trim() ||
      !this.email.trim() ||
      !this.password
    ) {
      this.error = 'Заповни всі поля.';
      return;
    }

    this.loading = true;

    try {
      const response = await fetch(
        'https://frontend53.somee.com/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.username.trim(),
            email: this.email.trim(),
            password: this.password,
            firstName: this.firstName.trim(),
            lastName: this.lastName.trim(),
            image: '',
          }),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success === false) {
        this.error =
          result?.message || result?.title || 'Не вдалося зареєструватися.';
        return;
      }

      this.success = 'Акаунт створено. Тепер увійди.';
      this.registered.emit({
        username: this.username.trim(),
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email: this.email.trim(),
      });
    } catch {
      this.error = 'Не вдалося з’єднатися із сервером.';
    } finally {
      this.loading = false;
    }
  }
}