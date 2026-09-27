import { Component, OnInit } from '@angular/core';

interface EventItem {
  id: number | string;
  title: string;
  description: string;
  date: string;
  location: string;
  price: number;
  image: string;
  category: string;
}

@Component({
  selector: 'app-events',
  standalone: true,
  templateUrl: './events.html',
  styleUrl: './events.css',
})
export class Events implements OnInit {
  events: EventItem[] = [];
  searchText = '';
  loading = true;
  usingDemoData = false;
  selectedEvent: EventItem | null = null;
  errorMessage = '';

  private readonly demoEvents: EventItem[] = [
    {
      id: 1,
      title: 'Вечір живої музики',
      description: 'Концерт сучасних українських виконавців.',
      date: '15 листопада · 19:00',
      location: 'Atlas, Київ',
      price: 650,
      category: 'Музика',
      image:
        'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 2,
      title: 'Світло і простір',
      description: 'Виставка сучасного мистецтва.',
      date: '22 листопада · 18:30',
      location: 'Мистецький арсенал, Київ',
      price: 420,
      category: 'Мистецтво',
      image:
        'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 3,
      title: 'Кіно просто неба',
      description: 'Перегляд фільму та зустріч із кіноманами.',
      date: '29 листопада · 20:00',
      location: 'UNIT.City, Київ',
      price: 300,
      category: 'Кіно',
      image:
        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80',
    },
  ];

  get filteredEvents(): EventItem[] {
    const query = this.searchText.trim().toLowerCase();

    if (!query) return this.events;

    return this.events.filter((event) =>
      `${event.title} ${event.category} ${event.location}`
        .toLowerCase()
        .includes(query),
    );
  }

  ngOnInit(): void {
    this.loadEvents();
  }

  async loadEvents(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      const response = await fetch(
        'https://frontend53.somee.com/api/events',
      );

      if (!response.ok) {
        throw new Error('Сервер повернув помилку.');
      }

      const result: unknown = await response.json();
      const rows = this.getRows(result);

      this.events = rows.map((row, index) => this.toEvent(row, index));
    } catch {
      this.events = this.demoEvents;
      this.usingDemoData = true;
      this.errorMessage =
        'Не вдалося завантажити події з API. Показані демонстраційні дані.';
    } finally {
      this.loading = false;
    }
  }

  openDetails(event: EventItem): void {
    this.selectedEvent = event;
  }

  closeDetails(): void {
    this.selectedEvent = null;
  }

  private getRows(result: unknown): Record<string, unknown>[] {
    if (Array.isArray(result)) {
      return result as Record<string, unknown>[];
    }

    if (result && typeof result === 'object') {
      const data = result as Record<string, unknown>;
      const rows = data['items'] ?? data['data'] ?? data['results'];

      if (Array.isArray(rows)) {
        return rows as Record<string, unknown>[];
      }
    }

    return [];
  }

  private toEvent(row: Record<string, unknown>, index: number): EventItem {
    const title = String(row['title'] ?? row['name'] ?? 'Подія');
    const image = String(
      row['image'] ??
        row['imageUrl'] ??
        row['poster'] ??
        this.demoEvents[index % this.demoEvents.length].image,
    );

    return {
      id: (row['id'] as number | string | undefined) ?? index,
      title,
      description: String(
        row['description'] ?? 'Деталі події скоро з’являться.',
      ),
      date: String(
        row['date'] ?? row['eventDate'] ?? row['startDate'] ?? 'Дату уточнюйте',
      ),
      location: String(
        row['location'] ?? row['venue'] ?? row['place'] ?? 'Місце уточнюйте',
      ),
      price: Number(row['price'] ?? row['ticketPrice'] ?? 0),
      image,
      category: String(row['category'] ?? 'Подія'),
    };
  }
}