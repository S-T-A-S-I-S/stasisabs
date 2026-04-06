const API = "https://stasisebs.2024mmorgan.workers.dev/state?key=athleticsOverlay";
const OVERLAY_KEY = "";
const STORAGE_KEY = "stasisebs-athletics-state";
const AUTO_PUSH_MS = 5000;
const OVERLAY_PULL_MS = 5000;

const SPORT_PRESETS = {
  basketball: {
    label: "Basketball",
    homeScoreLabel: "Home Score",
    awayScoreLabel: "Away Score",
    periodLabel: "Quarter",
    periodValue: "1",
    clockLabel: "Game Clock",
    clockValue: "10:00",
    detail1Label: "Shot Clock",
    detail1Value: "30",
    detail2Label: "Possession",
    detail2Value: "HOME",
    status: "LIVE"
  },
  volleyball: {
    label: "Volleyball",
    homeScoreLabel: "Home Score",
    awayScoreLabel: "Away Score",
    periodLabel: "Set",
    periodValue: "1",
    clockLabel: "Match Status",
    clockValue: "LIVE",
    detail1Label: "Sets Won",
    detail1Value: "0-0",
    detail2Label: "Serve",
    detail2Value: "HOME",
    status: "LIVE"
  },
  soccer: {
    label: "Soccer",
    homeScoreLabel: "Home Score",
    awayScoreLabel: "Away Score",
    periodLabel: "Half",
    periodValue: "1",
    clockLabel: "Match Clock",
    clockValue: "45:00",
    detail1Label: "Stoppage",
    detail1Value: "+0",
    detail2Label: "Possession",
    detail2Value: "EVEN",
    status: "LIVE"
  },
  baseball: {
    label: "Baseball / Softball",
    homeScoreLabel: "Home Runs",
    awayScoreLabel: "Away Runs",
    periodLabel: "Inning",
    periodValue: "1",
    clockLabel: "Half",
    clockValue: "TOP",
    detail1Label: "Count",
    detail1Value: "0-0",
    detail2Label: "Outs",
    detail2Value: "0",
    status: "LIVE"
  },
  wrestling: {
    label: "Wrestling",
    homeScoreLabel: "Team Score",
    awayScoreLabel: "Team Score",
    periodLabel: "Weight",
    periodValue: "165",
    clockLabel: "Round",
    clockValue: "1",
    detail1Label: "Bout Score",
    detail1Value: "0-0",
    detail2Label: "Riding Time",
    detail2Value: "0:00",
    status: "LIVE"
  },
  generic: {
    label: "Generic Athletics",
    homeScoreLabel: "Home",
    awayScoreLabel: "Away",
    periodLabel: "Segment",
    periodValue: "1",
    clockLabel: "Clock",
    clockValue: "00:00",
    detail1Label: "Detail 1",
    detail1Value: "",
    detail2Label: "Detail 2",
    detail2Value: "",
    status: "LIVE"
  }
};

const defaults = {
  sport: "basketball",
  eventTitle: "MCC Athletics",
  venue: "Marshalltown Community College",
  sponsor: "",
  homeTeam: "MCC",
  awayTeam: "VISITOR",
  homeAbbr: "MCC",
  awayAbbr: "VST",
  homeLogo: "",
  awayLogo: "",
  homeScore: "0",
  awayScore: "0",
  periodLabel: SPORT_PRESETS.basketball.periodLabel,
  periodValue: SPORT_PRESETS.basketball.periodValue,
  clockLabel: SPORT_PRESETS.basketball.clockLabel,
  clockValue: SPORT_PRESETS.basketball.clockValue,
  detail1Label: SPORT_PRESETS.basketball.detail1Label,
  detail1Value: SPORT_PRESETS.basketball.detail1Value,
  detail2Label: SPORT_PRESETS.basketball.detail2Label,
  detail2Value: SPORT_PRESETS.basketball.detail2Value,
  status: SPORT_PRESETS.basketball.status,
  accent: "#FDB827",
  balls: "0",
  strikes: "0",
  outs: "0",
  runner1: "0",
  runner2: "0",
  runner3: "0"
};

function structuredDefaults() {
  return JSON.parse(JSON.stringify(defaults));
}

function normalizeState(state) {
  const out = structuredDefaults();
  if (!state || typeof state !== 'object') return out;
  for (const key of Object.keys(out)) {
    if (state[key] !== undefined && state[key] !== null) {
      out[key] = String(state[key]);
    }
  }
  if (!SPORT_PRESETS[out.sport]) out.sport = defaults.sport;
  out.balls = clampIntString(out.balls, 0, 4);
  out.strikes = clampIntString(out.strikes, 0, 3);
  out.outs = clampIntString(out.outs, 0, 3);
  out.runner1 = truthyString(out.runner1) ? '1' : '0';
  out.runner2 = truthyString(out.runner2) ? '1' : '0';
  out.runner3 = truthyString(out.runner3) ? '1' : '0';
  if (out.sport === 'baseball') {
    out.detail1Value = `${out.balls}-${out.strikes}`;
    out.detail2Value = out.outs;
  }
  return out;
}

function clampIntString(value, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return String(min);
  return String(Math.max(min, Math.min(max, n)));
}

function truthyString(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function headersWithKey(extra = {}) {
  return { ...extra, ...(OVERLAY_KEY ? { 'X-Overlay-Key': OVERLAY_KEY } : {}) };
}

function saveLocal(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state))); } catch {}
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredDefaults();
    return normalizeState(JSON.parse(raw));
  } catch {
    return structuredDefaults();
  }
}

async function apiGet() {
  const r = await fetch(API, { method: 'GET', headers: headersWithKey(), cache: 'no-store' });
  if (!r.ok) throw new Error(`GET failed: ${r.status}`);
  const txt = await r.text();
  return normalizeState(JSON.parse(txt || '{}'));
}

async function apiPost(state) {
  const payload = normalizeState(state);
  const r = await fetch(API, {
    method: 'POST',
    headers: headersWithKey({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`POST failed: ${r.status}`);
  saveLocal(payload);
  return true;
}

let draft = loadLocal();
let lastPushedJson = '';
let lastOverlayJson = '';

function byId(id) { return document.getElementById(id); }

function applyPresetToDraft(sport) {
  const preset = SPORT_PRESETS[sport] || SPORT_PRESETS.basketball;
  draft.sport = sport;
  draft.periodLabel = preset.periodLabel;
  draft.periodValue = preset.periodValue;
  draft.clockLabel = preset.clockLabel;
  draft.clockValue = preset.clockValue;
  draft.detail1Label = preset.detail1Label;
  draft.detail1Value = preset.detail1Value;
  draft.detail2Label = preset.detail2Label;
  draft.detail2Value = preset.detail2Value;
  draft.status = preset.status;
  if (sport === 'baseball') {
    draft.balls = draft.balls || '0';
    draft.strikes = draft.strikes || '0';
    draft.outs = draft.outs || '0';
  }
  draft = normalizeState(draft);
}

function fillControlForm() {
  const ids = Object.keys(defaults).filter(id => !['homeLogo', 'awayLogo', 'runner1', 'runner2', 'runner3'].includes(id));
  for (const id of ids) {
    const el = byId(id);
    if (el) el.value = draft[id] ?? '';
  }
  if (byId('runner1')) byId('runner1').checked = truthyString(draft.runner1);
  if (byId('runner2')) byId('runner2').checked = truthyString(draft.runner2);
  if (byId('runner3')) byId('runner3').checked = truthyString(draft.runner3);
  updateDynamicLabels();
  updateSportVisibility();
}

function updateDynamicLabels() {
  const preset = SPORT_PRESETS[draft.sport] || SPORT_PRESETS.basketball;
  const map = {
    homeScoreWrap: preset.homeScoreLabel,
    awayScoreWrap: preset.awayScoreLabel,
    periodLabelWrap: 'Period Label',
    periodValueWrap: preset.periodLabel,
    clockLabelWrap: 'Clock Label',
    clockValueWrap: preset.clockLabel,
    detail1LabelWrap: draft.sport === 'baseball' ? 'Count Label' : 'Detail 1 Label',
    detail1ValueWrap: draft.sport === 'baseball' ? 'Count Display' : preset.detail1Label,
    detail2LabelWrap: draft.sport === 'baseball' ? 'Outs Label' : 'Detail 2 Label',
    detail2ValueWrap: draft.sport === 'baseball' ? 'Outs Display' : preset.detail2Label,
  };
  for (const [id, label] of Object.entries(map)) {
    const wrap = byId(id);
    if (wrap) {
      const span = wrap.querySelector('.fieldTitle');
      if (span) span.textContent = label;
    }
  }
}

function updateSportVisibility() {
  const baseball = draft.sport === 'baseball';
  byId('baseballControls')?.classList.toggle('hiddenSection', !baseball);
}

function setFieldValue(key, value) {
  draft[key] = String(value);
  const el = byId(key);
  if (el) el.value = draft[key];
  draft = normalizeState(draft);
  saveLocal(draft);
  renderPreview(draft);
}

function bindControlForm() {
  const ids = Object.keys(defaults).filter(id => !['homeLogo', 'awayLogo', 'runner1', 'runner2', 'runner3'].includes(id));
  for (const id of ids) {
    const el = byId(id);
    if (!el) continue;
    const handler = () => {
      draft[id] = el.value;
      if (id === 'sport') applyPresetToDraft(el.value);
      draft = normalizeState(draft);
      saveLocal(draft);
      fillControlForm();
      renderPreview(draft);
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  }

  bindLogoUpload('homeLogoUpload', 'homeLogo');
  bindLogoUpload('awayLogoUpload', 'awayLogo');
  bindRunnerToggle('runner1');
  bindRunnerToggle('runner2');
  bindRunnerToggle('runner3');

  byId('addHome')?.addEventListener('click', () => bumpScore('home', 1));
  byId('subHome')?.addEventListener('click', () => bumpScore('home', -1));
  byId('addAway')?.addEventListener('click', () => bumpScore('away', 1));
  byId('subAway')?.addEventListener('click', () => bumpScore('away', -1));
  byId('nextPeriod')?.addEventListener('click', () => bumpNumeric('periodValue', 1));
  byId('prevPeriod')?.addEventListener('click', () => bumpNumeric('periodValue', -1));
  byId('swapTeams')?.addEventListener('click', swapTeams);
  byId('fillDemo')?.addEventListener('click', fillDemo);
  byId('reset')?.addEventListener('click', resetDraft);
  byId('sendBtn')?.addEventListener('click', sendDraft);
  byId('syncBtn')?.addEventListener('click', syncFromRemote);

  byId('addBall')?.addEventListener('click', () => bumpStat('balls', 1, 0, 4));
  byId('subBall')?.addEventListener('click', () => bumpStat('balls', -1, 0, 4));
  byId('addStrike')?.addEventListener('click', () => bumpStat('strikes', 1, 0, 3));
  byId('subStrike')?.addEventListener('click', () => bumpStat('strikes', -1, 0, 3));
  byId('clearCount')?.addEventListener('click', () => {
    draft.balls = '0';
    draft.strikes = '0';
    draft = normalizeState(draft);
    fillControlForm();
    saveLocal(draft);
    renderPreview(draft);
  });
  byId('clearOuts')?.addEventListener('click', () => {
    draft.outs = '0';
    draft = normalizeState(draft);
    fillControlForm();
    saveLocal(draft);
    renderPreview(draft);
  });
}

function bindRunnerToggle(id) {
  const el = byId(id);
  if (!el) return;
  el.addEventListener('change', () => {
    draft[id] = el.checked ? '1' : '0';
    draft = normalizeState(draft);
    saveLocal(draft);
    renderPreview(draft);
  });
}

function bindLogoUpload(inputId, stateKey) {
  const input = byId(inputId);
  if (!input) return;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      draft[stateKey] = String(e.target?.result || '');
      draft = normalizeState(draft);
      saveLocal(draft);
      renderPreview(draft);
    };
    reader.readAsDataURL(file);
  });
}

function bumpScore(side, delta) {
  const key = side === 'home' ? 'homeScore' : 'awayScore';
  const next = Math.max(0, (parseInt(draft[key], 10) || 0) + delta);
  setFieldValue(key, next);
}

function bumpNumeric(key, delta) {
  const current = parseInt(draft[key], 10);
  if (!Number.isFinite(current)) return;
  setFieldValue(key, Math.max(0, current + delta));
}

function bumpStat(key, delta, min, max) {
  const next = Math.max(min, Math.min(max, (parseInt(draft[key], 10) || 0) + delta));
  setFieldValue(key, next);
  fillControlForm();
}

function swapTeams() {
  [draft.homeTeam, draft.awayTeam] = [draft.awayTeam, draft.homeTeam];
  [draft.homeAbbr, draft.awayAbbr] = [draft.awayAbbr, draft.homeAbbr];
  [draft.homeScore, draft.awayScore] = [draft.awayScore, draft.homeScore];
  [draft.homeLogo, draft.awayLogo] = [draft.awayLogo, draft.homeLogo];
  draft = normalizeState(draft);
  fillControlForm();
  saveLocal(draft);
  renderPreview(draft);
}

function fillDemo() {
  draft = normalizeState({
    ...draft,
    eventTitle: 'MCC Athletics Network',
    venue: 'Marshalltown, Iowa',
    sponsor: 'Presented by STASIS Broadcast',
    homeTeam: 'Marshalltown Tigers',
    awayTeam: 'Visiting College',
    homeAbbr: 'MCC',
    awayAbbr: 'VIS',
    homeScore: draft.sport === 'baseball' ? '4' : '67',
    awayScore: draft.sport === 'baseball' ? '2' : '61',
    status: 'LIVE',
    balls: draft.sport === 'baseball' ? '2' : draft.balls,
    strikes: draft.sport === 'baseball' ? '1' : draft.strikes,
    outs: draft.sport === 'baseball' ? '1' : draft.outs,
    runner1: draft.sport === 'baseball' ? '1' : draft.runner1,
    runner2: draft.sport === 'baseball' ? '0' : draft.runner2,
    runner3: draft.sport === 'baseball' ? '1' : draft.runner3,
  });
  fillControlForm();
  saveLocal(draft);
  renderPreview(draft);
}

function resetDraft() {
  draft = structuredDefaults();
  fillControlForm();
  saveLocal(draft);
  renderPreview(draft);
}

function setStatus(text) {
  const btn = byId('sendBtn');
  if (!btn) return;
  btn.textContent = text;
  setTimeout(() => {
    btn.textContent = 'SEND TO OVERLAY';
  }, 1200);
}

async function sendDraft() {
  try {
    await apiPost(draft);
    lastPushedJson = JSON.stringify(normalizeState(draft));
    setStatus('SENT');
  } catch (err) {
    console.error(err);
    saveLocal(draft);
    setStatus('LOCAL ONLY');
  }
}

async function syncFromRemote() {
  try {
    draft = await apiGet();
    fillControlForm();
    saveLocal(draft);
    renderPreview(draft);
    setStatus('SYNCED');
  } catch (err) {
    console.error(err);
    draft = loadLocal();
    fillControlForm();
    renderPreview(draft);
    setStatus('LOCAL FALLBACK');
  }
}

function initials(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(x => x[0])
    .join('')
    .toUpperCase() || 'TM';
}

function logoMarkup(dataUri, fallbackText) {
  if (String(dataUri || '').startsWith('data:image/')) {
    return `<img class="teamLogoImg" src="${dataUri}" alt="logo" />`;
  }
  return `<div class="teamMarkText">${escapeHtml(fallbackText)}</div>`;
}

function renderBaseballExtras(state) {
  const active1 = truthyString(state.runner1) ? 'active' : '';
  const active2 = truthyString(state.runner2) ? 'active' : '';
  const active3 = truthyString(state.runner3) ? 'active' : '';
  return `
    <div class="detailBar baseballDetailBar">
      <div class="baseballCountRow">
        <div class="countChip"><span>B</span><strong>${escapeHtml(state.balls)}</strong></div>
        <div class="countChip"><span>S</span><strong>${escapeHtml(state.strikes)}</strong></div>
        <div class="countChip"><span>O</span><strong>${escapeHtml(state.outs)}</strong></div>
      </div>
      <div class="baseRunnerWrap">
        <div class="diamondField">
          <div class="base homePlate"></div>
          <div class="base firstBase ${active1}"></div>
          <div class="base secondBase ${active2}"></div>
          <div class="base thirdBase ${active3}"></div>
        </div>
      </div>
      <div class="detailSponsor">${escapeHtml(state.sponsor || ' ')}</div>
    </div>`;
}

function renderStandardExtras(state) {
  return `
    <div class="detailBar">
      <div class="detailItem"><span>${escapeHtml(state.detail1Label)}</span><strong>${escapeHtml(state.detail1Value)}</strong></div>
      <div class="detailItem"><span>${escapeHtml(state.detail2Label)}</span><strong>${escapeHtml(state.detail2Value)}</strong></div>
      <div class="detailSponsor">${escapeHtml(state.sponsor || ' ')}</div>
    </div>`;
}

function renderScorebug(state, root) {
  if (!root) return;
  const sport = SPORT_PRESETS[state.sport] || SPORT_PRESETS.basketball;
  document.documentElement.style.setProperty('--accent', state.accent || '#FDB827');
  root.innerHTML = `
    <div class="scorebugShell ${state.sport === 'baseball' ? 'isBaseball' : ''}">
      <div class="topline">
        <div class="eventMeta">
          <div class="eventTitle">${escapeHtml(state.eventTitle)}</div>
          <div class="eventSub">${escapeHtml(state.venue)}</div>
        </div>
        <div class="statusPill">${escapeHtml(state.status)}</div>
      </div>
      <div class="scorebugMain">
        <div class="teamBlock home">
          <div class="teamMark">${logoMarkup(state.homeLogo, state.homeAbbr || initials(state.homeTeam))}</div>
          <div class="teamNames">
            <div class="teamFull">${escapeHtml(state.homeTeam)}</div>
            <div class="teamShort">${escapeHtml(state.homeAbbr)}</div>
          </div>
          <div class="scoreBox">${escapeHtml(state.homeScore)}</div>
        </div>
        <div class="middleBlock">
          <div class="sportTag">${escapeHtml(sport.label)}</div>
          <div class="clockLine"><span>${escapeHtml(state.clockLabel)}</span><strong>${escapeHtml(state.clockValue)}</strong></div>
          <div class="periodLine"><span>${escapeHtml(state.periodLabel)}</span><strong>${escapeHtml(state.periodValue)}</strong></div>
        </div>
        <div class="teamBlock away">
          <div class="teamMark">${logoMarkup(state.awayLogo, state.awayAbbr || initials(state.awayTeam))}</div>
          <div class="teamNames">
            <div class="teamFull">${escapeHtml(state.awayTeam)}</div>
            <div class="teamShort">${escapeHtml(state.awayAbbr)}</div>
          </div>
          <div class="scoreBox">${escapeHtml(state.awayScore)}</div>
        </div>
      </div>
      ${state.sport === 'baseball' ? renderBaseballExtras(state) : renderStandardExtras(state)}
    </div>`;
}

function renderPreview(state) {
  renderScorebug(state, byId('previewMount'));
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function autoPushLoop() {
  if (!byId('athleticsControlRoot')) return;
  try {
    const payload = normalizeState(draft);
    const json = JSON.stringify(payload);
    if (json !== lastPushedJson) {
      await apiPost(payload);
      lastPushedJson = json;
    }
  } catch (err) {
    console.error('autoPushLoop', err);
  } finally {
    setTimeout(autoPushLoop, AUTO_PUSH_MS);
  }
}

async function overlayLoop() {
  try {
    const remote = await apiGet();
    const json = JSON.stringify(remote);
    if (json !== lastOverlayJson) {
      lastOverlayJson = json;
      saveLocal(remote);
      renderScorebug(remote, byId('overlayMount'));
    }
  } catch (err) {
    const fallback = loadLocal();
    const json = JSON.stringify(fallback);
    if (json !== lastOverlayJson) {
      lastOverlayJson = json;
      renderScorebug(fallback, byId('overlayMount'));
    }
  } finally {
    setTimeout(overlayLoop, OVERLAY_PULL_MS);
  }
}

function initControl() {
  if (!byId('athleticsControlRoot')) return;
  if (!SPORT_PRESETS[draft.sport]) applyPresetToDraft('basketball');
  draft = normalizeState(draft);
  fillControlForm();
  bindControlForm();
  renderPreview(draft);
  autoPushLoop();
}

function initOverlay() {
  if (!byId('overlayMount')) return;
  overlayLoop();
}

window.addEventListener('DOMContentLoaded', () => {
  initControl();
  initOverlay();
});
