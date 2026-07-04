import { badgeClass, formatClock, formatCountdown, formatDuration, resolveCauses } from './trains.js';
import { t } from './i18n.js';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badgeHtml(vm, lang) {
  const cls = badgeClass(vm);
  const text =
    cls === 'cancelled' ? t('cancelled', lang) :
    cls === 'ontime' ? t('onTime', lang) :
    `+${vm.delayMinutes} ${t('minShort', lang)}`;
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

export function trainRowHtml(vm, { timeMode, lang, now, expanded, causeCodes }) {
  const depText = timeMode === 'countdown'
    ? `${formatCountdown(vm.bestDeparture, now)} ${t('minShort', lang)}`
    : formatClock(vm.bestDeparture);
  const causesHtml = expanded && vm.causes.length
    ? `<ul class="causes">${resolveCauses(vm.causes, causeCodes, lang).map(c => `<li>${esc(c)}</li>`).join('')}</ul>`
    : expanded ? `<ul class="causes"><li>${esc(t('unknownCause', lang))}</li></ul>` : '';
  return `<li data-id="${esc(vm.id)}">
    <div class="train-row">
      <span class="train-name">${esc(vm.label)}</span>
      <span class="train-times">${esc(depText)} → ${formatClock(vm.bestArrival)}
        <div class="train-duration">${esc(formatDuration(vm.bestDeparture, vm.bestArrival))}
          · ${esc(t('track', lang))} ${esc(vm.track)}</div>
      </span>
      ${badgeHtml(vm, lang)}
    </div>
    ${causesHtml}
  </li>`;
}

export function renderTrains(listEl, vms, opts) {
  listEl.innerHTML = vms.length
    ? vms.map(vm => trainRowHtml(vm, { ...opts, expanded: opts.expandedId === vm.id })).join('')
    : `<li class="empty">${esc(t('noTrains', opts.lang))}</li>`;
}

export function renderSuggestions(listEl, stations, onPick) {
  listEl.innerHTML = stations
    .map(s => `<li data-code="${esc(s.stationShortCode)}">${esc(s.stationName)} (${esc(s.stationShortCode)})</li>`)
    .join('');
  listEl.hidden = stations.length === 0;
  listEl.onclick = (e) => {
    const li = e.target.closest('li[data-code]');
    if (li) onPick(stations.find(s => s.stationShortCode === li.dataset.code));
  };
}
