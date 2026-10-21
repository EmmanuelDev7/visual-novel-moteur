/* ============================================================
   VISUAL NOVEL ENGINE — engine.js  (v2 — Ren'Py edition)
   ============================================================
   NOUVELLES FONCTIONNALITÉS v2 :
   ─────────────────────────────────────────────────────────────
   ◆ SAUVEGARDE COMPLÈTE
     Restaure fond, personnages, musique, volume, overlay, mode NVL
     exactement comme au moment de la sauvegarde.

   ◆ ROLLBACK (retour arrière)
     Bouton ◀ dans le backlog pour revenir à un dialogue précédent.
     Identique au rollback Ren'Py.

   ◆ TRANSITIONS DE FOND (dissolve / fade)
     { type: 'background', value: '...', transition: 'dissolve', duration: 500 }
     { type: 'background', value: '...', transition: 'fade',     duration: 800 }
     Sans transition : changement instantané (comportement d'origine).

   ◆ EXPRESSIONS DE PERSONNAGES
     { type: 'character', id: 'sarah', expression: 'smile' }
     Mappe vers img/<id>-<expression>.png automatiquement.
     Compatible avec src: explicite.

   ◆ SKIP (saut rapide)
     Bouton SKIP dans le HUD. Avance à vitesse maximale.
     Clic ou touche Tab pour activer/désactiver.

   ◆ QUICKSAVE / QUICKLOAD
     F5 = sauvegarde rapide. F9 = chargement rapide.
     Toast de confirmation à l'écran.

   ◆ MODE NVL (texte plein écran)
     { type: 'dialogue', mode: 'nvl', speaker: '...', text: '...' }
     Le texte s'accumule sur un fond plein écran.
     { type: 'nvl_clear' } pour vider l'écran NVL.

   INSTRUCTIONS D'ORIGINE (inchangées) :
   ─────────────────────────────────────────────────────────────
   { type: 'bgm',        src: 'audio/theme.mp3', volume: 0.5, loop: true }
   { type: 'bgm',        src: null }
   { type: 'sfx',        src: 'audio/sfx.mp3', id: 'boom', loop: false, volume: 1.0 }
   { type: 'sfxStop',    id: 'boom' }
   { type: 'background', value: 'img/bg.png', transition: 'dissolve', duration: 500 }
   { type: 'bgAnimation', animation: 'anim-pulse' }
   { type: 'character',  id: 'sarah', src: 'img/sarah.png', position: 'left', show: true }
   { type: 'character',  id: 'sarah', expression: 'smile', position: 'left', show: true }
   { type: 'character',  id: 'sarah', show: false }
   { type: 'character',  id: 'sarah', dim: true }
   { type: 'dialogue',   speaker: 'Sarah', text: 'Bonjour.' }
   { type: 'dialogue',   mode: 'nvl', speaker: 'Narrateur', text: 'Long passage...' }
   { type: 'nvl_clear' }
   { type: 'choice',     options: [ { text: 'Option A', jump: 'label_a' } ] }
   { type: 'condition',  flag: 'nomDuFlag', then: 'label_vrai', else: 'label_faux' }
   { type: 'label',      id: 'nom_du_label' }
   { type: 'jump',       target: 'nom_du_label' }
   { type: 'chapter',    title: 'Chapitre 1' }
   { type: 'overlay',    color: 'black', duration: 600 }
   { type: 'end',        title: 'Fin de page' }
   ============================================================ */

'use strict';

// ════════════════════════════════════════════════════════════
//  SYSTÈME AUDIO
// ════════════════════════════════════════════════════════════
const Audio = (() => {
  let bgmNode    = null;
  let voiceNode  = null;
  let _currentBGMSrc    = null;
  let _currentBGMVolume = 0.5;
  const sfxNodes = {};

  function _make(src, { loop = false, volume = 1.0 } = {}) {
    const a = new window.Audio(src);
    a.loop   = loop;
    a.volume = Math.min(1, Math.max(0, volume));
    return a;
  }

  function _fadeOut(node, duration, onDone) {
    const steps    = 40;
    const interval = duration / steps;
    const startVol = node.volume;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      node.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        clearInterval(timer);
        node.volume = 0;
        if (onDone) onDone();
      }
    }, interval);
  }

  function _fadeIn(node, targetVolume, duration) {
    const steps    = 40;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      if (node !== bgmNode) { clearInterval(timer); return; }
      step++;
      node.volume = Math.min(targetVolume, targetVolume * (step / steps));
      if (step >= steps) { clearInterval(timer); node.volume = targetVolume; }
    }, interval);
  }

  return {
    get currentBGMSrc()    { return _currentBGMSrc; },
    get currentBGMVolume() { return _currentBGMVolume; },

    playBGM(src, { loop = true, volume = 0.5, fadeDuration = 1200 } = {}) {
      _currentBGMSrc    = src;
      _currentBGMVolume = volume;
      const oldNode = bgmNode;
      bgmNode = null;
      if (oldNode) _fadeOut(oldNode, fadeDuration / 2, () => oldNode.pause());
      if (!src) return;
      const newNode = _make(src, { loop, volume: 0 });
      newNode.play().catch(() => {});
      bgmNode = newNode;
      _fadeIn(newNode, volume, fadeDuration);
    },
    stopBGM(fadeDuration = 800) {
      _currentBGMSrc = null;
      if (!bgmNode) return;
      const node = bgmNode; bgmNode = null;
      _fadeOut(node, fadeDuration, () => node.pause());
    },
    setBGMVolume(v) {
      if (bgmNode) bgmNode.volume = Math.min(1, Math.max(0, v));
    },
    playVoice(src) {
      this.stopVoice();
      if (!src) return;
      voiceNode = _make(src, { loop: false, volume: 1.0 });
      voiceNode.play().catch(() => {});
    },
    stopVoice() {
      if (voiceNode) { voiceNode.pause(); voiceNode.currentTime = 0; voiceNode = null; }
    },
    playSFX(src, { id = null, loop = false, volume = 1.0 } = {}) {
      if (id) {
        if (sfxNodes[id]) sfxNodes[id].pause();
        const node = _make(src, { loop, volume });
        node.play().catch(() => {});
        sfxNodes[id] = node;
        if (!loop) node.addEventListener('ended', () => delete sfxNodes[id]);
      } else {
        const node = _make(src, { loop: false, volume });
        node.play().catch(() => {});
      }
    },
    stopSFX(id) {
      if (sfxNodes[id]) {
        sfxNodes[id].pause(); sfxNodes[id].currentTime = 0;
        delete sfxNodes[id];
      }
    },
    stopAllSFX() { Object.keys(sfxNodes).forEach(id => this.stopSFX(id)); },
    stopAll()    { this.stopBGM(); this.stopVoice(); this.stopAllSFX(); },

    /* Snapshot pour sauvegarde */
    snapshot() {
      return {
        bgmSrc:    _currentBGMSrc,
        bgmVolume: _currentBGMVolume,
      };
    },
    restore(snap) {
      if (!snap) return;
      if (snap.bgmSrc) {
        this.playBGM(snap.bgmSrc, { volume: snap.bgmVolume || 0.5, fadeDuration: 0 });
      }
    },
  };
})();

// ════════════════════════════════════════════════════════════
//  SYSTÈME DE SAUVEGARDE (localStorage)
// ════════════════════════════════════════════════════════════
const SaveSystem = (() => {
  const STORAGE_KEY      = 'vn_saves_v2';
  const AUTOSAVE_KEY     = 'vn_autosave_v2';
  const QUICKSAVE_KEY    = 'vn_quicksave_v2';
  const SETTINGS_KEY     = 'vn_settings_v2';
  const MAX_MANUAL_SLOTS = 3;

  let settings = {
    textSpeed:   28,
    bgmVolume:   0.5,
    bgmMuted:    false,
    autoAdvance: false,
    autoDelay:   2000,
    skipUnread:  false,   // true = skip même les textes non lus
  };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (saved) Object.assign(settings, saved);
    } catch(e) {}
    return settings;
  }
  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  /* ── Snapshot complet de l'état visuel ─────────────────── */
  function _buildSaveData(state) {
    /* Personnages visibles : on sérialise tout ce qu'il faut
       pour les recréer (src, position, dim) */
    const charactersSnapshot = {};
    Object.entries(state.characters).forEach(([id, el]) => {
      const img = el.querySelector('img');
      charactersSnapshot[id] = {
        src:      img ? img.src : null,
        position: el.classList.contains('left')   ? 'left'
                : el.classList.contains('right')  ? 'right'
                : el.classList.contains('center') ? 'center' : null,
        hidden:   el.classList.contains('hidden'),
        dim:      el.classList.contains('dim'),
      };
    });

    const bg = document.getElementById('background');
    return {
      index:      state.index,
      variables:  { ...state.variables },
      /* État visuel complet */
      visual: {
        bgImage:    bg.style.backgroundImage,
        bgColor:    bg.style.background,
        characters: charactersSnapshot,
        nvlMode:    state.nvlMode,
        nvlLines:   [...state.nvlLines],
      },
      /* Audio */
      audio: Audio.snapshot(),
      /* Dialogue affiché */
      speaker:  document.getElementById('speaker-name').textContent,
      text:     document.getElementById('dialogue-text').textContent,
      timestamp: Date.now(),
      /* Systèmes psychologiques */
      emotions:     EmotionEngine.snapshot(),
      power:        PowerSystem.snapshot(),
      consequences: ConsequenceSystem.snapshot(),
    };
  }

  function saveSlot(slotIndex, state) {
    const all = loadAllSlots();
    all[slotIndex] = _buildSaveData(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
  function loadSlot(slotIndex) {
    return loadAllSlots()[slotIndex] || null;
  }
  function loadAllSlots() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch(e) { return {}; }
  }
  function autoSave(state) {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(_buildSaveData(state)));
  }
  function loadAutoSave() {
    try { return JSON.parse(localStorage.getItem(AUTOSAVE_KEY)); }
    catch(e) { return null; }
  }
  function quickSave(state) {
    localStorage.setItem(QUICKSAVE_KEY, JSON.stringify(_buildSaveData(state)));
  }
  function loadQuickSave() {
    try { return JSON.parse(localStorage.getItem(QUICKSAVE_KEY)); }
    catch(e) { return null; }
  }
  function hasAnySave() {
    const all  = loadAllSlots();
    const auto = loadAutoSave();
    return auto !== null || Object.keys(all).length > 0;
  }

  return {
    settings, loadSettings, saveSettings,
    saveSlot, loadSlot, loadAllSlots,
    autoSave, loadAutoSave,
    quickSave, loadQuickSave,
    hasAnySave, MAX_MANUAL_SLOTS,
  };
})();

// ════════════════════════════════════════════════════════════
//  SYSTÈMES PSYCHOLOGIQUES (inchangés)
// ════════════════════════════════════════════════════════════
const EmotionEngine = (() => {
  const EMOTIONS = ['trust','fear','anger','sadness','hope'];
  const EMOTION_FR = {
    trust:   'Confiance',
    fear:    'Peur',
    anger:   'Colère',
    sadness: 'Tristesse',
    hope:    'Espoir',
  };
  const EMOTION_COLOR = {
    trust:   '#4fc3f7',
    fear:    '#ce93d8',
    anger:   '#ef5350',
    sadness: '#5c6bc0',
    hope:    '#66bb6a',
  };
  const profiles = {};

  function _init(charId) {
    if (!profiles[charId])
      profiles[charId] = { trust:50, fear:10, anger:10, sadness:20, hope:60 };
  }
  function modify(charId, emotion, { delta, set } = {}) {
    _init(charId);
    if (!EMOTIONS.includes(emotion)) return;
    if (set   !== undefined) profiles[charId][emotion] = Math.min(100, Math.max(0, set));
    else if (delta !== undefined) profiles[charId][emotion] = Math.min(100, Math.max(0, profiles[charId][emotion] + delta));
    _updateUI(charId);
  }
  function getDominant(charId) {
    _init(charId);
    return Object.entries(profiles[charId]).sort((a,b) => b[1]-a[1])[0][0];
  }
   function get(charId, emotion)   { _init(charId); return profiles[charId][emotion] || 0; }
  function getAll(charId)         { _init(charId); return { ...profiles[charId] }; }
  function snapshot()             { return JSON.parse(JSON.stringify(profiles)); }
  function restore(snap)          { Object.assign(profiles, snap); }

  function _updateUI() {
    const panel = document.getElementById('emotion-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    _renderEmotionPanel();
  }
  function _renderEmotionPanel() {
    const panel = document.getElementById('emotion-panel');
    if (!panel) return;
    panel.innerHTML = '';
    Object.entries(profiles).forEach(([charId, emos]) => {
      const block = document.createElement('div');
      block.className = 'emo-block';
      const dominant = getDominant(charId);
      const dominantFr = EMOTION_FR[dominant] || dominant;
      const charLabel = charId.charAt(0).toUpperCase() + charId.slice(1);
      block.innerHTML = `<div class="emo-name">${charLabel} <span class="emo-dominant">[${dominantFr}]</span></div>`;
      Object.entries(emos).forEach(([emo, val]) => {
        const bar = document.createElement('div');
        bar.className = 'emo-bar-row';
        bar.innerHTML = `
          <span class="emo-label">${EMOTION_FR[emo] || emo}</span>
          <div class="emo-track"><div class="emo-fill emo-${emo}" style="width:${val}%; background:${EMOTION_COLOR[emo] || 'var(--accent)'}"></div></div>
          <span class="emo-val">${val}</span>`;
        block.appendChild(bar);
      });
      panel.appendChild(block);
    });
  }
  return { modify, getDominant, get, getAll, snapshot, restore, renderPanel: _renderEmotionPanel, EMOTION_FR, EMOTION_COLOR };
})();

const PowerSystem = (() => {
  const relations = {};
  function _key(a, b) { return [a,b].sort().join('|'); }
  function _init(a, b) {
    const k = _key(a, b);
    if (!relations[k]) relations[k] = { entities:[a,b], axes:{information:0,emotional_dependency:0,social_status:0,coercion:0}, balance:0 };
    return k;
  }
  function modify(a, b, axis, { delta, set } = {}) {
    const k = _init(a, b);
    const r = relations[k];
    const flip = [a,b].sort()[0] !== a ? -1 : 1;
    if (set   !== undefined) r.axes[axis] = Math.min(100, Math.max(-100, set * flip));
    else if (delta !== undefined) r.axes[axis] = Math.min(100, Math.max(-100, r.axes[axis] + delta * flip));
    const vals = Object.values(r.axes);
    r.balance = Math.round(vals.reduce((s,v) => s+v, 0) / vals.length);
  }
  function getBalance(a, b) { const k=_key(a,b); return relations[k]?relations[k].balance:0; }
  function getAxis(a, b, axis) { const k=_key(a,b); return relations[k]?(relations[k].axes[axis]||0):0; }
  function dominates(a, b) {
    const k=_key(a,b); if(!relations[k])return false;
    const r=relations[k]; const sign=r.entities[0]===a?1:-1;
    return r.balance*sign>20;
  }
  function snapshot() { return JSON.parse(JSON.stringify(relations)); }
  function restore(snap) { Object.assign(relations, snap); }
  return { modify, getBalance, getAxis, dominates, snapshot, restore };
})();

const ConsequenceSystem = (() => {
  const queue = [];
  let currentStep = 0;
  function register(effect, delay) { queue.push({ triggerAt: currentStep + delay, effect }); }
  function tick(step) {
    currentStep = step;
    const fired = queue.filter(e => e.triggerAt <= step);
    fired.forEach(e => _apply(e.effect));
    const remaining = queue.filter(e => e.triggerAt > step);
    queue.length = 0; queue.push(...remaining);
    return fired.length > 0;
  }
  function _apply(effect) {
    const [ns, ...rest] = effect.target.split('.');
    if (ns === 'emotion' || EmotionEngine.get(ns, rest[0]) !== undefined) {
      EmotionEngine.modify(ns, rest[0], { delta: effect.delta, set: effect.set });
    } else if (ns === 'power') {
      const [a, b, axis] = rest;
      PowerSystem.modify(a, b, axis, { delta: effect.delta, set: effect.set });
    } else if (ns === 'variable') {
      if (effect.set !== undefined) state.variables[rest[0]] = effect.set;
    }
  }
  function snapshot() { return { queue: JSON.parse(JSON.stringify(queue)), step: currentStep }; }
  function restore(snap) { queue.length=0; queue.push(...(snap.queue||[])); currentStep=snap.step||0; }
  return { register, tick, snapshot, restore };
})();

const PsychSystem = (() => {
  const profiles = {};
  function setProfile(charId, profile) { profiles[charId] = profile; }
  function fire(charId, eventName) {
    const p = profiles[charId];
    if (!p) { console.warn(`[PsychSystem] Pas de profil pour "${charId}"`); return; }
    const effects = (p.triggers||{})[eventName];
    if (!effects) { console.warn(`[PsychSystem] Trigger inconnu: "${eventName}" pour "${charId}"`); return; }
    Object.entries(effects).forEach(([emotion, delta]) => EmotionEngine.modify(charId, emotion, { delta }));
  }
  function getAttachmentStyle(charId) { return profiles[charId]?.attachment_style || 'unknown'; }
  return { setProfile, fire, getAttachmentStyle };
})();

// ════════════════════════════════════════════════════════════
//  ÉTAT DU JEU
// ════════════════════════════════════════════════════════════
const state = {
  index:        0,
  labels:       {},
  variables:    {},
  characters:   {},
  typing:       false,
  waitingInput: false,
  currentText:  '',
  backlog:      [],       // [ { speaker, text, index } ]
  autoAdvanceTimer: null,
  /* Ren'Py v2 */
  skipping:     false,
  nvlMode:      false,
  nvlLines:     [],       // [ { speaker, text } ]
};

SaveSystem.loadSettings();

function buildLabels() {
  state.labels = {};
  SCRIPT.forEach((step, i) => { if (step.type === 'label') state.labels[step.id] = i; });
}

// ════════════════════════════════════════════════════════════
//  RÉFÉRENCES DOM
// ════════════════════════════════════════════════════════════
const bgEl       = document.getElementById('background');
const charsEl    = document.getElementById('characters');
const dlgBox     = document.getElementById('dialogue-box');
const speakerEl  = document.getElementById('speaker-name');
const textEl     = document.getElementById('dialogue-text');
const nextEl     = document.getElementById('next-indicator');
const choiceEl   = document.getElementById('choice-panel');
const titleEl    = document.getElementById('title-screen');
const endEl      = document.getElementById('end-screen');
const endNextBtn = document.getElementById('next');
const nvlEl      = document.getElementById('nvl-box');


// ════════════════════════════════════════════════════════════
//  TOAST DE NOTIFICATION (quicksave/quickload)
// ════════════════════════════════════════════════════════════
function showToast(message, duration = 2000) {
  let toast = document.getElementById('vn-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'vn-toast';
    document.getElementById('game').appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), duration);
}

// ════════════════════════════════════════════════════════════
//  SKIP (saut rapide style Ren'Py)
// ════════════════════════════════════════════════════════════
let _skipInterval = null;

function startSkip() {
  if (state.skipping) return;
  state.skipping = true;
  const btn = document.getElementById('skip-btn');
  if (btn) btn.classList.add('active');
  _runSkip();
}

function stopSkip() {
  state.skipping = false;
  clearTimeout(_skipInterval);
  const btn = document.getElementById('skip-btn');
  if (btn) btn.classList.remove('active');
}

function toggleSkip() {
  state.skipping ? stopSkip() : startSkip();
}

function _runSkip() {
  if (!state.skipping) return;
  /* Si un texte est en cours de typage, on le termine instantanément */
  if (state.typing) {
    skipTyping();
    _skipInterval = setTimeout(_runSkip, 50);
    return;
  }
  /* Si on attend un clic */
  if (state.waitingInput) {
    /* On arrête le skip face à un choix */
    if (choiceEl.classList.contains('visible')) { stopSkip(); return; }
    handleInput();
    _skipInterval = setTimeout(_runSkip, 80);
    return;
  }
  _skipInterval = setTimeout(_runSkip, 80);
}

// ════════════════════════════════════════════════════════════
//  SYSTÈME DE TYPAGE
// ════════════════════════════════════════════════════════════
let typeInterval = null;

function typeText(text, onDone) {
  textEl.textContent = '';
  state.typing       = true;
  state.waitingInput = false;
  nextEl.classList.remove('visible');
  clearInterval(typeInterval);

  /* En mode skip, affichage instantané */
  const speed = state.skipping ? 0 : SaveSystem.settings.textSpeed;

  if (speed === 0) {
    textEl.textContent = text;
    state.typing       = false;
    state.waitingInput = true;
    nextEl.classList.add('visible');
    if (onDone) onDone();
    _scheduleAutoAdvance();
    return;
  }
  let i = 0;
  typeInterval = setInterval(() => {
    textEl.textContent += text[i++];
    if (i >= text.length) {
      clearInterval(typeInterval);
      state.typing       = false;
      state.waitingInput = true;
      nextEl.classList.add('visible');
      if (onDone) onDone();
      _scheduleAutoAdvance();
    }
  }, speed);
}

function skipTyping() {
  if (!state.typing) return;
  clearInterval(typeInterval);
  textEl.textContent = state.currentText;
  state.typing       = false;
  state.waitingInput = true;
  nextEl.classList.add('visible');
  _scheduleAutoAdvance();
}

function _scheduleAutoAdvance() {
  if (!SaveSystem.settings.autoAdvance) return;
  clearTimeout(state.autoAdvanceTimer);
  state.autoAdvanceTimer = setTimeout(() => {
    if (state.waitingInput) handleInput();
  }, SaveSystem.settings.autoDelay);
}

// ════════════════════════════════════════════════════════════
//  MODE NVL
// ════════════════════════════════════════════════════════════
function _showNVL(speaker, text) {
  dlgBox.classList.add('hidden');
  nvlEl.classList.add('visible');
  state.nvlMode = true;
  state.nvlLines.push({ speaker, text });

  /* Re-render toutes les lignes accumulées */
  const content = nvlEl.querySelector('#nvl-content');
  content.innerHTML = '';
  state.nvlLines.forEach(line => {
    const entry = document.createElement('div');
    entry.className = 'nvl-entry';
    if (line.speaker) {
      const spEl = document.createElement('span');
      spEl.className = 'nvl-speaker';
      spEl.textContent = line.speaker + ' ';
      entry.appendChild(spEl);
    }
    const txEl = document.createElement('span');
    txEl.className = 'nvl-text';
    txEl.textContent = line.text;
    entry.appendChild(txEl);
    content.appendChild(entry);
  });
  /* Scroll to bottom */
  content.scrollTop = content.scrollHeight;

  /* Pour le typing, on cible la dernière ligne */
  const lastTx = content.lastElementChild?.querySelector('.nvl-text');
  if (lastTx) {
    state.currentText = text;
    lastTx.textContent = '';
    state.typing = true;
    state.waitingInput = false;
    nextEl.classList.remove('visible');

    const speed = state.skipping ? 0 : SaveSystem.settings.textSpeed;
    if (speed === 0) {
      lastTx.textContent = text;
      state.typing = false;
      state.waitingInput = true;
      nextEl.classList.add('visible');
      _scheduleAutoAdvance();
      return;
    }
    let i = 0;
    typeInterval = setInterval(() => {
      lastTx.textContent += text[i++];
      content.scrollTop = content.scrollHeight;
      if (i >= text.length) {
        clearInterval(typeInterval);
        state.typing = false;
        state.waitingInput = true;
        nextEl.classList.add('visible');
        _scheduleAutoAdvance();
      }
    }, speed);
  }
}

function _clearNVL() {
  state.nvlMode  = false;
  state.nvlLines = [];
  nvlEl.classList.remove('visible');
  dlgBox.classList.remove('hidden');
  const content = nvlEl.querySelector('#nvl-content');
  if (content) content.innerHTML = '';
}

// ════════════════════════════════════════════════════════════
//  TRANSITION DE FOND (dissolve / fade)
// ════════════════════════════════════════════════════════════
function _applyBackground(step) {
  const value      = step.value;
  const transition = step.transition || 'none';
  const duration   = step.duration   || 500;

  function _setFinal() {
    if (value && (value.startsWith('img') || value.startsWith('/') || value.startsWith('http'))) {
      bgEl.style.backgroundImage    = `url('${value}')`;
      bgEl.style.backgroundSize     = 'cover';
      bgEl.style.backgroundPosition = 'center';
      bgEl.style.backgroundRepeat   = 'no-repeat';
      
    } else {
      bgEl.style.backgroundImage = '';
      bgEl.style.background      = value || '#000';
    }
  }

  if (transition === 'dissolve') {
    /* Fondu enchaîné via opacity */
    bgEl.style.transition = `opacity ${duration}ms ease`;
    bgEl.style.opacity = '0';
    setTimeout(() => {
      _setFinal();
      bgEl.style.opacity = '1';
      setTimeout(() => { bgEl.style.transition = ''; advance(); }, duration);
    }, duration);
    return true; /* async */
  }

  if (transition === 'fade') {
    /* Fade to black puis nouveau fond */
    const half = duration / 2;
    bgEl.style.transition = `opacity ${half}ms ease`;
    bgEl.style.opacity = '0';
    setTimeout(() => {
      _setFinal();
      bgEl.style.opacity = '1';
      setTimeout(() => { bgEl.style.transition = ''; advance(); }, half);
    }, half);
    return true; /* async */
  }

  /* Sans transition */
  _setFinal();
  return false;
}

// ════════════════════════════════════════════════════════════
//  DISPOSITION JAPONAISE DES PERSONNAGES
// ════════════════════════════════════════════════════════════

/**
 * Met à jour la classe two-chars sur #characters selon le nombre
 * de personnages visibles, pour ajuster le positionnement CSS.
 */
function _updateCharacterLayout() {
  const visible = Object.values(state.characters).filter(
    el => !el.classList.contains('hidden') && !el.classList.contains('leaving')
  );
  charsEl.classList.toggle('two-chars', visible.length === 2);
}

/**
 * Identifie le locuteur parmi les personnages visibles et applique
 * active-speaker / auto-dim pour simuler le focus style VN japonais.
 * La correspondance se fait sur le nom (speaker) vs l'id du personnage
 * en ignorant la casse et les accents.
 */
function _highlightSpeaker(speaker) {
  if (!speaker) {
    /* Narrateur ou aucun locuteur : tous en pleine lumière */
    Object.values(state.characters).forEach(el => {
      el.classList.remove('active-speaker', 'auto-dim');
    });
    return;
  }

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const spNorm = norm(speaker);

  let found = false;
  Object.entries(state.characters).forEach(([id, el]) => {
    if (el.classList.contains('hidden') || el.classList.contains('leaving')) {
      el.classList.remove('active-speaker', 'auto-dim');
      return;
    }
    /* Correspondance : id du perso contenu dans le nom du locuteur ou vice-versa */
    const idNorm = norm(id);
    const match  = spNorm.includes(idNorm) || idNorm.includes(spNorm);
    if (match) {
      el.classList.add('active-speaker');
      el.classList.remove('auto-dim', 'dim');
      found = true;
    } else {
      el.classList.remove('active-speaker');
      /* Dim automatique seulement si un locuteur a été identifié */
      el.classList.add('auto-dim');
    }
  });

  /* Si aucun match (nom de locuteur inconnu), pas de dim automatique */
  if (!found) {
    Object.values(state.characters).forEach(el => {
      el.classList.remove('active-speaker', 'auto-dim');
    });
  }
}

// ════════════════════════════════════════════════════════════
//  EXÉCUTION DES INSTRUCTIONS
// ════════════════════════════════════════════════════════════
function execute(step) {
  if (!step) return;

  switch (step.type) {

    /* ── AUDIO ──────────────────────────────────────────── */
    case 'bgm':
      Audio.playBGM(step.src || null, {
        loop:   step.loop   !== undefined ? step.loop   : true,
        volume: step.volume !== undefined ? step.volume : 0.5,
      });
      advance(); break;

    case 'sfx':
      Audio.playSFX(step.src, {
        id:     step.id     || null,
        loop:   step.loop   !== undefined ? step.loop   : false,
        volume: step.volume !== undefined ? step.volume : 1.0,
      });
      advance(); break;

    case 'sfxStop':
      Audio.stopSFX(step.id);
      advance(); break;

    /* ── FOND ───────────────────────────────────────────── */
    case 'background':
      if (step.value && (step.value.startsWith('img') ||
          step.value.startsWith('/') || step.value.startsWith('http'))) {
        bgEl.style.backgroundImage    = `url('${step.value}')`;
        bgEl.style.backgroundSize     = 'cover';
        bgEl.style.backgroundPosition = 'center';
        bgEl.style.backgroundRepeat   = 'no-repeat';
        
      } else {
        bgEl.style.backgroundImage = '';
        bgEl.style.background      = step.value || '#000';
      }
      advance();
      break;

    case 'bgAnimation':
      bgEl.classList.remove('anim-pulse', 'anim-drift', 'anim-shake');
      if (step.animation && step.animation !== 'none')
        bgEl.classList.add(step.animation);
      advance();
      break;


    /* ── PERSONNAGES ────────────────────────────────────── */
    case 'character': {
      let charEl = state.characters[step.id];
      const isNew = !charEl;

      if (isNew) {
        charEl = document.createElement('div');
        charEl.className = 'character-wrapper hidden';
        charsEl.appendChild(charEl);
        state.characters[step.id] = charEl;
      }

      /* ── Position ── */
      charEl.classList.remove('left', 'right', 'center');
      if (step.position) charEl.classList.add(step.position);

      /* ── Résolution source (expression ou src direct) ── */
      let imgSrc = step.src || null;
      if (!imgSrc && step.expression) {
        imgSrc = `img/${step.id}-${step.expression}.png`;
      }

      if (imgSrc) {
        const existingImg = charEl.querySelector('img');
        if (existingImg && existingImg.src.endsWith(imgSrc.split('/').pop())) {
          /* Même image, pas de transition */
        } else if (existingImg && !charEl.classList.contains('hidden')) {
          /* Cross-fade : nouvelle image en fondu */
          const newImg = document.createElement('img');
          newImg.alt = step.id;
          newImg.style.opacity = '0';
          newImg.src = imgSrc;
          newImg.style.position = 'absolute';
          newImg.style.inset = '0';
          newImg.style.width = '100%';
          newImg.style.height = '100%';
          newImg.style.objectFit = 'contain';
          newImg.style.objectPosition = 'bottom center';
          newImg.style.transition = 'opacity 0.25s ease';
          charEl.appendChild(newImg);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              newImg.style.opacity = '1';
              existingImg.style.opacity = '0';
              setTimeout(() => {
                charEl.innerHTML = '';
                const finalImg = document.createElement('img');
                finalImg.src = imgSrc;
                finalImg.alt = step.id;
                charEl.appendChild(finalImg);
              }, 260);
            });
          });
        } else {
          charEl.innerHTML = `<img src="${imgSrc}" alt="${step.id}">`;
        }
      } else if (step.placeholder) {
        charEl.style.background = step.placeholder;
        charEl.style.borderTop  = '2px solid rgba(255,255,255,0.15)';
        charEl.textContent      = step.label || step.id;
      }

      /* ── Show / Hide avec transitions ── */
      if (step.show === true && charEl.classList.contains('hidden')) {
        charEl.classList.remove('hidden', 'leaving');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            charEl.classList.add('entering');
            setTimeout(() => charEl.classList.remove('entering'), 420);
          });
        });
      } else if (step.show === false && !charEl.classList.contains('hidden')) {
        charEl.classList.add('leaving');
        setTimeout(() => {
          charEl.classList.add('hidden');
          charEl.classList.remove('leaving');
        }, 260);
      }

      /* ── Dim manuel ── */
      if (step.dim === true)  charEl.classList.add('dim');
      if (step.dim === false) charEl.classList.remove('dim');

      /* ── Mise à jour disposition 2 personnages ── */
      _updateCharacterLayout();

      advance(); break;
    }

    /* ── DIALOGUE ───────────────────────────────────────── */
    case 'dialogue': {
      /* Arrêt du skip face à un dialogue (mode normal) */
      /* On laisse le skip continuer, il s'arrête seulement aux choix */

      const speaker = step.speaker || '';
      const text    = step.text;

      /* Backlog avec index pour le rollback */
      state.backlog.push({ speaker, text, index: state.index });
      if (state.backlog.length > 200) state.backlog.shift();

      if (step.voice) Audio.playVoice(step.voice);
      else            Audio.stopVoice();

      /* Autosave à chaque dialogue */
      SaveSystem.autoSave(state);

      /* ── Highlight du locuteur actif ── */
      _highlightSpeaker(speaker);

      /* Mode NVL ou ADV */
      if (step.mode === 'nvl') {
        _showNVL(speaker, text);
      } else {
        /* Sortir du mode NVL si on revient en ADV */
        if (state.nvlMode) _clearNVL();
        dlgBox.classList.remove('hidden');
        speakerEl.textContent = speaker;
        speakerEl.style.display = speaker ? '' : 'none';
        state.currentText     = text;
        typeText(text);
      }
      break;
    }

    /* ── NVL CLEAR ──────────────────────────────────────── */
    case 'nvl_clear':
      _clearNVL();
      advance(); break;

    /* ── CHOIX ──────────────────────────────────────────── */
    case 'choice':
      stopSkip(); /* Toujours arrêter le skip face à un choix */
      dlgBox.classList.add('hidden');
      choiceEl.innerHTML = '';
      choiceEl.classList.add('visible');
      step.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className   = 'choice-btn';
        btn.textContent = opt.text;
        btn.onclick = () => {
          choiceEl.classList.remove('visible');
          dlgBox.classList.remove('hidden');
          if (opt.set) Object.assign(state.variables, opt.set);
          jump(opt.jump);
        };
        choiceEl.appendChild(btn);
      });
      break;

    /* ── CONDITION ──────────────────────────────────────── */
    case 'condition': {
      const val = state.variables[step.flag];
      const target = val ? step.then : step.else;
      if (target) jump(target); else advance();
      break;
    }
    case 'condition_emotion': {
      const emoVal = EmotionEngine.get(step.character, step.emotion);
      let pass = false;
      switch (step.op) {
        case '>=': pass = emoVal >= step.value; break;
        case '<=': pass = emoVal <= step.value; break;
        case '>':  pass = emoVal >  step.value; break;
        case '<':  pass = emoVal <  step.value; break;
        case '==': pass = emoVal === step.value; break;
      }
      if (pass ? step.then : step.else) jump(pass ? step.then : step.else);
      else advance();
      break;
    }
    case 'condition_power': {
      const pwrVal = step.axis
        ? PowerSystem.getAxis(step.a, step.b, step.axis)
        : PowerSystem.getBalance(step.a, step.b);
      let pass2 = false;
      switch (step.op) {
        case '>=': pass2 = pwrVal >= step.value; break;
        case '<=': pass2 = pwrVal <= step.value; break;
        case '>':  pass2 = pwrVal >  step.value; break;
        case '<':  pass2 = pwrVal <  step.value; break;
        case '==': pass2 = pwrVal === step.value; break;
      }
      if (pass2 ? step.then : step.else) jump(pass2 ? step.then : step.else);
      else advance();
      break;
    }

    /* ── SYSTÈMES PSY ───────────────────────────────────── */
    case 'emotion':
      EmotionEngine.modify(step.character, step.emotion, { delta: step.delta, set: step.set });
      advance(); break;
    case 'power':
      PowerSystem.modify(step.a, step.b, step.axis, { delta: step.delta, set: step.set });
      advance(); break;
    case 'defer':
      ConsequenceSystem.register(step.effect, step.delay || 1);
      advance(); break;
    case 'trigger':
      PsychSystem.fire(step.character, step.event);
      advance(); break;
    case 'psych_profile':
      PsychSystem.setProfile(step.character, step.profile);
      advance(); break;
    case 'show_emotions': {
      const ep = document.getElementById('emotion-panel');
      if (ep) {
        ep.classList.toggle('hidden', !step.visible);
        if (step.visible) EmotionEngine.renderPanel();
      }
      advance(); break;
    }

    /* ── LABELS & SAUTS ─────────────────────────────────── */
    case 'label': advance(); break;
    case 'jump':  jump(step.target); break;

    /* ── CHAPITRE ───────────────────────────────────────── */
    case 'chapter':
      _showChapterTitle(step.title || '');
      break;

    /* ── OVERLAY ────────────────────────────────────────── */
    case 'overlay': {
      const ov = document.getElementById('overlay');
      ov.style.background = step.color || 'black';
      ov.style.opacity    = step.color === 'transparent' ? 0 : 0.7;
      setTimeout(() => advance(), step.duration || 600);
      break;
    }

    /* ── FIN DE PAGE ────────────────────────────────────── */
    case 'end':
      stopSkip();
      _showEmotionRecap(() => {
        document.getElementById('end-title').textContent = step.title || 'FIN';
        endNextBtn.textContent = (state.index + 1 < SCRIPT.length) ? 'Page suivante' : 'Retour au menu';
        endEl.style.display = 'flex';
      });
      break;

    default: advance();
  }
}

// ── Bilan émotions fin de scénario ──────────────────────────
function _showEmotionRecap(onDone) {
  const profiles = EmotionEngine.snapshot();
  /* S'il n'y a aucun profil, passer directement */
  if (!profiles || Object.keys(profiles).length === 0) { onDone(); return; }

  const EMOTION_FR    = EmotionEngine.EMOTION_FR;
  const EMOTION_COLOR = EmotionEngine.EMOTION_COLOR;

  /* Créer l'overlay de bilan */
  let recap = document.getElementById('emotion-recap');
  if (!recap) {
    recap = document.createElement('div');
    recap.id = 'emotion-recap';
    document.getElementById('game').appendChild(recap);
  }

  let html = `
    <div class="recap-inner">
      <div class="recap-title">— Bilan émotionnel —</div>
      <div class="recap-subtitle">État des personnages à la fin de cette scène</div>
      <div class="recap-profiles">`;

  Object.entries(profiles).forEach(([charId, emos]) => {
    const dominant = Object.entries(emos).sort((a,b) => b[1]-a[1])[0][0];
    const dominantFr = (EMOTION_FR && EMOTION_FR[dominant]) || dominant;
    const charLabel = charId.charAt(0).toUpperCase() + charId.slice(1);
    html += `<div class="recap-char">
      <div class="recap-char-name">${charLabel} <span class="recap-dominant">${dominantFr}</span></div>
      <div class="recap-bars">`;
    Object.entries(emos).forEach(([emo, val]) => {
      const labelFr = (EMOTION_FR && EMOTION_FR[emo]) || emo;
      const color   = (EMOTION_COLOR && EMOTION_COLOR[emo]) || '#b49fff';
      html += `
        <div class="recap-bar-row">
          <span class="recap-emo-label">${labelFr}</span>
          <div class="recap-track">
            <div class="recap-fill" style="width:0%; background:${color}" data-target="${val}"></div>
          </div>
          <span class="recap-emo-val">${val}</span>
        </div>`;
    });
    html += `</div></div>`;
  });

  html += `</div>
      <button class="recap-btn" id="recap-close-btn">Continuer</button>
    </div>`;

  recap.innerHTML = html;
  recap.classList.add('visible');

  /* Animer les barres après apparition */
  setTimeout(() => {
    recap.querySelectorAll('.recap-fill').forEach(fill => {
      fill.style.transition = 'width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      fill.style.width = fill.dataset.target + '%';
    });
  }, 300);

  document.getElementById('recap-close-btn').addEventListener('click', () => {
    recap.classList.remove('visible');
    setTimeout(() => { recap.innerHTML = ''; onDone(); }, 400);
  });
}

// ── Titre de chapitre ────────────────────────────────────────
function _showChapterTitle(title) {
  let el = document.getElementById('chapter-title-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'chapter-title-banner';
    document.getElementById('game').appendChild(el);
  }
  el.textContent = title;
  el.classList.remove('hidden', 'fade-out');
  el.classList.add('visible');
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => { el.classList.remove('visible'); advance(); }, 800);
  }, 2000);
}

// ════════════════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════════════════
function advance() {
  state.index++;
  ConsequenceSystem.tick(state.index);
  if (state.index < SCRIPT.length) execute(SCRIPT[state.index]);
}

function jump(labelId) {
  const idx = state.labels[labelId];
  if (idx !== undefined) { state.index = idx; execute(SCRIPT[state.index]); }
  else { console.warn(`[VN] Label inconnu: "${labelId}"`); advance(); }
}

// ════════════════════════════════════════════════════════════
//  GESTION DES ENTRÉES
// ════════════════════════════════════════════════════════════
function handleInput() {
  clearTimeout(state.autoAdvanceTimer);
  /* Ne rien faire si un choix est affiché */
  if (choiceEl.classList.contains('visible')) return;
  if (state.typing)      { skipTyping(); return; }
  if (state.waitingInput) {
    Audio.stopVoice();
    state.waitingInput = false;
    nextEl.classList.remove('visible');
    advance();
  }
}

document.getElementById('game').addEventListener('click', (e) => {
  if (e.target.closest('#hud')           ||
      e.target.closest('#choice-panel')  ||
      e.target.closest('#title-screen')  ||
      e.target.closest('#end-screen')    ||
      e.target.closest('#save-modal')    ||
      e.target.closest('#backlog-modal') ||
      e.target.closest('#settings-modal')||
      e.target.closest('#nvl-box .nvl-controls')) return;
  handleInput();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') handleInput();
  if (e.code === 'KeyB')  toggleBacklog();
  if (e.code === 'KeyS')  openSaveModal('save');
  if (e.code === 'KeyL')  openSaveModal('load');
  if (e.code === 'KeyA')  toggleAutoAdvance();
  if (e.code === 'KeyE')  toggleEmotionPanel();
  if (e.code === 'Tab')   { e.preventDefault(); toggleSkip(); }
  if (e.code === 'F5')    { e.preventDefault(); doQuickSave(); }
  if (e.code === 'F9')    { e.preventDefault(); doQuickLoad(); }
});

// ════════════════════════════════════════════════════════════
//  QUICKSAVE / QUICKLOAD
// ════════════════════════════════════════════════════════════
function doQuickSave() {
  SaveSystem.quickSave(state);
  showToast('⚡ Sauvegarde rapide effectuée');
}
function doQuickLoad() {
  const data = SaveSystem.loadQuickSave();
  if (!data) { showToast('⚠ Aucune sauvegarde rapide disponible'); return; }
  closeSaveModal();
  _loadStateFromData(data);
  showToast('⚡ Sauvegarde rapide chargée');
}

// ════════════════════════════════════════════════════════════
//  DÉMARRER / MENU
// ════════════════════════════════════════════════════════════
function startGame(fromSave) {
  titleEl.style.display = 'none';
  endEl.style.display   = 'none';
  _clearNVL();
  const ov = document.getElementById('overlay');
  if (ov) { ov.style.opacity = '0'; ov.style.background = 'transparent'; }
  if (!fromSave) {
    state.index     = 0;
    state.variables = {};
    state.backlog   = [];
  }
  state.characters = {};
  charsEl.innerHTML = '';
  buildLabels();
  execute(SCRIPT[state.index]);
}

function continueGame() {
  const auto = SaveSystem.loadAutoSave();
  if (!auto) { startGame(); return; }
  _loadStateFromData(auto);
}

function goToTitle() {
  Audio.stopAll();
  stopSkip();
  clearTimeout(state.autoAdvanceTimer);
  _clearNVL();
  titleEl.style.display = 'flex';
  endEl.style.display   = 'none';
  choiceEl.classList.remove('visible');
  dlgBox.classList.remove('hidden');
  charsEl.innerHTML  = '';
  state.characters   = {};
  state.index        = 0;
  state.waitingInput = false;
  state.typing       = false;
  _updateTitleButtons();
}

endNextBtn.addEventListener('click', () => {
  state.index++;
  endEl.style.display = 'none';
  titleEl.style.display = 'none';
  if (state.index < SCRIPT.length) execute(SCRIPT[state.index]);
  else goToTitle();
});

// ════════════════════════════════════════════════════════════
//  RESTAURATION COMPLÈTE DE L'ÉTAT VISUEL
// ════════════════════════════════════════════════════════════
function _restoreVisual(visual) {
  if (!visual) return;

  /* Reset overlay */
  const ov = document.getElementById('overlay');
  if (ov) { ov.style.opacity = '0'; ov.style.background = 'transparent'; }

  /* Fond */
  if (visual.bgImage) {
    bgEl.style.backgroundImage    = visual.bgImage;
    bgEl.style.backgroundSize     = 'cover';
    bgEl.style.backgroundPosition = 'center';
    bgEl.style.backgroundRepeat   = 'no-repeat';

  } else if (visual.bgColor) {
    bgEl.style.backgroundImage = '';
    bgEl.style.background      = visual.bgColor;
  }

  /* Personnages */
  charsEl.innerHTML = '';
  state.characters  = {};
  if (visual.characters) {
    Object.entries(visual.characters).forEach(([id, data]) => {
      const charEl = document.createElement('div');
      charEl.className = 'character-wrapper';
      if (data.position) charEl.classList.add(data.position);
      if (data.hidden)   charEl.classList.add('hidden');
      if (data.dim)      charEl.classList.add('dim');
      if (data.src) {
        charEl.innerHTML = `<img src="${data.src}" alt="${id}">`;
      }
      charsEl.appendChild(charEl);
      state.characters[id] = charEl;
    });
  }
  _updateCharacterLayout();

  /* Mode NVL */
  if (visual.nvlMode && visual.nvlLines?.length) {
    state.nvlMode  = true;
    state.nvlLines = [...visual.nvlLines];
    nvlEl.classList.add('visible');
    const content = nvlEl.querySelector('#nvl-content');
    content.innerHTML = '';
    visual.nvlLines.forEach(line => {
      const entry = document.createElement('div');
      entry.className = 'nvl-entry';
      if (line.speaker) {
        const spEl = document.createElement('span');
        spEl.className = 'nvl-speaker';
        spEl.textContent = line.speaker + ' ';
        entry.appendChild(spEl);
      }
      const txEl = document.createElement('span');
      txEl.className = 'nvl-text';
      txEl.textContent = line.text;
      entry.appendChild(txEl);
      content.appendChild(entry);
    });
    dlgBox.classList.add('hidden');
  } else {
    dlgBox.classList.remove('hidden');
  }
}

function _loadStateFromData(data) {
  state.index     = data.index;
  state.variables = data.variables || {};
  state.backlog   = [];
  titleEl.style.display = 'none';
  endEl.style.display   = 'none';
  choiceEl.classList.remove('visible');

  /* Restaurer les systèmes psychologiques */
  if (data.emotions)     EmotionEngine.restore(data.emotions);
  if (data.power)        PowerSystem.restore(data.power);
  if (data.consequences) ConsequenceSystem.restore(data.consequences);

  /* Restaurer l'audio */
  if (data.audio) Audio.restore(data.audio);

  /* Restaurer l'état visuel complet */
  _restoreVisual(data.visual);

  /* Restaurer le dialogue affiché */
  speakerEl.textContent = data.speaker || '';
  speakerEl.style.display = data.speaker ? '' : 'none';
  textEl.textContent    = data.text    || '';
  state.currentText     = data.text    || '';
  state.typing          = false;
  state.waitingInput    = true;
  nextEl.classList.add('visible');

  buildLabels();

  /* Synchroniser le volume BGM avec les settings */
  const volSlider = document.getElementById('bgm-volume');
  if (volSlider && data.audio) {
    volSlider.value = data.audio.bgmVolume || SaveSystem.settings.bgmVolume;
  }
}

// ════════════════════════════════════════════════════════════
//  AUDIO — contrôles HUD
// ════════════════════════════════════════════════════════════
let _bgmMuted = false;
let _bgmVolBeforeMute = 0.5;

function toggleBGMMute() {
  const btn    = document.getElementById('bgm-mute-btn');
  const slider = document.getElementById('bgm-volume');
  if (_bgmMuted) {
    _bgmMuted = false;
    Audio.setBGMVolume(_bgmVolBeforeMute);
    slider.value = _bgmVolBeforeMute;
    btn.textContent = '🔊';
  } else {
    _bgmMuted = true;
    _bgmVolBeforeMute = parseFloat(slider.value);
    Audio.setBGMVolume(0);
    slider.value = 0;
    btn.textContent = '🔇';
  }
  SaveSystem.settings.bgmMuted  = _bgmMuted;
  SaveSystem.settings.bgmVolume = _bgmVolBeforeMute;
  SaveSystem.saveSettings();
}

// ════════════════════════════════════════════════════════════
//  PANNEAU D'ÉMOTIONS
// ════════════════════════════════════════════════════════════
function toggleEmotionPanel() {
  const ep  = document.getElementById('emotion-panel');
  const btn = document.getElementById('emo-btn');
  if (!ep) return;
  const isHidden = ep.classList.toggle('hidden');
  if (btn) btn.classList.toggle('active', !isHidden);
  if (!isHidden) EmotionEngine.renderPanel();
}

// ════════════════════════════════════════════════════════════
//  AUTO-AVANCE
// ════════════════════════════════════════════════════════════
function toggleAutoAdvance() {
  SaveSystem.settings.autoAdvance = !SaveSystem.settings.autoAdvance;
  SaveSystem.saveSettings();
  const btn = document.getElementById('auto-btn');
  if (btn) btn.classList.toggle('active', SaveSystem.settings.autoAdvance);
}

// ════════════════════════════════════════════════════════════
//  BACKLOG + ROLLBACK
// ════════════════════════════════════════════════════════════
function toggleBacklog() {
  const modal = document.getElementById('backlog-modal');
  if (!modal) return;
  if (modal.classList.contains('open')) {
    modal.classList.remove('open');
  } else {
    _renderBacklog();
    modal.classList.add('open');
  }
}

function _renderBacklog() {
  const list = document.getElementById('backlog-list');
  if (!list) return;
  list.innerHTML = '';
  const entries = [...state.backlog].reverse();
  entries.forEach((entry, i) => {
    const item = document.createElement('div');
    item.className = 'backlog-entry';
    item.innerHTML = `
      <span class="backlog-speaker">${entry.speaker}</span>
      <span class="backlog-text">${entry.text}</span>
    `;
    /* Bouton rollback (sauf pour le dernier dialogue = le plus récent) */
    if (i > 0 && entry.index !== undefined) {
      const rollBtn = document.createElement('button');
      rollBtn.className   = 'backlog-rollback-btn';
      rollBtn.textContent = '◀ Revenir ici';
      rollBtn.onclick     = () => _rollbackTo(entry);
      item.appendChild(rollBtn);
    }
    list.appendChild(item);
  });
}

function _rollbackTo(entry) {
  /* Fermer le backlog */
  document.getElementById('backlog-modal').classList.remove('open');
  /* Revenir à l'index du dialogue sélectionné */
  state.index     = entry.index;
  state.typing    = false;
  state.waitingInput = false;
  /* Tronquer le backlog jusqu'à ce point */
  const entryPos = state.backlog.findIndex(e => e.index === entry.index);
  if (entryPos >= 0) state.backlog = state.backlog.slice(0, entryPos);
  /* Ré-exécuter ce dialogue */
  execute(SCRIPT[state.index]);
}

// ════════════════════════════════════════════════════════════
//  MODAL SAUVEGARDE / CHARGEMENT
// ════════════════════════════════════════════════════════════
let _saveModalMode = 'save';

function openSaveModal(mode) {
  _saveModalMode = mode;
  const modal = document.getElementById('save-modal');
  if (!modal) return;
  document.getElementById('save-modal-title').textContent =
    mode === 'save' ? 'Sauvegarder' : 'Charger une partie';
  _renderSaveSlots();
  modal.classList.add('open');
}

function closeSaveModal() {
  const modal = document.getElementById('save-modal');
  if (modal) modal.classList.remove('open');
}

function _renderSaveSlots() {
  const container = document.getElementById('save-slots');
  if (!container) return;
  container.innerHTML = '';
  const all  = SaveSystem.loadAllSlots();
  const auto = SaveSystem.loadAutoSave();
  const quick = SaveSystem.loadQuickSave();

  /* Slot sauvegarde rapide */
  const quickEl = _buildSlotEl('quick', quick, _saveModalMode);
  container.appendChild(quickEl);

  /* Slot autosauvegarde */
  const autoEl = _buildSlotEl('auto', auto, _saveModalMode);
  container.appendChild(autoEl);

  /* Slots manuels */
  for (let i = 0; i < SaveSystem.MAX_MANUAL_SLOTS; i++) {
    const el = _buildSlotEl(i, all[i] || null, _saveModalMode);
    container.appendChild(el);
  }
}

function _buildSlotEl(slotId, data, mode) {
  const wrap = document.createElement('div');
  wrap.className = 'save-slot';
  const isAuto  = slotId === 'auto';
  const isQuick = slotId === 'quick';
  const isEmpty = !data;
  const label   = isQuick ? '⚡ Sauvegarde rapide'
                : isAuto  ? 'Sauvegarde auto'
                : `Emplacement ${Number(slotId) + 1}`;
  const preview = data
    ? `<span class="slot-speaker">${data.speaker || ''}</span>
       <span class="slot-text">${data.text ? data.text.slice(0, 60) + (data.text.length > 60 ? '…' : '') : ''}</span>
       <span class="slot-date">${data.timestamp ? new Date(data.timestamp).toLocaleString('fr-FR') : ''}</span>`
    : `<span class="slot-empty">— Vide —</span>`;

  wrap.innerHTML = `
    <div class="slot-header">${label}</div>
    <div class="slot-preview">${preview}</div>
  `;

  if (!isAuto && !isQuick) {
    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    if (mode === 'save') {
      btn.textContent = isEmpty ? 'Sauvegarder' : 'Écraser';
      btn.onclick = () => { SaveSystem.saveSlot(slotId, state); _renderSaveSlots(); };
    } else {
      btn.textContent = 'Charger';
      btn.disabled    = isEmpty;
      btn.onclick     = () => { if (!data) return; closeSaveModal(); _loadStateFromData(data); };
    }
    wrap.appendChild(btn);
  } else if ((isAuto || isQuick) && mode === 'load' && data) {
    const btn = document.createElement('button');
    btn.className   = 'slot-btn';
    btn.textContent = 'Reprendre';
    btn.onclick     = () => { closeSaveModal(); _loadStateFromData(data); };
    wrap.appendChild(btn);
  } else if (isQuick && mode === 'save') {
    const btn = document.createElement('button');
    btn.className   = 'slot-btn';
    btn.textContent = '⚡ Sauvegarder';
    btn.onclick     = () => { doQuickSave(); _renderSaveSlots(); };
    wrap.appendChild(btn);
  }

  return wrap;
}

// ════════════════════════════════════════════════════════════
//  MODAL PARAMÈTRES
// ════════════════════════════════════════════════════════════
function openSettings() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  document.getElementById('speed-select').value    = SaveSystem.settings.textSpeed;
  document.getElementById('auto-delay-range').value = SaveSystem.settings.autoDelay;
  modal.classList.add('open');
}
function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('open');
}
function applySettings() {
  const speed = parseInt(document.getElementById('speed-select').value, 10);
  const delay = parseInt(document.getElementById('auto-delay-range').value, 10);
  SaveSystem.settings.textSpeed = speed;
  SaveSystem.settings.autoDelay = delay;
  SaveSystem.saveSettings();
  closeSettings();
}

// ════════════════════════════════════════════════════════════
//  MISE À JOUR DES BOUTONS TITRE
// ════════════════════════════════════════════════════════════
function _updateTitleButtons() {
  const hasSave     = SaveSystem.hasAnySave();
  const continueBtn = document.getElementById('continue-btn');
  const loadBtn     = document.getElementById('title-load-btn');
  if (continueBtn) continueBtn.style.display = hasSave ? 'block' : 'none';
  if (loadBtn)     loadBtn.style.display     = hasSave ? 'block' : 'none';
}

// ════════════════════════════════════════════════════════════
//  INIT AU CHARGEMENT
// ════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  buildLabels();
  _updateTitleButtons();

  const volSlider = document.getElementById('bgm-volume');
  if (volSlider) {
    volSlider.value = SaveSystem.settings.bgmVolume;
    volSlider.oninput = (e) => {
      Audio.setBGMVolume(e.target.value);
      SaveSystem.settings.bgmVolume = parseFloat(e.target.value);
      SaveSystem.saveSettings();
    };
  }

  if (SaveSystem.settings.bgmMuted) {
    _bgmMuted = true;
    _bgmVolBeforeMute = SaveSystem.settings.bgmVolume;
    Audio.setBGMVolume(0);
    const muteBtn = document.getElementById('bgm-mute-btn');
    if (muteBtn) muteBtn.textContent = '🔇';
  }
});

// ════════════════════════════════════════════════════════════
//  EXPOSITION GLOBALE
// ════════════════════════════════════════════════════════════
window.VN = {
  EmotionEngine, PowerSystem, ConsequenceSystem, PsychSystem, state,
  doQuickSave, doQuickLoad, toggleSkip, showToast,
};
