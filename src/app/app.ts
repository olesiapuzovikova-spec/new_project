import { Component, OnInit } from '@angular/core';
import { Account } from './account/account';
import { Login } from './login/login';
import { Register } from './register/register';
import type { RegisteredProfile } from './register/register';

interface EventItem {
  id: number | string;
  title: string;
  category: string;
  date: string;
  venue: string;
  price: number;
  image: string;
  description: string;
}

type DataObject = Record<string, unknown>;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Account, Login, Register],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  searchText = '';
  selectedEvent: EventItem | null = null;
  bookingDate = '';
  ticketCount = 1;
  message = '';

  showLogin = false;
  showRegister = false;
  showAccount = false;
  loggedIn = false;
  accountTab: 'profile' | 'bookings' = 'profile';

  private readonly apiUrl = 'https://books-cars-api.onrender.com/api';

  private readonly demoEvents: EventItem[] = [
    {
      id: 1,
      title: 'Вечір живої музики',
      category: 'Музика',
      date: '15 листопада · 19:00',
      venue: 'Atlas, Київ',
      price: 650,
      image:
        'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=900&q=80',
      description: 'Концерт сучасних українських виконавців.',
    },
    {
      id: 2,
      title: 'Світло і простір',
      category: 'Мистецтво',
      date: '22 листопада · 18:30',
      venue: 'Мистецький арсенал, Київ',
      price: 420,
      image:
        'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=80',
      description: 'Виставка сучасного мистецтва.',
    },
    {
      id: 3,
      title: 'Кіно просто неба',
      category: 'Кіно',
      date: '29 листопада · 20:00',
      venue: 'UNIT.City, Київ',
      price: 300,
      image:
        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80',
      description: 'Вечір кіно та зустріч із кіноманами.',
    },
  ];

  events: EventItem[] = [...this.demoEvents];

  get filteredEvents(): EventItem[] {
    const query = this.searchText.trim().toLowerCase();

    if (!query) {
      return this.events;
    }

    return this.events.filter((event) =>
      `${event.title} ${event.category} ${event.venue}`
        .toLowerCase()
        .includes(query),
    );
  }

  ngOnInit(): void {
    this.loggedIn = this.isAuthenticated();
    void this.loadEvents();
  }

  async loadEvents(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/events`);

      if (!response.ok) {
        return;
      }

      const result: unknown = await response.json();
      const rows = this.getRows(result);

      if (rows.length > 0) {
        this.events = rows.map((row, index) => this.toEvent(row, index));
      }
    } catch {
      // Якщо API недоступне, показуємо демонстраційні події.
    }
  }

  openBooking(event: EventItem): void {
    this.selectedEvent = event;
    this.bookingDate = '';
    this.ticketCount = 1;
  }

  closeBooking(): void {
    this.selectedEvent = null;
  }

  async confirmBooking(): Promise<void> {
    if (!this.selectedEvent || !this.bookingDate || this.ticketCount < 1) {
      return;
    }

    const savedAuth = localStorage.getItem('eventpass-auth');

    if (!this.isAuthenticated() || !savedAuth) {
      this.showLogin = true;
      this.showRegister = false;
      this.message = 'Спочатку увійди в акаунт, щоб забронювати квитки.';
      return;
    }

    let userId: number | null = null;

    try {
      userId = this.findUserId(JSON.parse(savedAuth) as unknown);
    } catch {
      userId = null;
    }

    if (userId === null) {
      this.showLogin = true;
      this.showRegister = false;
      this.message = 'Не вдалося прочитати ID із токена. Увійди в акаунт ще раз.';
      return;
    }

    const eventId = Number(this.selectedEvent.id);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      this.message = 'Ця подія не має коректного ID для бронювання.';
      return;
    }

    try {
      const token = this.findToken(JSON.parse(savedAuth) as unknown);
      const headers = new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      });

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(`${this.apiUrl}/bookings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          quantity: this.ticketCount,
          date: `${this.bookingDate}T00:00:00.000Z`,
          userId,
          eventId,
        }),
      });

      const result: unknown = await response.json().catch(() => null);
      const data =
        result && typeof result === 'object'
          ? (result as DataObject)
          : null;

      if (!response.ok || data?.['success'] === false) {
        this.message =
          String(data?.['message'] ?? data?.['title'] ?? '') ||
          'Не вдалося створити бронювання.';
        return;
      }

      const bookedTitle = this.selectedEvent.title;
      this.closeBooking();
      this.showMessage(`Квитки на «${bookedTitle}» заброньовано!`);
    } catch {
      this.message = 'Не вдалося з’єднатися із сервером бронювання.';
    }
  }

  isAuthenticated(): boolean {
    const savedAuth = localStorage.getItem('eventpass-auth');

    if (!savedAuth) {
      return false;
    }

    try {
      const auth = JSON.parse(savedAuth) as { success?: boolean };
      return auth.success === true;
    } catch {
      return false;
    }
  }

  openAccount(tab: 'profile' | 'bookings'): void {
    if (!this.isAuthenticated()) {
      this.loggedIn = false;
      this.showAccount = false;
      this.showLogin = true;
      this.showRegister = false;
      this.message = 'Увійди в акаунт, щоб відкрити профіль.';
      return;
    }

    this.loggedIn = true;
    this.accountTab = tab;
    this.showAccount = true;
  }

  onLoginSuccess(result: unknown): void {
    if (
      !result ||
      typeof result !== 'object' ||
      (result as { success?: boolean }).success !== true
    ) {
      this.message = 'Не вдалося підтвердити вхід. Спробуй ще раз.';
      return;
    }

    localStorage.setItem('eventpass-auth', JSON.stringify(result));

    this.loggedIn = true;
    this.showLogin = false;
    this.showRegister = false;
    this.accountTab = 'profile';
    this.showAccount = true;
  }

  onRegistered(profile: RegisteredProfile): void {
    localStorage.setItem(
      'eventpass-registered-profile',
      JSON.stringify(profile),
    );

    this.showRegister = false;
    this.showMessage('Акаунт створено. Тепер увійди.');
  }

  logout(): void {
    localStorage.removeItem('eventpass-auth');
    this.loggedIn = false;
    this.showAccount = false;
    this.showLogin = false;
    this.showRegister = false;
    this.message = 'Ти вийшла з акаунта.';
  }

  private showMessage(text: string): void {
    this.message = text;

    window.setTimeout(() => {
      this.message = '';
    }, 3500);
  }

  private findUserId(value: unknown): number | null {
    if (typeof value === 'string') {
      const claims = this.decodeJwt(value);

      if (claims) {
        return this.findUserId(claims);
      }

      return null;
    }

    if (!value || typeof value !== 'object') {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findUserId(item);

        if (found !== null) {
          return found;
        }
      }

      return null;
    }

    const object = value as DataObject;
    const idKeys = [
      'userId',
      'user_id',
      'id',
      'nameid',
      'nameidentifier',
      'sub',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    ];

    for (const key of idKeys) {
      const rawId = object[key];

      if (rawId !== null && rawId !== undefined && String(rawId).trim()) {
        const id = Number(rawId);

        if (Number.isInteger(id) && id > 0) {
          return id;
        }
      }
    }

    for (const key of ['user', 'payload', 'data', 'result']) {
      const found = this.findUserId(object[key]);

      if (found !== null) {
        return found;
      }
    }

    for (const item of Object.values(object)) {
      if (item && typeof item === 'object') {
        const found = this.findUserId(item);

        if (found !== null) {
          return found;
        }
      }
    }

    return null;
  }

  private findToken(value: unknown): string | null {
    if (typeof value === 'string') {
      const candidate = value.trim();
      return candidate.split('.').length === 3 ? candidate : null;
    }

    if (!value || typeof value !== 'object') {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findToken(item);

        if (found) {
          return found;
        }
      }

      return null;
    }

    const object = value as DataObject;

    for (const key of ['token', 'accessToken', 'jwt', 'payload']) {
      const found = this.findToken(object[key]);

      if (found) {
        return found;
      }
    }

    return null;
  }

  private decodeJwt(token: string): DataObject | null {
    try {
      const parts = token.split('.');

      if (parts.length !== 3) {
        return null;
      }

      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(
        base64.length + ((4 - (base64.length % 4)) % 4),
        '=',
      );
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const decoded: unknown = JSON.parse(new TextDecoder().decode(bytes));

      return decoded && typeof decoded === 'object' && !Array.isArray(decoded)
        ? (decoded as DataObject)
        : null;
    } catch {
      return null;
    }
  }

  private getRows(result: unknown): DataObject[] {
    if (Array.isArray(result)) {
      return result.filter(
        (row): row is DataObject =>
          row !== null && typeof row === 'object' && !Array.isArray(row),
      );
    }

    if (result && typeof result === 'object') {
      const data = result as DataObject;
      const rows =
        data['items'] ??
        data['data'] ??
        data['results'] ??
        data['payload'];

      if (Array.isArray(rows)) {
        return rows.filter(
          (row): row is DataObject =>
            row !== null && typeof row === 'object' && !Array.isArray(row),
        );
      }

      if (rows && typeof rows === 'object') {
        const nested = rows as DataObject;
        const nestedRows =
          nested['items'] ?? nested['results'] ?? nested['events'];

        if (Array.isArray(nestedRows)) {
          return nestedRows.filter(
            (row): row is DataObject =>
              row !== null && typeof row === 'object' && !Array.isArray(row),
          );
        }
      }
    }

    return [];
  }

  private toEvent(row: DataObject, index: number): EventItem {
    const fallback = this.demoEvents[index % this.demoEvents.length];

    return {
      id: (row['id'] as number | string | undefined) ?? index + 1,
      title: String(row['title'] ?? row['name'] ?? 'Подія'),
      category: String(row['category'] ?? 'Подія'),
      date: String(
        row['date'] ?? row['eventDate'] ?? row['startDate'] ?? 'Дату уточнюйте',
      ),
      venue: String(
        row['venue'] ?? row['location'] ?? row['place'] ?? 'Місце уточнюйте',
      ),
      price: Number(row['price'] ?? row['ticketPrice'] ?? 0),
      image: String(
        row['image'] ?? row['imageUrl'] ?? row['poster'] ?? fallback.image,
      ),
      description: String(
        row['description'] ?? 'Деталі події скоро з’являться.',
      ),
    };
  }
}