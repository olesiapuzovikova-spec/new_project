import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

type AccountTab = 'profile' | 'bookings';
type DataObject = Record<string, unknown>;

interface BookingView {
  id: string;
  title: string;
  date: string;
  quantity: string;
  venue: string;
}

interface ProfileEditForm {
  userName: string;
  country: string;
  birthDate: string;
  aboutMe: string;
}

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account implements OnInit {
  @Input() initialTab: AccountTab = 'profile';

  @Output() close = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  activeTab: AccountTab = 'profile';
  profile: DataObject | null = null;
  bookings: BookingView[] = [];

  profileLoading = false;
  bookingsLoading = false;
  savingProfile = false;
  isEditing = false;

  profileError = '';
  bookingsError = '';
  saveError = '';
  saveMessage = '';

  editForm: ProfileEditForm = this.emptyForm();

  private readonly apiUrl = 'https://books-cars-api.onrender.com/api';
  private token: string | null = null;
  private tokenClaims: DataObject = {};

  ngOnInit(): void {
    this.activeTab = this.initialTab;
    this.token = this.readToken();
    this.tokenClaims = this.readTokenClaims();

    void this.loadProfile();
    void this.loadBookings();
  }

  async loadProfile(): Promise<void> {
    this.profileLoading = true;
    this.profileError = '';

    const savedProfile = this.readRegisteredProfile();

    try {
      const response = await fetch(
        `${this.apiUrl}/user?page=1&page_size=100`,
        { headers: { Accept: 'application/json' } },
      );

      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        this.profile = this.matchingRegisteredProfile(savedProfile);

        if (!this.profile) {
          this.profileError = this.getErrorMessage(
            result,
            'Не вдалося завантажити профіль.',
          );
        }

        return;
      }

      const users = this.findArray(result);
      const user = this.findCurrentUser(users, savedProfile);

      if (user) {
        this.profile = {
          ...this.claimsAsProfile(),
          ...(this.matchingRegisteredProfile(savedProfile) ?? {}),
          ...user,
        };
      } else {
        this.profile =
          this.matchingRegisteredProfile(savedProfile) ??
          this.claimsAsProfile();

        if (!this.profile || Object.keys(this.profile).length === 0) {
          this.profileError =
            'Не вдалося знайти дані твого профілю. Перевір, чи ти увійшла у потрібний акаунт.';
        }
      }
    } catch {
      this.profile = this.matchingRegisteredProfile(savedProfile);

      if (!this.profile) {
        this.profileError = 'Не вдалося з’єднатися із сервером.';
      }
    } finally {
      this.profileLoading = false;
    }
  }

  async loadBookings(): Promise<void> {
    this.bookingsLoading = true;
    this.bookingsError = '';

    try {
      const response = await fetch(`${this.apiUrl}/bookings/my`, {
        headers: this.authHeaders(),
      });

      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        this.bookingsError = this.getErrorMessage(
          result,
          'Не вдалося завантажити бронювання.',
        );
        return;
      }

      this.bookings = this.findArray(result).map((row, index) =>
        this.toBooking(row, index),
      );
    } catch {
      this.bookingsError = 'Не вдалося з’єднатися із сервером.';
    } finally {
      this.bookingsLoading = false;
    }
  }

  startEditing(): void {
    if (!this.profile) {
      return;
    }

    this.editForm = {
      userName: this.getText(this.profile, 'userName', 'username'),
      country: this.getText(this.profile, 'country'),
      birthDate: this.toDateInputValue(
        this.getText(this.profile, 'birthDate', 'dateOfBirth'),
      ),
      aboutMe: this.getText(this.profile, 'aboutMe', 'about'),
    };

    this.saveError = '';
    this.saveMessage = '';
    this.isEditing = true;
  }

  cancelEditing(): void {
    this.isEditing = false;
    this.saveError = '';
    this.editForm = this.emptyForm();
  }

  async saveProfile(): Promise<void> {
    if (!this.profile) {
      this.saveError = 'Дані профілю ще не завантажено.';
      return;
    }

    const userId = this.getProfileId();

    if (userId === null) {
      this.saveError = 'Не вдалося визначити ID користувача.';
      return;
    }

    this.savingProfile = true;
    this.saveError = '';
    this.saveMessage = '';

    const birthDate = this.editForm.birthDate
      ? `${this.editForm.birthDate}T00:00:00`
      : null;

    const body = {
      userId,
      userName: this.editForm.userName.trim(),
      country: this.editForm.country.trim(),
      birthDate,
      aboutMe: this.editForm.aboutMe.trim(),
    };

    try {
      const response = await fetch(`${this.apiUrl}/user/profile`, {
        method: 'PATCH',
        headers: this.authHeaders(true),
        body: JSON.stringify(body),
      });

      const result: unknown = await response.json().catch(() => null);
      const resultObject =
        result && typeof result === 'object' ? (result as DataObject) : null;

      if (!response.ok || resultObject?.['success'] === false) {
        this.saveError = this.getErrorMessage(
          result,
          'Не вдалося зберегти зміни профілю.',
        );
        return;
      }

      this.profile = {
        ...this.profile,
        ...body,
      };

      this.isEditing = false;
      this.saveMessage = 'Зміни профілю збережено.';
    } catch {
      this.saveError =
        'Не вдалося з’єднатися із сервером. Перевір, чи API доступне.';
    } finally {
      this.savingProfile = false;
    }
  }

  value(...keys: string[]): string {
    if (!this.profile) {
      return '—';
    }

    for (const key of keys) {
      const value = this.profile[key];

      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value);
      }
    }

    return '—';
  }

  displayDate(...keys: string[]): string {
    const value = this.value(...keys);

    if (value === '—') {
      return value;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('uk-UA').format(date);
  }

  private getProfileId(): number | null {
    const profileId = Number(this.profile?.['id'] ?? this.profile?.['userId']);

    if (Number.isInteger(profileId) && profileId > 0) {
      return profileId;
    }

    const claimId = Number(
      this.claimValue(
        'id',
        'userId',
        'user_id',
        'nameid',
        'nameidentifier',
        'sub',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
      ),
    );

    return Number.isInteger(claimId) && claimId > 0 ? claimId : null;
  }

  private findCurrentUser(
    users: DataObject[],
    savedProfile: DataObject | null,
  ): DataObject | null {
    const email =
      this.claimValue('email', 'emailaddress') ||
      String(savedProfile?.['email'] ?? '');

    const userId = this.claimValue(
      'id',
      'userId',
      'user_id',
      'nameid',
      'nameidentifier',
      'sub',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    );

    const username =
      this.claimValue('username', 'userName', 'unique_name') ||
      String(savedProfile?.['userName'] ?? savedProfile?.['username'] ?? '');

    if (email) {
      const match = users.find(
        (user) =>
          this.normalize(user['email']) === this.normalize(email),
      );

      if (match) {
        return match;
      }
    }

    if (userId) {
      const match = users.find(
        (user) =>
          String(user['id'] ?? user['userId'] ?? '') === String(userId),
      );

      if (match) {
        return match;
      }
    }

    if (username) {
      const match = users.find(
        (user) =>
          this.normalize(user['userName']) === this.normalize(username),
      );

      if (match) {
        return match;
      }
    }

    return null;
  }

  private matchingRegisteredProfile(
    savedProfile: DataObject | null,
  ): DataObject | null {
    if (!savedProfile) {
      return null;
    }

    const authEmail = this.normalize(this.claimValue('email', 'emailaddress'));
    const savedEmail = this.normalize(savedProfile['email']);

    if (authEmail && savedEmail && authEmail !== savedEmail) {
      return null;
    }

    return savedProfile;
  }

  private claimsAsProfile(): DataObject {
    const claims = this.tokenClaims;

    return {
      id: this.claimValue(
        'id',
        'userId',
        'user_id',
        'nameid',
        'nameidentifier',
        'sub',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
      ),
      email: this.claimValue('email', 'emailaddress'),
      userName: this.claimValue('userName', 'username', 'unique_name'),
      firstName: this.claimValue('firstName', 'given_name'),
      lastName: this.claimValue('lastName', 'family_name'),
      country: this.claimValue('country'),
      birthDate: this.claimValue('birthDate'),
      aboutMe: this.claimValue('aboutMe'),
    };
  }

  private claimValue(...names: string[]): string {
    const wanted = new Set(names.map((name) => name.toLowerCase()));

    for (const [key, value] of Object.entries(this.tokenClaims)) {
      if (
        wanted.has(key.toLowerCase()) &&
        value !== null &&
        value !== undefined &&
        String(value).trim()
      ) {
        return String(value);
      }
    }

    return '';
  }

  private readRegisteredProfile(): DataObject | null {
    try {
      const saved = localStorage.getItem('eventpass-registered-profile');

      if (!saved) {
        return null;
      }

      const parsed: unknown = JSON.parse(saved);

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as DataObject)
        : null;
    } catch {
      return null;
    }
  }

  private readToken(): string | null {
    try {
      const saved = localStorage.getItem('eventpass-auth');

      return saved ? this.findToken(JSON.parse(saved) as unknown) : null;
    } catch {
      return null;
    }
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
        const token = this.findToken(item);

        if (token) {
          return token;
        }
      }

      return null;
    }

    const object = value as DataObject;

    for (const key of ['token', 'accessToken', 'jwt', 'payload']) {
      const token = this.findToken(object[key]);

      if (token) {
        return token;
      }
    }

    return null;
  }

  private readTokenClaims(): DataObject {
    if (!this.token) {
      return {};
    }

    try {
      const payload = this.token.split('.')[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(
        base64.length + ((4 - (base64.length % 4)) % 4),
        '=',
      );
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as DataObject)
        : {};
    } catch {
      return {};
    }
  }

  private authHeaders(json = false): Headers {
    const headers = new Headers({ Accept: 'application/json' });

    if (json) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    return headers;
  }

  private findArray(value: unknown): DataObject[] {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is DataObject =>
          item !== null && typeof item === 'object' && !Array.isArray(item),
      );
    }

    if (value && typeof value === 'object') {
      const object = value as DataObject;

      for (const key of ['items', 'bookings', 'results', 'payload', 'data']) {
        const rows = this.findArray(object[key]);

        if (rows.length > 0) {
          return rows;
        }
      }
    }

    return [];
  }

  private toBooking(row: DataObject, index: number): BookingView {
    const event =
      row['event'] && typeof row['event'] === 'object'
        ? (row['event'] as DataObject)
        : {};

    return {
      id: String(row['id'] ?? index + 1),
      title: String(
        row['eventTitle'] ?? row['title'] ?? event['title'] ?? 'Подія',
      ),
      date: String(row['date'] ?? row['eventDate'] ?? 'Дата не вказана'),
      quantity: String(row['quantity'] ?? row['ticketCount'] ?? '—'),
      venue: String(row['venue'] ?? event['venue'] ?? 'Місце не вказане'),
    };
  }

  private getText(object: DataObject, ...keys: string[]): string {
    for (const key of keys) {
      const value = object[key];

      if (value !== null && value !== undefined) {
        return String(value);
      }
    }

    return '';
  }

  private toDateInputValue(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private emptyForm(): ProfileEditForm {
    return {
      userName: '',
      country: '',
      birthDate: '',
      aboutMe: '',
    };
  }

  private getErrorMessage(result: unknown, fallback: string): string {
    if (result && typeof result === 'object') {
      const object = result as DataObject;
      const message = object['message'] ?? object['title'];

      if (message) {
        return String(message);
      }
    }

    return fallback;
  }
}