import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeStation } from '../src/mqtt.js';

function fakeClient() {
  const listeners = {};
  return {
    on: vi.fn((ev, cb) => { (listeners[ev] ??= []).push(cb); }),
    emit: (ev, ...args) => (listeners[ev] ?? []).forEach(cb => cb(...args)),
    subscribe: vi.fn(),
    end: vi.fn(),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('subscribeStation', () => {
  it('subscribes to the station topic on connect and forwards parsed trains', () => {
    const client = fakeClient();
    const onTrain = vi.fn();
    subscribeStation('HKI', { onTrain, onFallbackTick: vi.fn() }, () => client);
    client.emit('connect');
    expect(client.subscribe).toHaveBeenCalledWith('trains-by-station/HKI');
    client.emit('message', 'trains-by-station/HKI', Buffer.from(JSON.stringify({ trainNumber: 27 })));
    expect(onTrain).toHaveBeenCalledWith({ trainNumber: 27 });
  });
  it('ignores malformed messages', () => {
    const client = fakeClient();
    const onTrain = vi.fn();
    subscribeStation('HKI', { onTrain, onFallbackTick: vi.fn() }, () => client);
    client.emit('message', 't', Buffer.from('not json'));
    expect(onTrain).not.toHaveBeenCalled();
  });
  it('polls every 30 s while disconnected, stops on reconnect and close()', () => {
    const client = fakeClient();
    const onFallbackTick = vi.fn();
    const sub = subscribeStation('HKI', { onTrain: vi.fn(), onFallbackTick }, () => client);
    client.emit('close');
    vi.advanceTimersByTime(65000);
    expect(onFallbackTick).toHaveBeenCalledTimes(2);
    client.emit('connect');
    vi.advanceTimersByTime(65000);
    expect(onFallbackTick).toHaveBeenCalledTimes(2);
    sub.close();
    expect(client.end).toHaveBeenCalled();
  });
});
