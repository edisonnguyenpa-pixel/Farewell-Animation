(() => {
'use strict';

/* ============================================================
   AUDIO ENGINE — everything synthesized, zero external files
   ============================================================ */
const Audio = (() => {
  let ctx = null, master = null, muted = false, ambience = null;

  function ensure(){
    if (!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({freq=440, dur=0.3, type='sine', delay=0, gain=0.18, glideTo=null, attack=0.02}){
    ensure();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function chord(freqs, opts={}){ freqs.forEach(f => tone({...opts, freq:f})); }

  function playPing(){
    chord([880, 1318.5], {dur:0.5, type:'sine', gain:0.14});
  }
  function playBootChime(){
    [523.25,659.25,783.99,1046.5].forEach((f,i)=> tone({freq:f, dur:0.5, delay:i*0.11, type:'triangle', gain:0.13}));
  }
  function playPop(){
    tone({freq:520, dur:0.16, type:'sine', gain:0.16, glideTo:760});
  }
  function playHeartChime(){
    chord([784,987.77,1174.7], {dur:0.9, type:'sine', gain:0.1, attack:0.05});
  }
  function playRingtone(){
    ensure();
    const pattern = [{f:659.25,d:0.18},{f:783.99,d:0.22}];
    for (let rep=0; rep<2; rep++){
      let t = rep*0.85;
      pattern.forEach(p => { tone({freq:p.f, dur:p.d, delay:t, type:'sine', gain:0.12, attack:0.03}); t += p.d+0.05; });
    }
  }
  function playClick(){
    tone({freq:1800, dur:0.03, type:'sine', gain:0.05});
  }
  function playConfirm(){
    tone({freq:880, dur:0.18, type:'sine', gain:0.12, attack:0.01});
    tone({freq:1174.7, dur:0.24, delay:0.12, type:'sine', gain:0.12, attack:0.01});
  }
  function playTypingTexture(durationMs=1000){
    ensure();
    const count = Math.floor(durationMs/90);
    for (let i=0;i<count;i++){
      tone({freq: 1500+Math.random()*400, dur:0.025, delay: i*0.09+Math.random()*0.03, type:'square', gain:0.022});
    }
  }
  function speak(text, opts={}){
    if (!('speechSynthesis' in window)) return;
    try{
      const u = new SpeechSynthesisUtterance(text);
      u.volume = opts.volume ?? 0.5;
      u.rate = opts.rate ?? 1.02;
      u.pitch = opts.pitch ?? 1.12;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => /female|samantha|victoria|karen|zira|moira|tessa/i.test(v.name))
        || voices.find(v => v.lang && v.lang.startsWith('en'));
      if (preferred) u.voice = preferred;
      window.speechSynthesis.speak(u);
    }catch(e){}
  }
  function playCelebration(){
    [523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=> tone({freq:f, dur:0.7, delay:i*0.09, type:'triangle', gain:0.15}));
  }
  function playTick(){
    tone({freq:1600, dur:0.03, type:'square', gain:0.03});
  }

  function noiseBuffer(seconds){
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr*seconds, sr);
    const data = buf.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i] = (Math.random()*2-1);
    return buf;
  }

  function startPad(kind){
    ensure();
    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.connect(master);

    const nodes = [];
    const freqSets = kind === 'office'
      ? [261.63, 329.63, 392.0]
      : [220.0, 277.18, 329.63, 440.0];

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'office' ? 1200 : 900;
    filter.connect(padGain);

    freqSets.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.detune.value = (i - 1) * 4;
      osc.connect(filter);
      osc.start();
      nodes.push(osc);
    });

    // gentle noise texture for "office ambience"
    let noiseSrc = null;
    if (kind === 'office'){
      noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer(2);
      noiseSrc.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 800;
      noiseFilter.Q.value = 0.6;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.02;
      noiseSrc.connect(noiseFilter).connect(noiseGain).connect(padGain);
      noiseSrc.start();
    }

    // slow LFO on filter cutoff for gentle movement
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = kind === 'office' ? 150 : 220;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    nodes.push(lfo);

    const targetGain = kind === 'office' ? 0.05 : 0.07;
    padGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 2.2);

    return {
      gainNode: padGain,
      stop(fadeSec = 1.5){
        const t = ctx.currentTime;
        padGain.gain.cancelScheduledValues(t);
        padGain.gain.setValueAtTime(padGain.gain.value, t);
        padGain.gain.linearRampToValueAtTime(0.0001, t + fadeSec);
        setTimeout(() => {
          nodes.forEach(n => { try{ n.stop(); }catch(e){} });
          if (noiseSrc) try{ noiseSrc.stop(); }catch(e){}
        }, fadeSec*1000 + 100);
      }
    };
  }

  function crossfadeAmbience(kind){
    const old = ambience;
    ambience = startPad(kind);
    if (old) old.stop(2.5);
  }

  function stopAmbience(fadeSec=2){
    if (ambience){ ambience.stop(fadeSec); ambience = null; }
  }

  function fadeOutAll(duration = 4){
    ensure();
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.0001, t + duration);
  }

  function restoreMaster(){
    ensure();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(muted ? 0 : 0.9, ctx.currentTime);
  }

  function toggleMute(){
    muted = !muted;
    ensure();
    master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    return muted;
  }

  return {
    unlock: ensure, playPing, playBootChime, playPop, playHeartChime,
    playRingtone, playClick, playConfirm, playTypingTexture, speak,
    playCelebration, playTick,
    crossfadeAmbience, stopAmbience, fadeOutAll, restoreMaster, toggleMute
  };
})();

/* ============================================================
   MUSIC — assets/music/leaving-on-a-jet-plane.mp3 if present,
   otherwise the synthesized ambience pads above carry the score.
   ============================================================ */
const Music = (() => {
  const el = document.getElementById('bg-music');
  let usingFile = false;
  let warned = false;
  el.volume = 0.55;

  function tryStart(){
    return new Promise(resolve => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        el.removeEventListener('error', onError);
        el.removeEventListener('playing', onPlaying);
        usingFile = ok;
        if (!ok && !warned){
          warned = true;
          console.warn(
            '[SIA Farewell] assets/music/leaving-on-a-jet-plane.mp3 was not found (or could not be decoded). ' +
            'Falling back to the synthesized ambient soundtrack. Drop the real MP3 into assets/music/ to use it instead — no code changes needed.'
          );
        }
        resolve(ok);
      };
      const onError = () => finish(false);
      const onPlaying = () => finish(true);
      el.addEventListener('error', onError);
      el.addEventListener('playing', onPlaying);
      el.currentTime = 0;
      const p = el.play();
      if (p && p.catch) p.catch(() => finish(false));
      setTimeout(() => finish(false), 1200);
    });
  }

  function fadeOut(duration = 5){
    if (!usingFile) return;
    const steps = 24;
    const start = el.volume;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      el.volume = Math.max(0, start * (1 - i/steps));
      if (i >= steps){ clearInterval(iv); el.pause(); }
    }, duration*1000/steps);
  }

  function reset(){
    if (!usingFile) return;
    el.currentTime = 0;
    el.volume = 0.55;
    el.play().catch(()=>{});
  }

  return { tryStart, fadeOut, reset, get usingFile(){ return usingFile; } };
})();

/* ============================================================
   PARTICLE ENGINE — confetti + sparkles on a single canvas
   ============================================================ */
const FX = (() => {
  const canvas = document.getElementById('fx-canvas');
  const ctx2d = canvas.getContext('2d');
  let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let particles = [];
  let rafId = null;
  let fallingConfetti = false;
  let ambientSparkles = false;

  const COLORS = ['#FF6F61','#FF8C69','#FFD166','#2EC4B6','#5fb0a8','#ffffff'];

  function resize(){
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w+'px'; canvas.style.height = h+'px';
    ctx2d.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', resize);
  resize();

  function ensureLoop(){
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function loop(){
    ctx2d.clearRect(0,0,w,h);

    if (fallingConfetti && Math.random() < 0.55){
      spawnConfettiPiece(Math.random()*w, -20, {vy: 1+Math.random()*1.5, vx:(Math.random()-0.5)*1.2});
    }
    if (ambientSparkles && Math.random() < 0.12){
      spawnSparkle(Math.random()*w, Math.random()*h);
    }

    particles.forEach(p => p.update());
    particles.forEach(p => p.draw(ctx2d));
    particles = particles.filter(p => !p.dead);

    if (particles.length > 0 || fallingConfetti || ambientSparkles){
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }

  function spawnConfettiPiece(x, y, vel={}){
    const size = 6 + Math.random()*6;
    particles.push({
      x, y, rot: Math.random()*Math.PI*2,
      vx: vel.vx ?? (Math.random()-0.5)*6,
      vy: vel.vy ?? (-4 - Math.random()*4),
      vr: (Math.random()-0.5)*0.3,
      size, color: COLORS[(Math.random()*COLORS.length)|0],
      life: 0, maxLife: 260 + Math.random()*120,
      dead:false,
      update(){
        this.vy += 0.06;
        this.x += this.vx; this.y += this.vy; this.rot += this.vr;
        this.life++;
        if (this.y > h + 30 || this.life > this.maxLife) this.dead = true;
      },
      draw(c){
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.rot);
        c.globalAlpha = Math.max(0, 1 - this.life/this.maxLife);
        c.fillStyle = this.color;
        c.fillRect(-this.size/2, -this.size/3, this.size, this.size*0.6);
        c.restore();
      }
    });
  }

  function burstConfetti(x, y, count=90){
    for (let i=0;i<count;i++){
      const angle = Math.random()*Math.PI*2;
      const speed = 3 + Math.random()*7;
      spawnConfettiPiece(x, y, {vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed - 3});
    }
    ensureLoop();
  }

  function spawnSparkle(x, y){
    particles.push({
      x, y, r: 1.5 + Math.random()*2.5,
      life: 0, maxLife: 70 + Math.random()*60,
      phase: Math.random()*Math.PI*2,
      dead:false,
      update(){ this.life++; if (this.life > this.maxLife) this.dead = true; },
      draw(c){
        const t = this.life/this.maxLife;
        const a = Math.sin(t*Math.PI) * (0.7+0.3*Math.sin(this.phase+this.life*0.2));
        c.save();
        c.globalAlpha = Math.max(0,a);
        c.fillStyle = '#fff';
        c.shadowColor = '#FFD166';
        c.shadowBlur = 8;
        c.beginPath();
        c.arc(this.x, this.y, this.r, 0, Math.PI*2);
        c.fill();
        c.restore();
      }
    });
  }

  function sparkleBurst(count=40, region=null){
    const rx = region ? region.x : w/2, ry = region ? region.y : h/2;
    const rw = region ? region.w : w*0.6, rh = region ? region.h : h*0.5;
    for (let i=0;i<count;i++){
      spawnSparkle(rx + (Math.random()-0.5)*rw, ry + (Math.random()-0.5)*rh);
    }
    ensureLoop();
  }

  function startFallingConfetti(){ fallingConfetti = true; ensureLoop(); }
  function stopFallingConfetti(){ fallingConfetti = false; }
  function startAmbientSparkles(){ ambientSparkles = true; ensureLoop(); }
  function stopAmbientSparkles(){ ambientSparkles = false; }

  return { burstConfetti, sparkleBurst, startFallingConfetti, stopFallingConfetti, startAmbientSparkles, stopAmbientSparkles };
})();

/* ============================================================
   SMALL DOM HELPERS
   ============================================================ */
function animateCount(el, from, to, duration, plusSuffix){
  const t0 = performance.now();
  function step(now){
    const t = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.round(from + (to - from) * eased);
    el.textContent = val.toLocaleString() + (plusSuffix && t >= 1 ? '+' : '');
    if (Math.random() < 0.15) Audio.playTick();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function spawnFloatingHeart(x, y){
  const el = document.createElement('div');
  el.className = 'floating-heart';
  el.textContent = ['💛','❤️','✨'][(Math.random()*3)|0];
  el.style.left = (x + (Math.random()-0.5)*40) + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

/* ============================================================
   SCENE MANAGER
   ============================================================ */
const scenes = Array.from(document.querySelectorAll('#stage .scene'));
const loaderEl = document.getElementById('scene-loader');
const controlsEl = document.getElementById('controls');
const startGateEl = document.getElementById('start-gate');
const dotsWrap = document.getElementById('progress-dots');

let currentIndex = -1;
let sceneTimeoutId = null;
let pendingTimers = [];

scenes.forEach((_, i) => {
  const dot = document.createElement('div');
  dot.className = 'dot';
  dot.title = 'Scene ' + (i+1);
  dot.addEventListener('click', () => jumpTo(i));
  dotsWrap.appendChild(dot);
});
const dotEls = Array.from(dotsWrap.children);

function sceneTimer(fn, delay){
  const id = setTimeout(() => {
    pendingTimers = pendingTimers.filter(t => t !== id);
    fn();
  }, delay);
  pendingTimers.push(id);
  return id;
}

function clearAllTimers(){
  pendingTimers.forEach(id => clearTimeout(id));
  pendingTimers = [];
  if (sceneTimeoutId){ clearTimeout(sceneTimeoutId); sceneTimeoutId = null; }
}

function resetSceneVisuals(index){
  const el = scenes[index];
  el.querySelectorAll('.show, .flip').forEach(n => n.classList.remove('show','flip'));
  if (index === 1){ const v = el.querySelector('#calls-value'); if (v) v.textContent = '0'; }
  if (index === 2){ const stack = el.querySelector('#msg-stack'); if (stack) stack.innerHTML = ''; }
  if (index === 3){ const body = el.querySelector('#calendar-body'); if (body) body.innerHTML = ''; }
}

const SCENE_ENTER = {
  0: enterMorning,
  1: enterCalls,
  2: enterMessages,
  3: enterCalendar,
  4: enterFadeOut,
  5: enterTeamPhoto,
  6: enterBigThanks,
  7: enterFinal,
};

function goToScene(index, {instant=false} = {}){
  if (index < 0 || index >= scenes.length) return;
  clearAllTimers();

  if (currentIndex >= 0 && currentIndex !== index){
    const prev = scenes[currentIndex];
    prev.classList.remove('active');
    prev.classList.add('leaving');
    setTimeout(() => prev.classList.remove('leaving'), 1400);
    if (currentIndex === 5) FX.stopAmbientSparkles();
    if (currentIndex === 7) FX.stopFallingConfetti();
  }

  currentIndex = index;
  resetSceneVisuals(index);
  const el = scenes[index];
  el.classList.add('active');

  if (!controlsEl.classList.contains('show')) controlsEl.classList.add('show');
  dotEls.forEach((d,i) => d.classList.toggle('active', i === index));

  const enterFn = SCENE_ENTER[index];
  if (enterFn) enterFn(el);

  const duration = parseInt(el.dataset.duration, 10) || 0;
  if (duration > 0){
    sceneTimeoutId = setTimeout(() => goToScene(index+1), duration);
  }
}

function jumpTo(index){
  goToScene(index);
}

function skipScene(){
  if (currentIndex >= scenes.length - 1) return;
  goToScene(currentIndex + 1);
}

/* ---------------- scene behaviors ---------------- */

function scheduleBlink(){
  const blinkEl = document.getElementById('char-blink');
  if (!blinkEl) return;
  sceneTimer(() => {
    blinkEl.classList.add('do-blink');
    sceneTimer(() => blinkEl.classList.remove('do-blink'), 340);
    scheduleBlink();
  }, 2600 + Math.random()*3400);
}

function enterMorning(el){
  if (!Music.usingFile) Audio.crossfadeAmbience('office');
  sceneTimer(() => Audio.playBootChime(), 1550);
  scheduleBlink();

  const callCard = el.querySelector('#call-card');

  sceneTimer(() => { Audio.playRingtone(); callCard.classList.add('show'); }, 3400);
  sceneTimer(() => {
    Audio.playClick();
    Audio.speak('Good morning! Thank you for calling SIA Medical.', {volume:.5});
    Audio.playTypingTexture(900);
    callCard.classList.remove('show');
  }, 4400);
  sceneTimer(() => Audio.playConfirm(), 5500);

  sceneTimer(() => { Audio.playRingtone(); callCard.classList.add('show'); }, 6400);
  sceneTimer(() => {
    Audio.playClick();
    Audio.speak('Have a lovely day!', {volume:.5});
    Audio.playTypingTexture(700);
    callCard.classList.remove('show');
  }, 7400);
  sceneTimer(() => Audio.playConfirm(), 8400);
}

function enterCalls(el){
  const bubbles = Array.from(el.querySelectorAll('.speech-bubble'));
  bubbles.forEach(b => {
    const t = parseInt(b.dataset.t, 10);
    sceneTimer(() => { b.classList.add('show'); Audio.playPop(); }, t);
  });

  const counterEl = el.querySelector('#calls-value');
  const steps = [
    {value:25, at:1200, dur:900},
    {value:78, at:3500, dur:900},
    {value:143, at:5800, dur:900},
    {value:312, at:8100, dur:1000},
    {value:1000, at:10500, dur:1200, plus:true, celebrate:true},
  ];
  let prevVal = 0;
  steps.forEach(s => {
    sceneTimer(() => {
      animateCount(counterEl, prevVal, s.value, s.dur, s.plus);
      prevVal = s.value;
      if (s.celebrate){
        sceneTimer(() => {
          Audio.playCelebration();
          const rect = el.getBoundingClientRect();
          FX.burstConfetti(rect.left + rect.width/2, rect.top + rect.height*0.65, 140);
        }, s.dur - 200);
      }
    }, s.at);
  });
}

const TEAM_MESSAGES = [
  {
    name:'Shane', time:'9:14 AM', avatar:'assets/images/shane.jpg',
    message:"Hi Kem,\nI still can't believe tomorrow is your last day.\nThank you for everything. Thank you for always helping, for being someone I could rely on, and for making things a little easier even during the stressful days.\nI'm really going to miss working with you. Burwood was lucky to have you, and so was the whole remote team.\nI'm happy for you and excited for your new journey, but of course, I'm sad to see you go. I hope everything works out for you because you truly deserve it.\nDon't be a stranger ha! Keep in touch. Wishing you all the best in your next chapter. Good luck, and thank you again for everything! ❤️",
    typingMs:1500, holdMs:6500
  },
  {
    name:'Shai', time:'9:16 AM', avatar:'assets/images/shai.jpg',
    message:"Hey Kem,\nCan't believe tomorrow's your last day! Just wanted to say how much I've loved working with you...you're seriously the full package. Creative genius, amazing singer (still waiting for that album drop 🎤😉), total AI master 🤖, and let's not forget your green thumb growing your own food like a pro 🌱🥗 pahingi lettuce! =P\nYou've inspired me (and probably everyone else too) with all the cool things you do, like Painting, Hiking, singing, and a lot more, and it's been such a joy having you around. Work won't be the same without your spark, but I know you'll keep shining wherever you go.\nWishing you all the fun, success, and happiness in your next adventure... and don't forget us when you're famous! 🌟\nBig hugs,\nSharica 💛\n#EatChickenForever",
    typingMs:2000, holdMs:9500
  },
  {
    name:'Kate', time:'9:19 AM', avatar:'assets/images/kate.jpg',
    message:"Keeeem, Kem Possible 🥹❤️\nWe are so lucky to have a colleague like you. Walang makakapantay sayo. 🥹 You are a true PPG blood, and you will always be. 🥹❤️ We are always happy for you and your growth. Alam mo naman gaano kami ka-supportive. And alam mo din namang nandito lang kami lagi. Chat ka lang kapag may next samgy na tayo. 🙈 We will definitely miss you and all your shareables. Take care always and we're rooting for you. 💖",
    typingMs:1800, holdMs:8500
  },
  {
    name:'Ericka', time:'9:22 AM', avatar:'assets/images/ericka.jpg',
    message:"Hi Kem, I'm really grateful that I had the chance to work with you and get to know you. Thank you for always being kind, approachable. Wishing you all the best on your next journey. I know you'll do amazing wherever you go. Don't be a stranger, and I hope our paths cross again someday. 😊\nTake care always, Kem, and good luck! 🤍",
    typingMs:1800, holdMs:8500
  },
  {
    name:'Edison', time:'9:27 AM', avatar:'assets/images/edison.jpg', emphasis:true,
    message:"On behalf of everyone at SIA Medical and SIA Dental, thank you for everything you've done for our patients, our team, and our company. Your kindness, professionalism, and dedication have made a lasting impact. We are incredibly grateful for everything you've contributed. While we're sad to see you go, we're excited for everything waiting for you ahead. You'll always be part of the SIA Family. We wish you every success in your next chapter. ❤️",
    typingMs:2200, holdMs:9500
  },
];

function avatarHTML(person){
  if (person.avatar){
    return `<div class="msg-avatar" style="background-image:url('${person.avatar}')"></div>`;
  }
  return `<div class="msg-avatar initials">${(person.initials || person.name[0])}</div>`;
}

function scrollStackToBottom(stack){
  stack.scrollTo({ top: stack.scrollHeight, behavior:'smooth' });
}

function showTypingRow(stack, person){
  const row = document.createElement('div');
  row.className = 'msg-row show typing-row';
  row.innerHTML = `${avatarHTML(person)}<div class="msg-content"><div class="msg-meta"><span class="msg-name">${person.name}</span></div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
  stack.appendChild(row);
  scrollStackToBottom(stack);
  Audio.playClick();
  Audio.playTypingTexture(Math.min(1200, person.typingMs - 200));
}

function showMessageRow(stack, person){
  const typingRow = stack.querySelector('.typing-row');
  if (typingRow) typingRow.remove();

  const row = document.createElement('div');
  row.className = 'msg-row show' + (person.emphasis ? ' emphasis' : '');
  const safeMessage = person.message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br><br>');
  row.innerHTML = `${avatarHTML(person)}<div class="msg-content"><div class="msg-meta"><span class="msg-name">${person.name}</span><span class="msg-time">${person.time}</span></div><div class="msg-bubble">${safeMessage}<span class="msg-reaction">❤️</span></div><div class="msg-receipt">Seen ✓✓</div></div>`;
  stack.appendChild(row);
  Audio.playPing();
  scrollStackToBottom(stack);

  sceneTimer(() => {
    const reaction = row.querySelector('.msg-reaction');
    if (reaction) reaction.classList.add('show');
    Audio.playHeartChime();
    const rect = row.getBoundingClientRect();
    for (let i=0;i<3;i++){
      sceneTimer(() => spawnFloatingHeart(rect.left + rect.width*Math.random(), rect.top), i*180);
    }
  }, 550);

  sceneTimer(() => {
    const receipt = row.querySelector('.msg-receipt');
    if (receipt) receipt.classList.add('show');
  }, 1300);
}

function enterMessages(el){
  const stack = el.querySelector('#msg-stack');
  stack.innerHTML = '';
  let t = 500;
  TEAM_MESSAGES.forEach(person => {
    const typingAt = t;
    const messageAt = t + person.typingMs;
    sceneTimer(() => showTypingRow(stack, person), typingAt);
    sceneTimer(() => showMessageRow(stack, person), messageAt);
    t = messageAt + person.holdMs;
  });
}

const WEEKDAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL'];

function buildCalendarFrames(){
  const frames = [];
  let day = 5, wd = 0, month = 0;
  for (let i=0;i<6;i++){
    frames.push({month: MONTHS[month], day: String(day).padStart(2,'0'), weekday: WEEKDAYS[wd]});
    day++; wd = (wd+1)%7;
  }
  for (let i=0;i<8;i++){
    month = Math.min(month+1, MONTHS.length-1);
    day = 3 + ((i*11)%26);
    wd = (wd+3)%7;
    frames.push({month: MONTHS[month], day: String(day).padStart(2,'0'), weekday: WEEKDAYS[wd]});
  }
  frames.push({month:'JUL', day:'10', weekday:'FRI', year:'2026', special:true});
  return frames;
}

function enterCalendar(el){
  const body = el.querySelector('#calendar-body');
  const top = el.querySelector('#calendar-top');
  body.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'calendar-page';
  body.appendChild(page);

  const frames = buildCalendarFrames();
  function render(f){
    const yearLine = f.year ? `<div class="year">${f.year}</div>` : '';
    page.innerHTML = `<div class="weekday">${f.weekday}</div><div class="day">${f.day}</div><div class="month">${f.month}</div>${yearLine}`;
    if (f.special) page.style.color = 'var(--coral)';
  }
  render(frames[0]);
  top.textContent = '2026';

  let i = 1;
  function tick(){
    if (i >= frames.length) return;
    page.classList.add('flip');
    Audio.playTick();
    sceneTimer(() => {
      render(frames[i]);
      page.classList.remove('flip');
      i++;
      const progress = i / frames.length;
      const delay = i === frames.length ? 260 : (120 + Math.sin(progress*Math.PI) * -60 + 220);
      sceneTimer(tick, Math.max(90, delay));
    }, 340);
  }
  sceneTimer(tick, 500);
}

function enterFadeOut(el){
  if (!Music.usingFile) Audio.crossfadeAmbience('emotional');
}

function enterTeamPhoto(el){
  FX.startAmbientSparkles();
  const rect = el.getBoundingClientRect();
  sceneTimer(() => FX.sparkleBurst(50, {x: rect.left+rect.width/2, y: rect.top+rect.height/2, w: rect.width, h: rect.height}), 300);
}

function enterBigThanks(el){
  el.querySelectorAll('[data-t]').forEach(node => {
    const t = parseInt(node.dataset.t, 10);
    sceneTimer(() => {
      node.classList.add('show');
      if (node.classList.contains('heart')) Audio.playHeartChime();
    }, t);
  });
}

function enterFinal(el){
  el.querySelectorAll('[data-t]').forEach(node => {
    const t = parseInt(node.dataset.t, 10);
    sceneTimer(() => {
      node.classList.add('show');
      if (node.classList.contains('heart')) Audio.playHeartChime();
    }, t);
  });
  FX.startFallingConfetti();
  sceneTimer(() => { Audio.fadeOutAll(5); Music.fadeOut(5); }, 5500);
}

/* ============================================================
   LOADER SEQUENCE
   ============================================================ */
function playLoaderThenStart(){
  loaderEl.classList.add('active');
  sceneTimer(() => Audio.playPing(), 350);
  sceneTimer(() => Audio.playBootChime(), 3300);
  sceneTimer(() => {
    loaderEl.classList.add('fading');
    sceneTimer(() => {
      loaderEl.classList.remove('active','fading');
      goToScene(0);
    }, 1100);
  }, 3800);
}

/* ============================================================
   CONTROLS
   ============================================================ */
document.getElementById('btn-start').addEventListener('click', () => {
  Audio.unlock();
  Audio.restoreMaster();
  startGateEl.classList.add('gone');
  Music.tryStart();
  playLoaderThenStart();
});

document.getElementById('btn-replay').addEventListener('click', () => {
  clearAllTimers();
  FX.stopFallingConfetti();
  FX.stopAmbientSparkles();
  Audio.stopAmbience(0.6);
  Audio.restoreMaster();
  Music.reset();
  scenes.forEach((s,i) => { s.classList.remove('active','leaving'); resetSceneVisuals(i); });
  currentIndex = -1;
  loaderEl.classList.remove('active','fading');
  playLoaderThenStart();
});

document.getElementById('btn-skip').addEventListener('click', skipScene);

document.getElementById('btn-mute').addEventListener('click', (e) => {
  const muted = Audio.toggleMute();
  e.currentTarget.textContent = muted ? '🔇' : '🔊';
});

document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement){
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

})();
