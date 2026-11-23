(() => {
'use strict';

// ---------- Constants ----------
const MAP = 4000;
const BLUE = 'blue', RED = 'red';
const BASE = { blue: { x: 380, y: 3620 }, red: { x: 3620, y: 380 } };
const FOUNTAIN_R = 420;
const TEAM_COLOR = { blue: '#4f8cff', red: '#ff5a5a', neutral: '#f0a040' };
const NEUTRAL = 'neutral';
/** River objectives. Drake buffs the whole team's damage; Golem empowers its killer. */
const MONSTERS = {
    drake: { name: 'Drake', x: 2780, y: 2780, hp: 3200, ad: 70, armor: 30, range: 320, ranged: true, r: 48, as: 0.55, first: 120, respawn: 150, gold: 150, xp: 300, color: '#ff8a3a' },
    golem: { name: 'Golem', x: 1220, y: 1220, hp: 2600, ad: 60, armor: 40, range: 150, ranged: false, r: 44, as: 0.7, first: 90, respawn: 120, gold: 120, xp: 250, color: '#8fd0ff' },
};
const DRAKE_BUFF = { dur: 120, dmg: 0.12 };
const GOLEM_BUFF = { dur: 90, speed: 0.15, regen: 0.012 };
/** Team-wide troop (minion) upgrades bought from the shop. Each has three tiers. */
const TROOP_UPGRADES = [
    { id: 'dmg', name: 'Sharpened Blades', icon: '🗡', desc: '+20% minion damage', costs: [500, 800, 1100] },
    { id: 'hp', name: 'Reinforced Armor', icon: '🛡', desc: '+20% minion health', costs: [500, 800, 1100] },
    { id: 'siege', name: 'Siege Workshop', icon: '💣', desc: 'Cannon minion every 2 / every wave, +1 extra', costs: [700, 1000, 1400] },
];
const LANES = {
    top: [BASE.blue, { x: 450, y: 3000 }, { x: 450, y: 450 }, { x: 3000, y: 450 }, BASE.red],
    mid: [BASE.blue, BASE.red],
    bot: [BASE.blue, { x: 1000, y: 3550 }, { x: 3550, y: 3550 }, { x: 3550, y: 1000 }, BASE.red],
};
const WAVE_INTERVAL = 30;
const MAX_LEVEL = 18;

const ITEMS = [
    { id: 'sword', name: 'Long Sword', icon: '⚔', cost: 350, stats: { ad: 10 } },
    { id: 'tome', name: 'Amplifying Tome', icon: '✦', cost: 435, stats: { ap: 20 } },
    { id: 'ruby', name: 'Ruby Crystal', icon: '♥', cost: 400, stats: { maxHp: 150 } },
    { id: 'cloth', name: 'Cloth Armor', icon: '⛨', cost: 300, stats: { armor: 15 } },
    { id: 'dagger', name: 'Dagger', icon: '➶', cost: 300, stats: { asBonus: 0.15 } },
    { id: 'boots', name: 'Boots', icon: '➹', cost: 300, stats: { speed: 25 }, unique: true },
    { id: 'pickaxe', name: 'Pickaxe', icon: '⚒', cost: 875, stats: { ad: 25 } },
    { id: 'rod', name: 'Blasting Wand', icon: '✧', cost: 850, stats: { ap: 40 } },
    { id: 'belt', name: 'Giant\'s Belt', icon: '❤', cost: 900, stats: { maxHp: 350 } },
];
const MAX_ITEMS = 6;
const POTION = { cost: 50, max: 5, heal: 150, dur: 10 };

// ---------- Champions ----------
const lv = (u) => u.level;
const CHAMPS = {
    vanguard: {
        name: 'Vanguard', letter: 'V', color: '#4f8cff',
        hp: 650, hpL: 95, mana: 0, manaL: 0, ad: 64, adL: 4, armor: 36, armorL: 4,
        range: 140, as: 0.65, speed: 345, ranged: false, r: 30, regen: 8,
        abilities: [
            { key: 'Q', name: 'Strike', cd: 8, cost: 0, range: 380,
              cast(u, tx, ty) {
                  const p = clampTo(u, tx, ty, 380);
                  startDash(u, p.x, p.y, 1400, () => {
                      fx('ring', u.x, u.y, 170, 0.3, '#ffd75a');
                      for (const e of enemiesInRadius(u, u.x, u.y, 170)) {
                          damage(u, e, 40 + 22 * lv(u) + 1.0 * u.ad, 'phys');
                          e.slow = Math.max(e.slow, 1.5); e.slowPct = 0.35;
                      }
                  });
              },
              ai: (u, e, d) => d < 380 && d > 160 },
            { key: 'W', name: 'Bulwark', cd: 14, cost: 0, range: 0, self: true,
              cast(u) { u.shield = 70 + 25 * lv(u) + 0.1 * u.maxHp; u.shieldT = 3; fx('ring', u.x, u.y, 50, 0.4, '#9fd3ff'); },
              ai: (u, e, d) => d < 400 && u.hp < u.maxHp * 0.7 },
            { key: 'E', name: 'Whirl', cd: 10, cost: 0, range: 0, self: true,
              cast(u) { u.spin = 2; u.spinTick = 0; },
              ai: (u, e, d) => d < 200 },
            { key: 'R', name: 'Verdict', cd: 70, cost: 0, range: 450, ult: true, targeted: true,
              cast(u, tx, ty) {
                  const t = pickTarget(u, tx, ty, 450, true);
                  if (!t) return false;
                  const dmg = 150 + 35 * lv(u) + 0.35 * (t.maxHp - t.hp);
                  fx('bolt', t.x, t.y - 300, 0, 0.35, '#ffd75a', { tx: t.x, ty: t.y });
                  later(0.25, () => { if (t.alive) damage(u, t, dmg, 'true'); });
              },
              ai: (u, e, d) => e.kind === 'champ' && d < 450 && e.hp < 150 + 35 * lv(u) + 0.35 * (e.maxHp - e.hp) },
        ],
    },
    arcanist: {
        name: 'Arcanist', letter: 'A', color: '#b26bff',
        hp: 520, hpL: 82, mana: 420, manaL: 30, ad: 52, adL: 3, armor: 22, armorL: 3.5, ap: 20,
        range: 525, as: 0.65, speed: 330, ranged: true, r: 26, regen: 6, manaRegen: 8,
        abilities: [
            { key: 'Q', name: 'Bolt', cd: 4, cost: 50, range: 1000,
              cast(u, tx, ty) {
                  skillshot(u, tx, ty, { speed: 1400, range: 1000, width: 45, color: '#c99bff',
                      onHit: (e) => damage(u, e, 70 + 25 * lv(u) + 0.75 * u.ap, 'magic') });
              },
              ai: (u, e, d) => d < 950 },
            { key: 'W', name: 'Rift', cd: 11, cost: 70, range: 850,
              cast(u, tx, ty) {
                  const p = clampTo(u, tx, ty, 850);
                  fx('warn', p.x, p.y, 200, 0.75, '#b26bff');
                  later(0.75, () => {
                      fx('ring', p.x, p.y, 200, 0.35, '#e1c4ff');
                      for (const e of enemiesInRadius(u, p.x, p.y, 200)) {
                          damage(u, e, 60 + 22 * lv(u) + 0.6 * u.ap, 'magic');
                          e.stun = Math.max(e.stun, 1);
                      }
                  });
              },
              ai: (u, e, d) => d < 800 },
            { key: 'E', name: 'Blink', cd: 16, cost: 60, range: 420,
              cast(u, tx, ty) { const p = clampTo(u, tx, ty, 420); fx('ring', u.x, u.y, 40, 0.3, '#b26bff'); u.x = p.x; u.y = p.y; fx('ring', u.x, u.y, 40, 0.3, '#b26bff'); u.order = null; },
              ai: () => false },
            { key: 'R', name: 'Cataclysm', cd: 60, cost: 100, range: 1600, ult: true,
              cast(u, tx, ty) {
                  const ang = Math.atan2(ty - u.y, tx - u.x);
                  const ox = u.x, oy = u.y;
                  fx('beamwarn', ox, oy, 1600, 0.8, '#b26bff', { ang, w: 130 });
                  later(0.8, () => {
                      fx('beam', ox, oy, 1600, 0.4, '#f0dcff', { ang, w: 130 });
                      for (const e of world.units) {
                          if (!e.alive || e.team === u.team || e.kind === 'tower' || e.kind === 'nexus') continue;
                          if (distToSegment(e, ox, oy, ox + Math.cos(ang) * 1600, oy + Math.sin(ang) * 1600) < 65 + e.r)
                              damage(u, e, 200 + 40 * lv(u) + 1.0 * u.ap, 'magic');
                      }
                  });
              },
              ai: (u, e, d) => e.kind === 'champ' && d < 1300 && e.hp < e.maxHp * 0.55 },
        ],
    },
    ranger: {
        name: 'Ranger', letter: 'R', color: '#3fd18b',
        hp: 560, hpL: 88, mana: 330, manaL: 25, ad: 60, adL: 3.5, armor: 25, armorL: 3.5,
        range: 575, as: 0.72, speed: 330, ranged: true, r: 26, regen: 6, manaRegen: 6,
        abilities: [
            { key: 'Q', name: 'Rapid', cd: 12, cost: 40, range: 0, self: true,
              cast(u) { u.rapid = 4; fx('ring', u.x, u.y, 45, 0.4, '#3fd18b'); },
              ai: (u, e, d) => d < u.range + 50 },
            { key: 'W', name: 'Volley', cd: 9, cost: 60, range: 900,
              cast(u, tx, ty) {
                  const base = Math.atan2(ty - u.y, tx - u.x);
                  const hit = new Set();
                  for (let i = -2; i <= 2; i++) {
                      const a = base + i * 0.17;
                      skillshot(u, u.x + Math.cos(a) * 100, u.y + Math.sin(a) * 100, { speed: 1500, range: 900, width: 30, color: '#a8ffcf', seek: 3.2,
                          onHit: (e) => { if (hit.has(e)) return; hit.add(e); damage(u, e, 30 + 18 * lv(u) + 0.9 * u.ad, 'phys'); } });
                  }
              },
              ai: (u, e, d) => d < 850 },
            { key: 'E', name: 'Tumble', cd: 7, cost: 30, range: 300,
              cast(u, tx, ty) { const p = clampTo(u, tx, ty, 300); startDash(u, p.x, p.y, 1300, () => { u.atkCd = 0; }); },
              ai: (u, e, d) => d < 250 && u.hp < u.maxHp * 0.5 },
            { key: 'R', name: 'Sky', cd: 80, cost: 100, range: 6000, ult: true,
              cast(u, tx, ty) {
                  skillshot(u, tx, ty, { speed: 1700, range: 6000, width: 70, color: '#7dffb8', champsOnly: true, big: true,
                      onHit: (e) => { damage(u, e, 220 + 45 * lv(u) + 0.9 * u.ad, 'magic'); e.stun = Math.max(e.stun, 1.6); } });
              },
              ai: (u, e, d) => e.kind === 'champ' && d < 1500 && e.hp < e.maxHp * 0.5 },
        ],
    },
};
const FLASH = { cd: 180, range: 400 };

// ---------- Utilities ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function clampTo(u, tx, ty, maxR) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d <= maxR) return { x: clamp(tx, 20, MAP - 20), y: clamp(ty, 20, MAP - 20) };
    return { x: clamp(u.x + dx / d * maxR, 20, MAP - 20), y: clamp(u.y + dy / d * maxR, 20, MAP - 20) };
}
function distToSegment(p, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((p.x - x1) * dx + (p.y - y1) * dy) / l2, 0, 1) : 0;
    return Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy));
}
function pathLength(path) {
    let len = 0;
    for (let i = 1; i < path.length; i++) len += dist(path[i - 1], path[i]);
    return len;
}
function pointAt(path, t) {
    let target = pathLength(path) * t;
    for (let i = 1; i < path.length; i++) {
        const seg = dist(path[i - 1], path[i]);
        if (target <= seg) {
            const k = target / seg;
            return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * k, y: path[i - 1].y + (path[i].y - path[i - 1].y) * k };
        }
        target -= seg;
    }
    return { ...path[path.length - 1] };
}
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const enemy = (t) => (t === BLUE ? RED : BLUE);

// ---------- World ----------
let world;
let nextId = 1;

function newWorld() {
    return { pings: [], buffs: { blue: 0, red: 0 }, upgrades: { blue: { dmg: 0, hp: 0, siege: 0 }, red: { dmg: 0, hp: 0, siege: 0 } }, time: 0, units: [], projectiles: [], effects: [], timers: [], nextWave: 5, wave: 0, kills: { blue: 0, red: 0 }, over: false };
}

function makeUnit(o) {
    return Object.assign({
        id: nextId++, alive: true, x: 0, y: 0, r: 20, hp: 100, maxHp: 100, ad: 10, ap: 0, armor: 0,
        range: 100, as: 0.6, speed: 300, atkCd: 0, order: null, stun: 0, slow: 0, slowPct: 0,
        shield: 0, shieldT: 0, lastHitBy: null, ranged: false,
    }, o);
}

function makeChamp(key, team, lane, isPlayer, name) {
    const c = CHAMPS[key];
    const u = makeUnit({
        kind: 'champ', key, team, lane, isPlayer, name, def: c, r: c.r, ranged: c.ranged,
        level: 1, xp: 0, gold: 500, kills: 0, deaths: 0, assists: 0, cs: 0, items: [],
        streak: 0, multi: 0, multiT: -99, potions: 0, potionT: 0,
        cds: [0, 0, 0, 0], flashCd: 0, respawn: 0, recall: 0, mana: c.mana, maxMana: c.mana,
        spin: 0, spinTick: 0, rapid: 0, dash: null,
    });
    recalcStats(u, true);
    respawnAt(u);
    return u;
}

function recalcStats(u, fill) {
    const c = u.def, L = u.level - 1;
    const bonus = { ad: 0, ap: 0, maxHp: 0, armor: 0, asBonus: 0, speed: 0 };
    for (const it of u.items) for (const [k, v] of Object.entries(it.stats)) bonus[k] += v;
    const oldMax = u.maxHp || 1;
    u.maxHp = c.hp + c.hpL * L + bonus.maxHp;
    u.maxMana = c.mana + c.manaL * L;
    u.ad = c.ad + c.adL * L + bonus.ad;
    u.ap = (c.ap || 0) + bonus.ap;
    u.armor = c.armor + c.armorL * L + bonus.armor;
    u.baseAs = c.as * (1 + 0.025 * L + bonus.asBonus);
    u.baseSpeed = c.speed + bonus.speed;
    u.range = c.range;
    if (fill) { u.hp = u.maxHp; u.mana = u.maxMana; }
    else u.hp = Math.min(u.maxHp, u.hp * (u.maxHp / oldMax));
}

function respawnAt(u) {
    const b = BASE[u.team];
    const off = u.team === BLUE ? 1 : -1;
    u.x = b.x + off * (40 + Math.random() * 60);
    u.y = b.y - off * (40 + Math.random() * 60);
    u.alive = true; u.hp = u.maxHp; u.mana = u.maxMana;
    u.order = null; u.stun = 0; u.slow = 0; u.dash = null; u.recall = 0; u.potionT = 0;
    u.dmgBy = new Map();
}

function spawnStructures() {
    for (const team of [BLUE, RED]) {
        for (const [lane, path] of Object.entries(LANES)) {
            const p = team === BLUE ? path : [...path].reverse();
            const outer = pointAt(p, 0.33), inner = pointAt(p, 0.15);
            const outerT = makeUnit({ kind: 'tower', team, lane, tier: 2, ...outer, r: 42, hp: 3000, maxHp: 3000, ad: 160, range: 480, as: 0.85, armor: 60 });
            const innerT = makeUnit({ kind: 'tower', team, lane, tier: 1, ...inner, r: 42, hp: 3500, maxHp: 3500, ad: 190, range: 480, as: 0.85, armor: 70, protector: outerT });
            world.units.push(outerT, innerT);
        }
        const nexus = makeUnit({ kind: 'nexus', team, x: BASE[team].x + (team === BLUE ? 220 : -220), y: BASE[team].y - (team === BLUE ? 220 : -220), r: 70, hp: 5000, maxHp: 5000, armor: 0 });
        world.units.push(nexus);
    }
}

function spawnMonsters() {
    for (const [key, m] of Object.entries(MONSTERS)) {
        world.units.push(makeUnit({ kind: 'monster', mkey: key, name: m.name, team: NEUTRAL, x: m.x, y: m.y, home: { x: m.x, y: m.y },
            r: m.r, hp: m.hp, maxHp: m.hp, ad: m.ad, armor: m.armor, range: m.range, ranged: m.ranged, as: m.as, speed: 300,
            alive: false, respawnAt: m.first, gold: m.gold, xp: m.xp, facing: Math.PI * 0.75 }));
    }
}

function updateMonster(u) {
    if (!u.alive) {
        if (world.time >= u.respawnAt) {
            const m = MONSTERS[u.mkey], scale = 1 + world.time / 600;
            Object.assign(u, { alive: true, hp: m.hp * scale, maxHp: m.hp * scale, ad: m.ad * scale, x: u.home.x, y: u.home.y, order: null, lastHitBy: null });
            feed(`${u.name} has spawned in the river`, NEUTRAL);
            if (u.mkey === 'drake') banner('The Drake has spawned');
        }
        return;
    }
    const leash = Math.hypot(u.x - u.home.x, u.y - u.home.y) > 650;
    const hitter = u.lastHitBy && u.lastHitBy.alive && u.lastHitBy.kind === 'champ' && world.time - (u.hitT || 0) < 6 ? u.lastHitBy : null;
    if (leash || !hitter) {
        // Reset: walk home and regenerate quickly.
        u.order = Math.hypot(u.x - u.home.x, u.y - u.home.y) > 10 ? { type: 'move', x: u.home.x, y: u.home.y } : null;
        if (leash) u.lastHitBy = null;
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.005);
        return;
    }
    if (!u.order || u.order.target !== hitter) u.order = { type: 'attack', target: hitter };
}

/** Buy the next tier of a team troop upgrade. */
function buyUpgrade(u, id) {
    const up = TROOP_UPGRADES.find((x) => x.id === id), tiers = world.upgrades[u.team];
    if (!up || tiers[id] >= up.costs.length || (u.alive && !inFountain(u, u.team))) return false;
    const cost = up.costs[tiers[id]];
    if (u.gold < cost) return false;
    u.gold -= cost; tiers[id]++;
    feed(`${u.name} upgraded ${up.name} to tier ${tiers[id]}`, u.team);
    return true;
}

function isInvulnerable(u) {
    if (u.kind === 'tower' && u.protector) return u.protector.alive;
    if (u.kind === 'nexus') {
        return !world.units.some((t) => t.kind === 'tower' && t.team === u.team && t.tier === 1 && !t.alive);
    }
    return false;
}

function spawnWave() {
    world.wave++;
    const scale = 1 + world.time / 600;
    for (const team of [BLUE, RED]) {
        for (const [lane, path] of Object.entries(LANES)) {
            const p = team === BLUE ? path : [...path].reverse();
            const up = world.upgrades[team];
            const types = ['melee', 'melee', 'melee', 'caster', 'caster', 'caster'];
            const cannonEvery = [3, 2, 1, 1][up.siege];
            if (world.wave % cannonEvery === 0) types.splice(3, 0, 'cannon');
            if (up.siege >= 3) types.splice(3, 0, 'cannon');
            types.forEach((type, i) => {
                const start = pointAt(p, 0.06);
                const spec = {
                    melee: { hp: 470, ad: 14, range: 110, r: 16, gold: 21, xp: 60, armor: 0 },
                    caster: { hp: 300, ad: 24, range: 500, r: 14, gold: 15, xp: 30, armor: 0, ranged: true },
                    cannon: { hp: 900, ad: 40, range: 550, r: 22, gold: 60, xp: 90, armor: 20, ranged: true },
                }[type];
                world.units.push(makeUnit({
                    kind: 'minion', mtype: type, team, lane, path: p, wp: 1,
                    x: start.x - (p[1].x - p[0].x) / pathLength(p) * i * 45 + (Math.random() - 0.5) * 10,
                    y: start.y - (p[1].y - p[0].y) / pathLength(p) * i * 45 + (Math.random() - 0.5) * 10,
                    r: spec.r, hp: spec.hp * scale * (1 + 0.2 * up.hp), maxHp: spec.hp * scale * (1 + 0.2 * up.hp), ad: spec.ad * scale * (1 + 0.2 * up.dmg), armor: spec.armor,
                    tier: up.dmg + up.hp,
                    range: spec.range, ranged: !!spec.ranged, as: 0.8, speed: 325, gold: spec.gold, xp: spec.xp,
                }));
            });
        }
    }
}

// ---------- Combat ----------
function damage(src, tgt, amount, type) {
    if (!tgt.alive || isInvulnerable(tgt) || world.over) return;
    let dmg = amount;
    if (src.kind === 'champ' && world.buffs[src.team] > world.time) dmg *= 1 + DRAKE_BUFF.dmg;
    if (tgt.kind === 'monster') tgt.hitT = world.time;
    if (type === 'phys') dmg *= 100 / (100 + Math.max(0, tgt.armor));
    if (type === 'magic') dmg *= 100 / (100 + Math.max(0, tgt.mr ?? tgt.armor * 0.6));
    if (tgt.shield > 0) {
        const absorbed = Math.min(tgt.shield, dmg);
        tgt.shield -= absorbed; dmg -= absorbed;
    }
    tgt.hp -= dmg;
    tgt.lastHitBy = src;
    if (dmg >= 1) fxEvent('hit', tgt, type);
    if (tgt.kind === 'champ') {
        tgt.recall = 0;
        if (src.kind === 'champ') { tgt.lastChampHit = { by: src, t: world.time }; tgt.dmgBy && tgt.dmgBy.set(src, world.time); }
    }
    if (src.kind === 'champ' && tgt.kind === 'champ') src.aggroT = world.time;
    if (dmg >= 1 && (tgt.isPlayer || src.isPlayer)) fx('num', tgt.x, tgt.y - tgt.r, Math.round(dmg), 0.7, type === 'true' ? '#fff' : type === 'magic' ? '#c99bff' : '#ffb35a');
    if (tgt.hp <= 0) kill(src, tgt);
}

function kill(src, tgt) {
    tgt.alive = false; tgt.hp = 0;
    fxEvent('death', tgt);
    const killer = src.kind === 'champ' ? src : (tgt.lastChampHit && world.time - tgt.lastChampHit.t < 10 ? tgt.lastChampHit.by : null);

    if (tgt.kind === 'minion') {
        if (src.kind === 'champ') { src.gold += tgt.gold; src.cs++; if (src.isPlayer) { fx('num', tgt.x, tgt.y - 20, '+' + tgt.gold + 'g', 0.9, '#ffd75a'); fxEvent('gold', tgt, src); } }
        const nearby = champsOf(enemy(tgt.team)).filter((c) => c.alive && dist(c, tgt) < 1000);
        for (const c of nearby) giveXp(c, tgt.xp / Math.max(1, nearby.length) * 1.4);
    } else if (tgt.kind === 'champ') {
        tgt.deaths++;
        tgt.respawn = 6 + tgt.level * 2;
        world.kills[enemy(tgt.team)]++;
        const bounty = 300 + Math.min(500, Math.max(0, tgt.streak - 1) * 100);
        const shutdown = tgt.streak >= 3;
        tgt.streak = 0;
        let callout = null;
        if (killer) {
            killer.kills++;
            killer.streak++;
            killer.multi = world.time - killer.multiT < 10 ? killer.multi + 1 : 1;
            killer.multiT = world.time;
            const firstBlood = !world.firstBlood;
            world.firstBlood = true;
            killer.gold += bounty + (firstBlood ? 100 : 0);
            giveXp(killer, 120 + tgt.level * 30);
            const helpers = [...(tgt.dmgBy || new Map())].filter(([c, t]) => c !== killer && c.team === killer.team && world.time - t < 10).map(([c]) => c);
            for (const h of helpers) { h.assists++; h.gold += Math.round(bounty * 0.5 / helpers.length); giveXp(h, (120 + tgt.level * 30) * 0.5); }
            feed(`${killer.name} slain ${tgt.name}${shutdown ? ' (shut down)' : ''}`, killer.team);
            callout = firstBlood ? 'First Blood!' : ({ 2: 'Double Kill!', 3: 'Triple Kill!', 4: 'Quadra Kill!' })[Math.min(4, killer.multi)]
                || (shutdown ? 'Shut Down!' : ({ 3: 'Killing Spree!', 5: 'Rampage!', 7: 'Unstoppable!', 9: 'Godlike!' })[killer.streak]);
            // Bots only announce first blood and sprees; the player hears every callout.
            if (!killer.isPlayer && callout && callout !== 'First Blood!') callout = killer.streak >= 3 || shutdown ? `${killer.name}: ${callout}` : null;
        } else feed(`${tgt.name} was executed`, enemy(tgt.team));
        if (tgt.isPlayer) banner(callout ? `${callout} · You have been slain` : 'You have been slain');
        else if (callout) banner(callout);
        else if (killer && killer.isPlayer) banner('Enemy slain');
        else if (tgt.dmgBy && tgt.dmgBy.has(player) && world.time - tgt.dmgBy.get(player) < 10) banner('Assist');
    } else if (tgt.kind === 'tower') {
        for (const c of champsOf(enemy(tgt.team))) c.gold += 150;
        feed(`${tgt.team === BLUE ? 'Blue' : 'Red'} ${tgt.lane} tower destroyed`, enemy(tgt.team));
        if (playerTeamIs(enemy(tgt.team))) banner('Enemy turret destroyed'); else banner('Your turret has been destroyed');
    } else if (tgt.kind === 'monster') {
        tgt.respawnAt = world.time + MONSTERS[tgt.mkey].respawn;
        const team = killer ? killer.team : src.team;
        if (killer) { killer.gold += tgt.gold; giveXp(killer, tgt.xp); }
        for (const c of champsOf(team)) if (c !== killer) { c.gold += 50; if (c.alive && dist(c, tgt) < 1400) giveXp(c, tgt.xp * 0.5); }
        if (tgt.mkey === 'drake') world.buffs[team] = world.time + DRAKE_BUFF.dur;
        else if (killer) killer.golemT = world.time + GOLEM_BUFF.dur;
        const ours = playerTeamIs(team);
        feed(`${team === BLUE ? 'Blue' : 'Red'} team slew the ${tgt.name}`, team);
        banner(tgt.mkey === 'drake' ? (ours ? 'Drake slain! +12% damage for your team' : 'Enemy team took the Drake')
            : (killer && killer.isPlayer ? 'Golem slain! You are empowered' : ours ? 'Your team took the Golem' : 'Enemy team took the Golem'));
    } else if (tgt.kind === 'nexus') {
        endGame(tgt.team !== player.team);
    }
}

function giveXp(c, amount) {
    if (c.level >= MAX_LEVEL) return;
    c.xp += amount;
    while (c.level < MAX_LEVEL && c.xp >= xpNeeded(c.level)) {
        c.xp -= xpNeeded(c.level);
        c.level++;
        fxEvent('levelup', c);
        recalcStats(c, false);
        c.hp = Math.min(c.maxHp, c.hp + c.def.hpL);
        if (c.isPlayer) { fx('ring', c.x, c.y, 60, 0.6, '#ffd75a'); if (c.level === 6) banner('Ultimate unlocked! (R)'); }
    }
}
const xpNeeded = (level) => 180 + level * 100;

function startAttack(u, t) {
    u.atkCd = 1 / currentAs(u);
    u.atkAnim = 0.25;
    if (u.ranged || u.kind === 'tower') {
        world.projectiles.push({
            homing: t, x: u.x, y: u.y, speed: u.kind === 'tower' ? 1300 : 1500, owner: u, team: u.team,
            color: u.kind === 'tower' ? '#ffe28a' : (u.kind === 'champ' ? u.def.color : TEAM_COLOR[u.team]),
            size: u.kind === 'tower' ? 9 : u.kind === 'champ' ? 6 : 4,
            dmg: u.kind === 'tower' ? towerDamage(u, t) : u.ad,
        });
    } else {
        damage(u, t, u.ad, 'phys');
        fx('slash', t.x, t.y, t.r + 6, 0.15, '#fff');
    }
}

function towerDamage(tower, t) {
    if (t.kind === 'minion') return t.maxHp * (t.mtype === 'cannon' ? 0.15 : 0.45);
    tower.heat = (tower.heatTarget === t ? (tower.heat || 1) + 0.3 : 1);
    tower.heatTarget = t;
    return tower.ad * Math.min(2.5, tower.heat) * (1 + world.time / 900);
}

const currentAs = (u) => (u.kind === 'champ' ? Math.min(2.5, u.baseAs * (u.rapid > 0 ? 1.6 : 1)) : u.as);
const currentSpeed = (u) => (u.kind === 'champ' ? u.baseSpeed * (u.golemT > world.time ? 1 + GOLEM_BUFF.speed : 1) : u.speed) * (u.slow > 0 ? 1 - u.slowPct : 1);

function skillshot(u, tx, ty, opt) {
    const ang = Math.atan2(ty - u.y, tx - u.x);
    world.projectiles.push({
        x: u.x, y: u.y, vx: Math.cos(ang) * opt.speed, vy: Math.sin(ang) * opt.speed,
        travelled: 0, owner: u, team: u.team, ...opt,
    });
}

function startDash(u, tx, ty, speed, onEnd) {
    u.dash = { tx, ty, speed, onEnd };
    u.order = null;
}

function pickTarget(u, tx, ty, range, champsOnly) {
    let best = null, bd = Infinity;
    for (const e of world.units) {
        if (!e.alive || e.team === u.team || (champsOnly && e.kind !== 'champ')) continue;
        if (dist(u, e) > range + e.r) continue;
        const d = Math.hypot(e.x - tx, e.y - ty);
        if (d < bd && d < 300) { bd = d; best = e; }
    }
    return best;
}

function enemiesInRadius(u, x, y, r) {
    return world.units.filter((e) => e.alive && e.team !== u.team && e.kind !== 'tower' && e.kind !== 'nexus' && Math.hypot(e.x - x, e.y - y) <= r + e.r);
}

const champsOf = (team) => world.units.filter((u) => u.kind === 'champ' && u.team === team);
const playerTeamIs = (team) => player.team === team;

function canCast(u, i) {
    const a = u.def.abilities[i];
    if (!u.alive || u.stun > 0 || u.dash || u.cds[i] > 0 || u.mana < a.cost) return false;
    if (a.ult && u.level < 6) return false;
    return true;
}

function cast(u, i, tx, ty) {
    if (!canCast(u, i)) return false;
    const a = u.def.abilities[i];
    if (a.cast(u, tx, ty) === false) return false;
    u.cds[i] = a.cd * Math.max(0.6, 1 - u.level * 0.015);
    u.mana -= a.cost;
    u.recall = 0;
    return true;
}

function flash(u, tx, ty) {
    if (!u.alive || u.flashCd > 0 || u.stun > 0) return;
    const p = clampTo(u, tx, ty, FLASH.range);
    fx('ring', u.x, u.y, 35, 0.3, '#ffef8a');
    u.x = p.x; u.y = p.y; u.dash = null; u.recall = 0;
    fx('ring', u.x, u.y, 35, 0.3, '#ffef8a');
    u.flashCd = FLASH.cd;
}

// ---------- Effects / timers ----------
function fx(type, x, y, r, dur, color, extra) {
    world.effects.push({ type, x, y, r, t: 0, dur, color, ...extra });
}
function later(delay, fn) { world.timers.push({ t: delay, fn }); }

// ---------- Simulation ----------
function inFountain(u, team) { return Math.hypot(u.x - BASE[team].x, u.y - BASE[team].y) < FOUNTAIN_R; }

function moveToward(u, tx, ty, dt, stopAt = 0) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d <= stopAt + 0.5) return true;
    const step = Math.min(currentSpeed(u) * dt, d - stopAt);
    u.x += dx / d * step; u.y += dy / d * step;
    u.facing = Math.atan2(dy, dx);
    return d - step <= stopAt + 0.5;
}

function update(dt) {
    world.time += dt;
    if (world.time >= world.nextWave) { spawnWave(); world.nextWave += WAVE_INTERVAL; }

    for (let i = world.timers.length - 1; i >= 0; i--) {
        const t = world.timers[i];
        t.t -= dt;
        if (t.t <= 0) { world.timers.splice(i, 1); t.fn(); }
    }

    for (const u of world.units) {
        if (u.kind === 'champ') updateChampState(u, dt);
        if (u.kind === 'monster' && !u.alive) updateMonster(u);
        if (!u.alive) continue;
        u.atkCd = Math.max(0, u.atkCd - dt);
        u.stun = Math.max(0, u.stun - dt);
        u.slow = Math.max(0, u.slow - dt);
        if (u.kind === 'minion') minionAI(u);
        else if (u.kind === 'monster') updateMonster(u);
        else if (u.kind === 'tower') towerAI(u);
        else if (u.kind === 'champ' && (!u.isPlayer || world.autoplay)) botAI(u, dt);
        else if (u.isPlayer) autoAcquire(u, dt);
        if (u.kind !== 'nexus') act(u, dt);
    }

    separate();
    updateProjectiles(dt);

    for (let i = world.effects.length - 1; i >= 0; i--) {
        world.effects[i].t += dt;
        if (world.effects[i].t >= world.effects[i].dur) world.effects.splice(i, 1);
    }
    world.units = world.units.filter((u) => u.alive || u.kind !== 'minion');
}

function updateChampState(u, dt) {
    if (!u.alive) {
        u.respawn -= dt;
        if (u.respawn <= 0) respawnAt(u);
        return;
    }
    for (let i = 0; i < 4; i++) u.cds[i] = Math.max(0, u.cds[i] - dt);
    u.flashCd = Math.max(0, u.flashCd - dt);
    u.rapid = Math.max(0, u.rapid - dt);
    u.shieldT = Math.max(0, u.shieldT - dt);
    if (u.shieldT <= 0) u.shield = 0;
    u.hp = Math.min(u.maxHp, u.hp + (u.def.regen + u.level * 0.5) * dt);
    u.mana = Math.min(u.maxMana, u.mana + (u.def.manaRegen || 0) * dt);
    u.gold += 2 * dt;
    if (u.golemT > world.time) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * GOLEM_BUFF.regen * dt);
    if (u.potionT > 0) { u.potionT -= dt; u.hp = Math.min(u.maxHp, u.hp + POTION.heal / POTION.dur * dt); }

    if (inFountain(u, u.team)) {
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.12 * dt);
        u.mana = Math.min(u.maxMana, u.mana + u.maxMana * 0.12 * dt);
    }
    if (inFountain(u, enemy(u.team))) damage({ kind: 'fountain', team: enemy(u.team) }, u, 800 * dt, 'true');
    if (!u.alive) return;

    if (u.spin > 0) {
        u.spin -= dt; u.spinTick -= dt;
        if (u.spinTick <= 0) {
            u.spinTick = 0.25;
            fx('ring', u.x, u.y, 200, 0.2, 'rgba(255,215,90,0.8)');
            for (const e of enemiesInRadius(u, u.x, u.y, 200)) damage(u, e, (18 + 5 * u.level + 0.35 * u.ad) * (e.kind === 'minion' ? 0.75 : 1), 'phys');
        }
    }
    if (u.recall > 0) {
        u.recall -= dt;
        if (u.recall <= 0) { respawnAt(u); u.hp = u.maxHp; if (u.isPlayer) banner('Recalled'); }
    }
    if (u.dash) {
        u.stun = 0;
        if (moveTowardRaw(u, u.dash.tx, u.dash.ty, u.dash.speed * dt)) {
            const d = u.dash; u.dash = null;
            d.onEnd && d.onEnd();
        }
    }
}

function moveTowardRaw(u, tx, ty, step) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d <= step) { u.x = tx; u.y = ty; return true; }
    u.x += dx / d * step; u.y += dy / d * step;
    return false;
}

function validTarget(u, t) {
    return t && t.alive && t.team !== u.team && !(t.kind === 'champ' && inFountain(t, t.team) && u.kind !== 'champ');
}

function act(u, dt) {
    if (u.stun > 0 || u.dash) return;
    const o = u.order;
    if (!o) return;
    if (o.type === 'move') {
        if (u.kind === 'tower') return;
        if (moveToward(u, o.x, o.y, dt)) u.order = null;
    } else if (o.type === 'attack') {
        const t = o.target;
        if (!validTarget(u, t)) { u.order = null; return; }
        // Auto-acquired targets are never chased out of range.
        if (o.auto && dist(u, t) > u.range + t.r + u.r * 0.5 + 40) { u.order = null; return; }
        const reach = u.range + t.r + u.r * 0.5;
        if (dist(u, t) <= reach) {
            u.facing = Math.atan2(t.y - u.y, t.x - u.x);
            if (u.atkCd <= 0 && !isInvulnerable(t)) { startAttack(u, t); if (u.kind === 'champ') u.recall = 0; }
        } else if (u.kind !== 'tower') {
            moveToward(u, t.x, t.y, dt, reach - 4);
        }
    }
}

function nearestEnemy(u, range, filter) {
    let best = null, bd = range;
    for (const e of world.units) {
        if (!e.alive || e.team === u.team || isInvulnerable(e) && e.kind === 'nexus') continue;
        if (filter && !filter(e)) continue;
        if (e.kind === 'champ' && inFountain(e, e.team)) continue;
        const d = dist(u, e) - e.r;
        if (d < bd) { bd = d; best = e; }
    }
    return best;
}

function minionAI(u) {
    const cur = u.order && u.order.type === 'attack' ? u.order.target : null;
    if (cur && validTarget(u, cur) && dist(u, cur) < 700) return;
    const t = nearestEnemy(u, 400, (e) => !isInvulnerable(e) && e.kind !== 'monster');
    if (t) { u.order = { type: 'attack', target: t }; return; }
    while (u.wp < u.path.length - 1 && dist(u, u.path[u.wp]) < 60) u.wp++;
    const wp = u.path[u.wp];
    u.order = { type: 'move', x: wp.x, y: wp.y };
}

function towerAI(u) {
    const cur = u.order && u.order.target;
    const reach = (t) => dist(u, t) <= u.range + t.r;
    // Towers switch to champions that attack allied champions inside their range.
    const aggressor = world.units.find((c) => c.kind === 'champ' && c.alive && c.team !== u.team && reach(c) && c.aggroT && world.time - c.aggroT < 1.5
        && world.units.some((a) => a.kind === 'champ' && a.team === u.team && a.alive && reach(a) && a.lastChampHit && a.lastChampHit.by === c && world.time - a.lastChampHit.t < 1.5));
    if (aggressor) { u.order = { type: 'attack', target: aggressor }; return; }
    if (cur && validTarget(u, cur) && reach(cur)) return;
    let best = null, bd = Infinity;
    for (const e of world.units) {
        if (!e.alive || e.team === u.team || !reach(e) || e.kind === 'tower' || e.kind === 'nexus' || e.kind === 'monster') continue;
        if (e.kind === 'champ' && inFountain(e, e.team)) continue;
        const score = dist(u, e) + (e.kind === 'champ' ? 2000 : 0);
        if (score < bd) { bd = score; best = e; }
    }
    u.order = best ? { type: 'attack', target: best } : null;
}

function separate() {
    const movers = world.units.filter((u) => u.alive && (u.kind === 'minion' || u.kind === 'champ'));
    const solids = world.units.filter((u) => u.alive && (u.kind === 'tower' || u.kind === 'nexus'));
    for (let i = 0; i < movers.length; i++) {
        const a = movers[i];
        if (a.dash) continue;
        for (let j = i + 1; j < movers.length; j++) {
            const b = movers[j];
            const dx = b.x - a.x, dy = b.y - a.y, min = (a.r + b.r) * 0.8;
            const d2 = dx * dx + dy * dy;
            if (d2 > 0 && d2 < min * min && !b.dash) {
                const d = Math.sqrt(d2), push = (min - d) / 2;
                a.x -= dx / d * push; a.y -= dy / d * push;
                b.x += dx / d * push; b.y += dy / d * push;
            }
        }
        for (const s of solids) {
            const dx = a.x - s.x, dy = a.y - s.y, d = Math.hypot(dx, dy), min = a.r + s.r;
            if (d > 0 && d < min) { a.x = s.x + dx / d * min; a.y = s.y + dy / d * min; }
        }
        a.x = clamp(a.x, 20, MAP - 20); a.y = clamp(a.y, 20, MAP - 20);
    }
}

/** Bend a skillshot toward the nearest enemy ahead of it (within ~50° and 550 units). */
function steerProjectile(p, dt) {
    const ang = Math.atan2(p.vy, p.vx), spd = Math.hypot(p.vx, p.vy);
    let best = null, bd = 550;
    for (const e of world.units) {
        if (!e.alive || e.team === p.team || e.kind === 'tower' || e.kind === 'nexus') continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > bd) continue;
        let diff = Math.atan2(e.y - p.y, e.x - p.x) - ang;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.abs(diff) > 0.9) continue;
        // Champions are preferred: they count as closer than they are.
        const score = e.kind === 'champ' ? d * 0.6 : d;
        if (score < bd) { bd = score; best = { e, diff }; }
    }
    if (!best) return;
    const turn = clamp(best.diff, -p.seek * dt, p.seek * dt);
    p.vx = Math.cos(ang + turn) * spd; p.vy = Math.sin(ang + turn) * spd;
}

function updateProjectiles(dt) {
    const out = [];
    for (const p of world.projectiles) {
        if (p.homing) {
            const t = p.homing;
            if (!t.alive) continue;
            const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy), step = p.speed * dt;
            if (d <= step + t.r * 0.5) {
                if (p.owner.kind === 'tower') damage(p.owner, t, p.dmg, 'true');
                else damage(p.owner, t, p.dmg, 'phys');
                continue;
            }
            p.x += dx / d * step; p.y += dy / d * step;
            out.push(p);
            continue;
        }
        if (p.seek) steerProjectile(p, dt);
        const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
        p.travelled += Math.hypot(p.vx * dt, p.vy * dt);
        let hit = null;
        for (const e of world.units) {
            if (!e.alive || e.team === p.team || e.kind === 'tower' || e.kind === 'nexus') continue;
            if (p.champsOnly && e.kind !== 'champ') continue;
            if (distToSegment(e, p.x, p.y, nx, ny) <= e.r + p.width / 2) { hit = e; break; }
        }
        p.x = nx; p.y = ny;
        if (hit) { p.onHit(hit); fx('ring', hit.x, hit.y, 30, 0.25, p.color); continue; }
        if (p.travelled < p.range && p.x > 0 && p.y > 0 && p.x < MAP && p.y < MAP) out.push(p);
    }
    world.projectiles = out;
}

// ---------- Pings ----------
/**
 * Map alert from a champion. 'help' pulls the nearest idle allied bot toward the spot
 * for a few seconds; 'danger' makes allied bots near the spot back off.
 */
function ping(from, type, x, y) {
    world.pings = world.pings.filter((p) => world.time - p.t < 4);
    if (world.pings.filter((p) => p.from === from && world.time - p.t < 3).length >= 3) return false;
    world.pings.push({ from, type, x, y, t: world.time, team: from.team });
    const allies = champsOf(from.team).filter((c) => c !== from && c.alive && !c.isPlayer);
    if (type === 'help') {
        const helper = allies.filter((c) => !c.retreating && c.hp > c.maxHp * 0.5).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
        if (helper) helper.assistGoal = { x, y, until: world.time + 12 };
    } else {
        for (const c of allies) if (Math.hypot(c.x - x, c.y - y) < 1200) { c.assistGoal = null; c.dangerT = world.time + 4; }
    }
    return true;
}

// ---------- Player auto-attack ----------
/**
 * When the player is idle, automatically fire at the best enemy in attack range:
 * champions first, then the lowest-health minion, then structures.
 */
function autoAcquire(u, dt) {
    u.holdT = Math.max(0, (u.holdT || 0) - dt);
    if (!u.alive || u.order || u.dash || u.recall > 0 || u.holdT > 0 || u.stun > 0) return;
    const reach = (e) => dist(u, e) <= u.range + e.r + u.r * 0.5;
    let champ = null, minion = null, structure = null;
    for (const e of world.units) {
        if (!validTarget(u, e) || isInvulnerable(e) || !reach(e) || e.kind === 'monster') continue;
        if (e.kind === 'champ') { if (!champ || e.hp < champ.hp) champ = e; }
        else if (e.kind === 'minion') { if (!minion || e.hp < minion.hp) minion = e; }
        else if (!structure) structure = e;
    }
    const t = champ || minion || structure;
    if (t) u.order = { type: 'attack', target: t, auto: true };
}

// ---------- Bot AI ----------
function botAI(u, dt) {
    if (!u.alive || u.dash) return;
    u.thinkT = (u.thinkT || 0) - dt;
    if (u.thinkT > 0 && u.order) return;
    u.thinkT = 0.2 + Math.random() * 0.15;

    const home = BASE[u.team];
    if (inFountain(u, u.team)) {
        botShop(u);
        if (u.hp < u.maxHp * 0.95) { u.order = null; return; }
        u.retreating = false;
    }
    if (u.recall > 0) return;
    if (u.hp < u.maxHp * 0.5 && !inFountain(u, u.team)) drinkPotion(u);

    if (u.hp < u.maxHp * 0.28) u.retreating = true;
    if (u.retreating) {
        const threat = nearestEnemy(u, 900, (e) => e.kind === 'champ' || e.kind === 'tower');
        if (!threat && !inFountain(u, u.team) && dist(u, home) > 1200) {
            u.order = null; u.recall = 8; return;
        }
        const flee = u.def.abilities.findIndex((a) => a.name === 'Blink' || a.name === 'Tumble');
        if (threat && flee >= 0 && canCast(u, flee)) cast(u, flee, home.x, home.y);
        u.order = { type: 'move', x: home.x, y: home.y };
        return;
    }

    const path = u.team === BLUE ? LANES[u.lane] : [...LANES[u.lane]].reverse();
    const enemyChamp = nearestEnemy(u, 1000, (e) => e.kind === 'champ');
    const towerNear = (pt, team) => world.units.find((t) => t.kind === 'tower' && t.alive && t.team === team && dist(t, pt) < t.range + 60);

    if (enemyChamp) {
        const d = dist(u, enemyChamp);
        for (let i = 3; i >= 0; i--) {
            const a = u.def.abilities[i];
            if (canCast(u, i) && a.ai(u, enemyChamp, d) && Math.random() < 0.5) {
                const lead = a.self ? 0 : 0.25;
                const tx = enemyChamp.x + (enemyChamp.order && enemyChamp.order.type === 'move' ? Math.cos(enemyChamp.facing || 0) * currentSpeed(enemyChamp) * lead : 0);
                const ty = enemyChamp.y + (enemyChamp.order && enemyChamp.order.type === 'move' ? Math.sin(enemyChamp.facing || 0) * currentSpeed(enemyChamp) * lead : 0);
                if (cast(u, i, tx, ty)) return;
            }
        }
        const enemyTower = towerNear(enemyChamp, enemy(u.team));
        const healthy = u.hp / u.maxHp > enemyChamp.hp / enemyChamp.maxHp - 0.1;
        if (!enemyTower && (healthy || d < u.range) && d < u.range + 250) {
            u.order = { type: 'attack', target: enemyChamp }; return;
        }
        if (enemyChamp.hp < enemyChamp.maxHp * 0.15 && !enemyTower && u.flashCd <= 0 && d < u.range + 350 && Math.random() < 0.2) {
            flash(u, enemyChamp.x, enemyChamp.y);
            u.order = { type: 'attack', target: enemyChamp }; return;
        }
    }

    // Objectives: healthy bots that are close enough go take a river monster when no enemy champion is near.
    const mon = world.units.find((m) => m.kind === 'monster' && m.alive && dist(u, m) < (u.objective === m ? 2600 : 1500));
    if (mon && u.level >= 4 && u.hp > u.maxHp * (u.objective === mon ? 0.35 : 0.7) && !nearestEnemy(u, 900, (e) => e.kind === 'champ')) {
        u.objective = mon;
        u.order = { type: 'attack', target: mon }; return;
    }
    u.objective = null;

    // Answer a help ping: head to the spot (fighting anything met on the way above).
    if (u.assistGoal) {
        if (world.time > u.assistGoal.until || Math.hypot(u.x - u.assistGoal.x, u.y - u.assistGoal.y) < 250) u.assistGoal = null;
        else { u.order = { type: 'move', x: u.assistGoal.x, y: u.assistGoal.y }; return; }
    }
    // Danger ping: hold back toward home for a moment.
    if (u.dangerT && world.time < u.dangerT) { const back = clampTo(u, home.x, home.y, 400); u.order = { type: 'move', x: back.x, y: back.y }; return; }

    // Farm: last-hit low minions, otherwise hit the lowest minion near the wave.
    const minions = world.units.filter((m) => m.kind === 'minion' && m.alive && m.team !== u.team && dist(u, m) < 800 && !towerNear(m, enemy(u.team)));
    if (minions.length) {
        minions.sort((a, b) => a.hp - b.hp);
        const lowest = minions[0];
        if (lowest.hp <= u.ad * 1.1 || Math.random() < 0.6) { u.order = { type: 'attack', target: lowest }; return; }
    }

    // Siege a tower if friendly minions are tanking it.
    const tower = world.units.find((t) => t.kind === 'tower' && t.alive && t.team !== u.team && dist(u, t) < 900 && !isInvulnerable(t));
    if (tower && tower.order && tower.order.target && tower.order.target.kind === 'minion') {
        u.order = { type: 'attack', target: tower }; return;
    }
    const nexus = world.units.find((n) => n.kind === 'nexus' && n.team !== u.team);
    if (nexus.alive && !isInvulnerable(nexus) && dist(u, nexus) < 900) { u.order = { type: 'attack', target: nexus }; return; }

    // Walk to the front of the allied wave, or to our outer tower if no wave yet.
    const allies = world.units.filter((m) => m.kind === 'minion' && m.alive && m.team === u.team && m.lane === u.lane);
    let goal;
    if (allies.length) {
        allies.sort((a, b) => dist(b, home) - dist(a, home));
        const front = allies[Math.min(1, allies.length - 1)];
        const back = clampTo(front, home.x, home.y, u.ranged ? 220 : 80);
        goal = back;
    } else {
        const own = world.units.filter((t) => t.kind === 'tower' && t.alive && t.team === u.team && t.lane === u.lane).sort((a, b) => dist(b, home) - dist(a, home))[0];
        goal = own ? clampTo(own, home.x, home.y, 150) : pointAt(path, 0.15);
    }
    if (towerNear(goal, enemy(u.team)) && !allies.some((m) => towerNear(m, enemy(u.team)))) goal = clampTo(goal, home.x, home.y, 450);
    u.order = { type: 'move', x: goal.x + (Math.random() - 0.5) * 60, y: goal.y + (Math.random() - 0.5) * 60 };
}

function botShop(u) {
    const prefs = u.key === 'arcanist' ? ['boots', 'rod', 'tome', 'ruby', 'belt', 'rod'] : u.key === 'ranger' ? ['boots', 'pickaxe', 'dagger', 'dagger', 'sword', 'cloth'] : ['boots', 'belt', 'pickaxe', 'cloth', 'ruby', 'sword'];
    for (const id of prefs) {
        const item = ITEMS.find((i) => i.id === id);
        if (u.items.length >= MAX_ITEMS) return;
        if (item.unique && u.items.some((i) => i.id === id)) continue;
        if (u.items.filter((i) => i.id === id).length >= prefs.filter((p) => p === id).length) continue;
        if (u.gold >= item.cost) { u.gold -= item.cost; u.items.push(item); recalcStats(u, false); }
        else break;
    }
    while (u.potions < 2 && buyPotion(u));
    if (u.items.length >= 4 || u.gold > 1500) {
        const t = world.upgrades[u.team];
        const next = TROOP_UPGRADES.filter((x) => t[x.id] < x.costs.length).sort((a, b) => t[a.id] - t[b.id])[0];
        if (next && u.gold >= next.costs[t[next.id]] + 300) buyUpgrade(u, next.id);
    }
}

function drinkPotion(u) {
    if (!u.alive || u.potions <= 0 || u.potionT > 0 || u.hp >= u.maxHp) return false;
    u.potions--; u.potionT = POTION.dur;
    fx('ring', u.x, u.y, 40, 0.4, '#ff6b8a');
    return true;
}
function buyPotion(u) {
    if ((u.alive && !inFountain(u, u.team)) || u.gold < POTION.cost || u.potions >= POTION.max) return false;
    u.gold -= POTION.cost; u.potions++;
    return true;
}

function buy(u, item) {
    if ((u.alive && !inFountain(u, u.team)) || u.gold < item.cost || u.items.length >= MAX_ITEMS) return;
    if (item.unique && u.items.some((i) => i.id === item.id)) return;
    u.gold -= item.cost;
    u.items.push(item);
    recalcStats(u, false);
}

// ---------- Game setup ----------
let player;
function setupGame(cfg) {
    world = newWorld();
    nextId = 1;
    spawnStructures();
    spawnMonsters();
    const keys = Object.keys(CHAMPS);
    const pick = () => keys[Math.floor(Math.random() * keys.length)];
    player = makeChamp(cfg.champion, BLUE, 'mid', true, cfg.name);
    const botNames = ['Ashbringer', 'Nightfall', 'Ironclad', 'Stormcaller', 'Duskblade', 'Emberwolf'];
    world.units.push(
        player,
        makeChamp(pick(), BLUE, 'top', false, botNames[0]),
        makeChamp(pick(), BLUE, 'bot', false, botNames[1]),
        makeChamp(pick(), RED, 'top', false, botNames[2]),
        makeChamp(pick(), RED, 'mid', false, botNames[3]),
        makeChamp(pick(), RED, 'bot', false, botNames[4]),
    );
    return world;
}

function endGame(victory) {
    if (world.over) return;
    world.over = true;
    world.victory = victory;
    onGameOver && onGameOver(victory);
}

// ---------- Browser layer ----------
let onGameOver = null;
let feed = () => {}, banner = () => {}, fxEvent = () => {};

if (typeof window === 'undefined' || !document.getElementById('game')) {
    if (typeof module !== 'undefined') module.exports = { setupGame, update, getWorld: () => world, getPlayer: () => player, cast, buy, buyPotion, buyUpgrade, ping, MONSTERS, drinkPotion, ITEMS, CHAMPS, isInvulnerable, flash };
    return;
}

const cfg = window.NQ;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const cam = { x: 0, y: 0, locked: true };
const mouse = { x: 0, y: 0, sx: 0, sy: 0, inside: true };
let paused = false;
let W = 0, H = 0, DPR = 1;
// View mode: '3d' renders the world with WebGL (Three.js) under the 2D effects layer.
const TILT = 0.6;
let use3D = false, COS = 1, SIN = 0;
const webglOK = (() => { try { const c = document.createElement('canvas'); return !!(window.THREE && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (_) { return false; } })();
(() => {
    let pref = null;
    try { pref = localStorage.getItem('nq-view'); } catch (_) {}
    if (/[?&]view=2d/.test(location.search)) pref = '2d';
    if (/[?&]view=3d/.test(location.search)) pref = '3d';
    use3D = webglOK && pref !== '2d';
    COS = use3D ? Math.cos(TILT) : 1; SIN = use3D ? Math.sin(TILT) : 0;
})();
const lift = (h) => h * SIN / COS;
let hoverAbility = -1;

setupGame(cfg);
if (/[?&]autoplay/.test(location.search)) { world.autoplay = true; cam.locked = true; }
cam.x = player.x; cam.y = player.y;

feed = (text, team) => {
    const el = document.createElement('div');
    el.className = team;
    el.textContent = text;
    $('feed').prepend(el);
    setTimeout(() => el.remove(), 6000);
    while ($('feed').children.length > 6) $('feed').lastChild.remove();
};
let bannerTimer;
banner = (text) => {
    const el = $('banner');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.add('hidden'), 2200);
};
const track = (event, data) => { try { window.dataLayer && window.dataLayer.push({ event, ...data }); } catch (_) {} };
track('match_start', { champion: cfg.champion });
onGameOver = (victory) => {
    track('match_end', { champion: cfg.champion, result: victory ? 'victory' : 'defeat', kills: player.kills, deaths: player.deaths, duration_seconds: Math.round(world.time) });
    $('ov-title').textContent = victory ? 'Victory' : 'Defeat';
    $('ov-title').style.color = victory ? '#3fd18b' : '#ff5a5a';
    $('ov-text').textContent = `${player.def.name} · ${player.kills}/${player.deaths} · ${player.cs} CS · Level ${player.level} · ${fmtTime(world.time)}`;
    setTimeout(() => $('overlay').classList.remove('hidden'), 1500);
    const token = document.querySelector('meta[name="csrf-token"]').content;
    fetch(cfg.saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': token },
        body: JSON.stringify({
            player_name: cfg.name, champion: cfg.champion, victory, kills: player.kills, deaths: player.deaths,
            creep_score: player.cs, level: player.level, duration_seconds: Math.round(world.time),
        }),
    }).catch(() => {});
};

const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
let zoom = 1;
function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, isTouch ? 2 : 3);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    // Small screens see more of the map instead of a cramped close-up.
    zoom = isTouch ? clamp(Math.min(W, H) / 620, 0.62, 1) : clamp(Math.min(W, H) / 820, 0.5, 1);
}
window.addEventListener('resize', resize);
resize();

const toWorld = (sx, sy) => ({ x: (sx - W / 2) / zoom + cam.x, y: (sy - H / 2) / (zoom * COS) + cam.y });
const minimapRect = () => {
    if (isTouch) { const s = Math.min(130, Math.min(W, H) * 0.3); return { x: 10, y: 10, s }; }
    const s = Math.min(200, W * 0.28); return { x: W - s - 12, y: H - s - 12, s };
};

function minimapHit(sx, sy) {
    const m = minimapRect();
    if (sx >= m.x && sy >= m.y && sx <= m.x + m.s && sy <= m.y + m.s) return { x: (sx - m.x) / m.s * MAP, y: (sy - m.y) / m.s * MAP };
    return null;
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let pressPing = null;
canvas.addEventListener('pointerup', () => { clearTimeout(pressPing); });
canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || paused || world.over) return;
    e.preventDefault();
    const mmPing = minimapHit(e.clientX, e.clientY);
    if (mmPing) {
        // Long-press the minimap to send a help ping; a short tap still walks there.
        clearTimeout(pressPing);
        pressPing = setTimeout(() => { sendPing('help', mmPing); pressPing = null; }, 450);
    }
    issueOrder(minimapHit(e.clientX, e.clientY) || toWorld(e.clientX, e.clientY));
});
// Track the mouse over the whole window (HUD included) so edge scrolling works at every edge.
window.addEventListener('mousemove', (e) => {
    mouse.sx = e.clientX; mouse.sy = e.clientY; mouse.inside = true;
    if (pan) { cam.x -= e.movementX / zoom; cam.y -= e.movementY / zoom / COS; }
});
document.documentElement.addEventListener('mouseleave', () => { mouse.inside = false; });
window.addEventListener('blur', () => { mouse.inside = false; keysDown.clear(); });
let pan = false;
window.addEventListener('mouseup', (e) => { if (e.button === 1) pan = false; });
canvas.addEventListener('mousedown', (e) => {
    if (paused || world.over) return;
    const mm = minimapHit(e.clientX, e.clientY);
    if (e.altKey && (e.button === 0 || e.button === 2)) { sendPing(e.button === 2 ? 'danger' : 'help', mm || toWorld(e.clientX, e.clientY)); return; }
    if (e.button === 0 && mm) { cam.locked = false; cam.x = mm.x; cam.y = mm.y; return; }
    if (e.button === 1) { e.preventDefault(); pan = true; cam.locked = false; return; }
    if (e.button !== 2 && e.button !== 0) return;
    const w = mm || toWorld(e.clientX, e.clientY);
    issueOrder(w);
    if (!mm) moveHeld = { button: e.button, t: 0.15 };
});
// Holding a mouse button keeps steering the champion toward the cursor.
let moveHeld = null;
window.addEventListener('mouseup', (e) => { if (moveHeld && moveHeld.button === e.button) moveHeld = null; });
function applyHeldMove(dt) {
    if (!moveHeld || paused || world.over || !player.alive) return;
    moveHeld.t -= dt;
    if (moveHeld.t > 0) return;
    moveHeld.t = 0.12;
    const w = toWorld(mouse.sx, mouse.sy);
    if (player.order && player.order.type === 'attack' && !player.order.auto) return;
    player.order = { type: 'move', x: w.x, y: w.y };
}

function sendPing(type, w) {
    if (!ping(player, type, clamp(w.x, 0, MAP), clamp(w.y, 0, MAP))) return;
    feed(`${player.name}: ${type === 'help' ? 'Help here!' : 'Danger!'}`, player.team);
    window.nqBuzz && window.nqBuzz(15);
}

function issueOrder(w) {
    if (!player.alive) return;
    player.recall = 0;
    let target = null;
    for (const u of world.units) {
        if (!u.alive || u.team === player.team) continue;
        if (Math.hypot(u.x - w.x, u.y - w.y) <= u.r + 12) { target = u; break; }
    }
    if (target) { player.order = { type: 'attack', target }; fx('click', target.x, target.y, target.r + 8, 0.3, '#ff5a5a'); }
    else { player.order = { type: 'move', x: w.x, y: w.y }; fx('click', w.x, w.y, 14, 0.3, '#3fd18b'); }
}

const keysDown = new Set();
// Key layouts. Arrow keys always move the hero; the WASD layout also moves with WASD
// and shifts abilities to Q E R F (Flash on Shift).
const LAYOUTS = {
    classic: { abil: ['q', 'w', 'e', 'r'], flash: ['d', 'f'], flashLabel: 'D', move: {} },
    wasd: { abil: ['q', 'e', 'r', 'f'], flash: ['shift'], flashLabel: '⇧', move: { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0] } },
};
const ARROWS = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] };
let layoutName = 'classic';
try { if (localStorage.getItem('nq-keys') === 'wasd') layoutName = 'wasd'; } catch (_) {}
const layout = () => LAYOUTS[layoutName];
function setLayout(name) {
    layoutName = name;
    try { localStorage.setItem('nq-keys', name); } catch (_) {}
    keysDown.clear();
    refreshKeyLabels();
    if ($('keys-toggle')) $('keys-toggle').textContent = name === 'wasd' ? 'WASD' : 'QWER';
    banner(name === 'wasd' ? 'WASD movement · abilities on Q E R F · Flash on Shift' : 'Classic keys · arrows move · abilities on Q W E R');
}
window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (!$('shop').classList.contains('hidden')) $('shop').classList.add('hidden'); else if (!world.over) paused = !paused; return; }
    if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    if (paused || world.over || e.repeat) return;
    keysDown.add(k);
    if (ARROWS[k] || layout().move[k]) return;
    const w = toWorld(mouse.sx, mouse.sy);
    const idx = layout().abil.indexOf(k);
    if (idx >= 0) { cast(player, idx, w.x, w.y); hoverAbility = -1; }
    else if (layout().flash.includes(k)) flash(player, w.x, w.y);
    else if (k === 'k') setLayout(layoutName === 'wasd' ? 'classic' : 'wasd');
    else if (k === 'b') { if (player.alive && !inFountain(player, player.team)) { player.recall = 8; player.order = null; } }
    else if (k === 'p') toggleShop();
    else if (k === '1') drinkPotion(player);
    else if (k === 'g') setView(use3D ? '2d' : '3d');
    else if (k === 'y') { cam.locked = !cam.locked; banner(cam.locked ? 'Camera locked' : 'Camera unlocked'); }
    else if (k === 's') { player.order = null; player.recall = 0; player.holdT = 1.5; }
    else if (k === 'a') { const t = nearestEnemy(player, 600); if (t) player.order = { type: 'attack', target: t }; }
});
window.addEventListener('keyup', (e) => keysDown.delete(e.key.toLowerCase()));

/** Direct keyboard movement: steer the hero in screen directions while keys are held. */
let keyMoving = false;
function applyKeyMove() {
    let dx = 0, dy = 0;
    const map = { ...ARROWS, ...layout().move };
    for (const k of keysDown) if (map[k]) { dx += map[k][0]; dy += map[k][1]; }
    if (!player.alive || player.dash || player.stun > 0) return;
    if (dx || dy) {
        const m = Math.hypot(dx, dy);
        player.recall = 0;
        player.order = { type: 'move', x: player.x + dx / m * 200, y: player.y + dy / m * 200 / COS, key: true };
        keyMoving = true;
        cam.locked = true;
    } else if (keyMoving) {
        keyMoving = false;
        if (player.order && player.order.key) player.order = null;
    }
}

if ($('view-toggle')) {
    $('view-toggle').textContent = use3D ? '2D' : '3D';
    if (!webglOK) $('view-toggle').classList.add('hidden');
    $('view-toggle').addEventListener('click', (e) => { setView(use3D ? '2d' : '3d'); e.currentTarget.blur(); });
}
$('d-shop') && $('d-shop').addEventListener('click', () => { toggleShop(); $('d-shop').blur(); });
$('shop-close').addEventListener('click', () => $('shop').classList.add('hidden'));
function toggleShop() {
    $('shop').classList.toggle('hidden');
    renderShop();
}
const shopButtons = ITEMS.map((it) => {
    const b = document.createElement('button');
    b.className = 'shop-item';
    const stats = Object.entries(it.stats).map(([k, v]) => k === 'asBonus' ? `+${v * 100}% AS` : k === 'maxHp' ? `+${v} HP` : k === 'speed' ? `+${v} MS` : `+${v} ${k.toUpperCase()}`).join(', ');
    b.innerHTML = `<b>${it.icon} ${it.name}</b>${stats} · <span>${it.cost}g</span>`;
    b.addEventListener('click', () => { buy(player, it); renderShop(); });
    $('shop-items').appendChild(b);
    return { b, it };
});
const potionBtn = document.createElement('button');
potionBtn.className = 'shop-item';
potionBtn.innerHTML = `<b>🧪 Health Potion</b>Heals ${POTION.heal} HP over ${POTION.dur}s (key 1) · <span>${POTION.cost}g</span>`;
potionBtn.addEventListener('click', () => { buyPotion(player); renderShop(); });
$('shop-items').prepend(potionBtn);
const upHead = document.createElement('h3');
upHead.className = 'shop-sub';
upHead.textContent = 'Troop upgrades (your whole team\'s minions)';
$('shop-items').appendChild(upHead);
const upgradeButtons = TROOP_UPGRADES.map((up) => {
    const b = document.createElement('button');
    b.className = 'shop-item upgrade';
    b.addEventListener('click', () => { buyUpgrade(player, up.id); renderShop(); });
    $('shop-items').appendChild(b);
    return { b, up };
});
function renderShop() {
    const canShop = inFountain(player, player.team) || !player.alive;
    for (const { b, up } of upgradeButtons) {
        const tier = world.upgrades[player.team][up.id], maxed = tier >= up.costs.length;
        b.innerHTML = `<b>${up.icon} ${up.name} <em class="tier">${'★'.repeat(tier)}${'☆'.repeat(up.costs.length - tier)}</em></b>${up.desc} · <span>${maxed ? 'MAX' : up.costs[tier] + 'g'}</span>`;
        b.disabled = !canShop || maxed || player.gold < up.costs[tier];
    }
    potionBtn.disabled = !canShop || player.gold < POTION.cost || player.potions >= POTION.max;
    for (const { b, it } of shopButtons) {
        const owned = it.unique && player.items.some((i) => i.id === it.id);
        b.disabled = !canShop || player.gold < it.cost || player.items.length >= MAX_ITEMS || owned;
    }
}

// Ability bar
const abilEls = player.def.abilities.map((a, i) => {
    const el = document.createElement('div');
    el.className = 'abil';
    el.innerHTML = `<small class="key">${a.key}</small>${a.key}<span class="name">${a.name}</span><div class="cd hidden"></div>`;
    el.addEventListener('mouseenter', () => { hoverAbility = i; });
    el.addEventListener('mouseleave', () => { hoverAbility = -1; });
    $('abilities').appendChild(el);
    return el;
});
const flashEl = document.createElement('div');
flashEl.className = 'abil';
flashEl.innerHTML = '<small class="key">D</small>✦<span class="name">Flash</span><div class="cd hidden"></div>';
$('abilities').appendChild(flashEl);
function refreshKeyLabels() {
    abilEls.forEach((el, i) => { el.querySelector('.key').textContent = layout().abil[i].toUpperCase(); });
    flashEl.querySelector('.key').textContent = layout().flashLabel;
}
refreshKeyLabels();
if ($('keys-toggle')) {
    $('keys-toggle').textContent = layoutName === 'wasd' ? 'WASD' : 'QWER';
    if (isTouch) $('keys-toggle').classList.add('hidden');
    $('keys-toggle').addEventListener('click', (e) => { setLayout(layoutName === 'wasd' ? 'classic' : 'wasd'); e.currentTarget.blur(); });
}
const potionEl = document.createElement('div');
potionEl.className = 'abil potion';
potionEl.innerHTML = '<small>1</small>🧪<span class="name">Potion</span><div class="cd hidden"></div><b class="count">0</b>';
potionEl.addEventListener('click', () => drinkPotion(player));
$('abilities').appendChild(potionEl);
$('t-potion') && $('t-potion').addEventListener('click', () => drinkPotion(player));
$('portrait').style.background = player.def.color;
$('portrait').insertAdjacentText('afterbegin', player.def.letter);

// ---------- Touch controls ----------
const joy = { id: null, cx: 0, cy: 0, dx: 0, dy: 0 };
let touchAim = null, attackHeld = false, attackRetarget = 0;

function pickAttackTarget(range) {
    const near = (filter, r) => nearestEnemy(player, r, (e) => filter(e) && !isInvulnerable(e));
    return near((e) => e.kind === 'champ', range + 60)
        || world.units.filter((e) => e.alive && e.kind === 'minion' && e.team !== player.team && dist(player, e) < range + 150).sort((a, b) => a.hp - b.hp)[0]
        || near((e) => e.kind === 'tower' || e.kind === 'nexus', range + 200)
        || near(() => true, 700);
}
function autoAimPoint(range) {
    const t = nearestEnemy(player, Math.min(range, 1100) + 100, (e) => e.kind === 'champ')
        || nearestEnemy(player, Math.min(range, 1100), (e) => e.kind === 'minion');
    if (t) return { x: t.x, y: t.y };
    const f = player.facing || -Math.PI / 4;
    return { x: player.x + Math.cos(f) * Math.min(range, 600), y: player.y + Math.sin(f) * Math.min(range, 600) };
}
function aimPoint(aim) {
    const mag = Math.hypot(aim.dx, aim.dy);
    const range = aim.range > 2000 ? 1500 : aim.range;
    const k = clamp(mag / 70, 0.25, 1);
    return { x: player.x + aim.dx / mag * range * k, y: player.y + aim.dy / mag * range * k };
}
function useAbility(idx, point) {
    if (idx === 'flash') return flash(player, point.x, point.y);
    cast(player, idx, point.x, point.y);
}

if (isTouch) {
    const joyEl = $('joy'), knob = $('joy-knob'), zone = $('joy-zone');
    const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };
    window.nqBuzz = buzz;
    // Floating joystick: it appears wherever the thumb lands in the left zone.
    zone.addEventListener('pointerdown', (e) => {
        if (joy.id !== null) return;
        e.preventDefault();
        joy.id = e.pointerId; joy.cx = e.clientX; joy.cy = e.clientY;
        joyEl.style.left = (e.clientX - 65) + 'px'; joyEl.style.top = (e.clientY - 65) + 'px';
        joyEl.style.bottom = 'auto'; joyEl.classList.add('active');
        zone.setPointerCapture(e.pointerId);
        joyMove(e);
    });
    zone.addEventListener('pointermove', (e) => joyMove(e));
    zone.addEventListener('pointerup', (e) => { joyEnd(e); joyEl.classList.remove('active'); joyEl.style.left = joyEl.style.top = joyEl.style.bottom = ''; });
    zone.addEventListener('pointercancel', (e) => { joyEnd(e); joyEl.classList.remove('active'); joyEl.style.left = joyEl.style.top = joyEl.style.bottom = ''; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    const joyMove = (e) => {
        if (e.pointerId !== joy.id) return;
        let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
        const m = Math.hypot(dx, dy), max = 50;
        if (m > max) { dx = dx / m * max; dy = dy / m * max; }
        joy.dx = dx / max; joy.dy = dy / max;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const joyEnd = (e) => {
        if (e.pointerId !== joy.id) return;
        joy.id = null; joy.dx = joy.dy = 0; knob.style.transform = '';
        if (player.order && player.order.type === 'move' && player.order.joy) player.order = null;
    };

    document.querySelectorAll('#tbtns [data-abil]').forEach((btn) => {
        const raw = btn.dataset.abil, idx = raw === 'flash' ? 'flash' : +raw;
        const def = idx === 'flash' ? { range: FLASH.range } : player.def.abilities[idx];
        btn.querySelector('.lbl').textContent = idx === 'flash' ? 'Flash' : def.name;
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            btn.setPointerCapture(e.pointerId);
            buzz(8);
            touchAim = { idx, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, range: def.range || 0, self: !!def.self };
        });
        btn.addEventListener('pointermove', (e) => {
            if (!touchAim || touchAim.id !== e.pointerId) return;
            touchAim.dx = e.clientX - touchAim.sx; touchAim.dy = e.clientY - touchAim.sy;
        });
        const release = (e, cancelled) => {
            if (!touchAim || touchAim.id !== e.pointerId) return;
            const aim = touchAim; touchAim = null;
            if (cancelled || paused || world.over) return;
            const dragged = Math.hypot(aim.dx, aim.dy) > 18;
            const point = aim.self ? { x: player.x, y: player.y } : dragged ? aimPoint(aim) : autoAimPoint(aim.range || 400);
            useAbility(aim.idx, point);
        };
        btn.addEventListener('pointerup', (e) => release(e, false));
        btn.addEventListener('pointercancel', (e) => release(e, true));
    });

    const atk = $('t-attack');
    atk.addEventListener('pointerdown', (e) => { e.preventDefault(); atk.setPointerCapture(e.pointerId); buzz(8); attackHeld = true; attackRetarget = 0; });
    const atkEnd = () => { attackHeld = false; };
    atk.addEventListener('pointerup', atkEnd);
    atk.addEventListener('pointercancel', atkEnd);
    $('t-recall').addEventListener('click', () => { if (player.alive && !inFountain(player, player.team)) { player.recall = 8; player.order = null; } });
    $('t-shop').addEventListener('click', toggleShop);
    $('t-pause').addEventListener('click', () => { if (!world.over) paused = !paused; });

    let wentFullscreen = false;
    document.addEventListener('pointerdown', () => {
        if (wentFullscreen) return;
        wentFullscreen = true;
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) Promise.resolve(req.call(el)).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
    }, { once: true });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}

function applyTouchInput(dt) {
    if (!player.alive || player.dash || player.stun > 0) return;
    if (joy.id !== null && Math.hypot(joy.dx, joy.dy) > 0.2) {
        attackHeld = false;
        player.recall = 0;
        player.order = { type: 'move', x: player.x + joy.dx * 200, y: player.y + joy.dy * 200, joy: true };
    }
    if (attackHeld) {
        attackRetarget -= dt;
        const o = player.order;
        if (attackRetarget <= 0 || !o || o.type !== 'attack' || !o.target.alive) {
            attackRetarget = 0.35;
            const t = pickAttackTarget(player.range);
            if (t && !(o && o.type === 'attack' && o.target === t)) { player.order = { type: 'attack', target: t }; player.recall = 0; }
        }
    }
}

let hudT = 0;
function updateHud() {
    const p = player;
    $('clock').textContent = fmtTime(world.time);
    $('score-blue').textContent = world.kills.blue;
    $('score-red').textContent = world.kills.red;
    $('lvl').textContent = p.level;
    $('portrait').classList.toggle('dead', !p.alive);
    $('hp-fill').style.width = (p.hp / p.maxHp * 100) + '%';
    $('hp-text').textContent = p.alive ? `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}${p.shield > 0 ? ` (+${Math.round(p.shield)})` : ''}` : `Respawn in ${Math.ceil(p.respawn)}`;
    $('mp-fill').style.width = (p.maxMana ? p.mana / p.maxMana * 100 : 0) + '%';
    $('mp-text').textContent = p.maxMana ? `${Math.floor(p.mana)} / ${Math.round(p.maxMana)}` : 'No mana';
    $('xp-fill').style.width = (p.level >= MAX_LEVEL ? 100 : p.xp / xpNeeded(p.level) * 100) + '%';
    $('st-ad').textContent = Math.round(p.ad);
    $('st-ap').textContent = Math.round(p.ap);
    $('st-ar').textContent = Math.round(p.armor);
    $('st-as').textContent = currentAs(p).toFixed(2);
    $('st-ms').textContent = Math.round(currentSpeed(p));
    $('kda').textContent = `${p.kills}/${p.deaths}/${p.assists}`;
    if ($('buffs')) {
        const chips = [];
        if (world.buffs[p.team] > world.time) chips.push(`<span class="buff drake">🐉 ${Math.ceil(world.buffs[p.team] - world.time)}s</span>`);
        if (p.golemT > world.time) chips.push(`<span class="buff golem">🗿 ${Math.ceil(p.golemT - world.time)}s</span>`);
        const up = world.upgrades[p.team], tiers = up.dmg + up.hp + up.siege;
        if (tiers) chips.push(`<span class="buff troops" title="Troop upgrades">⚔ T${tiers}</span>`);
        const html = chips.join('');
        if ($('buffs').innerHTML !== html) $('buffs').innerHTML = html;
    }
    potionEl.querySelector('.count').textContent = p.potions;
    potionEl.classList.toggle('ready', p.potions > 0 && p.potionT <= 0);
    potionEl.querySelector('.cd').classList.toggle('hidden', p.potionT <= 0);
    potionEl.querySelector('.cd').textContent = p.potionT > 0 ? Math.ceil(p.potionT) : '';
    if ($('t-potion')) $('t-potion').textContent = `🧪${p.potions}`;
    $('cs').textContent = p.cs;
    $('gold').textContent = Math.floor(p.gold);
    if ($('d-shop')) $('d-shop').classList.toggle('can-buy', p.alive && inFountain(p, p.team) && Object.values(ITEMS).some((it) => it.cost <= p.gold) && $('shop').classList.contains('hidden'));
    if (!$('shop').classList.contains('hidden')) renderShop();
    $('items').innerHTML = Array.from({ length: MAX_ITEMS }, (_, i) => `<div title="${p.items[i] ? p.items[i].name : ''}">${p.items[i] ? p.items[i].icon : ''}</div>`).join('');
    p.def.abilities.forEach((a, i) => {
        const el = abilEls[i], cd = el.querySelector('.cd');
        el.classList.toggle('locked', !!a.ult && p.level < 6);
        el.classList.toggle('nomana', p.mana < a.cost);
        el.classList.toggle('ready', canCast(p, i));
        cd.classList.toggle('hidden', p.cds[i] <= 0);
        cd.textContent = p.cds[i] > 0 ? Math.ceil(p.cds[i]) : '';
    });
    if (isTouch) {
        document.querySelectorAll('#tbtns [data-abil]').forEach((btn) => {
            const raw = btn.dataset.abil, cdEl = btn.querySelector('.cd');
            const cd = raw === 'flash' ? p.flashCd : p.cds[+raw];
            const usable = raw === 'flash' ? p.flashCd <= 0 && p.alive : canCast(p, +raw);
            btn.classList.toggle('ready', usable);
            btn.classList.toggle('locked', raw !== 'flash' && !!p.def.abilities[+raw].ult && p.level < 6);
            cdEl.textContent = cd > 0 ? Math.ceil(cd) : '';
            cdEl.classList.toggle('hidden', cd <= 0);
        });
    }
    const fcd = flashEl.querySelector('.cd');
    flashEl.classList.toggle('ready', p.flashCd <= 0);
    fcd.classList.toggle('hidden', p.flashCd <= 0);
    fcd.textContent = p.flashCd > 0 ? Math.ceil(p.flashCd) : '';
}

// ---------- Rendering ----------
const MAP_SCALE = 0.6;
const TAU = Math.PI * 2;
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const nearLane = (x, y, pad) => Object.values(LANES).some((path) => path.some((p, k) => k > 0 && distToSegment({ x, y }, path[k - 1].x, path[k - 1].y, p.x, p.y) < pad));
const nearRiver = (x, y, pad) => distToSegment({ x, y }, 0, 0, MAP, MAP) < pad;
const nearBase = (x, y, pad) => Math.hypot(x - BASE.blue.x, y - BASE.blue.y) < pad || Math.hypot(x - BASE.red.x, y - BASE.red.y) < pad;

function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const glowCache = {};
function glowSprite(color) {
    if (glowCache[color]) return glowCache[color];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (glowCache[color] = c);
}
function glow(x, y, size, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprite(color), x - size, y - size, size * 2, size * 2);
    ctx.globalAlpha = 1;
}

function ellipse(x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }

const decor = (() => {
    const r = rng(7);
    const trees = [], rocks = [], bushes = [];
    for (let i = 0; i < 560; i++) {
        const x = r() * MAP, y = r() * MAP;
        if (!nearLane(x, y, 250) && !nearRiver(x, y, 230) && !nearBase(x, y, 900)) trees.push({ x, y, r: 26 + r() * 30, hue: r() });
    }
    for (let i = 0; i < 180; i++) {
        const x = r() * MAP, y = r() * MAP;
        if (!nearRiver(x, y, 160) && !nearBase(x, y, 850) && !nearLane(x, y, 90)) rocks.push({ x, y, r: 6 + r() * 14 });
    }
    for (let i = 0; i < 260; i++) {
        const x = r() * MAP, y = r() * MAP;
        if (nearLane(x, y, 200) && !nearLane(x, y, 130) && !nearBase(x, y, 850)) bushes.push({ x, y, r: 14 + r() * 12 });
    }
    return { trees, rocks, bushes };
})();

function prerenderMap(props = true) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(MAP * MAP_SCALE);
    const g = c.getContext('2d');
    g.scale(MAP_SCALE, MAP_SCALE);
    const r = rng(42);

    const base = g.createLinearGradient(0, MAP, MAP, 0);
    base.addColorStop(0, '#22402a'); base.addColorStop(0.5, '#2c5131'); base.addColorStop(1, '#2a3d2c');
    g.fillStyle = base; g.fillRect(0, 0, MAP, MAP);
    for (let i = 0; i < 9000; i++) {
        g.fillStyle = r() < 0.5 ? `rgba(80,130,64,${0.05 + r() * 0.1})` : `rgba(10,30,16,${0.06 + r() * 0.12})`;
        g.beginPath(); g.arc(r() * MAP, r() * MAP, 8 + r() * 44, 0, TAU); g.fill();
    }
    g.lineWidth = 2;
    for (let i = 0; i < 16000; i++) {
        const x = r() * MAP, y = r() * MAP;
        g.strokeStyle = `rgba(${130 + r() * 40},${180 + r() * 40},90,${0.1 + r() * 0.15})`;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 7, y - 6 - r() * 7); g.stroke();
    }

    const river = (w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(-100, -100); g.lineTo(MAP + 100, MAP + 100); g.stroke(); };
    river(340, '#4a4430'); river(300, '#183f56'); river(240, '#1f5a78'); river(140, '#2a7396');
    for (let i = 0; i < 600; i++) {
        const t = r(), off = (r() - 0.5) * 250;
        const x = t * MAP + off / Math.SQRT2, y = t * MAP - off / Math.SQRT2;
        g.strokeStyle = `rgba(210,240,255,${0.06 + r() * 0.12})`; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12 + r() * 22, y + 12 + r() * 22); g.stroke();
    }
    for (const side of [-1, 1]) {
        for (let i = 0; i < 900; i++) {
            const t = r() * 1.05 - 0.02, off = side * (118 + r() * 14);
            const x = t * MAP + off / Math.SQRT2, y = t * MAP - off / Math.SQRT2;
            g.fillStyle = `rgba(225,245,255,${0.12 + r() * 0.25})`;
            g.beginPath(); g.ellipse(x, y, 4 + r() * 10, 2 + r() * 3, Math.PI / 4, 0, TAU); g.fill();
        }
        for (let i = 0; i < 500; i++) {
            const t = r() * 1.05 - 0.02, off = side * (150 + r() * 22);
            const x = t * MAP + off / Math.SQRT2, y = t * MAP - off / Math.SQRT2;
            g.fillStyle = r() < 0.5 ? 'rgba(120,108,74,0.5)' : 'rgba(40,34,22,0.4)';
            g.beginPath(); g.arc(x, y, 2 + r() * 5, 0, TAU); g.fill();
        }
    }
    for (let i = 0; i < 45; i++) {
        const t = r(), off = (r() < 0.5 ? -1 : 1) * (70 + r() * 40);
        const x = t * MAP + off / Math.SQRT2, y = t * MAP - off / Math.SQRT2, pr = 9 + r() * 9, a = r() * TAU;
        g.fillStyle = 'rgba(0,20,30,0.3)'; g.beginPath(); g.arc(x + 2, y + 3, pr, 0, TAU); g.fill();
        g.fillStyle = '#3f7d3a'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, pr, a + 0.5, a + TAU - 0.1); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(130,190,100,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, pr * 0.7, a + 0.6, a + TAU - 0.2); g.stroke();
        if (r() < 0.35) { g.fillStyle = '#f2b6d0'; g.beginPath(); g.arc(x - pr * 0.2, y - pr * 0.2, 3.5, 0, TAU); g.fill(); }
    }

    const lane = (w, col) => {
        for (const path of Object.values(LANES)) {
            g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round';
            g.beginPath(); g.moveTo(path[0].x, path[0].y);
            for (const p of path.slice(1)) g.lineTo(p.x, p.y);
            g.stroke();
        }
    };
    lane(260, 'rgba(30,22,12,0.5)'); lane(225, '#6a573a'); lane(180, '#7f6848'); lane(90, 'rgba(150,125,90,0.25)');
    for (let i = 0; i < 9000; i++) {
        const x = r() * MAP, y = r() * MAP;
        if (!nearLane(x, y, 100)) continue;
        g.fillStyle = r() < 0.5 ? `rgba(55,40,24,${0.25 + r() * 0.3})` : `rgba(170,150,115,${0.2 + r() * 0.3})`;
        g.beginPath(); g.arc(x, y, 1.5 + r() * 4, 0, TAU); g.fill();
    }
    for (const path of Object.values(LANES)) {
        for (let k = 1; k < path.length; k++) {
            const a = path[k - 1], b = path[k], len = Math.hypot(b.x - a.x, b.y - a.y);
            const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
            for (const o of [-34, 34]) {
                g.strokeStyle = 'rgba(50,36,20,0.28)'; g.lineWidth = 9;
                g.beginPath(); g.moveTo(a.x + nx * o, a.y + ny * o); g.lineTo(b.x + nx * o, b.y + ny * o); g.stroke();
                g.strokeStyle = 'rgba(190,165,120,0.12)'; g.lineWidth = 3;
                g.beginPath(); g.moveTo(a.x + nx * (o + 6), a.y + ny * (o + 6)); g.lineTo(b.x + nx * (o + 6), b.y + ny * (o + 6)); g.stroke();
            }
            for (let d = 0; d < len; d += 26 + r() * 18) {
                const x0 = a.x + (b.x - a.x) * d / len, y0 = a.y + (b.y - a.y) * d / len;
                for (const sd of [-1, 1]) {
                    const off = sd * (108 + r() * 10), sx = x0 + nx * off, sy = y0 + ny * off;
                    if (nearBase(sx, sy, 820)) continue;
                    if (nearRiver(sx, sy, 160)) continue;
                    const sr = 6 + r() * 7;
                    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(sx + 2, sy + 3, sr, sr * 0.75, 0, 0, TAU); g.fill();
                    const v = 100 + r() * 40 | 0;
                    g.fillStyle = `rgb(${v},${v - 4},${v - 12})`; g.beginPath(); g.ellipse(sx, sy, sr, sr * 0.75, r() * 3, 0, TAU); g.fill();
                    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(sx - sr * 0.3, sy - sr * 0.3, sr * 0.4, sr * 0.25, 0, 0, TAU); g.fill();
                }
            }
        }
    }
    const flowers = ['#f3e27a', '#f2f2f2', '#e98fb7', '#a8c4ff'];
    for (let i = 0; i < 1500; i++) {
        const x = r() * MAP, y = r() * MAP;
        if (nearLane(x, y, 140) || nearRiver(x, y, 190) || nearBase(x, y, 880)) continue;
        const cx = x, cy = y, col = flowers[r() * flowers.length | 0];
        for (let j = 0; j < 3 + r() * 4; j++) {
            g.fillStyle = col; g.globalAlpha = 0.75;
            g.beginPath(); g.arc(cx + (r() - 0.5) * 26, cy + (r() - 0.5) * 18, 1.6 + r() * 1.6, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
    }

    for (const team of [BLUE, RED]) {
        const b = BASE[team], col = TEAM_COLOR[team];
        const pg = g.createRadialGradient(b.x, b.y, 100, b.x, b.y, 860);
        pg.addColorStop(0, '#6f7482'); pg.addColorStop(0.78, '#4b505b'); pg.addColorStop(1, 'rgba(60,64,72,0)');
        g.fillStyle = pg; g.beginPath(); g.arc(b.x, b.y, 860, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(25,28,36,0.35)'; g.lineWidth = 3;
        for (let rr = 160; rr < 780; rr += 110) { g.beginPath(); g.arc(b.x, b.y, rr, 0, TAU); g.stroke(); }
        for (let a = 0; a < 28; a++) {
            const ang = a / 28 * TAU;
            g.beginPath(); g.moveTo(b.x + Math.cos(ang) * 160, b.y + Math.sin(ang) * 160); g.lineTo(b.x + Math.cos(ang) * 770, b.y + Math.sin(ang) * 770); g.stroke();
        }
        const fg = g.createRadialGradient(b.x, b.y, 20, b.x, b.y, FOUNTAIN_R);
        fg.addColorStop(0, team === BLUE ? 'rgba(130,190,255,0.45)' : 'rgba(255,150,150,0.45)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = fg; g.beginPath(); g.arc(b.x, b.y, FOUNTAIN_R, 0, TAU); g.fill();
        g.strokeStyle = col; g.lineWidth = 6; g.setLineDash([34, 18]);
        g.beginPath(); g.arc(b.x, b.y, FOUNTAIN_R, 0, TAU); g.stroke(); g.setLineDash([]);
    }

    for (const k of decor.bushes) {
        for (const [dx, dy, s] of [[0, 0, 1], [-0.7, 0.2, 0.7], [0.7, 0.25, 0.7]]) {
            const x = k.x + dx * k.r, y = k.y + dy * k.r, rr = k.r * s;
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + 3, y + 5, rr, rr * 0.7, 0, 0, TAU); g.fill();
            const bg = g.createRadialGradient(x - rr * 0.3, y - rr * 0.4, 1, x, y, rr);
            bg.addColorStop(0, '#5f9a4a'); bg.addColorStop(1, '#244a24');
            g.fillStyle = bg; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
        }
    }
    if (props) for (const k of decor.rocks) {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(k.x + 3, k.y + 4, k.r, k.r * 0.7, 0, 0, TAU); g.fill();
        g.fillStyle = '#7a7d85'; g.beginPath(); g.ellipse(k.x, k.y, k.r, k.r * 0.75, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.ellipse(k.x - k.r * 0.3, k.y - k.r * 0.3, k.r * 0.4, k.r * 0.28, 0, 0, TAU); g.fill();
    }
    if (props) for (const t of decor.trees) {
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(t.x + t.r * 0.4, t.y + t.r * 0.5, t.r * 1.1, t.r * 0.75, 0, 0, TAU); g.fill();
        g.fillStyle = '#4a3420'; g.fillRect(t.x - 4, t.y, 8, t.r * 0.5);
        const h = 105 + t.hue * 35;
        const tg = g.createRadialGradient(t.x - t.r * 0.4, t.y - t.r * 0.5, t.r * 0.1, t.x, t.y, t.r * 1.1);
        tg.addColorStop(0, `hsl(${h},45%,40%)`); tg.addColorStop(1, `hsl(${h},50%,14%)`);
        g.fillStyle = tg;
        for (const [dx, dy, s] of [[-0.45, 0.15, 0.65], [0.45, 0.2, 0.6], [0, -0.4, 0.62], [0, 0, 1]]) {
            g.beginPath(); g.arc(t.x + dx * t.r, t.y + dy * t.r, t.r * s, 0, TAU); g.fill();
        }
    }
    return c;
}
const mapCache = {};
const getMap = (props) => mapCache[props] || (mapCache[props] = prerenderMap(props));

function drawMap(view) {
    const sx = Math.max(0, view.x0), sy = Math.max(0, view.y0);
    const ex = Math.min(MAP, view.x1), ey = Math.min(MAP, view.y1);
    ctx.fillStyle = '#0d1a10'; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    if (ex > sx && ey > sy) ctx.drawImage(getMap(true), sx * MAP_SCALE, sy * MAP_SCALE, (ex - sx) * MAP_SCALE, (ey - sy) * MAP_SCALE, sx, sy, ex - sx, ey - sy);
    // Moving glints on the river.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
        const t = ((i * 0.0247 + world.time * 0.006) % 1), off = Math.sin(i * 12.9) * 100;
        const x = t * MAP + off / Math.SQRT2, y = t * MAP - off / Math.SQRT2;
        if (x < view.x0 - 50 || x > view.x1 + 50 || y < view.y0 - 50 || y > view.y1 + 50) continue;
        glow(x, y, 26, 'rgba(140,210,255,0.6)', 0.25 + 0.2 * Math.sin(world.time * 3 + i));
    }
    ctx.globalCompositeOperation = 'source-over';
}

// ---------- Particles ----------
const particles = [];
const dusts = [], ghosts = [], impacts = [], coins = [], pillars = [];
let prevProj = [];
const clouds = [];
for (let i = 0; i < 9; i++) clouds.push({ x: Math.random() * 4000, y: Math.random() * 4000, r: 350 + Math.random() * 400, v: 18 + Math.random() * 14 });
function emit(x, y, n, color, speed = 200, life = 0.5, size = 3, gravity = 0) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.7);
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.4), max: life, color, size, g: gravity });
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900);
}
function updateParticles(dt) {
    const drag = Math.pow(0.04, dt);
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= drag; p.vy = p.vy * drag + p.g * dt;
    }
}
function drawParticles() {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
        const k = p.life / p.max;
        glow(p.x, p.y, p.size * (1 + k) * 2.2, p.color, k);
    }
    ctx.globalCompositeOperation = 'source-over';
}
let shakeT = 0, shakeMag = 0;
const shockwaves = [];
function shake(mag, dur) { if (mag >= shakeMag || shakeT <= 0) { shakeMag = mag; shakeT = dur; } }
const motes = [];
for (let i = 0; i < 70; i++) motes.push({ x: Math.random(), y: Math.random(), ph: Math.random() * TAU, s: 0.5 + Math.random() });
fxEvent = (type, u, extra) => {
    if (type === 'hit') {
        u.flashT = 0.12;
        if (u.isPlayer) shake(4, 0.15);
        const col = extra === 'magic' ? 'rgba(200,150,255,0.9)' : extra === 'true' ? 'rgba(255,255,255,0.9)' : 'rgba(255,190,90,0.9)';
        emit(u.x, u.y - u.r * 0.3, u.kind === 'champ' ? 6 : 3, col, 220, 0.35, 2.5);
    } else if (type === 'death') {
        const n = u.kind === 'tower' ? 60 : u.kind === 'nexus' ? 140 : u.kind === 'champ' ? 36 : 12;
        emit(u.x, u.y, n, TEAM_COLOR[u.team], u.kind === 'minion' ? 160 : 380, u.kind === 'minion' ? 0.5 : 1.1, u.kind === 'minion' ? 3 : 5);
        emit(u.x, u.y, n / 2, 'rgba(160,160,170,0.5)', 120, 1.2, 6, -40);
        if (u.kind !== 'minion') {
            shockwaves.push({ x: u.x, y: u.y, t: 0, dur: u.kind === 'nexus' ? 1.4 : 0.8, r: u.kind === 'nexus' ? 600 : u.kind === 'tower' ? 320 : 140, color: TEAM_COLOR[u.team] });
            const near = Math.hypot(u.x - cam.x, u.y - cam.y) < 900;
            if (near) shake(u.kind === 'nexus' ? 18 : u.kind === 'tower' ? 12 : u.isPlayer ? 8 : 5, u.kind === 'champ' ? 0.3 : 0.6);
        }
    } else if (type === 'levelup') {
        emit(u.x, u.y, 30, 'rgba(255,215,90,0.9)', 160, 1, 3, -120);
        shockwaves.push({ x: u.x, y: u.y, t: 0, dur: 0.7, r: 110, color: '#ffd75a' });
        pillars.push({ u, t: 0, dur: 1.1 });
    } else if (type === 'gold') {
        for (let i = 0; i < 6; i++) coins.push({ x: u.x + (Math.random() - 0.5) * 20, y: u.y, vx: (Math.random() - 0.5) * 260, vy: -180 - Math.random() * 160, t: 0, to: extra });
    }
};

// ---------- Units ----------
function walkPhase(u, dt) {
    const step = u._px !== undefined ? Math.hypot(u.x - u._px, u.y - u._py) : 0;
    const moved = step > 0.2;
    u.spd = dt > 0 ? step / dt : 0;
    u._px = u.x; u._py = u.y;
    if (u.kind === 'champ' && moved) {
        u.dustT = (u.dustT || 0) - dt;
        if (u.dustT <= 0) { u.dustT = 0.16; dusts.push({ x: u.x + (Math.random() - 0.5) * 8, y: u.y + u.r * 0.5, t: 0, dur: 0.6, s: 4 + Math.random() * 3 }); }
        if (u.spd > 700 && u.spd < 5000) ghosts.push({ u, x: u.x, y: u.y, t: 0, dur: 0.3 });
    }
    if (moved) u.walkT = (u.walkT || 0) + dt;
    u.atkAnim = Math.max(0, (u.atkAnim || 0) - dt);
    return moved;
}

function hpBar(u, w, yOff, color, opts = {}) {
    const x = u.x - w / 2, y = u.y - u.r - yOff, h = opts.h || 6;
    const frac = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = 'rgba(5,8,14,0.85)';
    ctx.beginPath(); ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 3); ctx.fill();
    // Recently lost health trails behind in a lighter color.
    u._hpTrail = Math.max(frac, (u._hpTrail ?? frac) - 0.6 * (opts.dt || 0.016));
    ctx.fillStyle = 'rgba(255,240,200,0.6)'; ctx.fillRect(x, y, w * u._hpTrail, h);
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, shade(color, 0.3)); gr.addColorStop(1, shade(color, -0.25));
    ctx.fillStyle = gr; ctx.fillRect(x, y, w * frac, h);
    if (u.shield > 0) { ctx.fillStyle = 'rgba(235,242,255,0.9)'; ctx.fillRect(x + w * frac, y, Math.min(w * (1 - frac), w * u.shield / u.maxHp), h); }
    if (opts.ticks) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        const step = u.maxHp > 2000 ? 500 : 100;
        for (let v = step; v < u.maxHp; v += step) ctx.fillRect(x + w * v / u.maxHp, y, v % 1000 === 0 ? 1.5 : 1, h * (v % 1000 === 0 ? 1 : 0.6));
    }
    if (opts.mana && u.maxMana > 0) {
        ctx.fillStyle = 'rgba(5,8,14,0.85)'; ctx.fillRect(x - 2, y + h + 1, w + 4, 4);
        ctx.fillStyle = '#5b8fff'; ctx.fillRect(x, y + h + 2, w * u.mana / u.maxMana, 2);
    }
    return { x, y };
}

function drawWeapon(u, r) {
    const swing = u.atkAnim > 0 ? Math.sin((1 - u.atkAnim / 0.25) * Math.PI) : 0;
    if (u.key === 'vanguard') {
        ctx.save(); ctx.translate(r * 0.15, r * 0.75); ctx.rotate(-0.9 + swing * 1.8);
        ctx.fillStyle = '#5a4630'; ctx.fillRect(-3, -3, 12, 6);
        ctx.fillStyle = '#c9a54a'; ctx.fillRect(8, -8, 4, 16);
        const bg = ctx.createLinearGradient(0, -4, 0, 4); bg.addColorStop(0, '#f2f5fb'); bg.addColorStop(1, '#8e98a8');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(12, -4); ctx.lineTo(r * 1.6, -2); ctx.lineTo(r * 1.75, 0); ctx.lineTo(r * 1.6, 2); ctx.lineTo(12, 4); ctx.fill();
        ctx.restore();
        // Shield on the off-hand.
        ctx.save(); ctx.translate(r * 0.35, -r * 0.8);
        ellipse(0, 0, r * 0.28, r * 0.5, '#2f5fb8', '#c9a54a', 2.5);
        ctx.restore();
    } else if (u.key === 'arcanist') {
        ctx.save(); ctx.translate(r * 0.2, r * 0.75); ctx.rotate(-0.15 - swing * 0.4);
        ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 1.4, 0); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        glow(r * 1.5, 0, 14 + swing * 10 + Math.sin(world.time * 6) * 2, 'rgba(190,120,255,0.9)');
        ctx.globalCompositeOperation = 'source-over';
        circle(r * 1.5, 0, 5, '#f0dcff');
        ctx.restore();
    } else {
        ctx.save(); ctx.translate(r * 0.85, 0);
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * 0.95, -1.1, 1.1); ctx.stroke();
        const pull = u.atkAnim > 0 ? (u.atkAnim / 0.25) * r * 0.4 : 0;
        ctx.strokeStyle = 'rgba(240,240,240,0.8)'; ctx.lineWidth = 1.2;
        const ex = -r * 0.2 + Math.cos(1.1) * r * 0.95, ey = Math.sin(1.1) * r * 0.95;
        ctx.beginPath(); ctx.moveTo(ex, -ey); ctx.lineTo(-pull, 0); ctx.lineTo(ex, ey); ctx.stroke();
        if (u.atkAnim > 0) { ctx.strokeStyle = '#e8e2c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-pull, 0); ctx.lineTo(r * 0.9, 0); ctx.stroke(); }
        ctx.restore();
    }
}

function drawChampion(u, dt) {
    const col = TEAM_COLOR[u.team], ally = u.team === player.team;
    const moving = walkPhase(u, dt);
    const r = u.r;
    const bob = moving ? Math.abs(Math.sin(u.walkT * 12)) * 3 : Math.sin(world.time * 2 + u.id) * 1;
    const facing = u.spin > 0 ? world.time * 22 : (u.facing || 0);

    ellipse(u.x, u.y + r * 0.55, r * 1.05, r * 0.42, 'rgba(0,0,0,0.38)');
    ctx.globalCompositeOperation = 'lighter';
    glow(u.x, u.y, r * 2.3, TEAM_COLOR[u.team], 0.22 + 0.06 * Math.sin(world.time * 3 + u.id));
    ctx.globalCompositeOperation = 'source-over';
    if (u.isPlayer) {
        const p = 0.5 + 0.5 * Math.sin(world.time * 4);
        ellipse(u.x, u.y + r * 0.5, r * 1.3 + p * 3, r * 0.55 + p, null, `rgba(255,215,90,${0.55 + p * 0.4})`, 3);
    } else {
        ellipse(u.x, u.y + r * 0.5, r * 1.2, r * 0.5, null, ally ? 'rgba(79,140,255,0.8)' : 'rgba(255,90,90,0.8)', 2.5);
    }
    if (u.rapid > 0) { ctx.globalCompositeOperation = 'lighter'; glow(u.x, u.y, r * 2, 'rgba(80,255,150,0.5)', 0.5); ctx.globalCompositeOperation = 'source-over'; }

    const y = u.y - 4 - bob;
    ctx.save(); ctx.translate(u.x, y); ctx.rotate(facing);
    const body = u.def.color;
    // Cape / back plate.
    ctx.fillStyle = shade(col, -0.35);
    ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.8); ctx.quadraticCurveTo(-r * 1.4, 0, -r * 0.2, r * 0.8); ctx.closePath(); ctx.fill();
    const bg = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
    bg.addColorStop(0, shade(body, 0.45)); bg.addColorStop(0.7, body); bg.addColorStop(1, shade(body, -0.45));
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * 0.98, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(body, -0.55); ctx.lineWidth = 2; ctx.stroke();
    // Shoulder pads.
    for (const s of [-1, 1]) {
        const sg = ctx.createRadialGradient(0, s * r * 0.7, 1, 0, s * r * 0.7, r * 0.35);
        sg.addColorStop(0, '#e9edf5'); sg.addColorStop(1, '#6c7484');
        circle(0, s * r * 0.72, r * 0.3, sg);
    }
    drawWeapon(u, r);
    const hg = ctx.createRadialGradient(r * 0.05, -r * 0.12, 1, r * 0.1, 0, r * 0.45);
    if (u.key === 'arcanist') { hg.addColorStop(0, '#8d5ad6'); hg.addColorStop(1, '#2d1650'); }
    else if (u.key === 'ranger') { hg.addColorStop(0, '#5fbf6e'); hg.addColorStop(1, '#1d4a26'); }
    else { hg.addColorStop(0, '#f1f3f8'); hg.addColorStop(1, '#69717f'); }
    circle(r * 0.1, 0, r * 0.42, hg);
    ctx.fillStyle = u.key === 'vanguard' ? '#1a1f2a' : '#f2d2b0';
    ctx.fillRect(r * 0.32, -r * 0.18, r * 0.14, r * 0.36);
    ctx.restore();

    if (u.spin > 0) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
            const a = world.time * 16 + i * 2.1;
            ctx.strokeStyle = `rgba(255,215,90,${0.5 - i * 0.12})`; ctx.lineWidth = 6 - i;
            ctx.beginPath(); ctx.arc(u.x, u.y, 140 + i * 28, a, a + 1.2); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
    }
    if (u.shield > 0) {
        const sg = ctx.createRadialGradient(u.x, y, r * 0.6, u.x, y, r * 1.5);
        sg.addColorStop(0, 'rgba(160,210,255,0)'); sg.addColorStop(1, 'rgba(160,210,255,0.45)');
        circle(u.x, y, r * 1.5, sg);
    }
    if (u.recall > 0) {
        const k = 1 - u.recall / 8;
        ctx.strokeStyle = '#7fb4ff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(u.x, u.y, r + 16, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
        if (Math.random() < 0.5) emit(u.x + (Math.random() - 0.5) * r * 2, u.y + r * 0.5, 1, 'rgba(120,180,255,0.9)', 20, 0.8, 3, -160);
    }
    if (u.stun > 0) {
        for (let i = 0; i < 3; i++) {
            const a = world.time * 6 + i * TAU / 3;
            ctx.fillStyle = '#ffe98a'; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
            ctx.fillText('★', u.x + Math.cos(a) * 18, y - r - 34 + Math.sin(a) * 5);
        }
    }

    champLabel(u, dt);
}
function champLabel(u, dt) {
    const ally = u.team === player.team;
    const bar = hpBar(u, 74, 22, u.isPlayer ? '#4fd16a' : ally ? '#4f8cff' : '#e84a4a', { ticks: true, mana: true, h: 7, dt });
    circle(bar.x - 9, bar.y + 4, 9, '#0b111d');
    ctx.strokeStyle = '#c8a95a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bar.x - 9, bar.y + 4, 9, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.level, bar.x - 9, bar.y + 4.5);
    ctx.textBaseline = 'alphabetic'; ctx.font = '600 12px system-ui';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(u.name, u.x, bar.y - 5);
    ctx.fillStyle = u.isPlayer ? '#ffe9a8' : '#fff'; ctx.fillText(u.name, u.x, bar.y - 5);
}

function drawMinion(u, dt) {
    const col = TEAM_COLOR[u.team], ally = u.team === player.team;
    const moving = walkPhase(u, dt);
    const r = u.r, f = u.facing || (u.team === BLUE ? -Math.PI / 4 : Math.PI * 0.75);
    const bob = moving ? Math.abs(Math.sin(u.walkT * 14 + u.id)) * 2 : 0;
    ellipse(u.x, u.y + r * 0.55, r, r * 0.4, 'rgba(0,0,0,0.35)');
    ctx.save(); ctx.translate(u.x, u.y - bob); ctx.rotate(f);
    if (u.mtype === 'cannon') {
        ctx.fillStyle = '#3b3f48';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.roundRect(-r * 0.8, s * r * 0.75 - 4, r * 1.6, 8, 3); ctx.fill(); }
        const cg = ctx.createLinearGradient(0, -r, 0, r); cg.addColorStop(0, shade(col, 0.3)); cg.addColorStop(1, shade(col, -0.4));
        ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(-r * 0.7, -r * 0.6, r * 1.4, r * 1.2, 4); ctx.fill();
        ctx.fillStyle = '#2a2d33'; ctx.fillRect(0, -4, r * 1.3 - (u.atkAnim > 0 ? 5 : 0), 8);
        circle(0, 0, r * 0.35, '#5b616d');
    } else {
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
        g.addColorStop(0, shade(col, 0.4)); g.addColorStop(1, shade(col, -0.45));
        circle(0, 0, r, g);
        if (u.mtype === 'melee') {
            const swing = u.atkAnim > 0 ? Math.sin((1 - u.atkAnim / 0.25) * Math.PI) : 0;
            ctx.save(); ctx.translate(0, r * 0.7); ctx.rotate(-0.6 + swing * 1.4);
            ctx.fillStyle = '#d6dbe4'; ctx.fillRect(0, -1.5, r * 1.1, 3); ctx.restore();
        } else {
            ctx.globalCompositeOperation = 'lighter';
            glow(r * 0.9, 0, 8 + (u.atkAnim > 0 ? 6 : 0), ally ? 'rgba(120,170,255,0.9)' : 'rgba(255,130,130,0.9)');
            ctx.globalCompositeOperation = 'source-over';
        }
        circle(r * 0.2, 0, r * 0.45, shade(col, -0.2));
    }
    ctx.restore();
    if (u.hp < u.maxHp) hpBar(u, 32, 8, ally ? '#4fd16a' : '#e84a4a', { h: 4, dt });
}

function drawTower(u, dt) {
    const col = TEAM_COLOR[u.team], ally = u.team === player.team;
    if (!u.alive) {
        ellipse(u.x, u.y + 14, 46, 20, 'rgba(0,0,0,0.35)');
        const r = rng(u.id * 97);
        for (let i = 0; i < 9; i++) {
            ctx.fillStyle = i % 2 ? '#4c4f57' : '#666a73';
            ctx.beginPath(); ctx.ellipse(u.x + (r() - 0.5) * 70, u.y + (r() - 0.3) * 30, 8 + r() * 10, 6 + r() * 6, r() * 3, 0, TAU); ctx.fill();
        }
        return;
    }
    if (u.team !== player.team && dist(player, u) < u.range + 300) {
        const danger = u.order && u.order.target === player;
        ctx.strokeStyle = danger ? 'rgba(255,60,60,0.85)' : 'rgba(255,90,90,0.35)'; ctx.lineWidth = danger ? 4 : 2.5;
        ctx.setLineDash([16, 10]); ctx.beginPath(); ctx.arc(u.x, u.y, u.range, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    ellipse(u.x + 10, u.y + 26, 50, 22, 'rgba(0,0,0,0.4)');
    // Octagonal stone base.
    const bg = ctx.createLinearGradient(u.x - 40, u.y - 40, u.x + 40, u.y + 40);
    bg.addColorStop(0, '#9aa0ab'); bg.addColorStop(1, '#4b505a');
    ctx.fillStyle = bg; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; ctx.lineTo(u.x + Math.cos(a) * 42, u.y + 6 + Math.sin(a) * 30); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#30343c'; ctx.lineWidth = 2; ctx.stroke();
    // Pillar.
    const pg = ctx.createLinearGradient(u.x - 18, 0, u.x + 18, 0);
    pg.addColorStop(0, '#5d626d'); pg.addColorStop(0.45, '#b5bac4'); pg.addColorStop(1, '#4a4e57');
    ctx.fillStyle = pg; ctx.fillRect(u.x - 17, u.y - 44, 34, 52);
    ellipse(u.x, u.y - 44, 17, 7, '#c9ced7');
    ctx.fillStyle = shade(col, -0.2); ctx.fillRect(u.x - 17, u.y - 20, 34, 6);
    // Floating crystal.
    const cy = u.y - 72 + Math.sin(world.time * 2 + u.id) * 4;
    const heat = u.order && u.order.target ? 1 : 0;
    ctx.globalCompositeOperation = 'lighter';
    glow(u.x, cy, 34 + heat * 10, ally ? 'rgba(90,150,255,0.8)' : 'rgba(255,90,90,0.8)', 0.8);
    ctx.globalCompositeOperation = 'source-over';
    const cg = ctx.createLinearGradient(u.x - 12, cy - 20, u.x + 12, cy + 20);
    cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.4, shade(col, 0.3)); cg.addColorStop(1, shade(col, -0.4));
    ctx.fillStyle = cg; ctx.beginPath();
    ctx.moveTo(u.x, cy - 22); ctx.lineTo(u.x + 12, cy); ctx.lineTo(u.x, cy + 18); ctx.lineTo(u.x - 12, cy); ctx.closePath(); ctx.fill();
    if (heat && u.order.target.alive) {
        const t = u.order.target;
        ctx.strokeStyle = ally ? 'rgba(120,170,255,0.25)' : 'rgba(255,120,120,0.25)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(u.x, cy); ctx.lineTo(t.x, t.y); ctx.stroke();
    }
    if (isInvulnerable(u)) {
        ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(u.x, u.y - 20, 60, 0, TAU); ctx.stroke();
    }
    const saved = u.r; u.r = 92;
    hpBar(u, 84, 0, ally ? '#4fd16a' : '#e84a4a', { ticks: true, h: 7, dt });
    u.r = saved;
}

function drawNexus(u, dt) {
    const col = TEAM_COLOR[u.team], ally = u.team === player.team, t = world.time;
    ellipse(u.x, u.y + 30, 110, 45, 'rgba(0,0,0,0.4)');
    const pg = ctx.createRadialGradient(u.x, u.y + 10, 10, u.x, u.y + 10, 110);
    pg.addColorStop(0, '#a3a8b4'); pg.addColorStop(1, '#3f434c');
    ellipse(u.x, u.y + 14, 108, 52, pg, '#2a2d34', 3);
    ellipse(u.x, u.y + 10, 80, 36, null, shade(col, -0.1), 3);
    if (!u.alive) {
        for (let i = 0; i < 6; i++) { const a = i * 1.1; ellipse(u.x + Math.cos(a) * 40, u.y + Math.sin(a) * 18, 18, 10, '#2e3138'); }
        return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
    const cy = u.y - 50 + Math.sin(t * 1.5) * 5;
    ctx.globalCompositeOperation = 'lighter';
    glow(u.x, cy, 110 + pulse * 20, ally ? 'rgba(80,140,255,0.7)' : 'rgba(255,80,80,0.7)', 0.7);
    ctx.globalCompositeOperation = 'source-over';
    // Rotating rings behind and in front of the crystal.
    const ring = (front) => {
        for (let i = 0; i < 2; i++) {
            const a = t * (i ? -0.9 : 0.6);
            ctx.strokeStyle = `rgba(255,255,255,${front ? 0.55 : 0.2})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(u.x, cy + 10, 90 - i * 18, 26 - i * 6, 0, front ? a : a + Math.PI, (front ? a : a + Math.PI) + Math.PI); ctx.stroke();
        }
    };
    ring(false);
    const cg = ctx.createLinearGradient(u.x - 40, cy - 70, u.x + 40, cy + 60);
    cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.35, shade(col, 0.35)); cg.addColorStop(0.7, col); cg.addColorStop(1, shade(col, -0.55));
    ctx.fillStyle = cg; ctx.beginPath();
    ctx.moveTo(u.x, cy - 75); ctx.lineTo(u.x + 38, cy - 15); ctx.lineTo(u.x + 26, cy + 45); ctx.lineTo(u.x, cy + 62);
    ctx.lineTo(u.x - 26, cy + 45); ctx.lineTo(u.x - 38, cy - 15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath();
    ctx.moveTo(u.x, cy - 75); ctx.lineTo(u.x - 38, cy - 15); ctx.lineTo(u.x - 6, cy); ctx.closePath(); ctx.fill();
    ring(true);
    if (isInvulnerable(u)) {
        const dg = ctx.createRadialGradient(u.x, u.y - 20, 60, u.x, u.y - 20, 130);
        dg.addColorStop(0, 'rgba(200,220,255,0)'); dg.addColorStop(1, `rgba(200,220,255,${0.18 + pulse * 0.1})`);
        circle(u.x, u.y - 20, 130, dg);
    }
    const saved = u.r; u.r = 150;
    hpBar(u, 150, 0, ally ? '#4fd16a' : '#e84a4a', { ticks: true, h: 9, dt });
    u.r = saved;
}

function drawMonster(u, dt) {
    const m = MONSTERS[u.mkey], t = world.time, r = u.r;
    walkPhase(u, dt);
    ellipse(u.x, u.y + r * 0.6, r * 1.1, r * 0.45, 'rgba(0,0,0,0.35)');
    ctx.save(); ctx.translate(u.x, u.y);
    if (u.mkey === 'drake') {
        const flap = Math.sin(t * 6) * 0.35;
        for (const sgn of [-1, 1]) {
            ctx.save(); ctx.scale(sgn, 1); ctx.rotate(-0.3 + flap);
            ctx.fillStyle = shade(m.color, -0.35); ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.2); ctx.lineTo(r * 1.9, -r * 1.1); ctx.lineTo(r * 1.5, -r * 0.1); ctx.lineTo(r * 1.1, r * 0.2); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        ctx.fillStyle = m.color; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r * 0.95, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = shade(m.color, 0.25); ctx.beginPath(); ctx.arc(0, -r * 0.85, r * 0.45, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff4a0'; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.95, 4, 0, TAU); ctx.arc(r * 0.15, -r * 0.95, 4, 0, TAU); ctx.fill();
    } else {
        ctx.fillStyle = '#6c7380'; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU); ctx.fill();
        ctx.fillStyle = '#868d9a'; for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(sgn * r * 0.95, -r * 0.1 + Math.sin(t * 3 + sgn) * 3, r * 0.42, 0, TAU); ctx.fill(); }
        ctx.fillStyle = m.color; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 4); ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
    hpBar(u, 90, 14, '#f0a040', { h: 6, dt });
}

function drawUnit(u, dt) {
    if (u.kind === 'monster') { if (u.alive) drawMonster(u, dt); return; }
    if (u.kind === 'tower') drawTower(u, dt);
    else if (u.kind === 'nexus') drawNexus(u, dt);
    else if (!u.alive) return;
    else if (u.kind === 'minion') drawMinion(u, dt);
    else drawChampion(u, dt);
    if (u.flashT > 0 && u.alive) {
        u.flashT -= dt;
        ctx.globalCompositeOperation = 'lighter';
        glow(u.x, u.y - u.r * 0.2, u.r * 2.2, 'rgba(255,255,255,0.8)', Math.max(0, u.flashT / 0.12) * 0.7);
        ctx.globalCompositeOperation = 'source-over';
    }
}

function drawLights(view) {
    ctx.globalCompositeOperation = 'lighter';
    for (const u of world.units) {
        if (!u.alive || (u.kind !== 'tower' && u.kind !== 'nexus')) continue;
        if (u.x < view.x0 - 400 || u.x > view.x1 + 400 || u.y < view.y0 - 400 || u.y > view.y1 + 400) continue;
        const flick = 0.85 + 0.15 * Math.sin(world.time * 3 + u.id);
        glow(u.x, u.y, u.kind === 'nexus' ? 420 : 260, TEAM_COLOR[u.team], 0.08 * flick);
    }
    for (const t of [BLUE, RED]) glow(BASE[t].x, BASE[t].y, 520, TEAM_COLOR[t], 0.05);
    ctx.globalCompositeOperation = 'source-over';
}

function drawGround(dt) {
    for (let i = dusts.length - 1; i >= 0; i--) {
        const d = dusts[i]; d.t += dt;
        if (d.t >= d.dur) { dusts.splice(i, 1); continue; }
        const k = d.t / d.dur;
        ctx.globalAlpha = 0.35 * (1 - k);
        ellipse(d.x, d.y - k * 6, d.s * (1 + k * 1.6), d.s * (0.6 + k), '#d9c9a3');
    }
    ctx.globalAlpha = 1;
    if (dusts.length > 200) dusts.splice(0, dusts.length - 200);
}

function drawTowerBeams() {
    ctx.globalCompositeOperation = 'lighter';
    for (const u of world.units) {
        if (u.kind !== 'tower' || !u.alive || !u.order || !u.order.target) continue;
        const t = u.order.target;
        if (!t.alive || Math.hypot(t.x - u.x, t.y - u.y) > u.range + t.r + 10) continue;
        const cy = use3D ? u.y - lift(125) : u.y - 72 + Math.sin(world.time * 2 + u.id) * 4;
        const col = t === player ? 'rgba(255,70,70,' : u.team === player.team ? 'rgba(110,170,255,' : 'rgba(255,120,120,';
        const fl = 0.5 + 0.5 * Math.sin(world.time * 30 + u.id);
        ctx.strokeStyle = col + (0.18 + fl * 0.12) + ')'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(u.x, cy); ctx.lineTo(t.x, t.y - (use3D ? lift(t.r * 1.2) : t.r * 0.3)); ctx.stroke();
        ctx.strokeStyle = col + (0.55 + fl * 0.3) + ')'; ctx.lineWidth = 1.5; ctx.stroke();
        glow(t.x, t.y - t.r * 0.3, t.r * 1.2, col + '0.9)', 0.35 + fl * 0.2);
    }
    ctx.globalCompositeOperation = 'source-over';
}

function drawCoinsAndPillars(dt) {
    for (let i = pillars.length - 1; i >= 0; i--) {
        const p = pillars[i]; p.t += dt;
        if (p.t >= p.dur) { pillars.splice(i, 1); continue; }
        const k = p.t / p.dur, a = Math.sin(k * Math.PI), w = 34 * (1 - k * 0.5);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, p.u.y - 260, 0, p.u.y);
        g.addColorStop(0, 'rgba(255,215,90,0)'); g.addColorStop(1, `rgba(255,225,120,${0.55 * a})`);
        ctx.fillStyle = g; ctx.fillRect(p.u.x - w / 2, p.u.y - 260, w, 260);
        ctx.fillStyle = `rgba(255,255,230,${0.6 * a})`; ctx.fillRect(p.u.x - w / 8, p.u.y - 260, w / 4, 260);
        ctx.globalCompositeOperation = 'source-over';
    }
    for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i]; c.t += dt;
        if (c.t < 0.35) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 900 * dt; }
        else {
            const tx = c.to.x, ty = c.to.y - c.to.r * 0.4, d = Math.hypot(tx - c.x, ty - c.y), sp = 900 * dt + d * 6 * dt;
            if (d < 12 || c.t > 1.5) { coins.splice(i, 1); emit(tx, ty, 2, 'rgba(255,215,90,0.9)', 80, 0.25, 2); continue; }
            c.x += (tx - c.x) / d * Math.min(d, sp); c.y += (ty - c.y) / d * Math.min(d, sp);
        }
        const sx = Math.abs(Math.cos(c.t * 14)) * 5 + 1;
        ellipse(c.x, c.y, sx, 5, '#f2c94c', '#8a6a1c', 1.2);
        ctx.globalCompositeOperation = 'lighter'; glow(c.x, c.y, 9, 'rgba(255,215,90,0.8)', 0.5); ctx.globalCompositeOperation = 'source-over';
    }
}

function drawGhosts(dt) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = ghosts.length - 1; i >= 0; i--) {
        const g = ghosts[i]; g.t += dt;
        if (g.t >= g.dur) { ghosts.splice(i, 1); continue; }
        const k = g.t / g.dur;
        glow(g.x, g.y - g.u.r * 0.2, g.u.r * 1.4, TEAM_COLOR[g.u.team], 0.45 * (1 - k));
    }
    ctx.globalCompositeOperation = 'source-over';
    if (ghosts.length > 120) ghosts.splice(0, ghosts.length - 120);
}

let cloudImg = null;
function cloudSprite() {
    if (cloudImg) return cloudImg;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,20,1)'); gr.addColorStop(0.6, 'rgba(0,0,20,0.5)'); gr.addColorStop(1, 'rgba(0,0,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return (cloudImg = c);
}
function drawClouds(view, dt) {
    for (const c of clouds) {
        c.x += c.v * dt; c.y -= c.v * 0.5 * dt;
        if (c.x - c.r > 4000) c.x = -c.r;
        if (c.y + c.r < 0) c.y = 4000 + c.r;
        if (c.x + c.r < view.x0 || c.x - c.r > view.x1 || c.y + c.r < view.y0 || c.y - c.r > view.y1) continue;
        ctx.globalAlpha = 0.16;
        ctx.drawImage(cloudSprite(), c.x - c.r, c.y - c.r * 0.7, c.r * 2, c.r * 1.4);
    }
    ctx.globalAlpha = 1;
}

function drawShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const w = shockwaves[i];
        w.t += dt;
        if (w.t >= w.dur) { shockwaves.splice(i, 1); continue; }
        const k = w.t / w.dur, e = 1 - Math.pow(1 - k, 3);
        ctx.globalAlpha = 1 - k;
        ellipse(w.x, w.y, w.r * e, w.r * e * 0.55, null, w.color, 6 * (1 - k) + 1);
        ellipse(w.x, w.y, w.r * e * 0.8, w.r * e * 0.44, null, 'rgba(255,255,255,0.6)', 2);
        ctx.globalAlpha = 1;
    }
}

function drawMotes(view) {
    const w = view.x1 - view.x0, h = view.y1 - view.y0;
    ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
        m.y -= 0.004 * m.s * 0.016; m.x += Math.sin(world.time * 0.6 + m.ph) * 0.0004;
        if (m.y < 0) m.y += 1;
        const x = view.x0 + ((m.x % 1) + 1) % 1 * w, y = view.y0 + m.y * h;
        const a = 0.35 + 0.35 * Math.sin(world.time * 2 * m.s + m.ph);
        glow(x, y, 6 * m.s, 'rgba(255,240,170,0.9)', a * 0.6);
    }
    ctx.globalCompositeOperation = 'source-over';
}

function drawProjectiles(dt) {
    const cur = new Set(world.projectiles);
    for (const p of prevProj) if (!cur.has(p)) {
        impacts.push({ x: p.x, y: p.y, t: 0, dur: 0.28, r: (p.homing ? p.size * 3 : p.width) * 1.4, color: p.color });
        emit(p.x, p.y, p.big ? 18 : 7, p.color, p.big ? 300 : 180, 0.35, p.big ? 4 : 2.5);
    }
    prevProj = world.projectiles.slice();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = impacts.length - 1; i >= 0; i--) {
        const m = impacts[i]; m.t += dt;
        if (m.t >= m.dur) { impacts.splice(i, 1); continue; }
        const k = m.t / m.dur;
        glow(m.x, m.y, m.r * (1 + k * 1.5), m.color, 1 - k);
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (0.5 + k * 1.8), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of world.projectiles) {
        if (p.homing) {
            const isTower = p.owner.kind === 'tower';
            glow(p.x, p.y, p.size * (isTower ? 4 : 3), p.color, 0.9);
            circle(p.x, p.y, p.size * 0.6, '#ffffff');
            if (isTower || p.owner.kind === 'champ') emit(p.x, p.y, 1, p.color, 20, 0.25, p.size * 0.6);
            continue;
        }
        const a = Math.atan2(p.vy, p.vx), len = p.big ? 70 : p.width * 1.2;
        for (let i = 0; i < 6; i++) {
            const k = i / 6;
            glow(p.x - Math.cos(a) * len * k * 1.5, p.y - Math.sin(a) * len * k * 1.5, p.width * (1 - k * 0.7) * (p.big ? 1.4 : 1), p.color, 0.6 * (1 - k));
        }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, len * 0.5, p.width * 0.18, 0, 0, TAU); ctx.fill();
        ctx.restore();
        emit(p.x, p.y, 1, p.color, 60, 0.4, p.big ? 5 : 3);
    }
    ctx.globalCompositeOperation = 'source-over';
}

function drawEffects() {
    for (const e of world.effects) {
        const k = e.t / e.dur;
        ctx.globalAlpha = Math.max(0, 1 - k);
        if (e.type === 'ring') {
            const rr = e.r * (0.6 + k * 0.4);
            const g = ctx.createRadialGradient(e.x, e.y, rr * 0.6, e.x, e.y, rr);
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, e.color.startsWith('#') ? e.color + '55' : 'rgba(255,215,90,0.25)');
            circle(e.x, e.y, rr, g);
            ctx.strokeStyle = e.color; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, TAU); ctx.stroke();
        } else if (e.type === 'slash') {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            const a = (e.x * 7 + e.y) % TAU;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r, a, a + 1.6); ctx.stroke();
        } else if (e.type === 'click') {
            ctx.strokeStyle = e.color; ctx.lineWidth = 2.5;
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2 + Math.PI / 4, d = e.r * (1.4 - k);
                ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.6);
                ctx.lineTo(e.x + Math.cos(a) * (d + 8), e.y + Math.sin(a) * (d + 8) * 0.6); ctx.stroke();
            }
        } else if (e.type === 'warn') {
            ctx.globalAlpha = 1;
            const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
            g.addColorStop(0, 'rgba(178,107,255,0.05)'); g.addColorStop(1, 'rgba(178,107,255,0.35)');
            circle(e.x, e.y, e.r, g);
            ctx.strokeStyle = e.color; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r * k, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.stroke();
        } else if (e.type === 'beamwarn' || e.type === 'beam') {
            ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang);
            if (e.type === 'beam') {
                ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createLinearGradient(0, -e.w / 2, 0, e.w / 2);
                g.addColorStop(0, 'rgba(178,107,255,0)'); g.addColorStop(0.5, 'rgba(255,240,255,1)'); g.addColorStop(1, 'rgba(178,107,255,0)');
                ctx.fillStyle = g; ctx.fillRect(0, -e.w / 2 * (1 + k), e.r, e.w * (1 + k));
                ctx.globalCompositeOperation = 'source-over';
            } else {
                ctx.globalAlpha = 0.2 + 0.25 * k;
                ctx.fillStyle = e.color; ctx.fillRect(0, -e.w / 2, e.r, e.w);
                ctx.globalAlpha = 0.8; ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.strokeRect(0, -e.w / 2, e.r * k, e.w);
            }
            ctx.restore();
        } else if (e.type === 'bolt') {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = e.color; ctx.lineWidth = 10 * (1 - k) + 2;
            ctx.beginPath(); ctx.moveTo(e.x, e.y);
            for (let i = 1; i <= 6; i++) ctx.lineTo(e.tx + (i < 6 ? (Math.random() - 0.5) * 30 : 0), e.y + (e.ty - e.y) * i / 6);
            ctx.stroke();
            glow(e.tx, e.ty, 60, 'rgba(255,215,90,0.9)', 1 - k);
            ctx.globalCompositeOperation = 'source-over';
        } else if (e.type === 'num') {
            const big = typeof e.r === 'number' && e.r >= 150;
            const s = (big ? 1.5 : 1) + Math.max(0, 0.3 - k) * (big ? 3 : 2);
            ctx.font = `800 ${Math.round(15 * s)}px system-ui`; ctx.textAlign = 'center';
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.save(); ctx.translate(e.x, e.y - k * 46 - lift(60)); ctx.scale(1, 1 / COS);
            ctx.strokeText(e.r, 0, 0);
            ctx.fillStyle = e.color; ctx.fillText(e.r, 0, 0);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }
}

function drawRangeIndicator() {
    if (!player.alive) return;
    const i = ['q', 'w', 'e', 'r'].findIndex((k) => keysDown.has(k));
    const idx = hoverAbility >= 0 ? hoverAbility : i;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y, player.range + player.r, 0, TAU); ctx.stroke();
    if (touchAim && !touchAim.self) {
        const range = touchAim.range > 2000 ? 1500 : touchAim.range;
        const dragged = Math.hypot(touchAim.dx, touchAim.dy) > 18;
        const pt = dragged ? aimPoint(touchAim) : autoAimPoint(touchAim.range || 400);
        ctx.strokeStyle = 'rgba(140,210,255,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(player.x, player.y, range, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(140,210,255,0.9)'; ctx.lineWidth = 6; ctx.setLineDash([18, 10]);
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(pt.x, pt.y); ctx.stroke(); ctx.setLineDash([]);
        circle(pt.x, pt.y, 26, 'rgba(140,210,255,0.35)');
        return;
    }
    if (idx < 0) return;
    const a = player.def.abilities[idx];
    if (!a.range || a.range > 2000) return;
    const g = ctx.createRadialGradient(player.x, player.y, a.range * 0.7, player.x, player.y, a.range);
    g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(1, 'rgba(120,200,255,0.18)');
    circle(player.x, player.y, a.range, g);
    ctx.strokeStyle = 'rgba(140,210,255,0.7)';
    ctx.beginPath(); ctx.arc(player.x, player.y, a.range, 0, TAU); ctx.stroke();
}

const miniCanvas = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 240;
    c.getContext('2d').drawImage(getMap(!use3D), 0, 0, 240, 240);
    return c;
})();

/** Pings drawn on the ground in the world view (ground transform active). */
function drawPings() {
    for (const p of world.pings) {
        const a = world.time - p.t;
        if (a > 4 || p.team !== player.team) continue;
        const col = p.type === 'help' ? '255,215,90' : '255,77,77';
        const fade = Math.max(0, 1 - a / 4);
        for (let k = 0; k < 3; k++) {
            const ph = (a * 1.2 + k / 3) % 1;
            ctx.strokeStyle = `rgba(${col},${fade * (1 - ph)})`; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(p.x, p.y, 30 + ph * 140, 0, TAU); ctx.stroke();
        }
        ctx.save(); ctx.translate(p.x, p.y - lift(60) - 40 - Math.abs(Math.sin(a * 5)) * 12); ctx.scale(1, 1 / COS);
        ctx.fillStyle = `rgba(${col},${fade})`; ctx.strokeStyle = `rgba(0,0,0,${fade})`; ctx.lineWidth = 4;
        ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const sym = p.type === 'help' ? '➜' : '!';
        ctx.strokeText(sym, 0, 0); ctx.fillText(sym, 0, 0);
        ctx.restore();
    }
}

function drawMinimap() {
    const m = minimapRect(), k = m.s / MAP;
    ctx.fillStyle = 'rgba(8,12,20,0.95)'; ctx.fillRect(m.x - 5, m.y - 5, m.s + 10, m.s + 10);
    ctx.strokeStyle = '#c8a95a'; ctx.lineWidth = 2; ctx.strokeRect(m.x - 4, m.y - 4, m.s + 8, m.s + 8);
    ctx.drawImage(miniCanvas, m.x, m.y, m.s, m.s);
    ctx.save(); ctx.translate(m.x, m.y); ctx.scale(k, k);
    for (const u of world.units) {
        if (!u.alive) continue;
        ctx.fillStyle = TEAM_COLOR[u.team];
        if (u.kind === 'tower') { ctx.fillRect(u.x - 70, u.y - 70, 140, 140); ctx.strokeStyle = '#000'; ctx.lineWidth = 18; ctx.strokeRect(u.x - 70, u.y - 70, 140, 140); }
        else if (u.kind === 'nexus') { ctx.beginPath(); ctx.arc(u.x, u.y, 140, 0, TAU); ctx.fill(); }
        else if (u.kind === 'minion') { ctx.beginPath(); ctx.arc(u.x, u.y, 32, 0, TAU); ctx.fill(); }
    }
    for (const u of world.units) {
        if (u.kind !== 'monster') continue;
        ctx.globalAlpha = u.alive ? 1 : 0.3;
        ctx.fillStyle = MONSTERS[u.mkey].color; ctx.strokeStyle = '#000'; ctx.lineWidth = 24;
        ctx.beginPath(); ctx.moveTo(u.x, u.y - 150); ctx.lineTo(u.x + 130, u.y); ctx.lineTo(u.x, u.y + 150); ctx.lineTo(u.x - 130, u.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1;
    }
    for (const u of world.units) {
        if (!u.alive || u.kind !== 'champ') continue;
        ctx.fillStyle = u.def.color; ctx.beginPath(); ctx.arc(u.x, u.y, 120, 0, TAU); ctx.fill();
        ctx.lineWidth = 34; ctx.strokeStyle = u.isPlayer ? '#ffd75a' : TEAM_COLOR[u.team]; ctx.stroke();
    }
    for (const p of world.pings) {
        const a = world.time - p.t;
        if (a > 4 || p.team !== player.team) continue;
        const col = p.type === 'help' ? '#ffd75a' : '#ff4d4d';
        ctx.strokeStyle = col; ctx.globalAlpha = Math.max(0, 1 - a / 4);
        for (let k = 0; k < 2; k++) { const ph = (a * 1.4 + k * 0.5) % 1; ctx.lineWidth = 30; ctx.beginPath(); ctx.arc(p.x, p.y, 120 + ph * 420, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = col; ctx.font = 'bold 360px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.type === 'help' ? '➜' : '!', p.x, p.y);
        ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 18;
    ctx.strokeRect(cam.x - W / 2 / zoom, cam.y - H / 2 / zoom / COS, W / zoom, H / zoom / COS);
    ctx.restore();
}

let vignette = null, vignetteKey = '';
function drawVignette() {
    const key = W + 'x' + H;
    if (key !== vignetteKey) {
        vignetteKey = key;
        vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,10,0.55)');
    }
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    if (!player.alive) { ctx.fillStyle = 'rgba(40,40,50,0.45)'; ctx.fillRect(0, 0, W, H); }
    else if (player.hp < player.maxHp * 0.25) {
        const p = 0.5 + 0.5 * Math.sin(world.time * 6);
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(180,0,0,${0.25 + p * 0.2})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
}

// ---------- 3D renderer (Three.js) ----------
// The simulation stays 2D (x, y on the ground). Three.js draws the world with an orthographic
// camera tilted by TILT, so a ground point maps to the screen with a simple y-scale (COS) and a
// height h lifts it by h * SIN. That lets the 2D canvas draw effects on top in matching coordinates.
const shakeOff = { x: 0, y: 0 };
let r3dInst = null;
const r3d = () => r3dInst || (r3dInst = create3D());

function create3D() {
    const T = window.THREE;
    const glCanvas = document.createElement('canvas');
    glCanvas.id = 'game3d';
    canvas.parentNode.insertBefore(glCanvas, canvas);
    const renderer = new T.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    scene.background = new T.Color(0x0b1410);
    // Depth haze: the far (upper) part of the screen fades slightly into the night air.
    scene.fog = new T.Fog(0x0e1a16, 2700, 5600);
    const windU = { value: 0 };
    // Bends geometry above its base with a travelling wind wave (instanced meshes only).
    const sway = (m, amp, base) => {
        m.onBeforeCompile = (sh) => {
            sh.uniforms.uWind = windU;
            sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
                vec4 wp = instanceMatrix[3];
                float hgt = max(0.0, position.y - (${base.toFixed(2)}));
                float ph = uWind * 1.6 + wp.x * 0.004 + wp.z * 0.006;
                transformed.x += (sin(ph) * 0.7 + sin(ph * 2.3) * 0.3) * hgt * ${amp.toFixed(3)};
                transformed.z += cos(ph * 0.8) * hgt * ${(amp * 0.5).toFixed(3)};`);
        };
        return m;
    };
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 6000);

    scene.add(new T.HemisphereLight(0xcfe3ff, 0x34402a, 0.6));
    const sun = new T.DirectionalLight(0xfff0d0, 1.25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 1.5;
    scene.add(sun, sun.target);

    // Ground: the pre-rendered 2D map (without trees and rocks) as a texture.
    const tex = new T.CanvasTexture(getMap(false));
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const ground = new T.Mesh(new T.PlaneGeometry(MAP, MAP, 64, 64), new T.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(MAP / 2, 0, MAP / 2); ground.receiveShadow = true;
    scene.add(ground);
    const outer = new T.Mesh(new T.PlaneGeometry(MAP * 3, MAP * 3), new T.MeshLambertMaterial({ color: 0x14261a }));
    outer.rotation.x = -Math.PI / 2; outer.position.set(MAP / 2, -2, MAP / 2);
    scene.add(outer);
    // River surface: a glossy translucent strip that catches the sun.
    const rippleTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d'), rr = rng(77);
        g.fillStyle = '#7fb8d8'; g.fillRect(0, 0, 256, 256);
        g.lineCap = 'round';
        for (let i = 0; i < 90; i++) {
            const x = rr() * 256, y = rr() * 256, w = 10 + rr() * 34;
            g.strokeStyle = `rgba(235,250,255,${0.25 + rr() * 0.5})`; g.lineWidth = 1 + rr() * 2;
            g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3 - rr() * 3, x + w, y); g.stroke();
        }
        const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(22, 1.1); t.encoding = T.sRGBEncoding;
        return t;
    })();
    const water = new T.Mesh(new T.PlaneGeometry(MAP * Math.SQRT2 + 400, 250),
        new T.MeshPhongMaterial({ color: 0x3aa0d0, map: rippleTex, transparent: true, opacity: 0.28, shininess: 90, specular: 0xbfe8ff, depthWrite: false }));
    water.rotation.x = -Math.PI / 2; water.rotation.z = -Math.PI / 4; water.position.set(MAP / 2, 3, MAP / 2);
    scene.add(water);

    // Trees and rocks as instanced meshes.
    const m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3(), col = new T.Color();
    const trees = decor.trees;
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.18, 1, 6), new T.MeshLambertMaterial({ color: 0x5a3b22 }), trees.length);
    const canopyGeo = new T.IcosahedronGeometry(1, 1);
    const canopy = new T.InstancedMesh(canopyGeo, sway(new T.MeshLambertMaterial({ flatShading: true }), 0.08, -1), trees.length * 2);
    trees.forEach((t, i) => {
        const h = t.r * 1.4;
        m4.compose(v.set(t.x, h * 0.5, t.y), q.identity(), sc.set(t.r, h, t.r)); trunk.setMatrixAt(i, m4);
        const hue = (105 + t.hue * 35) / 360;
        m4.compose(v.set(t.x, h + t.r * 0.55, t.y), q.setFromEuler(new T.Euler(0, t.hue * 6, 0)), sc.set(t.r * 1.15, t.r * 0.95, t.r * 1.15));
        canopy.setMatrixAt(i * 2, m4); canopy.setColorAt(i * 2, col.setHSL(hue, 0.5, 0.24));
        m4.compose(v.set(t.x + t.r * 0.25, h + t.r * 1.25, t.y - t.r * 0.2), q, sc.set(t.r * 0.75, t.r * 0.7, t.r * 0.75));
        canopy.setMatrixAt(i * 2 + 1, m4); canopy.setColorAt(i * 2 + 1, col.setHSL(hue, 0.45, 0.32));
    });
    trunk.castShadow = canopy.castShadow = true; canopy.receiveShadow = true;
    scene.add(trunk, canopy);
    const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshLambertMaterial({ color: 0x8a8d95, flatShading: true }), decor.rocks.length);
    decor.rocks.forEach((k, i) => {
        m4.compose(v.set(k.x, k.r * 0.3, k.y), q.setFromEuler(new T.Euler(k.x % 3, k.y % 3, 0)), sc.set(k.r, k.r * 0.7, k.r * 0.85));
        rocks.setMatrixAt(i, m4);
    });
    rocks.castShadow = rocks.receiveShadow = true;
    scene.add(rocks);

    // Grass tufts scattered over the jungle, swaying in the wind.
    const tufts = [];
    {
        const rr = rng(4242), want = isTouch ? 1400 : 3600;
        for (let i = 0; i < want * 4 && tufts.length < want; i++) {
            const x = rr() * MAP, y = rr() * MAP;
            if (nearLane(x, y, 130) || nearRiver(x, y, 170) || nearBase(x, y, 560)) continue;
            if (trees.some((t) => Math.abs(t.x - x) < t.r && Math.abs(t.y - y) < t.r)) continue;
            tufts.push({ x, y, s: 7 + rr() * 9, a: rr() * 6.28, h: rr() });
        }
    }
    const grass = new T.InstancedMesh(new T.ConeGeometry(0.35, 1, 3).translate(0, 0.5, 0), sway(new T.MeshLambertMaterial({ flatShading: true }), 0.35, 0), tufts.length * 3);
    tufts.forEach((g, i) => {
        for (let k = 0; k < 3; k++) {
            const ox = Math.cos(g.a + k * 2.1) * g.s * 0.35, oz = Math.sin(g.a + k * 2.1) * g.s * 0.35;
            m4.compose(v.set(g.x + ox, 0, g.y + oz), q.setFromEuler(new T.Euler(Math.cos(k * 2.1) * 0.25, g.a + k, Math.sin(k * 2.1) * 0.25)), sc.set(g.s * 0.7, g.s * (1.2 + k * 0.35), g.s * 0.7));
            grass.setMatrixAt(i * 3 + k, m4);
            grass.setColorAt(i * 3 + k, col.setHSL((95 + g.h * 30) / 360, 0.5, 0.22 + k * 0.05 + g.h * 0.06));
        }
    });
    grass.receiveShadow = true;
    scene.add(grass);

    // Additive halo sprites fake a bloom glow around crystals and orbs.
    const haloTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        return new T.CanvasTexture(c);
    })();
    const haloMats = {};
    const halo = (color, size, opacity = 0.7) => {
        const m = haloMats[color + opacity] || (haloMats[color + opacity] = new T.SpriteMaterial({ map: haloTex, color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
        const sp = new T.Sprite(opacity === 0 ? m.clone() : m); sp.scale.set(size, size, 1); sp.renderOrder = 5;
        return sp;
    };

    // Fireflies drifting over the jungle (animated entirely in the vertex shader).
    const flyCount = isTouch ? 260 : 700, flyPos = [], flySeed = [];
    { const rr = rng(909); while (flyPos.length / 3 < flyCount) { const x = rr() * MAP, y = rr() * MAP; if (nearLane(x, y, 160) || nearBase(x, y, 500)) continue; flyPos.push(x, 20 + rr() * 60, y); flySeed.push(rr() * 100); } }
    const flyGeo = new T.BufferGeometry();
    flyGeo.setAttribute('position', new T.Float32BufferAttribute(flyPos, 3));
    flyGeo.setAttribute('seed', new T.Float32BufferAttribute(flySeed, 1));
    const flyU = { value: 0 };
    const flies = new T.Points(flyGeo, new T.ShaderMaterial({
        uniforms: { uTime: flyU, uScale: { value: 1 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
            void main() {
                vec3 p = position;
                p.x += sin(uTime * 0.5 + seed) * 40.0; p.z += cos(uTime * 0.4 + seed * 1.3) * 40.0; p.y += sin(uTime * 1.3 + seed * 2.0) * 12.0;
                vA = pow(max(0.0, sin(uTime * 1.7 + seed * 3.0)), 3.0);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = (3.0 + 5.0 * vA) * uScale;
            }`,
        fragmentShader: `varying float vA;
            void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 0.95, 0.55, (1.0 - d * 2.0) * (0.15 + 0.85 * vA)); }`,
    }));
    flies.frustumCulled = false;
    scene.add(flies);

    // A fixed pool of point lights handed to the brightest things in view each frame
    // (a constant light count avoids shader recompiles).
    const lights = Array.from({ length: isTouch ? 4 : 8 }, () => { const l = new T.PointLight(0xffffff, 0, 420, 2); scene.add(l); return l; });

    // Shared materials and geometry for units.
    const mats = {};
    const mat = (color, opts = {}) => {
        const key = color + JSON.stringify(opts);
        return mats[key] || (mats[key] = new T.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...opts }));
    };
    const glowMat = (color) => mat(color, { emissive: color, emissiveIntensity: 0.9, roughness: 0.25 });
    const G = {
        box: new T.BoxGeometry(1, 1, 1), sphere: new T.SphereGeometry(1, 16, 12), cyl: new T.CylinderGeometry(1, 1, 1, 14),
        cone: new T.ConeGeometry(1, 1, 14), oct: new T.OctahedronGeometry(1, 0), ring: new T.TorusGeometry(1, 0.06, 6, 40),
        oct8: new T.CylinderGeometry(1, 1.12, 1, 8), dome: new T.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        bow: new T.TorusGeometry(1, 0.08, 6, 20, Math.PI),
    };
    const part = (g, m, x, y, z, sx, sy, sz) => {
        const o = new T.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy ?? sx, sz ?? sx);
        o.castShadow = true; o.receiveShadow = true; return o;
    };

    function buildChampion(u) {
        const g = new T.Group(), r = u.r, team = TEAM_COLOR[u.team], body = u.def.color;
        const rig = new T.Group(); g.add(rig);
        rig.add(part(G.cyl, mat(0x2a2f3a), -r * 0.05, r * 0.35, -r * 0.25, r * 0.16, r * 0.7, r * 0.16));
        rig.add(part(G.cyl, mat(0x2a2f3a), -r * 0.05, r * 0.35, r * 0.25, r * 0.16, r * 0.7, r * 0.16));
        rig.add(part(G.cyl, mat(body), 0, r * 1.05, 0, r * 0.5, r * 0.85, r * 0.42));
        rig.add(part(G.sphere, mat(0xd8dde6, { metalness: 0.6, roughness: 0.3 }), 0, r * 1.38, -r * 0.52, r * 0.24));
        rig.add(part(G.sphere, mat(0xd8dde6, { metalness: 0.6, roughness: 0.3 }), 0, r * 1.38, r * 0.52, r * 0.24));
        const cape = part(G.box, mat(shade(team, -0.3)), -r * 0.42, r * 0.95, 0, r * 0.08, r * 1.1, r * 0.85);
        cape.rotation.z = -0.18; rig.add(cape);
        const headCol = u.key === 'arcanist' ? 0x5b3596 : u.key === 'ranger' ? 0x2f7a3c : 0xc9ced8;
        rig.add(part(G.sphere, mat(headCol, u.key === 'vanguard' ? { metalness: 0.7, roughness: 0.3 } : {}), r * 0.05, r * 1.72, 0, r * 0.34));
        if (u.key === 'arcanist') rig.add(part(G.cone, mat(0x3f2470), 0, r * 2.15, 0, r * 0.32, r * 0.6, r * 0.32));
        if (u.key === 'ranger') { const h = part(G.cone, mat(0x24602f), -r * 0.08, r * 1.95, 0, r * 0.36, r * 0.4, r * 0.36); rig.add(h); }
        if (u.key === 'vanguard') rig.add(part(G.box, mat(0x1a1f2a), r * 0.36, r * 1.74, 0, r * 0.06, r * 0.08, r * 0.3));
        const arm = new T.Group(); arm.position.set(0, r * 1.15, r * 0.55); rig.add(arm);
        if (u.key === 'vanguard') {
            arm.add(part(G.box, mat(0xe6ebf2, { metalness: 0.8, roughness: 0.2 }), r * 0.75, 0, 0, r * 1.3, r * 0.08, r * 0.16));
            arm.add(part(G.box, mat(0xc8a95a, { metalness: 0.7 }), r * 0.1, 0, 0, r * 0.1, r * 0.12, r * 0.4));
            const shield = part(G.cyl, mat(shade(team, -0.1), { metalness: 0.5 }), r * 0.3, r * 1.1, -r * 0.62, r * 0.42, r * 0.08, r * 0.42);
            shield.rotation.z = Math.PI / 2; rig.add(shield);
        } else if (u.key === 'arcanist') {
            arm.add(part(G.cyl, mat(0x6b4a2a), r * 0.2, r * 0.2, 0, r * 0.06, r * 1.9, r * 0.06));
            arm.add(part(G.sphere, glowMat(0xd7a8ff), r * 0.2, r * 1.2, 0, r * 0.2));
            const h = halo(0xc58cff, r * 1.6); h.position.set(r * 0.2, r * 1.2, 0); arm.add(h);
        } else {
            const bow = part(G.bow, mat(0x8a5a2b), r * 0.55, 0, -r * 0.2, r * 0.75);
            bow.rotation.x = Math.PI / 2; bow.rotation.z = -Math.PI / 2; arm.add(bow);
        }
        const ring = part(G.ring, new T.MeshBasicMaterial({ color: u.isPlayer ? 0xffd75a : u.team === player.team ? 0x4f8cff : 0xff5a5a }), 0, 2, 0, r * 1.25);
        ring.rotation.x = Math.PI / 2; ring.castShadow = false; g.add(ring);
        const bubble = part(G.sphere, new T.MeshStandardMaterial({ color: 0xa0d2ff, transparent: true, opacity: 0.28, emissive: 0x6aa8ff, emissiveIntensity: 0.4 }), 0, r * 1.1, 0, r * 1.5);
        bubble.castShadow = false; bubble.visible = false; g.add(bubble);
        // Whirlwind: two tilted translucent blade rings spun around the body.
        const swirl = new T.Group(); swirl.visible = false; g.add(swirl);
        for (let k = 0; k < 2; k++) {
            const s = new T.Mesh(new T.TorusGeometry(r * (2.6 + k * 0.9), r * 0.12, 4, 32, Math.PI * 1.3),
                new T.MeshBasicMaterial({ color: k ? 0xfff2b0 : 0xffd75a, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
            s.rotation.x = Math.PI / 2 + (k ? 0.15 : -0.1); s.position.y = r * (0.8 + k * 0.5); swirl.add(s);
        }
        const aura = halo(0x5dffa8, r * 4, 0.0); aura.position.y = r * 1.1; g.add(aura);
        const hit = halo(0xffffff, r * 3.2, 0.0); hit.position.y = r * 1.1; g.add(hit);
        g.userData = { rig, arm, ring, bubble, swirl, aura, hit };
        return g;
    }
    function buildMinion(u) {
        const g = new T.Group(), r = u.r, team = TEAM_COLOR[u.team];
        const rig = new T.Group(); g.add(rig);
        if (u.mtype === 'cannon') {
            rig.add(part(G.box, mat(0x3b3f48), 0, r * 0.5, 0, r * 1.7, r * 0.7, r * 1.3));
            rig.add(part(G.box, mat(team), 0, r * 1.0, 0, r * 1.2, r * 0.4, r * 1.0));
            const barrel = part(G.cyl, mat(0x22252c, { metalness: 0.7 }), r * 0.9, r * 1.05, 0, r * 0.22, r * 1.2, r * 0.22);
            barrel.rotation.z = Math.PI / 2; rig.add(barrel);
        } else {
            rig.add(part(G.sphere, mat(team), 0, r * 0.8, 0, r * 0.75, r * 0.8, r * 0.75));
            rig.add(part(G.sphere, mat(0x2a2f3a), r * 0.2, r * 1.55, 0, r * 0.42));
            if (u.mtype === 'melee') rig.add(part(G.box, mat(0xd8dde6, { metalness: 0.7 }), r * 0.7, r * 0.9, r * 0.6, r * 0.9, r * 0.1, r * 0.14));
            else { rig.add(part(G.cone, mat(shade(team, -0.3)), r * 0.15, r * 2.05, 0, r * 0.38, r * 0.7, r * 0.38)); rig.add(part(G.sphere, glowMat(0xffe08a), r * 0.75, r * 1.0, r * 0.5, r * 0.18)); const h = halo(0xffd070, r * 1.4, 0.55); h.position.set(r * 0.75, r * 1.0, r * 0.5); rig.add(h); }
        }
        const hit = halo(0xffffff, r * 3, 0.0); hit.position.y = r; g.add(hit);
        if (u.tier > 0) {
            const trim = part(G.ring, mat(0xffd75a, { metalness: 0.8, roughness: 0.25, emissive: 0x6a4a00, emissiveIntensity: 0.4 }), 0, r * 0.85, 0, r * 0.8);
            trim.rotation.x = Math.PI / 2; rig.add(trim);
            if (u.tier >= 3) rig.add(part(G.cone, mat(0xffd75a, { metalness: 0.8, roughness: 0.25 }), r * 0.2, r * 2.0, 0, r * 0.2, r * 0.35, r * 0.2));
        }
        g.userData = { rig, hit };
        return g;
    }
    function buildTower(u) {
        const g = new T.Group(), team = TEAM_COLOR[u.team];
        const alive = new T.Group(); g.add(alive);
        alive.add(part(G.oct8, mat(0x5d626c, { roughness: 0.9 }), 0, 12, 0, 46, 24, 46));
        alive.add(part(G.oct8, mat(0x737882, { roughness: 0.9 }), 0, 30, 0, 34, 12, 34));
        alive.add(part(G.cyl, mat(0x8a909a, { roughness: 0.8 }), 0, 70, 0, 18, 70, 18));
        alive.add(part(G.cyl, mat(team, { metalness: 0.4 }), 0, 82, 0, 19.5, 6, 19.5));
        alive.add(part(G.oct8, mat(0x6c717b), 0, 108, 0, 24, 8, 24));
        const crystal = part(G.oct, glowMat(team), 0, 128, 0, 13, 22, 13);
        crystal.castShadow = false; alive.add(crystal);
        const cHalo = halo(team, 90, 0.55); cHalo.material = cHalo.material.clone(); cHalo.position.y = 128; alive.add(cHalo);
        // Team banner hanging from a pole, waving in the wind.
        alive.add(part(G.cyl, mat(0x3a3328), 26, 100, 0, 1.6, 70, 1.6));
        const flagGeo = new T.PlaneGeometry(26, 34, 8, 1); flagGeo.translate(13, 0, 0);
        const flag = new T.Mesh(flagGeo, mat(team, { side: T.DoubleSide, emissive: team, emissiveIntensity: 0.15 }));
        flag.position.set(27, 116, 0); flag.castShadow = true; alive.add(flag);
        const rubble = new T.Group(); g.add(rubble); rubble.visible = false;
        const rr = rng(u.id * 97);
        for (let i = 0; i < 10; i++) {
            const b = part(G.box, mat(i % 2 ? 0x4c4f57 : 0x6a6e77), (rr() - 0.5) * 80, 5 + rr() * 8, (rr() - 0.5) * 60, 10 + rr() * 16, 8 + rr() * 10, 10 + rr() * 14);
            b.rotation.set(rr() * 2, rr() * 3, rr()); rubble.add(b);
        }
        g.userData = { alive, rubble, crystal, cHalo, flag, flagBase: Float32Array.from(flagGeo.attributes.position.array) };
        return g;
    }
    function buildNexus(u) {
        const g = new T.Group(), team = TEAM_COLOR[u.team];
        g.add(part(G.cyl, mat(0x5d626c, { roughness: 0.9 }), 0, 10, 0, 112, 20, 112));
        g.add(part(G.cyl, mat(0x777c86, { roughness: 0.85 }), 0, 26, 0, 84, 12, 84));
        const inner = part(G.ring, mat(team, { emissive: team, emissiveIntensity: 0.5 }), 0, 33, 0, 70); inner.rotation.x = Math.PI / 2; g.add(inner);
        const crystal = part(G.oct, glowMat(team), 0, 120, 0, 40, 75, 40); g.add(crystal);
        const cHalo = halo(team, 300, 0.5); cHalo.position.y = 120; g.add(cHalo);
        const beam = new T.Mesh(new T.CylinderGeometry(14, 30, 1400, 16, 1, true),
            new T.MeshBasicMaterial({ color: team, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
        beam.position.y = 860; g.add(beam);
        const r1 = part(G.ring, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 }), 0, 115, 0, 85);
        const r2 = part(G.ring, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 }), 0, 115, 0, 66);
        r1.castShadow = r2.castShadow = false; g.add(r1, r2);
        const dome = part(G.dome, new T.MeshStandardMaterial({ color: 0xc8dcff, transparent: true, opacity: 0.16, emissive: 0x88aaff, emissiveIntensity: 0.3, depthWrite: false }), 0, 0, 0, 140);
        dome.castShadow = false; g.add(dome);
        g.userData = { crystal, r1, r2, dome, cHalo, beam };
        return g;
    }

    function buildMonster(u) {
        const g = new T.Group(), r = u.r, m = MONSTERS[u.mkey];
        const rig = new T.Group(); g.add(rig);
        if (u.mkey === 'drake') {
            const scale = mat(m.color, { roughness: 0.5, metalness: 0.2 }), dark = mat(shade(m.color, -0.4));
            rig.add(part(G.sphere, scale, 0, r * 0.9, 0, r * 0.9, r * 0.6, r * 0.6));
            const neck = part(G.cyl, scale, r * 0.75, r * 1.25, 0, r * 0.22, r * 0.8, r * 0.22); neck.rotation.z = -0.8; rig.add(neck);
            rig.add(part(G.box, scale, r * 1.15, r * 1.6, 0, r * 0.6, r * 0.35, r * 0.4));
            for (const sg of [-1, 1]) {
                rig.add(part(G.cone, mat(0xf2e6c8), r * 1.0, r * 1.9, sg * r * 0.15, r * 0.06, r * 0.35, r * 0.06));
                rig.add(part(G.sphere, glowMat(0xfff080), r * 1.4, r * 1.68, sg * r * 0.14, r * 0.06));
                rig.add(part(G.cyl, dark, -r * 0.1, r * 0.35, sg * r * 0.35, r * 0.13, r * 0.6, r * 0.13));
            }
            const tail = part(G.cone, scale, -r * 1.2, r * 0.8, 0, r * 0.25, r * 1.3, r * 0.25); tail.rotation.z = Math.PI / 2 + 0.3; rig.add(tail);
            const wings = [];
            for (const sg of [-1, 1]) {
                const w = new T.Group(); w.position.set(r * 0.1, r * 1.2, sg * r * 0.4); rig.add(w);
                const shape = new T.Shape(); shape.moveTo(0, 0); shape.lineTo(r * 0.6, r * 1.9); shape.lineTo(-r * 0.4, r * 1.5); shape.lineTo(-r * 0.9, r * 0.6); shape.lineTo(0, 0);
                const wm = new T.Mesh(new T.ShapeGeometry(shape), mat(shade(m.color, -0.25), { side: T.DoubleSide }));
                wm.rotation.x = sg * Math.PI / 2; wm.castShadow = true; w.add(wm); w.userData.s = sg; wings.push(w);
            }
            const fire = halo(0xff7a20, r * 2.2, 0.0); fire.position.set(r * 1.6, r * 1.6, 0); rig.add(fire);
            g.userData = { rig, wings, fire };
        } else {
            const stone = mat(0x6c7380, { roughness: 0.95, flatShading: true }), light = mat(0x868d9a, { roughness: 0.9, flatShading: true });
            rig.add(part(G.oct, stone, 0, r * 1.15, 0, r * 0.85, r * 0.75, r * 0.7));
            rig.add(part(G.oct, light, r * 0.15, r * 1.95, 0, r * 0.38));
            const arms = [];
            for (const sg of [-1, 1]) {
                const a = new T.Group(); a.position.set(0, r * 1.45, sg * r * 0.85); rig.add(a);
                a.add(part(G.oct, light, 0, -r * 0.45, 0, r * 0.32, r * 0.55, r * 0.32));
                a.add(part(G.box, stone, 0, -r * 0.95, 0, r * 0.4));
                arms.push(a);
                rig.add(part(G.box, stone, 0, r * 0.3, sg * r * 0.4, r * 0.38, r * 0.6, r * 0.38));
            }
            const core = part(G.oct, glowMat(m.color), r * 0.62, r * 1.2, 0, r * 0.22); core.castShadow = false; rig.add(core);
            const ch = halo(m.color, r * 2.4, 0.5); ch.position.set(r * 0.7, r * 1.2, 0); rig.add(ch);
            g.userData = { rig, arms, core };
        }
        return g;
    }

    const meshes = new Map(), dying = new Set();
    // Units topple over and sink into the ground instead of vanishing.
    function dieAnim(g, d, dt) {
        d.deadT = (d.deadT ?? 0) + dt;
        const k = Math.min(1, d.deadT / 1.1);
        d.rig.rotation.x = Math.min(1, k * 2.5) * 1.45 * (g.id % 2 ? 1 : -1);
        g.position.y = -Math.max(0, k - 0.45) * 80;
        g.visible = k < 1;
        return k >= 1;
    }
    function sync(u, dt) {
        let g = meshes.get(u);
        if (!g) {
            g = u.kind === 'champ' ? buildChampion(u) : u.kind === 'minion' ? buildMinion(u) : u.kind === 'monster' ? buildMonster(u) : u.kind === 'tower' ? buildTower(u) : buildNexus(u);
            if (u.kind === 'champ') g.scale.setScalar(1.45); else if (u.kind === 'minion') g.scale.setScalar(1.25 * (1 + 0.04 * (u.tier || 0)));
            meshes.set(u, g); scene.add(g);
        }
        const d = g.userData, t = world.time;
        g.visible = true;
        g.position.set(u.x, 0, u.y);
        if (u.kind === 'monster') {
            if (!u.alive) { if (d.deadT === undefined || d.deadT < 1.1) dieAnim(g, d, dt); else g.visible = false; return; }
            if (d.deadT !== undefined) { d.deadT = undefined; d.rig.rotation.x = 0; g.position.y = 0; }
            const facing = u.order && u.order.target ? Math.atan2(u.order.target.y - u.y, u.order.target.x - u.x) : (u.facing ?? Math.PI * 0.75);
            d.rig.rotation.y = -facing;
            const atk = u.atkAnim > 0 ? Math.sin((1 - u.atkAnim / 0.25) * Math.PI) : 0;
            if (u.mkey === 'drake') {
                d.rig.position.y = 30 + Math.sin(t * 2.5) * 8;
                d.wings.forEach((w) => { w.rotation.x = w.userData.s * (Math.sin(t * 6) * 0.5 - 0.2); });
                d.fire.material.opacity = atk * 0.9;
            } else {
                d.arms[0].rotation.z = -atk * 1.4;
                d.arms[1].rotation.z = Math.sin(t * 2) * 0.1;
                d.core.rotation.y = t * 2;
            }
            return;
        }
        if (u.kind === 'champ' || u.kind === 'minion') {
            if (!u.alive) { dieAnim(g, d, dt); return; }
            if (d.deadT !== undefined) { d.deadT = undefined; d.rig.rotation.x = 0; g.position.y = 0; }
            const moving = (u.spd || 0) > 5;
            const bob = moving ? Math.abs(Math.sin((u.walkT || 0) * (u.kind === 'champ' ? 12 : 14) + u.id)) * (u.kind === 'champ' ? 4 : 2.5) : 0;
            d.rig.position.y = bob;
            d.rig.scale.y = moving ? 1 : 1 + Math.sin(t * 2.4 + u.id) * 0.025;
            d.hit.material.opacity = Math.max(0, (u.flashT || 0) / 0.12) * 0.5;
            const facing = u.spin > 0 ? t * 22 : (u.facing ?? (u.team === BLUE ? -Math.PI / 4 : Math.PI * 0.75));
            d.rig.rotation.y = -facing;
            if (u.kind === 'champ') {
                d.rig.rotation.z = moving ? -0.12 : 0;
                const a = u.atkAnim > 0 ? Math.sin((1 - u.atkAnim / 0.25) * Math.PI) : 0;
                d.arm.rotation.y = u.key === 'vanguard' ? -a * 1.6 + 0.4 : -a * 0.5;
                d.ring.visible = true;
                d.ring.scale.setScalar(u.r * (1.25 + (u.isPlayer ? 0.06 * Math.sin(t * 4) : 0)));
                d.bubble.visible = u.shield > 0;
                d.swirl.visible = u.spin > 0;
                if (u.spin > 0) { d.swirl.rotation.y = -t * 14; d.swirl.children.forEach((s, k) => { s.material.opacity = 0.35 + 0.25 * Math.sin(t * 20 + k); }); }
                d.aura.material.opacity = u.rapid > 0 ? 0.35 + 0.15 * Math.sin(t * 12) : 0;
            }
        } else if (u.kind === 'tower') {
            d.alive.visible = u.alive; d.rubble.visible = !u.alive;
            d.crystal.position.y = 128 + Math.sin(t * 2 + u.id) * 5;
            d.cHalo.position.y = d.crystal.position.y; d.cHalo.material.opacity = 0.45 + 0.12 * Math.sin(t * 3 + u.id);
            if (u.alive && dt > 0) {
                const pos = d.flag.geometry.attributes.position, b = d.flagBase;
                for (let i = 0; i < pos.count; i++) {
                    const x = b[i * 3], k = x / 26;
                    pos.array[i * 3 + 2] = Math.sin(t * 5 + x * 0.25 + u.id) * 4 * k;
                }
                pos.needsUpdate = true; d.flag.geometry.computeVertexNormals();
            }
            d.crystal.rotation.y = t * 1.2;
        } else {
            d.crystal.visible = d.r1.visible = d.r2.visible = d.cHalo.visible = u.alive;
            d.cHalo.position.y = 120 + Math.sin(t * 1.5) * 6; d.cHalo.scale.setScalar(300 + 25 * Math.sin(t * 2.2));
            d.crystal.position.y = 120 + Math.sin(t * 1.5) * 6; d.crystal.rotation.y = t * 0.6;
            d.r1.rotation.set(Math.PI / 2 + Math.sin(t * 0.7) * 0.35, t * 0.6, 0);
            d.r2.rotation.set(Math.PI / 2 + Math.cos(t * 0.9) * 0.35, -t * 0.9, 0);
            d.dome.visible = u.alive && isInvulnerable(u);
            d.beam.visible = u.alive; d.beam.material.opacity = 0.12 + 0.05 * Math.sin(t * 2);
        }
    }

    let lastW = 0, lastH = 0, lastZ = 0;
    const target = new T.Vector3();
    return {
        canvas: glCanvas,
        render(view, dt) {
            if (W !== lastW || H !== lastH || zoom !== lastZ) {
                lastW = W; lastH = H; lastZ = zoom;
                renderer.setPixelRatio(Math.min(DPR, isTouch ? 1.5 : 2));
                renderer.setSize(W, H, false);
                flies.material.uniforms.uScale.value = zoom * Math.min(DPR, isTouch ? 1.5 : 2);
                camera.left = -W / 2 / zoom; camera.right = W / 2 / zoom; camera.top = H / 2 / zoom; camera.bottom = -H / 2 / zoom;
                camera.updateProjectionMatrix();
                const ext = Math.max(W, H) / zoom * 0.75;
                Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 5000 });
                sun.shadow.camera.updateProjectionMatrix();
            }
            target.set(Math.round(cam.x) - shakeOff.x / zoom, 0, Math.round(cam.y) - shakeOff.y / zoom / COS);
            camera.position.set(target.x, target.y + 2500 * Math.cos(TILT), target.z + 2500 * Math.sin(TILT));
            camera.lookAt(target);
            sun.position.set(target.x - 900, 1800, target.z - 700); sun.target.position.copy(target);
            water.material.opacity = 0.3 + 0.05 * Math.sin(world.time * 1.3);
            rippleTex.offset.set(world.time * 0.05, Math.sin(world.time * 0.4) * 0.03);
            flyU.value = world.time;
            const seen = new Set();
            for (const u of world.units) {
                const near = u.x > view.x0 - 400 && u.x < view.x1 + 400 && u.y > view.y0 - 400 && u.y < view.y1 + 600;
                if (!near) { const g = meshes.get(u); if (g) g.visible = false; continue; }
                sync(u, dt); seen.add(u);
            }
            // Drop meshes of units that no longer exist (dead minions are removed from the world).
            for (const [u, g] of meshes) if (!world.units.includes(u)) { meshes.delete(u); if (g.visible && g.userData.rig) dying.add(g); else scene.remove(g); }
            for (const g of dying) if (dieAnim(g, g.userData, dt)) { scene.remove(g); dying.delete(g); }
            windU.value = world.time;
            // Assign the light pool: projectiles first, then tower and nexus crystals near the camera.
            const cands = [];
            for (const p of world.projectiles) {
                if (p.x < view.x0 - 200 || p.x > view.x1 + 200 || p.y < view.y0 - 200 || p.y > view.y1 + 300) continue;
                cands.push({ x: p.x, y: 50, z: p.y, c: p.color, i: p.big ? 3 : p.owner.kind === 'tower' ? 2.2 : 1.4, d: p.big ? 600 : 300, pr: 2 });
            }
            for (const u of world.units) {
                if (!u.alive || (u.kind !== 'tower' && u.kind !== 'nexus')) continue;
                if (u.x < view.x0 - 300 || u.x > view.x1 + 300 || u.y < view.y0 - 300 || u.y > view.y1 + 500) continue;
                const nex = u.kind === 'nexus';
                cands.push({ x: u.x, y: nex ? 140 : 128, z: u.y, c: TEAM_COLOR[u.team], i: (nex ? 2.4 : 1.6) * (0.85 + 0.15 * Math.sin(world.time * 3 + u.id)), d: nex ? 700 : 450, pr: 1 });
            }
            cands.sort((a, b) => b.pr - a.pr || Math.hypot(a.x - cam.x, a.z - cam.y) - Math.hypot(b.x - cam.x, b.z - cam.y));
            lights.forEach((l, i) => {
                const c = cands[i];
                if (!c) { l.intensity = 0; return; }
                l.position.set(c.x, c.y, c.z); l.color.set(c.c); l.intensity = c.i; l.distance = c.d;
            });
            renderer.render(scene, camera);
        },
        show(on) { glCanvas.style.display = on ? 'block' : 'none'; },
    };
}

// 2D overlay pieces drawn on top of the 3D scene.
const MODEL_TOP = { champ: 3.3, minion: 2.4, tower: 150, nexus: 200, monster: 2.6 };
function overlayAt(u, top, yOff, fn) {
    const h = Math.max(0, top - (u.r + yOff) / Math.max(SIN, 0.01) * 0.9);
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.translate(W / 2 + shakeOff.x + (u.x - cam.x) * zoom, H / 2 + shakeOff.y + ((u.y - cam.y) * COS - h * SIN) * zoom);
    ctx.scale(zoom, zoom); ctx.translate(-u.x, -u.y);
    fn();
    ctx.restore();
}
function drawOverlay3D(u, dt) {
    if (u.kind === 'champ' || u.kind === 'minion') walkPhase(u, dt);
    if (u.kind === 'tower' && u.alive && u.team !== player.team && dist(player, u) < u.range + 300) {
        const danger = u.order && u.order.target === player;
        ctx.strokeStyle = danger ? 'rgba(255,60,60,0.85)' : 'rgba(255,90,90,0.35)'; ctx.lineWidth = danger ? 4 : 2.5;
        ctx.setLineDash([16, 10]); ctx.beginPath(); ctx.arc(u.x, u.y, u.range, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (!u.alive) return;
    if (u.kind === 'champ') {
        if (u.rapid > 0) { ctx.globalCompositeOperation = 'lighter'; glow(u.x, u.y, u.r * 2, 'rgba(80,255,150,0.5)', 0.5); ctx.globalCompositeOperation = 'source-over'; }
        if (u.spin > 0) {
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const a = world.time * 16 + i * 2.1;
                ctx.strokeStyle = `rgba(255,215,90,${0.5 - i * 0.12})`; ctx.lineWidth = 6 - i;
                ctx.beginPath(); ctx.arc(u.x, u.y, 140 + i * 28, a, a + 1.2); ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
        if (u.recall > 0) {
            const k = 1 - u.recall / 8;
            ctx.strokeStyle = '#7fb4ff'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 16, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
            if (Math.random() < 0.5) emit(u.x + (Math.random() - 0.5) * u.r * 2, u.y + u.r * 0.5, 1, 'rgba(120,180,255,0.9)', 20, 0.8, 3, -160);
        }
    }
    if (u.flashT > 0) {
        u.flashT -= dt;
        ctx.globalCompositeOperation = 'lighter';
        glow(u.x, u.y - lift(u.kind === 'champ' ? u.r : 20), u.r * 2.2, 'rgba(255,255,255,0.8)', Math.max(0, u.flashT / 0.12) * 0.7);
        ctx.globalCompositeOperation = 'source-over';
    }
    overlayQueue.push(u);
}
const overlayQueue = [];
function drawLabels3D(dt) {
    for (const u of overlayQueue) {
        const ally = u.team === player.team;
        if (u.kind === 'champ') {
            overlayAt(u, u.r * MODEL_TOP.champ, 22, () => {
                champLabel(u, dt);
                if (u.stun > 0) for (let i = 0; i < 3; i++) {
                    const a = world.time * 6 + i * TAU / 3;
                    ctx.fillStyle = '#ffe98a'; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
                    ctx.fillText('★', u.x + Math.cos(a) * 18, u.y - u.r - 34 + Math.sin(a) * 5);
                }
            });
        } else if (u.kind === 'minion') {
            if (u.hp < u.maxHp) overlayAt(u, u.r * MODEL_TOP.minion, 8, () => hpBar(u, 32, 8, ally ? '#4fd16a' : '#e84a4a', { h: 4, dt }));
        } else if (u.kind === 'monster') {
            overlayAt(u, u.r * MODEL_TOP.monster + (u.mkey === 'drake' ? 40 : 0), 10, () => {
                hpBar(u, 100, 12, '#f0a040', { h: 6, dt });
                ctx.fillStyle = '#ffe0a0'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
                ctx.fillText(u.name, u.x, u.y - u.r - 22);
            });
        } else if (u.kind === 'tower') {
            overlayAt(u, MODEL_TOP.tower, 0, () => hpBar(u, 84, 0, ally ? '#4fd16a' : '#e84a4a', { ticks: true, h: 7, dt }));
        } else {
            const saved = u.r; u.r = 60;
            overlayAt(u, MODEL_TOP.nexus, 0, () => hpBar(u, 150, 0, ally ? '#4fd16a' : '#e84a4a', { ticks: true, h: 9, dt }));
            u.r = saved;
        }
    }
    overlayQueue.length = 0;
}

function setView(mode) {
    const want3D = mode === '3d' && webglOK;
    if (want3D === use3D) return;
    use3D = want3D;
    COS = use3D ? Math.cos(TILT) : 1; SIN = use3D ? Math.sin(TILT) : 0;
    try { localStorage.setItem('nq-view', use3D ? '3d' : '2d'); } catch (_) {}
    if (use3D) r3d().show(true); else if (r3dInst) r3dInst.show(false);
    miniCanvas.getContext('2d').drawImage(getMap(!use3D), 0, 0, 240, 240);
    const b = $('view-toggle'); if (b) b.textContent = use3D ? '2D' : '3D';
    banner(use3D ? '3D view' : '2D view');
}

// Show an attack cursor when hovering an enemy (desktop only).
let hoverCursor = '';
function updateCursor() {
    if (isTouch || !mouse.inside) return;
    const w = toWorld(mouse.sx, mouse.sy);
    const over = world.units.some((u) => u.alive && u.team !== player.team && Math.hypot(u.x - w.x, (u.y - w.y)) <= u.r + 14);
    const c = over ? 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27%3E%3Cpath d=%27M3 3l7 2 9 9-3 3-9-9z%27 fill=%27%23ff5a5a%27 stroke=%27%23000%27/%3E%3Cpath d=%27M15 19l4-4 2 2-4 4z%27 fill=%27%23ffd75a%27 stroke=%27%23000%27/%3E%3C/svg%3E") 3 3, crosshair' : '';
    if (c !== hoverCursor) { hoverCursor = c; canvas.style.cursor = c; }
}

function render(dt) {
    updateCursor();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.save();
    let sx = 0, sy = 0;
    if (shakeT > 0) { shakeT -= dt; const m = shakeMag * Math.max(0, shakeT) / 0.3; sx = (Math.random() - 0.5) * 2 * Math.min(m, shakeMag); sy = (Math.random() - 0.5) * 2 * Math.min(m, shakeMag); if (shakeT <= 0) shakeMag = 0; }
    shakeOff.x = sx; shakeOff.y = sy;
    const hw = W / 2 / zoom, hh = H / 2 / zoom / COS;
    const view = { x0: cam.x - hw, x1: cam.x + hw, y0: cam.y - hh, y1: cam.y + hh };
    if (use3D) { ctx.clearRect(0, 0, W, H); r3d().render(view, dt); }
    ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(zoom, zoom * COS); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    if (!use3D) drawMap(view);
    drawGround(dt);
    drawLights(view);
    drawShockwaves(dt);
    drawPings();
    drawRangeIndicator();
    const visible = world.units.filter((u) => u.x > view.x0 - 250 && u.x < view.x1 + 250 && u.y > view.y0 - 250 && u.y < view.y1 + 250);
    visible.sort((a, b) => a.y - b.y);
    if (use3D) for (const u of visible) drawOverlay3D(u, dt);
    else {
        for (const u of visible) if (!u.alive && u.kind === 'tower') drawUnit(u, dt);
        for (const u of visible) if (u.alive || u.kind !== 'tower') drawUnit(u, dt);
    }
    drawGhosts(dt);
    drawTowerBeams();
    ctx.save(); ctx.translate(0, -lift(45)); drawProjectiles(dt); ctx.restore();
    ctx.save(); ctx.translate(0, -lift(25)); drawParticles(); ctx.restore();
    drawEffects();
    drawCoinsAndPillars(dt);
    if (!use3D) drawClouds(view, dt);
    drawMotes(view);
    ctx.restore();
    if (use3D) drawLabels3D(dt);
    drawVignette();
    drawMinimap();
    if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#c8a95a'; ctx.font = 'bold 40px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', W / 2, H / 2);
        ctx.font = '16px system-ui'; ctx.fillStyle = '#e6e9f2';
        ctx.fillText('Press Esc to resume', W / 2, H / 2 + 36);
        ctx.textBaseline = 'alphabetic';
    }
}

function updateCamera(dt) {
    applyHeldMove(dt);
    if (!paused && !world.over && !world.autoplay) applyKeyMove();
    if (keysDown.has(' ')) cam.locked = true;
    // Edge scrolling and arrow keys pan the camera (and unlock it); speed ramps up toward the edge.
    let px = 0, py = 0;
    if (!isTouch && !world.autoplay && mouse.inside && !pan && document.hasFocus() && !keysDown.has(' ')) {
        const edge = 36;
        if (mouse.sx < edge) px -= 1 - mouse.sx / edge;
        if (mouse.sx > W - edge) px += 1 - (W - mouse.sx) / edge;
        if (mouse.sy < edge) py -= 1 - mouse.sy / edge;
        if (mouse.sy > H - edge) py += 1 - (H - mouse.sy) / edge;
        px = px && Math.sign(px) * (0.35 + 0.65 * Math.abs(px));
        py = py && Math.sign(py) * (0.35 + 0.65 * Math.abs(py));
    }
    if (px || py) {
        if (cam.locked) { cam.locked = false; $('cam-hint') && $('cam-hint').classList.remove('hidden'); }
        const speed = 1700 / Math.max(zoom, 0.6) * dt;
        cam.x += px * speed; cam.y += py * speed / COS;
    }
    if (cam.locked) {
        cam.x += (player.x - cam.x) * Math.min(1, dt * 10);
        cam.y += (player.y - cam.y) * Math.min(1, dt * 10);
    }
    $('cam-hint') && $('cam-hint').classList.toggle('hidden', cam.locked || isTouch);
    const hw = W / 2 / zoom, hh = H / 2 / zoom / COS;
    cam.x = clamp(cam.x, Math.min(hw, MAP / 2), Math.max(MAP - hw, MAP / 2));
    cam.y = clamp(cam.y, Math.min(hh, MAP / 2), Math.max(MAP - hh + 160 / zoom, MAP / 2));
}

let last = performance.now();
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const portraitBlocked = isTouch && H > W;
    if (!paused && !portraitBlocked) {
        applyTouchInput(dt);
        if (!world.over) update(dt);
        else {
            for (const e of world.effects) e.t += dt;
            world.effects = world.effects.filter((e) => e.t < e.dur);
        }
        updateCamera(dt);
        updateParticles(dt);
    }
    render(dt);
    hudT -= dt;
    if (hudT <= 0) {
        hudT = 0.1; updateHud();
        if (!$('shop').classList.contains('hidden')) renderShop();
    }
    requestAnimationFrame(frame);
}
updateHud();
banner('Welcome to Nexus Quest League');
requestAnimationFrame(frame);
})();
