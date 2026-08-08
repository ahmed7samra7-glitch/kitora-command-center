import { EventEmitter } from 'events';
import { dbRuntime } from './dbStorage.js';

export interface BusEvent {
  id: string;
  topic: string;
  source: string;
  traceId?: string;
  payload: any;
  timestamp: string;
}

export type EventSubscriber = (event: BusEvent) => Promise<void> | void;

class InternalEventBus {
  private emitter: EventEmitter;
  private history: BusEvent[] = [];

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    // Load existing event logs from persistent storage
    const saved = dbRuntime.get('eventLogs');
    if (Array.isArray(saved)) {
      this.history = saved;
    }
  }

  public emit(topic: string, payload: any) {
    return this.publish(topic, 'SYSTEM', payload);
  }

  public publish(topic: string, source: string, payload: any, traceId?: string): BusEvent {
    const event: BusEvent = {
      id: `EVT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      topic,
      source,
      traceId: traceId || `TR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      payload,
      timestamp: new Date().toISOString()
    };

    this.history.unshift(event);
    if (this.history.length > 500) {
      this.history = this.history.slice(0, 500);
    }

    // Persist event history
    dbRuntime.set('eventLogs', this.history);

    // Emit event asynchronously
    setImmediate(() => {
      this.emitter.emit(topic, event);
      this.emitter.emit('*', event); // wildcard subscriber
    });

    console.log(`[Event Bus] [${event.topic}] Published by ${source} (ID: ${event.id})`);
    return event;
  }

  public subscribe(topic: string, subscriber: EventSubscriber) {
    this.emitter.on(topic, async (event: BusEvent) => {
      try {
        await subscriber(event);
      } catch (err: any) {
        console.error(`[Event Bus Subscriber Error] Topic: ${topic}, Event: ${event.id}`, err);
      }
    });
  }

  public getHistory(topicFilter?: string, limit = 50): BusEvent[] {
    if (!topicFilter || topicFilter === '*') {
      return this.history.slice(0, limit);
    }
    return this.history.filter(e => e.topic.toLowerCase().includes(topicFilter.toLowerCase())).slice(0, limit);
  }

  public clearHistory() {
    this.history = [];
    dbRuntime.set('eventLogs', []);
  }
}

export const eventBus = new InternalEventBus();
