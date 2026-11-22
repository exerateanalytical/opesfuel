import fs from 'node:fs';
import path from 'node:path';

export interface OutboxEvent {
  deviceEventId: string;
  protocol: 'DOMS_PTS2' | 'VEEDER_ROOT_ATG' | 'OCPP_201_EV';
  summary: string;
  alarmTriggered: boolean;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
}

/**
 * Crash-safe durable JSONL outbox with deduplication and exponential backoff retry.
 * Designed for Raspberry Pi / Linux edge sites with intermittent 3G/4G links.
 */
export class DurableOutbox {
  private readonly filePath: string;
  private readonly queue: OutboxEvent[] = [];
  private readonly seenIds = new Set<string>();

  constructor(filePath: string) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!fs.existsSync(this.filePath)) return;
    const raw = fs.readFileSync(this.filePath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const evt = JSON.parse(trimmed) as OutboxEvent;
        if (evt.deviceEventId && !this.seenIds.has(evt.deviceEventId)) {
          this.seenIds.add(evt.deviceEventId);
          this.queue.push(evt);
        }
      } catch {
        // skip corrupted partial trailing line after sudden power cut
      }
    }
  }

  private compactToDisk(): void {
    const tmp = `${this.filePath}.tmp`;
    const data = this.queue.map((e) => JSON.stringify(e)).join('\n') + (this.queue.length ? '\n' : '');
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  enqueue(input: Omit<OutboxEvent, 'createdAt' | 'attempts' | 'nextAttemptAt'>): boolean {
    if (this.seenIds.has(input.deviceEventId)) return false;
    const evt: OutboxEvent = {
      ...input,
      createdAt: new Date().toISOString(),
      attempts: 0,
      nextAttemptAt: Date.now(),
    };
    this.seenIds.add(evt.deviceEventId);
    this.queue.push(evt);
    fs.appendFileSync(this.filePath, JSON.stringify(evt) + '\n', 'utf8');
    return true;
  }

  depth(): number {
    return this.queue.length;
  }

  async flush(sender: (evt: OutboxEvent) => Promise<void>): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    const now = Date.now();
    const remaining: OutboxEvent[] = [];

    for (const evt of this.queue) {
      if (evt.nextAttemptAt > now) {
        remaining.push(evt);
        continue;
      }
      try {
        await sender(evt);
        sent++;
      } catch {
        evt.attempts += 1;
        const backoffMs = Math.min(300_000, 2_000 * Math.pow(2, Math.min(evt.attempts, 8)));
        evt.nextAttemptAt = Date.now() + backoffMs;
        remaining.push(evt);
        failed++;
      }
    }

    if (sent > 0 || failed > 0) {
      this.queue.length = 0;
      this.queue.push(...remaining);
      this.compactToDisk();
    }
    return { sent, failed };
  }
}
