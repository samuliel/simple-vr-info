import mqtt from 'mqtt';

const MQTT_URL = 'wss://rata.digitraffic.fi:443/mqtt';
const FALLBACK_MS = 30000;

export function subscribeStation(shortCode, { onTrain, onFallbackTick }, connectFn = () => mqtt.connect(MQTT_URL)) {
  const client = connectFn();
  let fallbackTimer = null;

  const startFallback = () => {
    if (!fallbackTimer) fallbackTimer = setInterval(onFallbackTick, FALLBACK_MS);
  };
  const stopFallback = () => {
    if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
  };

  client.on('connect', () => {
    stopFallback();
    client.subscribe(`trains-by-station/${shortCode}`);
  });
  client.on('close', startFallback);
  client.on('error', startFallback);
  client.on('message', (_topic, payload) => {
    try { onTrain(JSON.parse(payload.toString())); } catch { /* ignore malformed */ }
  });

  return {
    close() {
      stopFallback();
      client.end();
    },
  };
}
