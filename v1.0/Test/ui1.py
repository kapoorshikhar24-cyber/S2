import webview
import threading
import time as t

HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Timer</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #08080C;
    --surface:   #111118;
    --ring-bg:   #1A1A24;
    --accent:    #E8B84B;
    --accent-lo: rgba(232,184,75,0.12);
    --accent-md: rgba(232,184,75,0.35);
    --warn:      #FF5E5E;
    --done:      #4DFFB4;
    --text-hi:   #F0EDE4;
    --text-md:   #6B6878;
    --text-lo:   #2C2B38;
    --ring-r:    130;
    --ring-c:    160;
  }

  html, body {
    height: 100%;
    background: var(--bg);
    color: var(--text-hi);
    font-family: 'Syne', sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: default;
    user-select: none;
  }

  body::before {
    content: '';
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E");
    background-size: 200px;
    pointer-events: none;
    z-index: 0;
    opacity: 0.6;
  }

  body::after {
    content: '';
    position: fixed;
    width: 500px; height: 500px;
    background: radial-gradient(ellipse, rgba(232,184,75,0.06) 0%, transparent 70%);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 0;
  }

  .card {
    position: relative; z-index: 1;
    background: var(--surface);
    border: 0.5px solid rgba(255,255,255,0.07);
    border-radius: 28px;
    padding: 40px 36px 34px;
    width: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    box-shadow:
      0 0 0 0.5px rgba(232,184,75,0.08),
      0 40px 80px rgba(0,0,0,0.7),
      inset 0 1px 0 rgba(255,255,255,0.05);
    animation: rise 0.6s cubic-bezier(0.22,1,0.36,1) both;
  }

  @keyframes rise {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }

  .header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }

  .label-tag {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-md);
  }

  .status-pill {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 20px;
    border: 0.5px solid var(--accent-md);
    color: var(--accent);
    background: var(--accent-lo);
    transition: all 0.3s ease;
  }

  .ring-wrap {
    position: relative;
    width: 320px; height: 320px;
    margin-bottom: 28px;
  }

  .ring-svg {
    width: 100%; height: 100%;
    transform: rotate(-90deg);
    overflow: visible;
  }

  .tick-marks { opacity: 0.25; }

  .ring-track {
    fill: none;
    stroke: var(--ring-bg);
    stroke-width: 8;
  }

  .ring-progress {
    fill: none;
    stroke: var(--accent);
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 1s linear, stroke 0.5s ease;
    filter: drop-shadow(0 0 6px rgba(232,184,75,0.5));
  }

  .arc-dot {
    fill: var(--accent);
    filter: drop-shadow(0 0 8px var(--accent));
    transition: fill 0.5s ease;
  }

  .center-text {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    pointer-events: none;
  }

  .time-display {
    font-family: 'DM Mono', monospace;
    font-size: 58px;
    font-weight: 500;
    letter-spacing: -2px;
    color: var(--text-hi);
    line-height: 1;
    transition: color 0.5s ease;
  }

  .time-sub {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.25em;
    color: var(--text-md);
    text-transform: uppercase;
  }

  .paused-badge {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
    opacity: 0;
    transform: translateY(4px);
    transition: all 0.25s ease;
    margin-top: 6px;
  }

  .paused-badge.visible {
    opacity: 1;
    transform: translateY(0);
  }

  @keyframes breathe {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  .ring-progress.paused { animation: breathe 2s ease-in-out infinite; }

  .bar-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .bar-bg {
    flex: 1;
    height: 2px;
    background: var(--ring-bg);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    width: 100%;
    transform-origin: left;
    transition: transform 1s linear, background 0.5s ease;
    box-shadow: 0 0 6px rgba(232,184,75,0.4);
  }

  .bar-pct {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-md);
    min-width: 34px;
    text-align: right;
  }

  .controls {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .btn {
    cursor: pointer;
    border: none;
    outline: none;
    font-family: 'Syne', sans-serif;
    font-weight: 600;
    transition: all 0.18s ease;
    display: flex; align-items: center; justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .btn::after {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle at center, rgba(255,255,255,0.15), transparent 70%);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .btn:active::after { opacity: 1; }
  .btn:active { transform: scale(0.94); }

  .btn-ghost {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: transparent;
    border: 0.5px solid var(--text-lo);
    color: var(--text-md);
    font-size: 12px;
    letter-spacing: 0.05em;
  }

  .btn-ghost:hover {
    border-color: var(--accent-md);
    color: var(--accent);
    background: var(--accent-lo);
  }

  .btn-primary {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: var(--accent);
    color: #08080C;
    font-size: 22px;
    box-shadow: 0 0 0 0 rgba(232,184,75,0.4);
    transition: all 0.2s ease, box-shadow 0.4s ease;
  }

  .btn-primary:hover {
    background: #F5CC6A;
    box-shadow: 0 0 0 8px rgba(232,184,75,0.15);
  }

  .btn-sm {
    font-size: 11px;
    letter-spacing: 0.06em;
  }

  .set-row {
    width: 100%;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .set-input {
    flex: 1;
    height: 40px;
    background: var(--bg);
    border: 0.5px solid var(--text-lo);
    border-radius: 10px;
    color: var(--text-hi);
    font-family: 'DM Mono', monospace;
    font-size: 14px;
    text-align: center;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
    appearance: none;
  }

  .set-input:focus {
    border-color: var(--accent-md);
    background: var(--accent-lo);
  }

  .set-input::placeholder { color: var(--text-md); }
  .set-input::-webkit-inner-spin-button,
  .set-input::-webkit-outer-spin-button { -webkit-appearance: none; }

  .btn-set {
    height: 40px;
    padding: 0 18px;
    border-radius: 10px;
    background: var(--accent-lo);
    border: 0.5px solid var(--accent-md);
    color: var(--accent);
    font-family: 'Syne', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .btn-set:hover { background: var(--accent-md); color: var(--bg); }
  .btn-set:active { transform: scale(0.96); }

  .done-overlay {
    position: absolute; inset: 0;
    border-radius: 28px;
    background: radial-gradient(ellipse at center, rgba(77,255,180,0.06) 0%, transparent 70%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.8s ease;
  }

  .done-overlay.show { opacity: 1; }

  .warn .ring-progress { stroke: var(--warn); filter: drop-shadow(0 0 6px rgba(255,94,94,0.5)); }
  .warn .arc-dot       { fill: var(--warn); filter: drop-shadow(0 0 8px var(--warn)); }
  .warn .bar-fill      { background: var(--warn); box-shadow: 0 0 6px rgba(255,94,94,0.4); }
  .warn .time-display  { color: var(--warn); }
  .warn .status-pill   { color: var(--warn); border-color: rgba(255,94,94,0.4); background: rgba(255,94,94,0.08); }

  .done-state .ring-progress { stroke: var(--done); filter: drop-shadow(0 0 6px rgba(77,255,180,0.6)); }
  .done-state .arc-dot       { fill: var(--done); filter: drop-shadow(0 0 10px var(--done)); }
  .done-state .bar-fill      { background: var(--done); box-shadow: 0 0 8px rgba(77,255,180,0.5); }
  .done-state .time-display  { color: var(--done); }
  .done-state .status-pill   { color: var(--done); border-color: rgba(77,255,180,0.4); background: rgba(77,255,180,0.08); }

  @keyframes pulse-done {
    0%, 100% { box-shadow: 0 0 0 0   rgba(77,255,180,0.4); }
    50%       { box-shadow: 0 0 0 14px rgba(77,255,180,0); }
  }
  .done-state .btn-primary { animation: pulse-done 1.5s ease-out infinite; background: var(--done); }
</style>
</head>
<body>

<div class="card" id="card">
  <div class="done-overlay" id="doneOverlay"></div>

  <div class="header">
    <span class="label-tag">Focus Timer</span>
    <span class="status-pill" id="statusPill">Running</span>
  </div>

  <div class="ring-wrap">
    <svg class="ring-svg" id="ringSvg" viewBox="0 0 320 320">
      <g class="tick-marks" id="ticks"></g>
      <circle class="ring-track" cx="160" cy="160" r="130"/>
      <circle class="ring-progress" id="ringProgress" cx="160" cy="160" r="130"/>
      <circle class="arc-dot" id="arcDot" cx="160" cy="30" r="6"/>
    </svg>

    <div class="center-text">
      <div class="time-display" id="timeDisplay">00:00</div>
      <div class="time-sub">mm · ss</div>
      <div class="paused-badge" id="pausedBadge">⏸ paused</div>
    </div>
  </div>

  <div class="bar-row">
    <div class="bar-bg">
      <div class="bar-fill" id="barFill"></div>
    </div>
    <div class="bar-pct" id="barPct">100%</div>
  </div>

  <div class="controls">
    <button class="btn btn-ghost btn-sm" id="btnAdd" title="Add 30 seconds">+30s</button>
    <button class="btn btn-primary" id="btnPause" title="Pause / Resume">⏸</button>
    <button class="btn btn-ghost btn-sm" id="btnReset" title="Reset">↺</button>
  </div>

  <div class="set-row">
    <input class="set-input" type="number" id="setInput" placeholder="seconds…" min="1" max="86400">
    <button class="btn-set" id="btnSet">Set</button>
  </div>
</div>

<script>
  const CIRC = 2 * Math.PI * 130;
  let totalTime  = __SECONDS__;
  let remaining  = __SECONDS__;
  let paused     = false;
  let done       = false;
  let interval   = null;

  const card       = document.getElementById('card');
  const ringProg   = document.getElementById('ringProgress');
  const arcDot     = document.getElementById('arcDot');
  const timeLbl    = document.getElementById('timeDisplay');
  const barFill    = document.getElementById('barFill');
  const barPct     = document.getElementById('barPct');
  const statusPill = document.getElementById('statusPill');
  const pauseBtn   = document.getElementById('btnPause');
  const pausedBadge= document.getElementById('pausedBadge');
  const doneOverlay= document.getElementById('doneOverlay');

  ringProg.style.strokeDasharray  = CIRC;
  ringProg.style.strokeDashoffset = 0;

  (function drawTicks() {
    const g = document.getElementById('ticks');
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
      const major = i % 5 === 0;
      const rOut = 148, rIn = rOut - (major ? 10 : 5);
      const x1 = 160 + rOut * Math.cos(angle), y1 = 160 + rOut * Math.sin(angle);
      const x2 = 160 + rIn  * Math.cos(angle), y2 = 160 + rIn  * Math.sin(angle);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', major ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)');
      line.setAttribute('stroke-width', major ? 1.5 : 0.8);
      line.setAttribute('stroke-linecap', 'round');
      g.appendChild(line);
    }
  })();

  function fmt(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function updateDot(frac) {
    const angle = frac * 2 * Math.PI - Math.PI / 2;
    arcDot.setAttribute('cx', 160 + 130 * Math.cos(angle));
    arcDot.setAttribute('cy', 160 + 130 * Math.sin(angle));
  }

  function render() {
    const frac   = Math.max(0, remaining) / totalTime;
    const offset = CIRC * (1 - frac);
    const pct    = Math.round(frac * 100);

    timeLbl.textContent  = done ? 'DONE' : fmt(remaining);
    ringProg.style.strokeDashoffset = offset;
    barFill.style.transform = `scaleX(${frac})`;
    barPct.textContent   = `${pct}%`;

    if (!done) updateDot(frac);

    const isWarn = remaining <= 10 && !done;
    card.classList.toggle('warn',       isWarn && !done);
    card.classList.toggle('done-state', done);
    doneOverlay.classList.toggle('show', done);

    if (done) {
      statusPill.textContent = '✓ Complete';
      pauseBtn.textContent   = '✓';
    } else if (paused) {
      statusPill.textContent = 'Paused';
    } else if (isWarn) {
      statusPill.textContent = 'Almost done';
    } else {
      statusPill.textContent = 'Running';
    }
  }

  function tick() {
    if (paused || done) return;
    if (remaining <= 0) {
      done = true;
      clearInterval(interval);
      render();
      // Close window after 3s
      setTimeout(() => { try { window.pywebview.api.close_window(); } catch(e) {} }, 3000);
      return;
    }
    remaining--;
    render();
  }

  function startTimer() {
    clearInterval(interval);
    done = false;
    card.classList.remove('done-state');
    interval = setInterval(tick, 1000);
    render();
  }

  pauseBtn.addEventListener('click', () => {
    if (done) return;
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : '⏸';
    pausedBadge.classList.toggle('visible', paused);
    ringProg.classList.toggle('paused', paused);
    statusPill.textContent = paused ? 'Paused' : 'Running';
  });

  document.getElementById('btnAdd').addEventListener('click', () => {
    if (done) return;
    remaining += 30; totalTime += 30; render();
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    clearInterval(interval);
    remaining = totalTime; done = false; paused = false;
    pauseBtn.textContent = '⏸';
    pausedBadge.classList.remove('visible');
    ringProg.classList.remove('paused');
    card.classList.remove('warn', 'done-state');
    doneOverlay.classList.remove('show');
    render(); startTimer();
  });

  document.getElementById('btnSet').addEventListener('click', () => {
    const v = parseInt(document.getElementById('setInput').value, 10);
    if (!v || v < 1) return;
    clearInterval(interval);
    totalTime = v; remaining = v; done = false; paused = false;
    pauseBtn.textContent = '⏸';
    pausedBadge.classList.remove('visible');
    ringProg.classList.remove('paused');
    card.classList.remove('warn', 'done-state');
    doneOverlay.classList.remove('show');
    document.getElementById('setInput').value = '';
    render(); startTimer();
  });

  document.getElementById('setInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnSet').click();
  });

  render();
  startTimer();
</script>
</body>
</html>
"""


class Api:
    def __init__(self, win_ref):
        self._win = win_ref

    def close_window(self):
        self._win.destroy()


class T:
    @staticmethod
    def sleep(seconds: int = 83):
        html = HTML.replace("__SECONDS__", str(seconds))

        api = Api(None)

        win = webview.create_window(
            title="Focus Timer",
            html=html,
            width=400,
            height=580,
            resizable=False,
            frameless=False,
            on_top=True,
            js_api=api,
            background_color="#08080C",
        )

        # Give api access to window after creation
        api._win = win

        webview.start()


if __name__ == "__main__":
    T.sleep(83)