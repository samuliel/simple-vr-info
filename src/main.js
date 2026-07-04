import { fetchStations, fetchCauseCodes, fetchLiveTrains } from './api.js';
import { subscribeStation } from './mqtt.js';
import { selectTrains, mergeTrain, searchStations } from './trains.js';
import { renderTrains, renderSuggestions, esc } from './ui.js';
import { t, defaultLang } from './i18n.js';

const $ = id => document.getElementById(id);

const state = {
  lang: localStorage.getItem('tt.lang') ?? defaultLang(),
  timeMode: localStorage.getItem('tt.timeMode') ?? 'clock',
  from: null, to: null,          // station objects {stationName, stationShortCode}
  stations: [], causeCodes: { category: new Map(), detailed: new Map(), third: new Map() },
  trains: [], expandedId: null,
  lastFetchAt: null, error: false,
  sub: null,
};

function render() {
  $('from-input').placeholder = t('from', state.lang);
  $('to-input').placeholder = t('to', state.lang);
  $('lang-toggle').textContent = state.lang === 'fi' ? 'EN' : 'FI';
  $('time-toggle').textContent = state.timeMode === 'clock' ? t('countdownMode', state.lang) : t('clockMode', state.lang);

  const status = $('status');
  if (state.error && state.lastFetchAt) {
    status.hidden = false;
    status.innerHTML = `${esc(t('loadError', state.lang))} — ${esc(t('dataFrom', state.lang))} ` +
      `${state.lastFetchAt.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })} ` +
      `<button id="retry">${esc(t('retry', state.lang))}</button>`;
    document.getElementById('retry').onclick = refresh;
  } else if (state.error) {
    status.hidden = false;
    status.innerHTML = `${esc(t('loadError', state.lang))} <button id="retry">${esc(t('retry', state.lang))}</button>`;
    document.getElementById('retry').onclick = refresh;
  } else {
    status.hidden = true;
  }

  const list = $('trains');
  list.classList.toggle('stale', state.error);
  if (state.from && state.to) {
    const vms = selectTrains(state.trains, state.from.stationShortCode, state.to.stationShortCode, new Date());
    renderTrains(list, vms, {
      timeMode: state.timeMode, lang: state.lang, now: new Date(),
      expandedId: state.expandedId, causeCodes: state.causeCodes,
    });
  } else {
    list.innerHTML = '';
  }
}

async function refresh() {
  if (!state.from || !state.to) return;
  try {
    state.trains = await fetchLiveTrains(state.from.stationShortCode, state.to.stationShortCode);
    state.lastFetchAt = new Date();
    state.error = false;
  } catch {
    state.error = true;
  }
  render();
}

function setPair(from, to) {
  state.from = from; state.to = to; state.trains = []; state.expandedId = null;
  if (from) $('from-input').value = from.stationName;
  if (to) $('to-input').value = to.stationName;
  if (from && to) {
    location.hash = `#${from.stationShortCode}/${to.stationShortCode}`;
    localStorage.setItem('tt.pair', `${from.stationShortCode}/${to.stationShortCode}`);
    state.sub?.close();
    state.sub = subscribeStation(from.stationShortCode, {
      onTrain: (train) => { state.trains = mergeTrain(state.trains, train); render(); },
      onFallbackTick: refresh,
    });
    refresh();
  }
  render();
}

function wireAutocomplete(inputId, listId, pick) {
  const input = $(inputId), list = $(listId);
  input.addEventListener('input', () => {
    renderSuggestions(list, searchStations(state.stations, input.value), (s) => {
      list.hidden = true;
      pick(s);
    });
  });
  input.addEventListener('focus', () => input.select());
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 200));
}

function restorePair() {
  const source = location.hash.slice(1) || localStorage.getItem('tt.pair') || '';
  const [f, tCode] = source.split('/');
  const find = code => state.stations.find(s => s.stationShortCode === code) ?? null;
  if (f && tCode) setPair(find(f), find(tCode));
}

async function init() {
  render();
  try {
    [state.stations, state.causeCodes] = await Promise.all([fetchStations(), fetchCauseCodes()]);
  } catch {
    state.error = true;
    render();
    return;
  }

  wireAutocomplete('from-input', 'from-list', s => setPair(s, state.to));
  wireAutocomplete('to-input', 'to-list', s => setPair(state.from, s));

  $('swap').onclick = () => state.from && state.to && setPair(state.to, state.from);
  $('lang-toggle').onclick = () => {
    state.lang = state.lang === 'fi' ? 'en' : 'fi';
    localStorage.setItem('tt.lang', state.lang);
    render();
  };
  $('time-toggle').onclick = () => {
    state.timeMode = state.timeMode === 'clock' ? 'countdown' : 'clock';
    localStorage.setItem('tt.timeMode', state.timeMode);
    render();
  };
  $('trains').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    state.expandedId = state.expandedId === li.dataset.id ? null : li.dataset.id;
    render();
  });
  window.addEventListener('hashchange', restorePair);

  setInterval(render, 30000);        // countdown freshness + window sliding
  setInterval(refresh, 5 * 60000);   // REST safety net

  restorePair();
}

init();
