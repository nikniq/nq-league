(() => {
'use strict';

// ---------- Constants ----------
const MAP = 4000;
const BLUE = 'blue', RED = 'red';
const BASE = { blue: { x: 380, y: 3620 }, red: { x: 3620, y: 380 } };
const FOUNTAIN_R = 420;
const TEAM_COLOR = { blue: '#4f8cff', red: '#ff5a5a' };
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
                      skillshot(u, u.x + Math.cos(a) * 100, u.y + Math.sin(a) * 100, { speed: 1500, range: 900, width: 30, color: '#a8ffcf',
                          onHit: (e) => { if (hit.has(e)) return; hit.add(e); damage(u, e, 30 + 18 * lv(u) + 0.9 * u.ad, 'phys'); } });
                  }
              },
              ai: (u, e, d) => d < 850 },
            { key: 'E', name: 'Tumble', cd: 7, cost: 30, range: 300,
              cast(u, tx, ty) { const p = clampTo(u, tx, ty, 300); startDash(u, p.x, p.y, 1300, () => { u.atkCd = 0; }); },
              ai: (u, e, d) => d < 250 && u.hp < u.maxHp * 0.5 },
            { key: 'R', name: 'Sky Arrow', cd: 80, cost: 100, range: 6000, ult: true,
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
    return { time: 0, units: [], projectiles: [], effects: [], timers: [], nextWave: 5, wave: 0, kills: { blue: 0, red: 0 }, over: false };
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
        level: 1, xp: 0, gold: 500, kills: 0, deaths: 0, cs: 0, items: [],
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
    u.order = null; u.stun = 0; u.slow = 0; u.dash = null; u.recall = 0;
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
            const types = ['melee', 'melee', 'melee', 'caster', 'caster', 'caster'];
            if (world.wave % 3 === 0) types.splice(3, 0, 'cannon');
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
                    r: spec.r, hp: spec.hp * scale, maxHp: spec.hp * scale, ad: spec.ad * scale, armor: spec.armor,
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
    if (type === 'phys') dmg *= 100 / (100 + Math.max(0, tgt.armor));
    if (type === 'magic') dmg *= 100 / (100 + Math.max(0, tgt.mr ?? tgt.armor * 0.6));
    if (tgt.shield > 0) {
        const absorbed = Math.min(tgt.shield, dmg);
        tgt.shield -= absorbed; dmg -= absorbed;
    }
    tgt.hp -= dmg;
    tgt.lastHitBy = src;
    if (tgt.kind === 'champ') {
        tgt.recall = 0;
        if (src.kind === 'champ') tgt.lastChampHit = { by: src, t: world.time };
    }
    if (src.kind === 'champ' && tgt.kind === 'champ') src.aggroT = world.time;
    if (dmg >= 1 && (tgt.isPlayer || src.isPlayer)) fx('num', tgt.x, tgt.y - tgt.r, Math.round(dmg), 0.7, type === 'true' ? '#fff' : type === 'magic' ? '#c99bff' : '#ffb35a');
    if (tgt.hp <= 0) kill(src, tgt);
}

function kill(src, tgt) {
    tgt.alive = false; tgt.hp = 0;
    const killer = src.kind === 'champ' ? src : (tgt.lastChampHit && world.time - tgt.lastChampHit.t < 10 ? tgt.lastChampHit.by : null);

    if (tgt.kind === 'minion') {
        if (src.kind === 'champ') { src.gold += tgt.gold; src.cs++; if (src.isPlayer) fx('num', tgt.x, tgt.y - 20, '+' + tgt.gold + 'g', 0.9, '#ffd75a'); }
        const nearby = champsOf(enemy(tgt.team)).filter((c) => c.alive && dist(c, tgt) < 1000);
        for (const c of nearby) giveXp(c, tgt.xp / Math.max(1, nearby.length) * 1.4);
    } else if (tgt.kind === 'champ') {
        tgt.deaths++;
        tgt.respawn = 6 + tgt.level * 2;
        world.kills[enemy(tgt.team)]++;
        if (killer) {
            killer.kills++;
            killer.gold += 300;
            giveXp(killer, 120 + tgt.level * 30);
            feed(`${killer.name} slain ${tgt.name}`, killer.team);
        } else feed(`${tgt.name} was executed`, enemy(tgt.team));
        if (tgt.isPlayer) banner('You have been slain');
        else if (killer && killer.isPlayer) banner('Enemy slain');
    } else if (tgt.kind === 'tower') {
        for (const c of champsOf(enemy(tgt.team))) c.gold += 150;
        feed(`${tgt.team === BLUE ? 'Blue' : 'Red'} ${tgt.lane} tower destroyed`, enemy(tgt.team));
        if (playerTeamIs(enemy(tgt.team))) banner('Enemy turret destroyed'); else banner('Your turret has been destroyed');
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
        recalcStats(c, false);
        c.hp = Math.min(c.maxHp, c.hp + c.def.hpL);
        if (c.isPlayer) { fx('ring', c.x, c.y, 60, 0.6, '#ffd75a'); if (c.level === 6) banner('Ultimate unlocked! (R)'); }
    }
}
const xpNeeded = (level) => 180 + level * 100;

function startAttack(u, t) {
    u.atkCd = 1 / currentAs(u);
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
const currentSpeed = (u) => (u.kind === 'champ' ? u.baseSpeed : u.speed) * (u.slow > 0 ? 1 - u.slowPct : 1);

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
        if (!u.alive) continue;
        u.atkCd = Math.max(0, u.atkCd - dt);
        u.stun = Math.max(0, u.stun - dt);
        u.slow = Math.max(0, u.slow - dt);
        if (u.kind === 'minion') minionAI(u);
        else if (u.kind === 'tower') towerAI(u);
        else if (u.kind === 'champ' && !u.isPlayer) botAI(u, dt);
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
    const t = nearestEnemy(u, 400, (e) => !isInvulnerable(e));
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
        if (!e.alive || e.team === u.team || !reach(e) || e.kind === 'tower' || e.kind === 'nexus') continue;
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
        else return;
    }
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
let feed = () => {}, banner = () => {};

if (typeof window === 'undefined' || !document.getElementById('game')) {
    if (typeof module !== 'undefined') module.exports = { setupGame, update, getWorld: () => world, getPlayer: () => player, cast, buy, ITEMS, CHAMPS, isInvulnerable, flash };
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
let hoverAbility = -1;

setupGame(cfg);
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
onGameOver = (victory) => {
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

function resize() {
    DPR = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
}
window.addEventListener('resize', resize);
resize();

const toWorld = (sx, sy) => ({ x: sx - W / 2 + cam.x, y: sy - H / 2 + cam.y });
const minimapRect = () => { const s = Math.min(200, W * 0.28); return { x: W - s - 12, y: H - s - 12, s }; };

function minimapHit(sx, sy) {
    const m = minimapRect();
    if (sx >= m.x && sy >= m.y && sx <= m.x + m.s && sy <= m.y + m.s) return { x: (sx - m.x) / m.s * MAP, y: (sy - m.y) / m.s * MAP };
    return null;
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousemove', (e) => { mouse.sx = e.clientX; mouse.sy = e.clientY; mouse.inside = true; });
canvas.addEventListener('mouseleave', () => { mouse.inside = false; });
canvas.addEventListener('mousedown', (e) => {
    if (paused || world.over) return;
    const mm = minimapHit(e.clientX, e.clientY);
    if (e.button === 0 && mm) { cam.locked = false; cam.x = mm.x; cam.y = mm.y; return; }
    if (e.button !== 2) return;
    const w = mm || toWorld(e.clientX, e.clientY);
    issueOrder(w);
});

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
window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (!$('shop').classList.contains('hidden')) $('shop').classList.add('hidden'); else if (!world.over) paused = !paused; return; }
    if (paused || world.over || e.repeat) return;
    keysDown.add(k);
    const w = toWorld(mouse.sx, mouse.sy);
    const idx = ['q', 'w', 'e', 'r'].indexOf(k);
    if (idx >= 0) { cast(player, idx, w.x, w.y); hoverAbility = -1; }
    else if (k === 'd' || k === 'f') flash(player, w.x, w.y);
    else if (k === 'b') { if (player.alive && !inFountain(player, player.team)) { player.recall = 8; player.order = null; } }
    else if (k === 'p') toggleShop();
    else if (k === 'y') { cam.locked = !cam.locked; banner(cam.locked ? 'Camera locked' : 'Camera unlocked'); }
    else if (k === 's') { player.order = null; player.recall = 0; }
    else if (k === 'a') { const t = nearestEnemy(player, 600); if (t) player.order = { type: 'attack', target: t }; }
});
window.addEventListener('keyup', (e) => keysDown.delete(e.key.toLowerCase()));

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
function renderShop() {
    const canShop = inFountain(player, player.team) || !player.alive;
    for (const { b, it } of shopButtons) {
        const owned = it.unique && player.items.some((i) => i.id === it.id);
        b.disabled = !canShop || player.gold < it.cost || player.items.length >= MAX_ITEMS || owned;
    }
}

// Ability bar
const abilEls = player.def.abilities.map((a, i) => {
    const el = document.createElement('div');
    el.className = 'abil';
    el.innerHTML = `<small>${a.key}</small>${a.key}<span class="name">${a.name}</span><div class="cd hidden"></div>`;
    el.addEventListener('mouseenter', () => { hoverAbility = i; });
    el.addEventListener('mouseleave', () => { hoverAbility = -1; });
    $('abilities').appendChild(el);
    return el;
});
const flashEl = document.createElement('div');
flashEl.className = 'abil';
flashEl.innerHTML = '<small>D</small>✦<span class="name">Flash</span><div class="cd hidden"></div>';
$('abilities').appendChild(flashEl);
$('portrait').style.background = player.def.color;
$('portrait').insertAdjacentText('afterbegin', player.def.letter);

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
    $('kda').textContent = `${p.kills}/${p.deaths}`;
    $('cs').textContent = p.cs;
    $('gold').textContent = Math.floor(p.gold);
    $('items').innerHTML = Array.from({ length: MAX_ITEMS }, (_, i) => `<div title="${p.items[i] ? p.items[i].name : ''}">${p.items[i] ? p.items[i].icon : ''}</div>`).join('');
    p.def.abilities.forEach((a, i) => {
        const el = abilEls[i], cd = el.querySelector('.cd');
        el.classList.toggle('locked', !!a.ult && p.level < 6);
        el.classList.toggle('nomana', p.mana < a.cost);
        el.classList.toggle('ready', canCast(p, i));
        cd.classList.toggle('hidden', p.cds[i] <= 0);
        cd.textContent = p.cds[i] > 0 ? Math.ceil(p.cds[i]) : '';
    });
    const fcd = flashEl.querySelector('.cd');
    flashEl.classList.toggle('ready', p.flashCd <= 0);
    fcd.classList.toggle('hidden', p.flashCd <= 0);
    fcd.textContent = p.flashCd > 0 ? Math.ceil(p.flashCd) : '';
}

// ---------- Rendering ----------
const decor = (() => {
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const trees = [];
    for (let i = 0; i < 380; i++) {
        const x = rnd() * MAP, y = rnd() * MAP;
        let near = false;
        for (const path of Object.values(LANES)) for (let k = 1; k < path.length; k++) if (distToSegment({ x, y }, path[k - 1].x, path[k - 1].y, path[k].x, path[k].y) < 260) near = true;
        if (distToSegment({ x, y }, 0, 0, MAP, MAP) < 220) near = true;
        if (Math.hypot(x - BASE.blue.x, y - BASE.blue.y) < 900 || Math.hypot(x - BASE.red.x, y - BASE.red.y) < 900) near = true;
        if (!near) trees.push({ x, y, r: 26 + rnd() * 30 });
    }
    return { trees };
})();

function drawMap() {
    ctx.fillStyle = '#1d3b24';
    ctx.fillRect(0, 0, MAP, MAP);
    // River
    ctx.strokeStyle = '#1f4f6e'; ctx.lineWidth = 260; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(MAP, MAP); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,190,230,0.12)'; ctx.lineWidth = 180;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(MAP, MAP); ctx.stroke();
    // Lanes
    for (const path of Object.values(LANES)) {
        ctx.strokeStyle = '#6b5a3e'; ctx.lineWidth = 240; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
        for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.strokeStyle = '#7d6a49'; ctx.lineWidth = 160;
        ctx.stroke();
    }
    // Bases
    for (const team of [BLUE, RED]) {
        const b = BASE[team];
        ctx.fillStyle = team === BLUE ? 'rgba(79,140,255,0.18)' : 'rgba(255,90,90,0.18)';
        ctx.beginPath(); ctx.arc(b.x, b.y, 800, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = team === BLUE ? 'rgba(79,140,255,0.35)' : 'rgba(255,90,90,0.35)';
        ctx.beginPath(); ctx.arc(b.x, b.y, FOUNTAIN_R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = TEAM_COLOR[team]; ctx.lineWidth = 4; ctx.stroke();
    }
}

function drawTrees(view) {
    for (const t of decor.trees) {
        if (t.x < view.x0 - 80 || t.x > view.x1 + 80 || t.y < view.y0 - 80 || t.y > view.y1 + 80) continue;
        ctx.fillStyle = '#12281a';
        ctx.beginPath(); ctx.arc(t.x + 6, t.y + 8, t.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#21502f';
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2c6a3e';
        ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
}

function hpBar(u, w, yOff, color) {
    const x = u.x - w / 2, y = u.y - u.r - yOff;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, u.hp / u.maxHp), 5);
    if (u.shield > 0) { ctx.fillStyle = '#e8eef8'; ctx.fillRect(x + w * Math.max(0, u.hp / u.maxHp), y, Math.min(w, w * u.shield / u.maxHp), 5); }
}

function drawUnit(u) {
    const col = TEAM_COLOR[u.team];
    const ally = u.team === player.team;
    if (u.kind === 'tower') {
        if (!u.alive) {
            ctx.fillStyle = '#3a3a3a'; ctx.fillRect(u.x - 30, u.y - 20, 60, 40);
            return;
        }
        if (dist(player, u) < u.range + 300 && u.team !== player.team) {
            ctx.strokeStyle = 'rgba(255,90,90,0.35)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(u.x, u.y, u.range, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = '#58606e'; ctx.fillRect(u.x - 32, u.y - 32, 64, 64);
        ctx.fillStyle = col; ctx.fillRect(u.x - 22, u.y - 22, 44, 44);
        ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(u.x, u.y - 4, 10, 0, Math.PI * 2); ctx.fill();
        if (isInvulnerable(u)) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(u.x - 36, u.y - 36, 72, 72); }
        hpBar(u, 80, 18, ally ? '#4fd16a' : '#e84a4a');
        return;
    }
    if (u.kind === 'nexus') {
        ctx.save(); ctx.translate(u.x, u.y);
        ctx.fillStyle = u.alive ? col : '#333';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + world.time * 0.3; ctx.lineTo(Math.cos(a) * u.r, Math.sin(a) * u.r); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(0, 0, u.r * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (u.alive) hpBar(u, 140, 20, ally ? '#4fd16a' : '#e84a4a');
        return;
    }
    if (!u.alive) return;
    if (u.kind === 'minion') {
        ctx.fillStyle = col;
        if (u.mtype === 'cannon') { ctx.fillRect(u.x - u.r, u.y - u.r, u.r * 2, u.r * 2); }
        else {
            ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2); ctx.fill();
            if (u.mtype === 'caster') { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(u.x, u.y, u.r * 0.4, 0, Math.PI * 2); ctx.fill(); }
        }
        hpBar(u, 30, 8, ally ? '#4fd16a' : '#e84a4a');
        return;
    }
    // Champion
    if (u.recall > 0) {
        ctx.strokeStyle = '#7fb4ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - u.recall / 8)); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(u.x, u.y + u.r * 0.7, u.r, u.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = u.def.color;
    ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = u.isPlayer ? 5 : 3; ctx.strokeStyle = u.isPlayer ? '#ffd75a' : col; ctx.stroke();
    const f = u.facing || 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(u.x + Math.cos(f) * u.r * 0.6, u.y + Math.sin(f) * u.r * 0.6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0f1a'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.def.letter, u.x, u.y + 1);
    if (u.spin > 0) {
        ctx.strokeStyle = 'rgba(255,215,90,0.6)'; ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) { const a = world.time * 14 + i * 2.1; ctx.beginPath(); ctx.arc(u.x, u.y, 120 + i * 30, a, a + 1); ctx.stroke(); }
    }
    if (u.stun > 0) { ctx.fillStyle = '#ffef8a'; ctx.font = '16px system-ui'; ctx.fillText('✶ ✶', u.x, u.y - u.r - 32); }
    hpBar(u, 70, 16, u.isPlayer ? '#4fd16a' : ally ? '#4f8cff' : '#e84a4a');
    ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${u.level} · ${u.name}`, u.x, u.y - u.r - 22);
}

function drawProjectiles() {
    for (const p of world.projectiles) {
        ctx.fillStyle = p.color;
        if (p.homing) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); continue; }
        const a = Math.atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        ctx.shadowColor = p.color; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.ellipse(0, 0, p.big ? 50 : p.width * 0.8, p.width / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

function drawEffects() {
    for (const e of world.effects) {
        const k = e.t / e.dur;
        ctx.globalAlpha = Math.max(0, 1 - k);
        if (e.type === 'ring' || e.type === 'slash') {
            ctx.strokeStyle = e.color; ctx.lineWidth = e.type === 'slash' ? 3 : 4;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (e.type === 'ring' ? 0.6 + k * 0.4 : 1), 0, Math.PI * 2); ctx.stroke();
        } else if (e.type === 'click') {
            ctx.strokeStyle = e.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 - k * 0.6), 0, Math.PI * 2); ctx.stroke();
        } else if (e.type === 'warn') {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * k, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = e.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke();
        } else if (e.type === 'beamwarn' || e.type === 'beam') {
            ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang);
            ctx.globalAlpha = e.type === 'beam' ? 1 - k : 0.25 + 0.25 * k;
            ctx.fillStyle = e.color;
            if (e.type === 'beam') { ctx.shadowColor = e.color; ctx.shadowBlur = 30; }
            ctx.fillRect(0, -e.w / 2, e.r, e.w);
            ctx.restore();
        } else if (e.type === 'bolt') {
            ctx.strokeStyle = e.color; ctx.lineWidth = 8; ctx.shadowColor = e.color; ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.tx, e.ty); ctx.stroke();
            ctx.shadowBlur = 0;
        } else if (e.type === 'num') {
            ctx.fillStyle = e.color; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center';
            ctx.fillText(e.r, e.x, e.y - k * 40);
        }
        ctx.globalAlpha = 1;
    }
}

function drawRangeIndicator() {
    const i = ['q', 'w', 'e', 'r'].findIndex((k) => keysDown.has(k));
    const idx = hoverAbility >= 0 ? hoverAbility : i;
    if (!player.alive) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y, player.range + player.r, 0, Math.PI * 2); ctx.stroke();
    if (idx < 0) return;
    const a = player.def.abilities[idx];
    if (!a.range || a.range > 2000) return;
    ctx.strokeStyle = 'rgba(120,200,255,0.6)';
    ctx.beginPath(); ctx.arc(player.x, player.y, a.range, 0, Math.PI * 2); ctx.stroke();
}

function drawMinimap() {
    const m = minimapRect(), k = m.s / MAP;
    ctx.fillStyle = 'rgba(10,15,26,0.92)'; ctx.fillRect(m.x - 3, m.y - 3, m.s + 6, m.s + 6);
    ctx.fillStyle = '#1d3b24'; ctx.fillRect(m.x, m.y, m.s, m.s);
    ctx.save(); ctx.translate(m.x, m.y); ctx.scale(k, k);
    ctx.strokeStyle = '#1f4f6e'; ctx.lineWidth = 220; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(MAP, MAP); ctx.stroke();
    ctx.strokeStyle = '#7d6a49'; ctx.lineWidth = 160;
    for (const path of Object.values(LANES)) { ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y); for (const p of path.slice(1)) ctx.lineTo(p.x, p.y); ctx.stroke(); }
    for (const u of world.units) {
        if (!u.alive) continue;
        ctx.fillStyle = TEAM_COLOR[u.team];
        if (u.kind === 'tower') ctx.fillRect(u.x - 70, u.y - 70, 140, 140);
        else if (u.kind === 'nexus') { ctx.beginPath(); ctx.arc(u.x, u.y, 130, 0, Math.PI * 2); ctx.fill(); }
        else if (u.kind === 'minion') ctx.fillRect(u.x - 30, u.y - 30, 60, 60);
        else {
            ctx.beginPath(); ctx.arc(u.x, u.y, 110, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 30; ctx.strokeStyle = u.isPlayer ? '#ffd75a' : '#000'; ctx.stroke();
        }
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 20;
    ctx.strokeRect(cam.x - W / 2, cam.y - H / 2, W, H);
    ctx.restore();
}

function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(Math.round(W / 2 - cam.x), Math.round(H / 2 - cam.y));
    const view = { x0: cam.x - W / 2, x1: cam.x + W / 2, y0: cam.y - H / 2, y1: cam.y + H / 2 };
    drawMap();
    drawRangeIndicator();
    const visible = world.units.filter((u) => u.x > view.x0 - 200 && u.x < view.x1 + 200 && u.y > view.y0 - 200 && u.y < view.y1 + 200);
    visible.sort((a, b) => a.y - b.y);
    for (const u of visible) if (u.kind === 'tower' || u.kind === 'nexus') drawUnit(u);
    for (const u of visible) if (u.kind === 'minion') drawUnit(u);
    for (const u of visible) if (u.kind === 'champ') drawUnit(u);
    drawTrees(view);
    drawProjectiles();
    drawEffects();
    ctx.restore();
    drawMinimap();
    if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#c8a95a'; ctx.font = 'bold 40px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', W / 2, H / 2);
        ctx.font = '16px system-ui'; ctx.fillStyle = '#e6e9f2';
        ctx.fillText('Press Esc to resume', W / 2, H / 2 + 36);
    }
}

function updateCamera(dt) {
    if (keysDown.has(' ')) cam.locked = true;
    if (cam.locked) {
        cam.x += (player.x - cam.x) * Math.min(1, dt * 10);
        cam.y += (player.y - cam.y) * Math.min(1, dt * 10);
    } else if (mouse.inside) {
        const edge = 24, speed = 1400 * dt;
        if (mouse.sx < edge) cam.x -= speed;
        if (mouse.sx > W - edge) cam.x += speed;
        if (mouse.sy < edge) cam.y -= speed;
        if (mouse.sy > H - edge) cam.y += speed;
    }
    cam.x = clamp(cam.x, W / 2 - 200, MAP - W / 2 + 200);
    cam.y = clamp(cam.y, H / 2 - 200, MAP - H / 2 + 200);
}

let last = performance.now();
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
        if (!world.over) update(dt);
        else {
            for (const e of world.effects) e.t += dt;
            world.effects = world.effects.filter((e) => e.t < e.dur);
        }
        updateCamera(dt);
    }
    render();
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
