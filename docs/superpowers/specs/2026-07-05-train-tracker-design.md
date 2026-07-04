# Finnish Railways Train Tracker — Design Spec

Date: 2026-07-05
Status: Approved design, pending implementation plan

## Purpose

A mobile-first website where the user picks an origin and a destination railway
station in Finland and sees the direct trains departing the origin within the
next 60 minutes that also stop at the destination. Late trains are marked, and
tapping a late train shows the reason for the delay. Data comes from the
Finnish Transport Infrastructure Agency's open Digitraffic railway API.

## Architecture

Static single-page app, no backend.

- **Stack:** vanilla JavaScript + Vite. Only runtime dependency: `mqtt` (mqtt.js
  for MQTT over WebSocket). Deployable to any static host.
- **Initial data:** REST
  `GET https://rata.digitraffic.fi/api/v1/live-trains/station/{from}/{to}`
  returns trains running between two stations with full timetable rows, delay
  minutes, cancellation flags, and delay `causes`.
- **Live updates:** MQTT over WebSocket at `wss://rata.digitraffic.fi:443/mqtt`,
  topic `trains-by-station/{from}`. Each message is a full train object; merge
  into local state by `trainNumber` + `departureDate`. Re-subscribe when the
  origin station changes. If the connection fails, fall back to REST polling
  every 30 s until it recovers.
- **Metadata** (fetched once, cached in localStorage with 7-day TTL):
  - `/metadata/stations` — station names/codes for autocomplete
    (passenger stations only: `passengerTraffic == true`).
  - `/metadata/cause-category-codes`,
    `/metadata/detailed-cause-category-codes`,
    `/metadata/third-cause-category-codes` — delay-cause descriptions with
    `passengerTerm.fi` / `passengerTerm.en`.

## UI (mobile-first, works on desktop)

Single screen:

- **Header:** two autocomplete inputs "Mistä / From" and "Minne / To" matching
  station name or short code (e.g. HKI); a swap button; a FI/EN language
  toggle. Language persists in localStorage, defaults to browser language.
- **Time display toggle:** switches all departure times between clock mode
  ("14:32") and countdown mode ("12 min"). Persisted in localStorage.
  Countdown uses the live estimate when present and re-renders every 30 s.
  Arrival times at the destination always stay in clock format.
- **Train list:** direct trains departing within the next 60 minutes, sorted by
  departure time. Each row: train type + number (IC 27, commuter line letter),
  departure time (per toggle), track, arrival time at destination, trip
  duration (e.g. "1 h 47 min", computed client-side from the origin departure
  and destination arrival rows, using live estimates when present), and a delay
  badge — green "on time" (≤ 1 min), yellow "+N min" (2–5 min), red "+N min"
  (> 5 min), grey "peruttu / cancelled" for cancelled trains.
- **Delay detail:** tapping a late train expands the row (accordion) showing
  each cause resolved to a human-readable description in the chosen language,
  most detailed available level first (third > detailed > category). Fall back
  to the raw code when no translation exists.
- **State restore:** selected pair lives in the URL hash (`#HKI/TPE`) and the
  last pair is remembered in localStorage.

## Data flow & logic

1. Load: metadata (cache or fetch) → restore station pair (hash →
   localStorage) → REST live-trains fetch → render.
2. Filter rule: include a train when its timetable row at the origin is type
   DEPARTURE with scheduled-or-live-estimate time within [now, now + 60 min],
   and a later row at the destination has `trainStopping: true`. Delay =
   `differenceInMinutes` of the origin departure row; prefer
   `liveEstimateTime` over `scheduledTime` for displayed/countdown times.
3. MQTT message → merge train into state → re-filter → re-render.
4. Timers: 30 s re-render tick (countdown freshness + trains sliding out of
   the 60-min window); REST re-fetch every 5 min as a safety net.

## Error handling

- Network/API failure: banner with retry button; keep last successful list
  greyed out with a "data from HH:MM" stamp.
- Empty result: friendly message ("Ei suoria junia seuraavan tunnin aikana" /
  "No direct trains in the next hour").
- Unknown cause codes: show raw code.

## Testing

- Vitest unit tests for pure logic: train filtering/window rule, delay and
  badge computation, trip duration formatting, cause-code resolution, station autocomplete matching,
  countdown formatting. Fixtures are real JSON captured from the API.
- Manual smoke test of the UI against the live API on mobile viewport.

## File layout

```
index.html
src/main.js     # wiring, state, timers
src/api.js      # REST + metadata fetch & cache
src/mqtt.js     # MQTT subscribe/merge, fallback polling
src/trains.js   # pure filtering, delay, formatting logic
src/ui.js       # DOM rendering
src/i18n.js     # FI/EN strings
src/styles.css  # mobile-first styles
```

## Out of scope

- Journeys with transfers / routing.
- Backend, accounts, notifications.
- Other languages beyond FI/EN.
