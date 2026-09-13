/**
 * main.js — ポモドーロタイマー + GSAP 破片アニメーション & リアルタイム位置調整エディタ
 *
 * ● 集中（25分デフォルト） → 休憩（5分デフォルト） のサイクル
 * ● 集中中: 22個の破片が順番にハート形の定位置へ集合
 * ● 休憩終了→次の集中開始時: 破片が弾け飛んで散らばる
 * ● 調整モード (Dキー / 🛠️ボタン): マウスドラッグや矢印キーで各破片の位置を直接編集可能！
 */

(function () {
  'use strict';

  /* ======================
     Configuration
     ====================== */
  let FOCUS_MINUTES = 25;
  let BREAK_MINUTES = 5;
  const TOTAL_FRAGMENTS = 22; // 1,2,4~23 (3.pngが存在しないため22枚)

  // 実際に存在する画像番号のリスト
  const FRAGMENT_IDS = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

  /* ======================
     DOM Elements
     ====================== */
  const trailCanvas = document.getElementById('trail-canvas');
  const trailCtx = trailCanvas.getContext('2d');
  const fragmentsContainer = document.getElementById('fragments-container');
  const minutesSlot = document.getElementById('minutes-slot');
  const secondsSlot = document.getElementById('seconds-slot');
  const timerMinutes = document.getElementById('timer-minutes'); // 互換用
  const timerSeconds = document.getElementById('timer-seconds'); // 互換用
  const timerSeparator = document.getElementById('timer-separator');
  const phaseText = document.getElementById('phase-text');
  const btnPause = document.getElementById('btn-pause');
  const btnSpeed = document.getElementById('btn-speed');
  const btnSound = document.getElementById('btn-sound');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const iconSoundOff = document.getElementById('icon-sound-off');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const btnSettings = document.getElementById('btn-settings');
  const settingsModal = document.getElementById('settings-modal');
  const inputFocus = document.getElementById('input-focus');
  const inputBreak = document.getElementById('input-break');
  const selectSpeed = document.getElementById('select-speed');
  const btnOpenEditor = document.getElementById('btn-open-editor');
  const btnSave = document.getElementById('btn-save-settings');
  const btnCancel = document.getElementById('btn-cancel-settings');

  // Editor Elements
  const btnEditor = document.getElementById('btn-editor');
  const editorToolbar = document.getElementById('editor-toolbar');
  const editorStatus = document.getElementById('editor-status');
  const edMoveUp = document.getElementById('ed-move-up');
  const edMoveDown = document.getElementById('ed-move-down');
  const edMoveLeft = document.getElementById('ed-move-left');
  const edMoveRight = document.getElementById('ed-move-right');
  const edScaleUp = document.getElementById('ed-scale-up');
  const edScaleDown = document.getElementById('ed-scale-down');
  const edCopyCode = document.getElementById('ed-copy-code');
  const edReset = document.getElementById('ed-reset');
  const edClose = document.getElementById('ed-close');

  /* ======================
     State
     ====================== */
  let phase = 'focus';        // 'focus' | 'break'
  let totalSeconds = FOCUS_MINUTES * 60;
  let remainingSeconds = totalSeconds;
  let isRunning = false;
  let isFirstStart = true;    // デバッグ用: 初回スタート時にscatter
  let timerInterval = null;
  let timerSpeed = 1;         // デフォルト1倍速 (通常速度)
  let fragments = [];         // DOM elements for each fragment
  let fragmentsMoved = [];    // Tracks which fragments have been moved to heart position
  let scheduleTimings = [];   // The second-marks at which each fragment should move
  let fragmentMoveOrder = [];
  let isEditorMode = false;
  let selectedFragmentId = null;

  /* ======================
     Heart Shape Math & Precise Positions
     1024x1024 基準キャンバスにおける、元画像の精密な相対位置とサイズ
     ====================== */
  const DEFAULT_HEART_FRAGMENTS = {
    1:  { dx: -167,   dy: -245,   w:  96.8, h:  98.2, rot: 0 },
    2:  { dx: -237,   dy: -228.5, w: 104.8, h:  87.4, rot: 0 },
    4:  { dx: -211.5, dy: -119,   w: 139.1, h: 134.4, rot: 0 },
    5:  { dx: -285,   dy:  -91.5, w:  82.2, h: 149.9, rot: 0 },
    6:  { dx: -217.5, dy:   56,   w: 141.9, h: 206.8, rot: 0 },
    7:  { dx: -132,   dy:  205,   w:  51.2, h:  49.8, rot: 0 },
    8:  { dx:  -70.5, dy: -192,   w: 119.8, h: 174.8, rot: 0 },
    9:  { dx:  -97.5, dy:   24,   w: 189.9, h: 182.4, rot: 0 },
    10: { dx: -122,   dy:   60,   w:  47.9, h:  39.5, rot: 0 },
    11: { dx:  -78.5, dy:  194,   w: 153.2, h: 202.6, rot: 0 },
    12: { dx:   -7,   dy:  -66,   w: 128.3, h: 166.4, rot: 0 },
    13: { dx:   23,   dy:  160,   w:  34.8, h:  74.7, rot: 0 },
    14: { dx:   65.5, dy: -187,   w: 123.1, h: 132.1, rot: 0 },
    15: { dx:  101,   dy:  -98,   w:  53.6, h:  47.9, rot: 0 },
    16: { dx:  102,   dy:    9,   w: 198.8, h: 174.4, rot: 0 },
    17: { dx:   92,   dy:   85,   w:  62.5, h:  47.9, rot: 0 },
    18: { dx:   86.5, dy:  192,   w: 155.1, h: 216.2, rot: 0 },
    19: { dx:  193,   dy: -237.5, w: 154.2, h:  73.3, rot: 0 },
    20: { dx:  203,   dy: -143.5, w: 148.5, h: 111.9, rot: 0 },
    21: { dx:  276,   dy: -180,   w:  23.0, h:  39.5, rot: 0 },
    22: { dx:  285,   dy: -105,   w:  78.0, h: 152.3, rot: 0 },
    23: { dx:  228.5, dy:   40.5, w: 147.1, h: 245.3, rot: 0 },
  };

  const DEFAULT_HEART_CONFIG = {
    centerX: 48.5,  // % of window width
    centerY: 17.0,  // % of window height
    scale: 0.49     // 全体スケール
  };

  const CONFIG_VERSION = 'v2.1';

  // localStorage から保存された設定をロード（バージョン変更時はデフォルトを優先適用）
  let activeHeartFragments = loadFragmentsConfig();
  let heartConfig = loadHeartConfig();

  function loadFragmentsConfig() {
    try {
      const savedVersion = localStorage.getItem('pomodoro_custom_heart_version');
      if (savedVersion !== CONFIG_VERSION) {
        localStorage.setItem('pomodoro_custom_heart_version', CONFIG_VERSION);
        localStorage.setItem('pomodoro_custom_heart_fragments', JSON.stringify(DEFAULT_HEART_FRAGMENTS));
        return JSON.parse(JSON.stringify(DEFAULT_HEART_FRAGMENTS));
      }
      const saved = localStorage.getItem('pomodoro_custom_heart_fragments');
      if (saved) {
        const parsed = JSON.parse(saved);
        const valid = FRAGMENT_IDS.every(id => parsed[id] && parsed[id].dx !== undefined);
        if (valid) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load fragments config from localStorage', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_HEART_FRAGMENTS));
  }

  function loadHeartConfig() {
    try {
      const savedVersion = localStorage.getItem('pomodoro_custom_heart_version');
      if (savedVersion !== CONFIG_VERSION) {
        localStorage.setItem('pomodoro_custom_heart_config', JSON.stringify(DEFAULT_HEART_CONFIG));
        return Object.assign({}, DEFAULT_HEART_CONFIG);
      }
      const saved = localStorage.getItem('pomodoro_custom_heart_config');
      if (saved) {
        return Object.assign({}, DEFAULT_HEART_CONFIG, JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load heart config from localStorage', e);
    }
    return Object.assign({}, DEFAULT_HEART_CONFIG);
  }

  function saveConfigToStorage() {
    try {
      localStorage.setItem('pomodoro_custom_heart_fragments', JSON.stringify(activeHeartFragments));
      localStorage.setItem('pomodoro_custom_heart_config', JSON.stringify(heartConfig));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }

  /* ======================
     Magical Sound Engine (Web Audio API)
     外部ファイル不要・遅延ゼロ・幻想的なクリスタルチャイム＆破砕効果音
     ====================== */
  let audioCtx = null;
  let isSoundEnabled = true;

  function getAudioContext() {
    if (!isSoundEnabled) return null;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx && AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  // 1. 集中終了 → 休憩開始時: 「ポロロロ〜ン♪」と祝福のクリスタルチャイムアルペジオ
  function playBreakStartSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
    const t0 = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + idx * 0.12);

      gain.gain.setValueAtTime(0.001, t0 + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + idx * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + idx * 0.12 + 1.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0 + idx * 0.12);
      osc.stop(t0 + idx * 0.12 + 1.9);
    });
  }

  // 2. 休憩終了 → 集中開始時: 「ピン・ポーン♪」と意識を切り替える澄んだベル
  function playFocusStartSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [880.0, 1174.66]; // A5, D6
    const t0 = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + idx * 0.18);

      gain.gain.setValueAtTime(0.001, t0 + idx * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.20, t0 + idx * 0.18 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + idx * 0.18 + 1.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0 + idx * 0.18);
      osc.stop(t0 + idx * 0.18 + 1.7);
    });
  }

  // 3. ハートの溜め音（光がスーッと収束する音）
  function playChargeSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t0);
    osc.frequency.exponentialRampToValueAtTime(1300, t0 + 0.35);

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(0.09, t0 + 0.30);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.38);
  }

  // 4. ハートの爆発散乱音（「パリーンッ！」とクリスタル破砕＋風圧バースト）
  function playShatterSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const freqs = [1900, 2600, 3400, 4200];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 150, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.35, t0 + 0.32);

      gain.gain.setValueAtTime(0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32 + idx * 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0);
      osc.stop(t0 + 0.40);
    });

    // 短いエアバースト
    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3000;
      filter.Q.value = 1.4;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.10, t0);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(t0);
    } catch (e) {}
  }

  /* ======================
     Calculate screen target for a fragment
     ====================== */
  function getFragmentTarget(id) {
    const frag = activeHeartFragments[id] || DEFAULT_HEART_FRAGMENTS[id];
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const s = (vh / 1000) * heartConfig.scale;

    const pxCenterX = (vw * heartConfig.centerX) / 100;
    const pxCenterY = (vh * heartConfig.centerY) / 100;

    const x = pxCenterX + frag.dx * s;
    const y = pxCenterY + frag.dy * s;
    const width = Math.max(10, frag.w * s);
    const height = Math.max(10, frag.h * s);
    const rotation = frag.rot || 0;

    return { x, y, width, height, rotation, s, pxCenterX, pxCenterY };
  }

  /* ======================
     Initialize Fragments & Add Drag Handlers
     ====================== */
  function createFragments() {
    fragmentsContainer.innerHTML = '';
    fragments = [];

    FRAGMENT_IDS.forEach((id, index) => {
      const el = document.createElement('div');
      el.classList.add('fragment');
      el.dataset.id = String(id);
      el.dataset.index = String(index);

      el.innerHTML = `
        <img src="images/${id}.png" alt="fragment ${id}" draggable="false">
        <span class="fragment-label">${id}</span>
      `;

      fragmentsContainer.appendChild(el);
      fragments.push(el);

      // Editor: Mouse drag support
      setupFragmentDrag(el, id);
    });
  }

  /* ======================
     Interactive Editor: Drag & Drop Logic
     ====================== */
  function setupFragmentDrag(el, id) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialDx = 0, initialDy = 0;

    el.addEventListener('pointerdown', (e) => {
      if (!isEditorMode) return;
      e.stopPropagation();
      e.preventDefault();

      selectFragment(id);

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const frag = activeHeartFragments[id];
      initialDx = frag.dx;
      initialDy = frag.dy;

      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (!isDragging || !isEditorMode) return;
      e.stopPropagation();

      const dxDiff = e.clientX - startX;
      const dyDiff = e.clientY - startY;

      const vh = window.innerHeight;
      const s = (vh / 1000) * heartConfig.scale;

      const frag = activeHeartFragments[id];
      frag.dx = Math.round((initialDx + dxDiff / s) * 10) / 10;
      frag.dy = Math.round((initialDy + dyDiff / s) * 10) / 10;

      updateSingleFragmentPosition(id);
      updateStatus(`[破片 #${id}] dx: ${frag.dx}, dy: ${frag.dy}`);
    });

    function endDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      saveConfigToStorage();
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
  }

  function selectFragment(id) {
    selectedFragmentId = id;
    fragments.forEach(f => {
      if (parseInt(f.dataset.id, 10) === id) {
        f.classList.add('selected');
      } else {
        f.classList.remove('selected');
      }
    });
    if (id !== null) {
      const frag = activeHeartFragments[id];
      updateStatus(`選択中: 破片 #${id} (dx: ${frag.dx}, dy: ${frag.dy}) — 矢印キーで微調整可能`);
    }
  }

  function updateSingleFragmentPosition(id) {
    const idx = FRAGMENT_IDS.indexOf(id);
    if (idx === -1) return;
    const el = fragments[idx];
    const target = getFragmentTarget(id);

    gsap.set(el, {
      left: target.x + 'px',
      top: target.y + 'px',
      width: target.width + 'px',
      height: target.height + 'px',
      rotation: target.rotation,
      xPercent: -50,
      yPercent: -50,
      opacity: 0.92
    });
  }

  /* ======================
     Scatter Fragments (Focus Start / Break End)
     ハートの最初の溜め（チャージ）を経て、一気に「シュンッ！」と画面外へ爆発散乱
     ====================== */
  function scatterFragments(animated) {
    fragmentsMoved = new Array(TOTAL_FRAGMENTS).fill(false);

    const centerPxX = (window.innerWidth * heartConfig.centerX) / 100;
    const centerPxY = (window.innerHeight * heartConfig.centerY) / 100;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const diag = Math.hypot(viewW, viewH);
    const containerY = gsap.getProperty(fragmentsContainer, 'y') || 0;

    fragments.forEach((el, i) => {
      const id = FRAGMENT_IDS[i];
      const target = getFragmentTarget(id);

      // ハート中心から各破片への放射角度
      let angle = Math.atan2(target.y - centerPxY, target.x - centerPxX);
      if (Math.hypot(target.y - centerPxY, target.x - centerPxX) < 20) {
        angle = -Math.PI / 2 + ((i - TOTAL_FRAGMENTS / 2) / TOTAL_FRAGMENTS) * Math.PI * 1.8;
      }

      // 画面外部（宇宙の彼方: 画面枠からさらに外側へ160px〜300px）の待機位置
      const dist = diag * 0.75 + 180 + Math.random() * 220;
      let offscreenX = centerPxX + Math.cos(angle) * dist;
      let offscreenY = centerPxY + Math.sin(angle) * dist;

      // 画面下深くに潜りすぎないよう上空・左右のアークへ整流
      if (offscreenY > viewH + 200) {
        offscreenY = viewH + 120;
      }

      const randRotation = target.rotation + (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 180);

      // ピクセル座標をキャッシュ（流星飛来のスタート地点）
      el._posX = offscreenX;
      el._posY = offscreenY;
      el._rot = randRotation;
      el._opacity = 0;

      gsap.killTweensOf(el);

      if (animated) {
        // ユーザー要望: 「弾ける前の溜めは、上に若干上がり、若干破片が広がって、パーンと弾けるようにして」
        // 1. 上に若干上がる (riseY = -18px)
        // 2. 若干破片が広がる (中心から外側へ spreadDist = 22px)
        const spreadDist = 22;
        const riseY = -18;
        const chargeX = target.x + Math.cos(angle) * spreadDist;
        const chargeY = target.y + Math.sin(angle) * spreadDist + riseY;

        const tl = gsap.timeline();

        // ステップ1: 溜め（上にふわりと浮き上がり、破片が外側に少し広がりながら眩しく光を溜める）
        tl.to(el, {
          left: chargeX + 'px',
          top: chargeY + 'px',
          scale: 1.10,
          opacity: 1.0,
          filter: 'drop-shadow(0 0 25px rgba(255, 255, 255, 1)) drop-shadow(0 0 45px rgba(130, 225, 255, 0.95)) brightness(1.75)',
          duration: 0.38,
          ease: 'power1.out'
        });

        // ステップ2: パーンと弾ける（溜まった頂点から一瞬で画面外へ猛スピードで吹き飛ぶ！）
        tl.to(el, {
          left: offscreenX + 'px',
          top: offscreenY + 'px',
          rotation: randRotation,
          opacity: 0,
          scale: 0.35,
          duration: 0.32 + Math.random() * 0.08,
          ease: 'power3.out',
          filter: 'drop-shadow(0 0 10px rgba(140, 200, 255, 0.5))',
          onStart: () => {
            createScatterSparkles(chargeX, chargeY, angle);
            if (i === 0) {
              createMeteorImpact(centerPxX, centerPxY + riseY + containerY);
            }
          },
          onComplete: () => {
            el.style.left = offscreenX + 'px';
            el.style.top = offscreenY + 'px';
          }
        });
      } else {
        gsap.set(el, {
          left: offscreenX + 'px',
          top: offscreenY + 'px',
          width: target.width + 'px',
          height: target.height + 'px',
          xPercent: -50,
          yPercent: -50,
          rotation: randRotation,
          opacity: 0,
          scale: 0.5
        });
      }
    });
  }

  /* ======================
     Place all fragments at heart positions (assembled state)
     ====================== */
  function placeFragmentsAtHeart() {
    fragmentsMoved = new Array(TOTAL_FRAGMENTS).fill(true);
    FRAGMENT_IDS.forEach((id, i) => {
      const el = fragments[i];
      const target = getFragmentTarget(id);
      el._posX = target.x;
      el._posY = target.y;
      gsap.set(el, {
        left: target.x + 'px',
        top: target.y + 'px',
        width: target.width + 'px',
        height: target.height + 'px',
        xPercent: -50,
        yPercent: -50,
        rotation: target.rotation,
        opacity: 0.88,
        scale: 1
      });
      el.style.filter = 'drop-shadow(0 0 14px rgba(200, 220, 255, 0.6))';
    });
  }

  /* ======================
     Ambient floating animation for scattered fragments
     ====================== */
  let ambientTimelines = [];

  function startAmbientFloat() {
    stopAmbientFloat();
    if (isEditorMode) return;
    ambientTimelines = new Array(TOTAL_FRAGMENTS);

    fragments.forEach((el, i) => {
      // すでにハートに集合済みの破片は浮遊させない
      if (fragmentsMoved[i]) return;

      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(el, {
        y: '+=' + (5 + Math.random() * 10),
        x: '+=' + (-4 + Math.random() * 8),
        rotation: '+=' + (-6 + Math.random() * 12),
        duration: 3 + Math.random() * 4,
        ease: 'sine.inOut'
      });
      ambientTimelines[i] = tl;
    });
  }

  function stopAmbientFloat() {
    ambientTimelines.forEach(tl => {
      if (tl) tl.kill();
    });
    ambientTimelines = [];
  }

  /* ======================
     Meteor Trail & Soft Glow Sparkle System (High-Performance & Silky Smooth)
     ====================== */
  let activeTrails = [];
  let sparkles = [];
  let impactRings = [];
  let isRenderLoopRunning = false;

  // 柔らかなボケ光球スプライト（硬い円ではなく、中心が白く輝き外側に溶ける微細な星屑オーブ）
  const glowSprites = {};

  function initGlowSprites() {
    const types = [
      { name: 'white', inner: '#ffffff', mid: 'rgba(210, 240, 255, 0.8)', outer: 'rgba(160, 210, 255, 0)' },
      { name: 'cyan',  inner: '#ffffff', mid: 'rgba(80, 250, 235, 0.85)', outer: 'rgba(50, 210, 230, 0)' },
      { name: 'pink',  inner: '#ffffff', mid: 'rgba(255, 130, 220, 0.85)', outer: 'rgba(230, 80, 180, 0)' },
      { name: 'gold',  inner: '#ffffff', mid: 'rgba(255, 235, 140, 0.9)', outer: 'rgba(255, 190, 70, 0)' }
    ];

    types.forEach(t => {
      const size = 32;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      grad.addColorStop(0, t.inner);
      grad.addColorStop(0.2, t.inner);
      grad.addColorStop(0.55, t.mid);
      grad.addColorStop(1, t.outer);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      glowSprites[t.name] = c;
    });
  }

  function resizeTrailCanvas() {
    if (!trailCanvas) return;
    trailCanvas.width = window.innerWidth;
    trailCanvas.height = window.innerHeight;
    trailCanvas.style.width = window.innerWidth + 'px';
    trailCanvas.style.height = window.innerHeight + 'px';
  }

  function startMeteorTrail(id, startX, startY) {
    const trail = {
      id: id,
      points: [{ x: startX, y: startY, time: performance.now() }],
      isFlying: true,
      fade: 1.0,
      headX: startX,
      headY: startY,
      prevHeadX: startX,
      prevHeadY: startY
    };
    activeTrails.push(trail);
    ensureRenderLoop();
    return trail;
  }

  function addMeteorPoint(trail, x, y) {
    trail.prevHeadX = trail.headX;
    trail.prevHeadY = trail.headY;
    trail.headX = x;
    trail.headY = y;

    const now = performance.now();
    trail.points.push({ x: x, y: y, time: now });

    // 直近220msの履歴を保持（彗星の尾を美しく描く）
    while (trail.points.length > 1 && now - trail.points[0].time > 220) {
      trail.points.shift();
    }

    // 移動方向の後ろに細やかな星屑粒子を放出（キラキラ瞬き）
    const dx = x - trail.prevHeadX;
    const dy = y - trail.prevHeadY;
    const speed = Math.hypot(dx, dy);

    if (speed > 1.5) {
      const types = ['cyan', 'pink', 'white', 'gold'];
      const pCount = Math.min(4, Math.floor(speed / 4.5) + 1);
      for (let i = 0; i < pCount; i++) {
        const offset = Math.random();
        // 破片の現在位置 (x, y) の直後からキラキラ粒子を放出
        const px = x - dx * offset * 0.4 + (Math.random() - 0.5) * 5;
        const py = y - dy * offset * 0.4 + (Math.random() - 0.5) * 5;
        sparkles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 1.2 - (dx / speed) * 0.9,
          vy: (Math.random() - 0.5) * 1.2 - (dy / speed) * 0.9,
          size: 1.2 + Math.random() * 2.2, // 細かいキラキラ粒子
          type: types[Math.floor(Math.random() * types.length)],
          alpha: 1.0,
          decay: 0.04 + Math.random() * 0.03,
          twinkle: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.25 + Math.random() * 0.35
        });
      }
    }
  }

  // 破片がハートから爆発的に散らばる時の高速星屑演出
  function createScatterSparkles(x, y, angle) {
    const types = ['cyan', 'pink', 'white', 'gold'];
    const count = 16;
    for (let k = 0; k < count; k++) {
      const a = angle + (Math.random() - 0.5) * 1.2;
      const spd = 6.0 + Math.random() * 12.0; // 爆発的な初速！
      sparkles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 1.4 + Math.random() * 2.8,
        type: types[Math.floor(Math.random() * types.length)],
        alpha: 1.0,
        decay: 0.045 + Math.random() * 0.035, // 素早くキラキラ消える
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.35 + Math.random() * 0.4
      });
    }
    ensureRenderLoop();
  }

  function finishMeteorTrail(trail) {
    trail.isFlying = false;
  }

  // 到着時の細やかなキラキラ星屑インパクト演出
  function createMeteorImpact(x, y) {
    // 1. 繊細でシャープな十字スターフレア（星の瞬き）
    impactRings.push({
      x: x,
      y: y,
      radius: 3,
      maxRadius: 40,
      alpha: 1.0,
      sparkleLen: 36,
      decay: 0.045
    });

    // 2. 細かくキラキラ瞬く星屑粒子がパッと舞い散る！
    const types = ['white', 'cyan', 'pink', 'gold'];
    for (let i = 0; i < 32; i++) {
      const angle = (Math.PI * 2 * i) / 32 + (Math.random() - 0.5) * 0.4;
      const spd = 1.2 + Math.random() * 4.2;
      sparkles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 1.5 + Math.random() * 2.8, // 細かく繊細な星屑
        type: types[Math.floor(Math.random() * types.length)],
        alpha: 1.0,
        decay: 0.022 + Math.random() * 0.02,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.25 + Math.random() * 0.35 // キラキラ点滅
      });
    }
    ensureRenderLoop();
  }

  function ensureRenderLoop() {
    if (!isRenderLoopRunning) {
      isRenderLoopRunning = true;
      requestAnimationFrame(renderTrails);
    }
  }

  function renderTrails() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    trailCtx.clearRect(0, 0, w, h);

    trailCtx.save();
    trailCtx.globalCompositeOperation = 'lighter'; // 加算合成で美しい光の重なり

    // 1. 各トレイル（彗星の尾）の描画 — shadowBlurを使わず多層ストロークで超高速描画！
    for (let i = activeTrails.length - 1; i >= 0; i--) {
      const trail = activeTrails[i];

      if (!trail.isFlying) {
        trail.fade -= 0.12;
        if (trail.points.length > 1) {
          trail.points.shift();
        }
      }

      if (trail.fade <= 0 || trail.points.length < 2) {
        activeTrails.splice(i, 1);
        continue;
      }

      const pts = trail.points;
      const head = pts[pts.length - 1];
      const tail = pts[0];

      // 先端から末尾へのグラデーション（シアン〜マゼンタピンク〜青〜白）
      const grad = trailCtx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      grad.addColorStop(0.0, 'rgba(100, 160, 255, 0)');
      grad.addColorStop(0.25, `rgba(130, 180, 255, ${0.35 * trail.fade})`);
      grad.addColorStop(0.55, `rgba(255, 120, 210, ${0.85 * trail.fade})`); // マゼンタピンク
      grad.addColorStop(0.85, `rgba(60, 250, 220, ${0.95 * trail.fade})`);  // エメラルド・シアン
      grad.addColorStop(1.0, `rgba(255, 255, 255, ${1.0 * trail.fade})`);   // 純白の核

      // 1-1. 最外層のソフトオーラ（幅 20px, alpha 0.4）
      trailCtx.beginPath();
      trailCtx.moveTo(pts[0].x, pts[0].y);
      for (let j = 1; j < pts.length; j++) trailCtx.lineTo(pts[j].x, pts[j].y);
      trailCtx.strokeStyle = grad;
      trailCtx.lineWidth = 20;
      trailCtx.lineCap = 'round';
      trailCtx.lineJoin = 'round';
      trailCtx.globalAlpha = 0.4 * trail.fade;
      trailCtx.stroke();

      // 1-2. 中間のシアン〜ピンクビーム（幅 9px, alpha 0.75）
      trailCtx.lineWidth = 9;
      trailCtx.globalAlpha = 0.75 * trail.fade;
      trailCtx.stroke();

      // 1-3. 内側のエメラルドコア（幅 4px, alpha 0.95）
      trailCtx.lineWidth = 4;
      trailCtx.globalAlpha = 0.95 * trail.fade;
      trailCtx.stroke();

      // 1-4. 中心の純白コアライン（幅 1.8px, alpha 1.0）
      trailCtx.strokeStyle = '#ffffff';
      trailCtx.lineWidth = 1.8;
      trailCtx.globalAlpha = 1.0 * trail.fade;
      trailCtx.stroke();

      // 1-5. 先端の光芒（鋭いスパークルフレア）
      if (trail.isFlying && pts.length >= 2) {
        const dx = head.x - pts[pts.length - 2].x;
        const dy = head.y - pts[pts.length - 2].y;
        const angle = Math.atan2(dy, dx);
        const flareLen = 22;

        trailCtx.save();
        trailCtx.translate(head.x, head.y);
        trailCtx.rotate(angle);

        trailCtx.beginPath();
        trailCtx.moveTo(flareLen, 0);
        trailCtx.lineTo(-5, 4);
        trailCtx.lineTo(-2, 0);
        trailCtx.lineTo(-5, -4);
        trailCtx.closePath();
        trailCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        trailCtx.globalAlpha = 1.0;
        trailCtx.fill();

        trailCtx.restore();
      }
    }

    // 2. 星屑パーティクルの描画（細かくキラキラと瞬くボケ光球）
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const p = sparkles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94; // ふんわり減速
      p.vy *= 0.94;
      p.alpha -= p.decay;
      p.twinkle += p.twinkleSpeed;

      if (p.alpha <= 0) {
        sparkles.splice(i, 1);
        continue;
      }

      // キラキラ瞬くアルファ値
      const twinkleAlpha = Math.max(0, p.alpha * (0.65 + 0.35 * Math.sin(p.twinkle)));
      const sprite = glowSprites[p.type] || glowSprites.white;
      trailCtx.globalAlpha = twinkleAlpha;
      const s = p.size;
      trailCtx.drawImage(sprite, p.x - s, p.y - s, s * 2, s * 2);
    }
    trailCtx.globalAlpha = 1.0;

    // 3. 到達時のインパクト（シャープな十字閃光 ＋ 繊細な波紋）の描画
    for (let i = impactRings.length - 1; i >= 0; i--) {
      const ring = impactRings[i];
      ring.radius += 2.4;
      ring.alpha -= ring.decay;

      if (ring.alpha <= 0) {
        impactRings.splice(i, 1);
        continue;
      }

      // 十字スターフレア
      const sLen = ring.sparkleLen * ring.alpha;
      trailCtx.save();
      trailCtx.translate(ring.x, ring.y);
      trailCtx.strokeStyle = `rgba(255, 255, 255, ${ring.alpha})`;
      trailCtx.lineWidth = 1.8;
      trailCtx.beginPath();
      trailCtx.moveTo(-sLen, 0);
      trailCtx.lineTo(sLen, 0);
      trailCtx.moveTo(0, -sLen);
      trailCtx.lineTo(0, sLen);
      // 斜め十字
      const diagLen = sLen * 0.55;
      trailCtx.moveTo(-diagLen, -diagLen);
      trailCtx.lineTo(diagLen, diagLen);
      trailCtx.moveTo(diagLen, -diagLen);
      trailCtx.lineTo(-diagLen, diagLen);
      trailCtx.stroke();

      // 繊細な光の波紋リング
      trailCtx.beginPath();
      trailCtx.arc(0, 0, ring.radius, 0, Math.PI * 2);
      trailCtx.strokeStyle = `rgba(130, 230, 255, ${ring.alpha * 0.6})`;
      trailCtx.lineWidth = 1.4;
      trailCtx.stroke();

      trailCtx.restore();
    }

    trailCtx.restore();

    if (activeTrails.length > 0 || sparkles.length > 0 || impactRings.length > 0) {
      requestAnimationFrame(renderTrails);
    } else {
      isRenderLoopRunning = false;
      trailCtx.clearRect(0, 0, w, h);
    }
  }

  /* ======================
     Move a single fragment to its heart position (画面外から流星突入 & 完全座標同期)
     ====================== */
  function moveFragmentToHeart(index) {
    if (index < 0 || index >= TOTAL_FRAGMENTS || fragmentsMoved[index]) return;
    fragmentsMoved[index] = true;

    const el = fragments[index];
    const id = FRAGMENT_IDS[index];
    const target = getFragmentTarget(id);

    if (ambientTimelines[index]) {
      ambientTimelines[index].kill();
      ambientTimelines[index] = null;
    }
    gsap.killTweensOf(el);

    // 飛行中スタイル
    el.classList.add('is-flying');

    // 画面外部の待機座標を取得
    const startX = el._posX !== undefined ? el._posX : (window.innerWidth * 0.5);
    const startY = el._posY !== undefined ? el._posY : (-150);

    const containerY = gsap.getProperty(fragmentsContainer, 'y') || 0;

    // 彗星の尾（トレイル）を開始（画面絶対座標に同期）
    const trail = startMeteorTrail(id, startX, startY + containerY);

    // 流星の超高速移動（0.40秒〜0.52秒）
    const dur = 0.40 + Math.random() * 0.12;

    const startRot = el._rot !== undefined ? el._rot : (target.rotation + 180);

    const motionObj = {
      x: startX,
      y: startY,
      rot: startRot,
      opacity: 0.1,
      scale: 0.6
    };

    // GSAP で motionObj をアニメーションさせ、同一フレーム・同一イージングで
    // 破片のDOMとトレイル/パーティクルを100%完全一致させる！
    gsap.to(motionObj, {
      x: target.x,
      y: target.y,
      rot: target.rotation,
      opacity: 0.95,
      scale: 1.0,
      duration: dur,
      ease: 'power3.out',
      onUpdate: function () {
        const cY = gsap.getProperty(fragmentsContainer, 'y') || 0;

        el.style.left = motionObj.x + 'px';
        el.style.top = motionObj.y + 'px';
        el.style.width = target.width + 'px';
        el.style.height = target.height + 'px';
        el.style.transform = `translate(-50%, -50%) rotate(${motionObj.rot}deg) scale(${motionObj.scale})`;
        el.style.opacity = motionObj.opacity;

        el._posX = motionObj.x;
        el._posY = motionObj.y;
        el._rot = motionObj.rot;

        // ★破片の中心に完璧に一致したキャンバス座標
        addMeteorPoint(trail, motionObj.x, motionObj.y + cY);
      },
      onComplete: function () {
        const cY = gsap.getProperty(fragmentsContainer, 'y') || 0;
        el.classList.remove('is-flying');
        el.style.left = target.x + 'px';
        el.style.top = target.y + 'px';
        el.style.width = target.width + 'px';
        el.style.height = target.height + 'px';
        el.style.transform = `translate(-50%, -50%) rotate(${target.rotation}deg) scale(1)`;
        el.style.opacity = 0.95;
        el._posX = target.x;
        el._posY = target.y;
        el._rot = target.rotation;

        finishMeteorTrail(trail);

        // 到着時の細やかなキラキラ星屑インパクト！
        createMeteorImpact(target.x, target.y + cY);

        // 到着時のクリスタル発光
        el.style.filter = 'drop-shadow(0 0 16px rgba(200, 240, 255, 0.9)) drop-shadow(0 0 6px rgba(255, 255, 255, 1))';
        setTimeout(() => {
          el.style.filter = 'drop-shadow(0 0 14px rgba(200, 220, 255, 0.6))';
        }, 400);
      }
    });
  }

  /* ======================
     Calculate Schedule
     ====================== */
  function calculateSchedule() {
    scheduleTimings = [];
    const totalSec = FOCUS_MINUTES * 60;
    const padStart = Math.min(30, totalSec * 0.02);
    const padEnd = Math.min(30, totalSec * 0.02);
    const usableDuration = totalSec - padStart - padEnd;
    const interval = usableDuration / (TOTAL_FRAGMENTS - 1);

    for (let i = 0; i < TOTAL_FRAGMENTS; i++) {
      const elapsedSec = Math.round(padStart + interval * i);
      scheduleTimings.push(elapsedSec);
    }

    fragmentMoveOrder = shuffleArray([...Array(TOTAL_FRAGMENTS).keys()]);
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ======================
     Timer Logic & Adaptive Vertical Slide Digit Animation
     通常速度では優雅に下にスライドし、倍速テスト時でも数字が一切消えず鮮明に描画
     ====================== */
  function updateSlotDigits(slotEl, newText, forceImmediate = false) {
    if (!slotEl) return;

    const now = performance.now();
    const delta = slotEl._lastUpdate ? (now - slotEl._lastUpdate) : 1000;
    slotEl._lastUpdate = now;

    const currentItems = Array.from(slotEl.querySelectorAll('.timer-digit-item'));
    const currentActive = currentItems.length > 0 ? currentItems[currentItems.length - 1] : null;

    if (!forceImmediate && currentActive && currentActive.textContent === newText) {
      return;
    }

    if (forceImmediate || currentItems.length === 0) {
      currentItems.forEach(el => {
        gsap.killTweensOf(el);
        el.remove();
      });
      const item = document.createElement('span');
      item.className = 'timer-digit-item';
      item.textContent = newText;
      gsap.set(item, { y: '0%', opacity: 1 });
      slotEl.appendChild(item);
      return;
    }

    // 更新間隔に応じたアニメーション時間の適応調整
    // 30倍速テスト中（delta < 200ms）は0.02秒または即座に切り替え、数字が消えるのを完全に防止！
    // 通常時（1秒に1回）は0.34秒でゆったりと心地よく下へスライド！
    const isUltraFast = delta < 250;

    // 2つ以上前の古い要素を直ちに破棄してDOM肥大化を完全防止
    if (currentItems.length > 1) {
      for (let i = 0; i < currentItems.length - 1; i++) {
        gsap.killTweensOf(currentItems[i]);
        currentItems[i].remove();
      }
    }

    const oldItem = currentItems[currentItems.length - 1];
    gsap.killTweensOf(oldItem);

    if (isUltraFast) {
      oldItem.remove();
      const item = document.createElement('span');
      item.className = 'timer-digit-item';
      item.textContent = newText;
      gsap.set(item, { y: '0%', opacity: 1 });
      slotEl.appendChild(item);
      return;
    }

    // 通常速度時の下スライドアニメーション
    // 旧数字: 中央 (0%) -> 下 (+100%) へスライドアウト
    // 新数字: 上 (-100%) -> 中央 (0%) へスライドイン
    gsap.to(oldItem, {
      y: '100%',
      opacity: 0,
      duration: 0.34,
      ease: 'power2.inOut',
      onComplete: () => {
        if (oldItem.parentNode) oldItem.parentNode.removeChild(oldItem);
      }
    });

    const newItem = document.createElement('span');
    newItem.className = 'timer-digit-item';
    newItem.textContent = newText;
    slotEl.appendChild(newItem);

    gsap.fromTo(newItem,
      { y: '-100%', opacity: 0 },
      { y: '0%', opacity: 1, duration: 0.34, ease: 'power2.inOut' }
    );
  }

  function updateTimerDisplay(forceImmediate = false) {
    const min = Math.floor(remainingSeconds / 60);
    const sec = remainingSeconds % 60;
    const minStr = String(min).padStart(2, '0');
    const secStr = String(sec).padStart(2, '0');

    if (minutesSlot) {
      updateSlotDigits(minutesSlot, minStr, forceImmediate);
    }
    if (secondsSlot) {
      updateSlotDigits(secondsSlot, secStr, forceImmediate);
    }

    if (timerMinutes) timerMinutes.textContent = minStr;
    if (timerSeconds) timerSeconds.textContent = secStr;
  }

  function tick() {
    if (remainingSeconds <= 0) {
      onPhaseEnd();
      return;
    }

    remainingSeconds--;
    updateTimerDisplay();

    if (phase === 'focus') {
      const elapsed = totalSeconds - remainingSeconds;
      for (let i = 0; i < TOTAL_FRAGMENTS; i++) {
        if (!fragmentsMoved[fragmentMoveOrder[i]] && elapsed >= scheduleTimings[i]) {
          moveFragmentToHeart(fragmentMoveOrder[i]);
        }
      }
    }
  }

  function onPhaseEnd() {
    stopTimer();

    if (phase === 'focus') {
      // 集中（25分）終了時: 全破片がハートの定位置に揃い、休憩中は揃った状態で優しく揺れる
      placeFragmentsAtHeart();
      phase = 'break';
      totalSeconds = BREAK_MINUTES * 60;
      remainingSeconds = totalSeconds;
      phaseText.textContent = '休憩';
      updateTimerDisplay(true);
      animatePhaseTransition();
      playBreakStartSound(); // ★集中終了・休憩開始の祝福チャイム！
      startTimer();
    } else {
      // 休憩終了時: 次の集中へ。合図ベルが鳴り、ハートが「溜め → パリンッ！シュンッ！」と爆発散乱
      phase = 'focus';
      totalSeconds = FOCUS_MINUTES * 60;
      remainingSeconds = totalSeconds;
      phaseText.textContent = '集中';
      updateTimerDisplay(true);

      playFocusStartSound(); // ★休憩終了・集中再開のベル！
      scatterFragments(true); // 溜め(0.36s) + 爆発(0.34s) + サウンド
      animatePhaseTransition();

      setTimeout(() => {
        calculateSchedule();
        startTimer();
      }, 760); // 溜め＋爆発完了（約0.75s）に合わせて即スタート
    }
  }

  function animatePhaseTransition() {
    gsap.fromTo(phaseText, { opacity: 0 }, { opacity: 0.3, duration: 1.2, ease: 'power2.out' });
  }

  /* ======================
     Heart Bobbing Animation (ハートの常時上下ゆらゆら揺れ)
     破片が1個の状態でも、集まっている途中でも、完成した状態でも常に優しく呼吸するように揺れる
     ====================== */
  let heartBobTween = null;
  function initHeartBobbing() {
    if (heartBobTween) heartBobTween.kill();
    heartBobTween = gsap.to(fragmentsContainer, {
      y: 10,
      duration: 3.6,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    });
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    isRunning = true;
    updatePauseIcon();
    timerInterval = setInterval(tick, 1000 / timerSpeed);
    if (timerSeparator) timerSeparator.style.animation = 'pulse-separator 2s ease-in-out infinite';
  }

  function stopTimer() {
    isRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    updatePauseIcon();
    if (timerSeparator) timerSeparator.style.animation = 'none';
  }

  function togglePause() {
    if (isEditorMode) toggleEditorMode(); // エディタモード中なら終了
    if (isRunning) {
      stopTimer();
    } else {
      if (isFirstStart) {
        isFirstStart = false;
        scatterFragments(true); // 溜め(0.36s) + 爆発(0.34s) + サウンド
        calculateSchedule();
        setTimeout(() => {
          startTimer();
        }, 760); // 溜め＋爆発完了に合わせてスタート
      } else {
        startTimer();
      }
    }
  }

  function updatePauseIcon() {
    if (isRunning) {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
    }
  }

  /* ======================
     Editor Mode Controls
     ====================== */
  function toggleEditorMode() {
    isEditorMode = !isEditorMode;

    if (isEditorMode) {
      stopTimer();
      stopAmbientFloat();
      if (heartBobTween) heartBobTween.pause();
      gsap.to(fragmentsContainer, { y: 0, duration: 0.25 });
      document.body.classList.add('editor-mode');
      editorToolbar.style.display = 'flex';
      placeFragmentsAtHeart();
      updateStatus('調整モードON: 破片をドラッグして移動、または矢印キーで微調整');
    } else {
      if (heartBobTween) heartBobTween.resume();
      document.body.classList.remove('editor-mode');
      editorToolbar.style.display = 'none';
      selectFragment(null);
      saveConfigToStorage();
    }
  }

  function updateStatus(msg) {
    if (editorStatus) editorStatus.textContent = msg;
  }

  // Editor toolbar button listeners
  edMoveUp.addEventListener('click', () => {
    heartConfig.centerY = Math.round((heartConfig.centerY - 1) * 10) / 10;
    saveConfigToStorage();
    placeFragmentsAtHeart();
    updateStatus(`全体位置: Y = ${heartConfig.centerY}vh`);
  });

  edMoveDown.addEventListener('click', () => {
    heartConfig.centerY = Math.round((heartConfig.centerY + 1) * 10) / 10;
    saveConfigToStorage();
    placeFragmentsAtHeart();
    updateStatus(`全体位置: Y = ${heartConfig.centerY}vh`);
  });

  edMoveLeft.addEventListener('click', () => {
    heartConfig.centerX = Math.round((heartConfig.centerX - 0.5) * 10) / 10;
    saveConfigToStorage();
    placeFragmentsAtHeart();
    updateStatus(`全体位置: X = ${heartConfig.centerX}vw`);
  });

  edMoveRight.addEventListener('click', () => {
    heartConfig.centerX = Math.round((heartConfig.centerX + 0.5) * 10) / 10;
    saveConfigToStorage();
    placeFragmentsAtHeart();
    updateStatus(`全体位置: X = ${heartConfig.centerX}vw`);
  });

  edScaleUp.addEventListener('click', () => {
    heartConfig.scale = Math.round((heartConfig.scale + 0.03) * 100) / 100;
    saveConfigToStorage();
    placeFragmentsAtHeart();
    updateStatus(`全体スケール: ${heartConfig.scale}`);
  });

  edScaleDown.addEventListener('click', () => {
    heartConfig.scale = Math.max(0.2, Math.round((heartConfig.scale - 0.03) * 100) / 100);
    saveConfigToStorage();
    placeFragmentsAtHeart();
    updateStatus(`全体スケール: ${heartConfig.scale}`);
  });

  edReset.addEventListener('click', () => {
    if (confirm('破片の配置を初期設定に戻しますか？')) {
      localStorage.removeItem('pomodoro_custom_heart_fragments');
      localStorage.removeItem('pomodoro_custom_heart_config');
      activeHeartFragments = JSON.parse(JSON.stringify(DEFAULT_HEART_FRAGMENTS));
      heartConfig = Object.assign({}, DEFAULT_HEART_CONFIG);
      placeFragmentsAtHeart();
      updateStatus('初期配置にリセットしました');
    }
  });

  edCopyCode.addEventListener('click', () => {
    const code = `// 最新の破片配置設定\nconst DEFAULT_HEART_FRAGMENTS = ${JSON.stringify(activeHeartFragments, null, 2)};\n\nconst DEFAULT_HEART_CONFIG = ${JSON.stringify(heartConfig, null, 2)};`;
    navigator.clipboard.writeText(code).then(() => {
      updateStatus('✅ 設定コードをクリップボードにコピーしました！');
      setTimeout(() => {
        updateStatus('各破片をドラッグまたは矢印キーで微調整できます');
      }, 3000);
    }).catch(() => {
      console.log(code);
      updateStatus('コンソールに設定コードを出力しました');
    });
  });

  edClose.addEventListener('click', toggleEditorMode);
  if (btnEditor) {
    btnEditor.addEventListener('click', toggleEditorMode);
  }
  if (btnOpenEditor) {
    btnOpenEditor.addEventListener('click', () => {
      closeSettings();
      setTimeout(() => {
        if (!isEditorMode) toggleEditorMode();
      }, 200);
    });
  }

  /* ======================
     Settings Modal
     ====================== */
  function openSettings() {
    if (isRunning) stopTimer();
    inputFocus.value = FOCUS_MINUTES;
    inputBreak.value = BREAK_MINUTES;
    if (selectSpeed) {
      selectSpeed.value = String(timerSpeed);
    }
    settingsModal.style.display = 'flex';
    gsap.fromTo(settingsModal, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
  }

  function closeSettings() {
    gsap.to(settingsModal, {
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        settingsModal.style.display = 'none';
      }
    });
  }

  function saveSettings() {
    const newFocus = parseInt(inputFocus.value, 10);
    const newBreak = parseInt(inputBreak.value, 10);
    const newSpeed = selectSpeed ? (parseInt(selectSpeed.value, 10) || 1) : 1;

    if (newFocus >= 1 && newFocus <= 90) FOCUS_MINUTES = newFocus;
    if (newBreak >= 1 && newBreak <= 30) BREAK_MINUTES = newBreak;
    timerSpeed = newSpeed;

    phase = 'focus';
    totalSeconds = FOCUS_MINUTES * 60;
    remainingSeconds = totalSeconds;
    phaseText.textContent = '集中';
    updateTimerDisplay(true);

    placeFragmentsAtHeart();
    isFirstStart = true;
    calculateSchedule();

    closeSettings();
  }

  /* ======================
     Event Listeners
     ====================== */
  btnPause.addEventListener('click', () => {
    getAudioContext(); // ユーザー操作でAudioContextをアンロック
    togglePause();
  });
  if (btnSpeed) {
    btnSpeed.addEventListener('click', () => {
      timerSpeed = timerSpeed === 30 ? 1 : 30;
      btnSpeed.textContent = timerSpeed + 'x';
      if (isRunning) {
        clearInterval(timerInterval);
        timerInterval = setInterval(tick, 1000 / timerSpeed);
      }
    });
  }
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      isSoundEnabled = !isSoundEnabled;
      if (isSoundEnabled) {
        iconSoundOn.style.display = 'block';
        iconSoundOff.style.display = 'none';
        getAudioContext();
        playFocusStartSound();
      } else {
        iconSoundOn.style.display = 'none';
        iconSoundOff.style.display = 'block';
      }
    });
  }
  btnSettings.addEventListener('click', openSettings);
  btnSave.addEventListener('click', saveSettings);
  btnCancel.addEventListener('click', closeSettings);

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  // Keyboard navigation & editor support
  document.addEventListener('keydown', (e) => {
    if (settingsModal.style.display !== 'none') {
      if (e.key === 'Escape') closeSettings();
      return;
    }

    // Toggle editor mode with 'd' or 'D'
    if (e.key === 'd' || e.key === 'D') {
      // If typing in an input, do not intercept
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        toggleEditorMode();
        return;
      }
    }

    // Editor mode shortcuts
    if (isEditorMode) {
      if (e.key === 'Escape') {
        toggleEditorMode();
        return;
      }

      if (selectedFragmentId !== null) {
        const frag = activeHeartFragments[selectedFragmentId];
        const step = e.shiftKey ? 5 : 1;
        let moved = false;

        if (e.key === 'ArrowUp') {
          frag.dy -= step;
          moved = true;
        } else if (e.key === 'ArrowDown') {
          frag.dy += step;
          moved = true;
        } else if (e.key === 'ArrowLeft') {
          frag.dx -= step;
          moved = true;
        } else if (e.key === 'ArrowRight') {
          frag.dx += step;
          moved = true;
        } else if (e.key === '[' || e.key === '{') {
          frag.w = Math.max(10, frag.w - 2);
          frag.h = Math.max(10, frag.h - 2);
          moved = true;
        } else if (e.key === ']' || e.key === '}') {
          frag.w += 2;
          frag.h += 2;
          moved = true;
        } else if (e.key === 'r' || e.key === 'R') {
          frag.rot = (frag.rot || 0) + (e.shiftKey ? -5 : 5);
          moved = true;
        }

        if (moved) {
          e.preventDefault();
          updateSingleFragmentPosition(selectedFragmentId);
          saveConfigToStorage();
          updateStatus(`[破片 #${selectedFragmentId}] dx: ${frag.dx}, dy: ${frag.dy}, w: ${Math.round(frag.w)}, rot: ${frag.rot}°`);
        }
      }
      return;
    }

    // Spacebar to pause / play
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      togglePause();
    }
  });

  // Deselect when clicking empty space in editor mode
  document.addEventListener('click', (e) => {
    if (!isEditorMode) return;
    if (!e.target.closest('.fragment') && !e.target.closest('#editor-toolbar') && !e.target.closest('#btn-editor')) {
      selectFragment(null);
      updateStatus('破片をクリックして選択、ドラッグまたは矢印キーで移動');
    }
  });

  // Window resize handler: recalculate target coordinates seamlessly
  window.addEventListener('resize', () => {
    resizeTrailCanvas();
    if (fragmentsMoved.some(m => m)) {
      placeFragmentsAtHeart();
    }
  });

  /* ======================
     Initialization
     ====================== */
  function init() {
    initGlowSprites();
    resizeTrailCanvas();
    createFragments();
    // デバッグ用: 初期状態はハート完成状態で表示
    placeFragmentsAtHeart();
    initHeartBobbing(); // ★常時上下ゆらゆら揺れを開始！
    calculateSchedule();
    updateTimerDisplay(true);
    updatePauseIcon();

    gsap.fromTo('#timer-split-container', { opacity: 0 }, { opacity: 1, duration: 1.5, ease: 'power2.out', delay: 0.3 });
    gsap.fromTo('#controls', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out', delay: 0.6 });
    gsap.fromTo('#phase-indicator', { opacity: 0 }, { opacity: 1, duration: 1.5, ease: 'power2.out', delay: 0.8 });
  }

  init();
})();
