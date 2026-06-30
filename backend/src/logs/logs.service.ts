import { Injectable } from '@nestjs/common';

export type LogCategory = 'mentor' | 'admin' | 'tutor' | 'auth';

export interface ApiLogEntry {
  id: number;
  ts: string;
  method: string;
  path: string;
  status: number | null;
  durationMs: number;
  category: LogCategory;
  error?: string;
}

const BUFFER_SIZE = 500;

@Injectable()
export class LogsService {
  private buffer: ApiLogEntry[] = [];
  private counter = 0;

  add(entry: Omit<ApiLogEntry, 'id' | 'ts'>): void {
    this.buffer.push({
      id: ++this.counter,
      ts: new Date().toISOString(),
      ...entry,
    });
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.splice(0, this.buffer.length - BUFFER_SIZE);
    }
  }

  get(category?: LogCategory, limit = 200): ApiLogEntry[] {
    const list = category
      ? this.buffer.filter((e) => e.category === category)
      : this.buffer;
    return list.slice(-limit).reverse();
  }

  /** Derive category from Mars API path. */
  static categorize(path: string): LogCategory {
    if (path.includes('/auth/')) return 'auth';
    if (path.includes('/controls/')) return 'tutor';
    if (
      path.includes('/attendance') ||
      path.includes('/groups') ||
      path.includes('/students')
    )
      return 'mentor';
    return 'admin';
  }
}
