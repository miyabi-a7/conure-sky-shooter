const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const shotEl = document.querySelector("#power");
const allyEl = document.querySelector("#ally");
const timeEl = document.querySelector("#time");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");

const POWERUPS = ["speed", "shot", "ally"];
const FOODS = [
  { name: "seed", color: "#f3cf72", points: 1 },
  { name: "apple", color: "#ef6f61", points: 2 },
  { name: "berry", color: "#7b61ff", points: 3 },
];

const state = {
  running: false,
  paused: false,
  over: false,
  score: 0,
  best: Number(localStorage.getItem("conure-sky-best") || 0),
  timeLeft: 90,
  lives: 3,
  lastTime: 0,
  scroll: 0,
  foodTimer: 1.1,
  enemyTimer: 0.35,
  shootTimer: 0,
  items: [],
  powerups: [],
  enemies: [],
  playerShots: [],
  enemyShots: [],
  sparks: [],
  keys: new Set(),
  touch: {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    playerStartX: 0,
    playerStartY: 0,
  },
  player: {
    x: 145,
    y: 270,
    r: 27,
    speed: 350,
    speedLevel: 0,
    shotLevel: 1,
    allies: 0,
    invincible: 0,
    wing: 0,
  },
};

bestEl.textContent = state.best;

function resetGame() {
  state.running = true;
  state.paused = false;
  state.over = false;
  state.score = 0;
  state.timeLeft = 90;
  state.lives = 3;
  state.scroll = 0;
  state.foodTimer = 1.1;
  state.enemyTimer = 0.25;
  state.shootTimer = 0;
  state.items = [];
  state.powerups = [];
  state.enemies = [];
  state.playerShots = [];
  state.enemyShots = [];
  state.sparks = [];
  state.player.x = 145;
  state.player.y = canvas.height / 2;
  state.player.speed = 350;
  state.player.speedLevel = 0;
  state.player.shotLevel = 1;
  state.player.allies = 0;
  state.player.invincible = 1.4;
  state.lastTime = performance.now();
  pauseButton.textContent = "Pause";
  pauseButton.setAttribute("aria-pressed", "false");
  updateHud();
}

function updateHud() {
  scoreEl.textContent = state.score;
  bestEl.textContent = state.best;
  shotEl.textContent = state.player.shotLevel;
  allyEl.textContent = state.player.allies;
  timeEl.textContent = `${Math.ceil(Math.max(0, state.timeLeft))}/${state.lives}`;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function choose(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function addSparks(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    state.sparks.push({
      x,
      y,
      vx: rand(-180, 180),
      vy: rand(-160, 125),
      life: rand(0.32, 0.78),
      size: rand(2, 5),
      color,
    });
  }
}

function spawnFood() {
  const food = choose(FOODS);
  state.items.push({
    ...food,
    x: canvas.width + 36,
    y: rand(72, canvas.height - 92),
    r: 14,
    vx: rand(170, 220),
    bob: rand(0, Math.PI * 2),
  });
}

function spawnEnemy() {
  const heavy = Math.random() < 0.22;
  state.enemies.push({
    x: canvas.width + 58,
    y: rand(66, canvas.height - 90),
    r: heavy ? 33 : 27,
    hp: heavy ? 5 : 3,
    maxHp: heavy ? 5 : 3,
    vx: heavy ? rand(135, 185) : rand(185, 265),
    shootTimer: rand(0.35, 1.05),
    flap: rand(0, Math.PI * 2),
    phase: rand(0, Math.PI * 2),
    heavy,
  });
}

function spawnPowerup(x, y) {
  if (Math.random() > 0.42) return;
  const type = choose(POWERUPS);
  state.powerups.push({
    type,
    x,
    y,
    r: 16,
    vx: 150,
    bob: rand(0, Math.PI * 2),
  });
}

function firePlayerShots() {
  const level = state.player.shotLevel;
  const origins = [{ x: state.player.x + 50, y: state.player.y - 5 }];
  for (let i = 0; i < state.player.allies; i += 1) {
    const allyY = state.player.y + (i === 0 ? -48 : 48);
    origins.push({ x: state.player.x + 28, y: allyY });
  }

  for (const origin of origins) {
    state.playerShots.push({ x: origin.x, y: origin.y, r: 6, vx: 620, vy: 0, damage: 1 });
    if (level >= 2) {
      state.playerShots.push({ x: origin.x, y: origin.y, r: 5, vx: 590, vy: -105, damage: 1 });
      state.playerShots.push({ x: origin.x, y: origin.y, r: 5, vx: 590, vy: 105, damage: 1 });
    }
    if (level >= 3) {
      state.playerShots.push({ x: origin.x - 8, y: origin.y - 12, r: 6, vx: 700, vy: 0, damage: 1 });
      state.playerShots.push({ x: origin.x - 8, y: origin.y + 12, r: 6, vx: 700, vy: 0, damage: 1 });
    }
  }
}

function fireEnemyShot(enemy) {
  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  const speed = enemy.heavy ? 235 : 270;
  state.enemyShots.push({
    x: enemy.x - 30,
    y: enemy.y + 4,
    r: enemy.heavy ? 8 : 6,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
  });
}

function movePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (state.keys.has("arrowleft") || state.keys.has("a")) dx -= 1;
  if (state.keys.has("arrowright") || state.keys.has("d")) dx += 1;
  if (state.keys.has("arrowup") || state.keys.has("w")) dy -= 1;
  if (state.keys.has("arrowdown") || state.keys.has("s")) dy += 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    state.player.x += (dx / length) * state.player.speed * dt;
    state.player.y += (dy / length) * state.player.speed * dt;
  }

  state.player.x = Math.max(48, Math.min(canvas.width * 0.62, state.player.x));
  state.player.y = Math.max(52, Math.min(canvas.height - 52, state.player.y));
  state.player.wing += dt * (state.running && !state.paused ? 13 : 4);
  state.player.invincible = Math.max(0, state.player.invincible - dt);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function collectFood(item) {
  state.score += item.points;
  addSparks(item.x, item.y, item.color, 8);
}

function collectPowerup(item) {
  if (item.type === "speed") {
    state.player.speedLevel = Math.min(3, state.player.speedLevel + 1);
    state.player.speed = 350 + state.player.speedLevel * 45;
    addSparks(item.x, item.y, "#68d6ff", 18);
  } else if (item.type === "shot") {
    state.player.shotLevel = Math.min(3, state.player.shotLevel + 1);
    addSparks(item.x, item.y, "#fff16f", 20);
  } else {
    state.player.allies = Math.min(2, state.player.allies + 1);
    addSparks(item.x, item.y, "#ff9c45", 22);
  }
}

function damagePlayer(x, y) {
  if (state.player.invincible > 0) return;
  state.lives -= 1;
  state.player.invincible = 1.8;
  addSparks(x, y, "#ef6f61", 28);
  if (state.lives <= 0) endGame();
}

function update(dt) {
  if (!state.running || state.paused || state.over) return;

  state.timeLeft -= dt;
  state.scroll += dt * 160;
  state.foodTimer -= dt;
  state.enemyTimer -= dt;
  state.shootTimer -= dt;

  if (state.foodTimer <= 0) {
    spawnFood();
    state.foodTimer = rand(1.35, 2.25);
  }

  if (state.enemyTimer <= 0) {
    spawnEnemy();
    state.enemyTimer = Math.max(0.28, rand(0.48, 0.92) - state.score * 0.0018);
  }

  if (state.shootTimer <= 0) {
    firePlayerShots();
    state.shootTimer = Math.max(0.12, 0.26 - state.player.shotLevel * 0.035);
  }

  movePlayer(dt);

  for (const item of state.items) {
    item.x -= item.vx * dt;
    item.y += Math.sin(item.bob + state.scroll * 0.035) * 0.35;
  }

  for (const item of state.powerups) {
    item.x -= item.vx * dt;
    item.y += Math.sin(item.bob + state.scroll * 0.045) * 0.65;
  }

  for (const shot of state.playerShots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }

  for (const shot of state.enemyShots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }

  for (const enemy of state.enemies) {
    enemy.flap += dt * 11;
    enemy.phase += dt * 2.4;
    enemy.x -= enemy.vx * dt;
    enemy.y += Math.sin(enemy.phase) * (enemy.heavy ? 0.7 : 1.1);
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && enemy.x < canvas.width - 50) {
      fireEnemyShot(enemy);
      enemy.shootTimer = enemy.heavy ? rand(0.8, 1.25) : rand(1.0, 1.65);
    }
  }

  for (const shot of state.playerShots) {
    for (const enemy of state.enemies) {
      if (shot.hit || enemy.dead) continue;
      if (distance(shot, enemy) < shot.r + enemy.r * 0.75) {
        shot.hit = true;
        enemy.hp -= shot.damage;
        addSparks(shot.x, shot.y, "#fff16f", 4);
        if (enemy.hp <= 0) {
          enemy.dead = true;
          state.score += enemy.heavy ? 12 : 7;
          addSparks(enemy.x, enemy.y, "#2b2e34", 20);
          spawnPowerup(enemy.x, enemy.y);
        }
      }
    }
  }

  state.items = state.items.filter((item) => {
    if (item.x < -44) return false;
    if (distance(item, state.player) < item.r + state.player.r * 0.72) {
      collectFood(item);
      return false;
    }
    return true;
  });

  state.powerups = state.powerups.filter((item) => {
    if (item.x < -44) return false;
    if (distance(item, state.player) < item.r + state.player.r * 0.78) {
      collectPowerup(item);
      return false;
    }
    return true;
  });

  state.enemyShots = state.enemyShots.filter((shot) => {
    if (shot.x < -30 || shot.y < -30 || shot.y > canvas.height + 30) return false;
    if (distance(shot, state.player) < shot.r + state.player.r * 0.68) {
      damagePlayer(shot.x, shot.y);
      return false;
    }
    return true;
  });

  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.dead || enemy.x < -80) return false;
    if (distance(enemy, state.player) < enemy.r + state.player.r * 0.68) {
      damagePlayer(enemy.x, enemy.y);
      enemy.dead = true;
      return false;
    }
    return true;
  });

  state.playerShots = state.playerShots.filter((shot) => !shot.hit && shot.x < canvas.width + 50 && shot.y > -40 && shot.y < canvas.height + 40);

  for (const spark of state.sparks) {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vy += 220 * dt;
    spark.life -= dt;
  }
  state.sparks = state.sparks.filter((spark) => spark.life > 0);

  if (state.timeLeft <= 0) endGame();
  updateHud();
}

function endGame() {
  state.over = true;
  state.running = false;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem("conure-sky-best", String(state.best));
  updateHud();
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#78c9df");
  sky.addColorStop(0.55, "#bcebe2");
  sky.addColorStop(1, "#f8d5a0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.74)";
  for (let i = 0; i < 9; i += 1) {
    const x = ((i * 205 - state.scroll * (0.42 + i * 0.015)) % (canvas.width + 260)) - 130;
    const y = 52 + (i % 4) * 76;
    drawCloud(x, y, 0.76 + (i % 3) * 0.18);
  }

  ctx.fillStyle = "#6fb86d";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let x = 0; x <= canvas.width + 60; x += 60) {
    const y = canvas.height - 36 - Math.sin((x + state.scroll) * 0.012) * 17;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();
}

function drawCloud(x, y, scale) {
  ctx.beginPath();
  ctx.arc(x, y, 24 * scale, 0, Math.PI * 2);
  ctx.arc(x + 26 * scale, y - 10 * scale, 32 * scale, 0, Math.PI * 2);
  ctx.arc(x + 62 * scale, y, 24 * scale, 0, Math.PI * 2);
  ctx.rect(x - 4 * scale, y, 68 * scale, 20 * scale);
  ctx.fill();
}

function drawFood(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  if (item.name === "apple") {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(0, 2, item.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4f8a43";
    ctx.fillRect(2, -item.r - 8, 6, 12);
  } else if (item.name === "berry") {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(-5, 3, item.r * 0.72, 0, Math.PI * 2);
    ctx.arc(6, 1, item.r * 0.75, 0, Math.PI * 2);
    ctx.arc(1, -7, item.r * 0.65, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, item.r * 0.66, item.r, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9d6f35";
    ctx.stroke();
  }
  ctx.restore();
}

function drawPowerup(item) {
  const color = item.type === "speed" ? "#68d6ff" : item.type === "shot" ? "#fff16f" : "#ff9c45";
  const label = item.type === "speed" ? "S" : item.type === "shot" ? "B" : "A";
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, item.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#17222a";
  ctx.font = "900 15px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

function drawShot(shot, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.ellipse(shot.x, shot.y, shot.r * 1.9, shot.r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrow(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const flap = Math.sin(enemy.flap) * (enemy.heavy ? 18 : 14);
  const scale = enemy.heavy ? 1.15 : 1;
  ctx.scale(scale, scale);
  ctx.fillStyle = enemy.heavy ? "#15171b" : "#20242a";
  ctx.strokeStyle = "#0f1115";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 27, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.quadraticCurveTo(-34, -25 - flap, -62, 4);
  ctx.quadraticCurveTo(-30, 12, -6, 5);
  ctx.moveTo(6, -4);
  ctx.quadraticCurveTo(34, -25 + flap, 62, 4);
  ctx.quadraticCurveTo(30, 12, 6, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f2c94c";
  ctx.beginPath();
  ctx.moveTo(-27, -2);
  ctx.lineTo(-45, -8);
  ctx.lineTo(-29, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f7f7f0";
  ctx.beginPath();
  ctx.arc(-10, -8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111318";
  ctx.beginPath();
  ctx.arc(-11, -8, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawConure(x, y, options = {}) {
  const wing = options.wing ?? state.player.wing;
  const moon = options.variant !== "sun";
  const flap = Math.sin(wing) * 16;
  const alpha = options.alpha ?? 1;
  const scale = options.scale ?? 1;
  const invincibleFlash = state.player.invincible > 0 && Math.floor(state.player.invincible * 12) % 2 === 0 && !options.variant;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = invincibleFlash ? 0.46 : alpha;

  if (moon) {
    ctx.fillStyle = "#8ecfb7";
    ctx.beginPath();
    ctx.ellipse(0, 4, 31, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6fbebf";
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.quadraticCurveTo(-38, -24 - flap, -68, 0);
    ctx.quadraticCurveTo(-34, 18, -4, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f3ead7";
    ctx.beginPath();
    ctx.arc(21, -9, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ddb58a";
    ctx.beginPath();
    ctx.ellipse(14, 12, 12, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#ffd85a";
    ctx.beginPath();
    ctx.ellipse(0, 4, 30, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff9b3d";
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.quadraticCurveTo(-36, -22 - flap, -64, 0);
    ctx.quadraticCurveTo(-32, 17, -4, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff6b45";
    ctx.beginPath();
    ctx.arc(21, -8, 17, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#f2c66d";
  ctx.beginPath();
  ctx.moveTo(39, -8);
  ctx.lineTo(57, -2);
  ctx.lineTo(39, 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fcfbf2";
  ctx.beginPath();
  ctx.arc(31, -14, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#17222a";
  ctx.beginPath();
  ctx.arc(32, -14, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = moon ? "#6d8fd7" : "#3fb36f";
  ctx.beginPath();
  ctx.moveTo(-24, 2);
  ctx.quadraticCurveTo(-49, 16, -75, 8);
  ctx.quadraticCurveTo(-51, 32, -18, 22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAllies() {
  for (let i = 0; i < state.player.allies; i += 1) {
    const y = state.player.y + (i === 0 ? -48 : 48);
    drawConure(state.player.x - 34, y, { variant: "sun", wing: state.player.wing + i, scale: 0.64, alpha: 0.95 });
  }
}

function drawSparks() {
  for (const spark of state.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life);
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMessage() {
  if (state.running && !state.paused && !state.over) return;

  ctx.fillStyle = "rgba(17, 24, 32, 0.58)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff9ea";
  ctx.textAlign = "center";
  ctx.font = "800 42px Segoe UI, sans-serif";
  const title = state.over ? "Game Over" : state.paused ? "Paused" : "Conure Sky Shooter";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 28);
  ctx.font = "700 19px Segoe UI, sans-serif";
  const text = state.over
    ? "Startでもう一度。カラスを倒して強化アイテムを集めよう"
    : "ムーンチークで出撃。カラスを倒してサンチークの援護を呼ぼう";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 18);
}

function render() {
  drawBackground();
  for (const item of state.items) drawFood(item);
  for (const item of state.powerups) drawPowerup(item);
  for (const shot of state.playerShots) drawShot(shot, "#fff16f");
  for (const shot of state.enemyShots) drawShot(shot, "#e5494f");
  for (const enemy of state.enemies) drawCrow(enemy);
  drawSparks();
  drawAllies();
  drawConure(state.player.x, state.player.y);
  drawMessage();
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;
  update(dt);
  render();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function beginTouchControl(event) {
  const point = canvasPoint(event);
  state.touch.active = true;
  state.touch.pointerId = event.pointerId;
  state.touch.startX = point.x;
  state.touch.startY = point.y;
  state.touch.playerStartX = state.player.x;
  state.touch.playerStartY = state.player.y;
}

function movePlayerFromTouch(event) {
  if (!state.touch.active || event.pointerId !== state.touch.pointerId) return;
  const point = canvasPoint(event);
  const sensitivity = 1.08;
  state.player.x = state.touch.playerStartX + (point.x - state.touch.startX) * sensitivity;
  state.player.y = state.touch.playerStartY + (point.y - state.touch.startY) * sensitivity;
  state.player.x = Math.max(48, Math.min(canvas.width * 0.62, state.player.x));
  state.player.y = Math.max(52, Math.min(canvas.height - 52, state.player.y));
}

function endTouchControl(event) {
  if (event.pointerId !== state.touch.pointerId) return;
  state.touch.active = false;
  state.touch.pointerId = null;
}

startButton.addEventListener("click", resetGame);
pauseButton.addEventListener("click", () => {
  if (!state.running && !state.paused) return;
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  pauseButton.setAttribute("aria-pressed", String(state.paused));
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
    state.keys.add(key);
  }
  if (key === " " && !event.repeat) {
    event.preventDefault();
    if (!state.running) resetGame();
    else pauseButton.click();
  }
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  if (!state.running) resetGame();
  beginTouchControl(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (event.buttons) movePlayerFromTouch(event);
});

canvas.addEventListener("pointerup", endTouchControl);
canvas.addEventListener("pointercancel", endTouchControl);

render();
setInterval(loop, 1000 / 60);
