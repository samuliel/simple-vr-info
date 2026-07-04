const strings = {
  from:        { fi: 'Mistä', en: 'From' },
  to:          { fi: 'Minne', en: 'To' },
  onTime:      { fi: 'ajallaan', en: 'on time' },
  cancelled:   { fi: 'peruttu', en: 'cancelled' },
  noTrains:    { fi: 'Ei suoria junia seuraavan tunnin aikana', en: 'No direct trains in the next hour' },
  loadError:   { fi: 'Tietojen haku epäonnistui', en: 'Failed to load data' },
  retry:       { fi: 'Yritä uudelleen', en: 'Retry' },
  dataFrom:    { fi: 'Tiedot klo', en: 'Data from' },
  track:       { fi: 'Raide', en: 'Track' },
  clockMode:   { fi: 'Kellonaika', en: 'Clock' },
  countdownMode:{ fi: 'Minuutit', en: 'Minutes' },
  minShort:    { fi: 'min', en: 'min' },
  unknownCause:{ fi: 'Syy ei tiedossa', en: 'Reason unknown' },
};

export function t(key, lang) {
  const entry = strings[key];
  if (!entry) return key;
  return entry[lang] ?? entry.fi;
}

export function defaultLang() {
  return (typeof navigator !== 'undefined' && (navigator.language || '').startsWith('fi')) ? 'fi' : 'en';
}
