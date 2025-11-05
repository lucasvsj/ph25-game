// Platanus Hack 25: Snake Game
// Navigate the snake around the "PLATANUS HACK ARCADE" title made of blocks!

// =============================================================================
// ARCADE BUTTON MAPPING - COMPLETE TEMPLATE
// =============================================================================
// Reference: See button-layout.webp at hack.platan.us/assets/images/arcade/
//
// Maps arcade button codes to keyboard keys for local testing.
// Each arcade code can map to multiple keyboard keys (array values).
// The arcade cabinet sends codes like 'P1U', 'P1A', etc. when buttons are pressed.
//
// To use in your game:
//   if (key === 'P1U') { ... }  // Works on both arcade and local (via keyboard)
//
// CURRENT GAME USAGE (Snake):
//   - P1U/P1D/P1L/P1R (Joystick) → Snake Direction
//   - P1A (Button A) or START1 (Start Button) → Restart Game
// =============================================================================

const ARCADE_CONTROLS = {
  // ===== PLAYER 1 CONTROLS =====
  // Joystick - Left hand on WASD
  'P1U': ['w'],
  'P1D': ['s'],
  'P1L': ['a'],
  'P1R': ['d'],
  'P1DL': null,  // Diagonal down-left (no keyboard default)
  'P1DR': null,  // Diagonal down-right (no keyboard default)

  // Action Buttons - Right hand on home row area (ergonomic!)
  // Top row (ABC): U, I, O  |  Bottom row (XYZ): J, K, L
  'P1A': ['u'],
  'P1B': ['i'],
  'P1C': ['o'],
  'P1X': ['j'],
  'P1Y': ['k'],
  'P1Z': ['l'],

  // Start Button
  'START1': ['1', 'Enter'],

  // ===== PLAYER 2 CONTROLS =====
  // Joystick - Right hand on Arrow Keys
  'P2U': ['ArrowUp'],
  'P2D': ['ArrowDown'],
  'P2L': ['ArrowLeft'],
  'P2R': ['ArrowRight'],
  'P2DL': null,  // Diagonal down-left (no keyboard default)
  'P2DR': null,  // Diagonal down-right (no keyboard default)

  // Action Buttons - Left hand (avoiding P1's WASD keys)
  // Top row (ABC): R, T, Y  |  Bottom row (XYZ): F, G, H
  'P2A': ['r'],
  'P2B': ['t'],
  'P2C': ['y'],
  'P2X': ['f'],
  'P2Y': ['g'],
  'P2Z': ['h'],

  // Start Button
  'START2': ['2']
};

// Build reverse lookup: keyboard key → arcade button code
const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keyboardKeys] of Object.entries(ARCADE_CONTROLS)) {
  if (keyboardKeys) {
    // Handle both array and single value
    const keys = Array.isArray(keyboardKeys) ? keyboardKeys : [keyboardKeys];
    keys.forEach(key => {
      KEYBOARD_TO_ARCADE[key] = arcadeCode;
    });
  }
}
// Scenes registry
const GameScene = { key: 'game', create: create, update: update };
const MenuScene = { key: 'menu', create: menuCreate, update: menuUpdate };

function menuCreate() {
  const s = this;
  s.cameras.main.setBackgroundColor('#000000');

  s.add.text(400, 130, 'BOOTFALL', {
    fontSize: '64px', fontFamily: 'Arial, sans-serif', color: '#ffffff', align: 'center'
  }).setOrigin(0.5);

  // Explicit buttons to avoid mapping errors
  s.menuItems = [];
  const mkBtn = (y, label, onClick) => {
    const t = s.add.text(400, y, label, {
      fontSize: '32px', fontFamily: 'Arial, sans-serif', color: '#00ffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => { s.menuIndex = s.menuItems.indexOf(t); updateMenuVisuals(s); });
    t.on('pointerdown', onClick);
    s.menuItems.push(t);
    return t;
  };
  s.btnStart = mkBtn(260, 'Start Game', () => s.scene.start('game'));
  s.btnInstr = mkBtn(330, 'Instructions', () => showInstructions(s));
  s.btnExit  = mkBtn(400, 'Exit', () => showExit(s));
  s.menuIndex = 0; updateMenuVisuals(s);

  s.input.keyboard.on('keydown', (ev) => {
    const key = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if (key === 'P1U') { s.menuIndex = (s.menuIndex + s.menuItems.length - 1) % s.menuItems.length; updateMenuVisuals(s); }
    else if (key === 'P1D') { s.menuIndex = (s.menuIndex + 1) % s.menuItems.length; updateMenuVisuals(s); }
    else if (key === 'P1A' || key === 'START1') {
      const actions = [() => s.scene.start('game'), () => showInstructions(s), () => showExit(s)];
      actions[s.menuIndex]();
    }
  });

  // Instructions overlay (hidden by default)
  s.instructionsGroup = s.add.group();
  const iOv = s.add.rectangle(400, 300, 800, 600, 0x000000, 0.86);
  const iT = s.add.text(400, 180, 'Instructions', { fontSize: '40px', fontFamily: 'Arial, sans-serif', color: '#ffff00' }).setOrigin(0.5);
  const iTxt = s.add.text(400, 300,
    'Move: A/D  |  Jump: W\nShoot down: U (ammo 3, recarga al aterrizar)\nPress START to begin',
    { fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#dddddd', align: 'center' }
  ).setOrigin(0.5);
  const iBack = s.add.text(400, 420, 'Back', { fontSize: '28px', fontFamily: 'Arial, sans-serif', color: '#00ff00' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  iBack.on('pointerdown', () => hideInstructions(s));
  s.instructionsGroup.addMultiple([iOv, iT, iTxt, iBack]);
  hideInstructions(s);
  s.input.keyboard.on('keydown', (ev) => { const k = KEYBOARD_TO_ARCADE[ev.key] || ev.key; if (s.instructionsVisible && (k === 'P1B' || ev.key === 'Escape' || k === 'P1A')) hideInstructions(s); });

  // Exit overlay (hidden by default)
  s.exitGroup = s.add.group();
  const eOv = s.add.rectangle(400, 300, 800, 600, 0x000000, 0.86);
  const eTxt = s.add.text(400, 280, 'Exit is not available on web', { fontSize: '28px', fontFamily: 'Arial, sans-serif', color: '#ff6666' }).setOrigin(0.5);
  const eHint = s.add.text(400, 330, 'Press START to play or Back to return', { fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#dddddd' }).setOrigin(0.5);
  const eBack = s.add.text(400, 400, 'Back', { fontSize: '28px', fontFamily: 'Arial, sans-serif', color: '#00ff00' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  eBack.on('pointerdown', () => hideExit(s));
  s.exitGroup.addMultiple([eOv, eTxt, eHint, eBack]);
  hideExit(s);
  s.input.keyboard.on('keydown', (ev) => {
    const k = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if (s.exitVisible && (k === 'P1B' || ev.key === 'Escape' || k === 'P1A')) hideExit(s);
    if (s.exitVisible && k === 'START1') s.scene.start('game');
  });
}

function menuUpdate() {
  // No-op; visuals actualizados por eventos
}

function updateMenuVisuals(s) {
  s.menuItems.forEach((t, i) => {
    const sel = i === s.menuIndex;
    t.setScale(sel ? 1.12 : 1);
    t.setColor(sel ? '#ffffff' : '#00ffff');
  });
}

function showInstructions(s) { s.instructionsVisible = true; s.instructionsGroup.setVisible(true); }
function hideInstructions(s) { s.instructionsVisible = false; s.instructionsGroup.setVisible(false); }
function showExit(s) { s.exitVisible = true; s.exitGroup.setVisible(true); }
function hideExit(s) { s.exitVisible = false; s.exitGroup.setVisible(false); }

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#000000',
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: [MenuScene, GameScene]
};

const game = new Phaser.Game(config);

// Game variables
let snake = [];
let snakeSize = 15;
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food;
let score = 0;
let scoreText;
let titleBlocks = [];
let gameOver = false;
let moveTimer = 0;
let moveDelay = 100;  // Faster initial speed (was 150ms)
let graphics;

// Downwell-like variables (M0 prototype)
let player;
let platforms = [];
let bullets = [];
let platformsGroup;
let bulletsGroup;
let keysState = { left: false, right: false };
let wasOnGround = false;
let ammo = 3;
let maxAmmo = 3;
let maxDepth = 0;
let worldHeight = 1000000;
let speed = 220;
let jump = 300;
let recoil = 240;

// Pixel font patterns (5x5 grid for each letter)
const letters = {
  P: [[1,1,1,1],[1,0,0,1],[1,1,1,1],[1,0,0,0],[1,0,0,0]],
  L: [[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,1]],
  A: [[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],
  T: [[1,1,1,1],[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  N: [[1,0,0,1],[1,1,0,1],[1,0,1,1],[1,0,0,1],[1,0,0,1]],
  U: [[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,1]],
  S: [[0,1,1,1],[1,0,0,0],[0,1,1,0],[0,0,0,1],[1,1,1,0]],
  H: [[1,0,0,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],
  C: [[0,1,1,1],[1,0,0,0],[1,0,0,0],[1,0,0,0],[0,1,1,1]],
  K: [[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1]],
  '2': [[1,1,1,0],[0,0,0,1],[0,1,1,0],[1,0,0,0],[1,1,1,1]],
  '5': [[1,1,1,1],[1,0,0,0],[1,1,1,0],[0,0,0,1],[1,1,1,0]],
  ':': [[0,0,0,0],[0,1,0,0],[0,0,0,0],[0,1,0,0],[0,0,0,0]],
  R: [[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,1,0],[1,0,0,1]],
  D: [[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,0]],
  E: [[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,1,1,1]]
};

// Bold font for ARCADE (filled/solid style)
const boldLetters = {
  A: [[1,1,1,1,1],[1,1,0,1,1],[1,1,1,1,1],[1,1,0,1,1],[1,1,0,1,1]],
  R: [[1,1,1,1,0],[1,1,0,1,1],[1,1,1,1,0],[1,1,0,1,1],[1,1,0,1,1]],
  C: [[1,1,1,1,1],[1,1,0,0,0],[1,1,0,0,0],[1,1,0,0,0],[1,1,1,1,1]],
  D: [[1,1,1,1,0],[1,1,0,1,1],[1,1,0,1,1],[1,1,0,1,1],[1,1,1,1,0]],
  E: [[1,1,1,1,1],[1,1,0,0,0],[1,1,1,1,0],[1,1,0,0,0],[1,1,1,1,1]]
};

function create() {
  const scene = this;
  graphics = this.add.graphics();

  // Build "PLATANUS HACK ARCADE" in cyan - centered and grid-aligned
  // PLATANUS: 8 letters × (4 cols + 1 spacing) = 40 blocks, but last letter no spacing = 39 blocks × 15px = 585px
  let x = Math.floor((800 - 585) / 2 / snakeSize) * snakeSize;
  let y = Math.floor(180 / snakeSize) * snakeSize;
  'PLATANUS'.split('').forEach(char => {
    x = drawLetter(char, x, y, 0x00ffff);
  });

  // HACK: 4 letters × (4 cols + 1 spacing) = 20 blocks, but last letter no spacing = 19 blocks × 15px = 285px
  x = Math.floor((800 - 285) / 2 / snakeSize) * snakeSize;
  y = Math.floor(280 / snakeSize) * snakeSize;
  'HACK'.split('').forEach(char => {
    x = drawLetter(char, x, y, 0x00ffff);
  });

  // ARCADE: 6 letters × (5 cols + 1 spacing) = 36 blocks, but last letter no spacing = 35 blocks × 15px = 525px
  x = Math.floor((800 - 525) / 2 / snakeSize) * snakeSize;
  y = Math.floor(380 / snakeSize) * snakeSize;
  'ARCADE'.split('').forEach(char => {
    x = drawLetter(char, x, y, 0xff00ff, true);
  });

  // Score display
  scoreText = this.add.text(16, 16, 'Score: 0', {
    fontSize: '24px',
    fontFamily: 'Arial, sans-serif',
    color: '#00ff00'
  });

  // Instructions
  this.add.text(400, 560, 'Use Joystick to Move | Avoid Walls, Yourself & The Title!', {
    fontSize: '16px',
    fontFamily: 'Arial, sans-serif',
    color: '#888888',
    align: 'center'
  }).setOrigin(0.5);

  // Initialize snake (start top left)
  snake = [
    { x: 75, y: 60 },
    { x: 60, y: 60 },
    { x: 45, y: 60 }
  ];

  // Spawn initial food
  spawnFood();

  // Keyboard and Arcade Button input
  this.input.keyboard.on('keydown', (event) => {
    // Normalize keyboard input to arcade codes for easier testing
    const key = KEYBOARD_TO_ARCADE[event.key] || event.key;

    // Restart game (arcade buttons only)
    if (gameOver && (key === 'P1A' || key === 'START1')) {
      restartGame(scene);
      return;
    }

    // Direction controls (keyboard keys get mapped to arcade codes)
    if (key === 'P1U' && direction.y === 0) {
      nextDirection = { x: 0, y: -1 };
    } else if (key === 'P1D' && direction.y === 0) {
      nextDirection = { x: 0, y: 1 };
    } else if (key === 'P1L' && direction.x === 0) {
      nextDirection = { x: -1, y: 0 };
    } else if (key === 'P1R' && direction.x === 0) {
      nextDirection = { x: 1, y: 0 };
    }
  });

  playTone(this, 440, 0.1);

  // ===== Downwell-like setup =====
  // Physics world bounds (very tall world)
  if (this.physics && this.physics.world) {
    this.physics.world.setBounds(0, 0, 800, worldHeight);
  }

  // Physics groups
  platformsGroup = this.physics.add.staticGroup();
  bulletsGroup = this.physics.add.group();

  // Player: white rectangle with dynamic body
  player = this.add.rectangle(400, 50, 18, 24, 0xffffff);
  this.physics.add.existing(player);
  player.body.setCollideWorldBounds(true);
  player.body.setMaxVelocity(300, 700);
  player.body.setDragX(800);

  // Seed initial platforms
  seedPlatforms(this, 150, this.cameras.main.scrollY + 800);
  // Colliders (single)
  this.physics.add.collider(player, platformsGroup);
  this.physics.add.collider(bulletsGroup, platformsGroup, (b /* bullet */, _p /* platform */) => {
    if (b && b.destroy) b.destroy();
  });

  // Camera follow (soft)
  this.cameras.main.startFollow(player, false, 0.1, 0.1);
  this.cameras.main.setBackgroundColor('#000000');

  // HUD
  if (!scoreText) {
    scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#00ff00'
    });
  }
  scoreText.setScrollFactor(0);
  if (!this.ammoText) {
    this.ammoText = this.add.text(16, 44, 'Ammo: ' + ammo, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffff00'
    }).setScrollFactor(0);
  }

  // Input handlers (use arcade mapping)
  this.input.keyboard.on('keydown', (event) => {
    const key = KEYBOARD_TO_ARCADE[event.key] || event.key;
    if (gameOver && (key === 'P1A' || key === 'START1')) {
      restartGame(scene);
      return;
    }
    if (key === 'P1L') keysState.left = true;
    if (key === 'P1R') keysState.right = true;
    if (key === 'P1U' && player.body.blocked.down) {
      player.body.setVelocityY(-jump);
      playTone(scene, 523, 0.05);
    }
    if (key === 'P1A' && !player.body.blocked.down && ammo > 0) {
      fireBullet(scene);
    }
  });

  this.input.keyboard.on('keyup', (event) => {
    const key = KEYBOARD_TO_ARCADE[event.key] || event.key;
    if (key === 'P1L') keysState.left = false;
    if (key === 'P1R') keysState.right = false;
  });
}

function drawLetter(char, startX, startY, color, useBold = false) {
  const pattern = useBold ? boldLetters[char] : letters[char];
  if (!pattern) return startX + 30;

  for (let row = 0; row < pattern.length; row++) {
    for (let col = 0; col < pattern[row].length; col++) {
      if (pattern[row][col]) {
        const blockX = startX + col * snakeSize;
        const blockY = startY + row * snakeSize;
        titleBlocks.push({ x: blockX, y: blockY, color: color });
      }
    }
  }
  return startX + (pattern[0].length + 1) * snakeSize;
}

function update(_time, _delta) {
  if (gameOver) return;

  // Horizontal control
  if (player && player.body) {
    let vx = 0;
    if (keysState.left) vx -= speed;
    if (keysState.right) vx += speed;
    player.body.setVelocityX(vx);

    // Land detection to reset ammo
    const onGround = player.body.blocked.down;
    if (onGround && !wasOnGround) {
      ammo = maxAmmo;
      if (this.ammoText) this.ammoText.setText('Ammo: ' + ammo);
      playTone(this, 440, 0.05);
    }
    wasOnGround = onGround;

    // Score by max depth
    if (player.y > maxDepth) {
      maxDepth = player.y;
      if (scoreText) scoreText.setText('Score: ' + Math.floor(maxDepth));
    }

  }

  // Ensure platforms fill below camera; recycle those far above
  const cam = this.cameras.main;
  // Camera: only descend, never move up (Downwell-like)
  cam.scrollY = Math.max(cam.scrollY, player.y - 260);
  seedPlatforms(this, cam.scrollY + 100, cam.scrollY + 800);
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (p.y < cam.scrollY - 60) {
      // move platform below
      const maxY = platforms.reduce((m, o) => Math.max(m, o.y), cam.scrollY + 300);
      positionPlatform(p, maxY + Phaser.Math.Between(70, 120));
      if (p.body && p.body.updateFromGameObject) p.body.updateFromGameObject();
    }
  }

  // Cleanup bullets below view
  bullets = bullets.filter(b => {
    if (!b.active) return false;
    if (b.y > cam.scrollY + 700) {
      b.destroy();
      return false;
    }
    return true;
  });

  // Game over if player moves above the visible area (top-out)
  if (player && player.y < cam.scrollY - 20) {
    endGame(this);
    return;
  }
}

function moveSnake(scene) {
  const head = snake[0];
  const newHead = {
    x: head.x + direction.x * snakeSize,
    y: head.y + direction.y * snakeSize
  };

  // Check wall collision
  if (newHead.x < 0 || newHead.x >= 800 || newHead.y < 0 || newHead.y >= 600) {
    endGame(scene);
    return;
  }

  // Check self collision
  for (let segment of snake) {
    if (segment.x === newHead.x && segment.y === newHead.y) {
      endGame(scene);
      return;
    }
  }

  // Check title block collision
  for (let block of titleBlocks) {
    if (newHead.x === block.x && newHead.y === block.y) {
      endGame(scene);
      return;
    }
  }

  snake.unshift(newHead);

  // Check food collision
  if (newHead.x === food.x && newHead.y === food.y) {
    score += 10;
    scoreText.setText('Score: ' + score);
    spawnFood();
    playTone(scene, 880, 0.1);

    if (moveDelay > 50) {  // Faster max speed (was 80ms)
      moveDelay -= 2;
    }
  } else {
    snake.pop();
  }
}

function spawnFood() {
  let valid = false;
  let attempts = 0;

  while (!valid && attempts < 100) {
    attempts++;
    const gridX = Math.floor(Math.random() * 53) * snakeSize;
    const gridY = Math.floor(Math.random() * 40) * snakeSize;

    // Check not on snake
    let onSnake = false;
    for (let segment of snake) {
      if (segment.x === gridX && segment.y === gridY) {
        onSnake = true;
        break;
      }
    }

    // Check not on title blocks
    let onTitle = false;
    for (let block of titleBlocks) {
      if (gridX === block.x && gridY === block.y) {
        onTitle = true;
        break;
      }
    }

    if (!onSnake && !onTitle) {
      food = { x: gridX, y: gridY };
      valid = true;
    }
  }
}

function drawGame() {
  graphics.clear();

  // Draw title blocks
  titleBlocks.forEach(block => {
    graphics.fillStyle(block.color, 1);
    graphics.fillRect(block.x, block.y, snakeSize - 2, snakeSize - 2);
  });

  // Draw snake
  snake.forEach((segment, index) => {
    if (index === 0) {
      graphics.fillStyle(0x00ff00, 1);
    } else {
      graphics.fillStyle(0x00aa00, 1);
    }
    graphics.fillRect(segment.x, segment.y, snakeSize - 2, snakeSize - 2);
  });

  // Draw food
  graphics.fillStyle(0xff0000, 1);
  graphics.fillRect(food.x, food.y, snakeSize - 2, snakeSize - 2);
}

function endGame(scene) {
  gameOver = true;
  playTone(scene, 220, 0.5);

  // Semi-transparent overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.7);
  overlay.fillRect(0, 0, 800, 600);

  // Game Over title with glow effect
  const gameOverText = scene.add.text(400, 300, 'GAME OVER', {
    fontSize: '64px',
    fontFamily: 'Arial, sans-serif',
    color: '#ff0000',
    align: 'center',
    stroke: '#ff6666',
    strokeThickness: 8
  }).setOrigin(0.5);

  // Pulsing animation for game over text
  scene.tweens.add({
    targets: gameOverText,
    scale: { from: 1, to: 1.1 },
    alpha: { from: 1, to: 0.8 },
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // Score display
  scene.add.text(400, 400, 'SCORE: ' + score, {
    fontSize: '36px',
    fontFamily: 'Arial, sans-serif',
    color: '#00ffff',
    align: 'center',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5);

  // Restart instruction with subtle animation
  const restartText = scene.add.text(400, 480, 'Press Button A or START to Restart', {
    fontSize: '24px',
    fontFamily: 'Arial, sans-serif',
    color: '#ffff00',
    align: 'center',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5);

  // Blinking animation for restart text
  scene.tweens.add({
    targets: restartText,
    alpha: { from: 1, to: 0.3 },
    duration: 600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });
}

function restartGame(scene) {
  // Minimal reset and full scene restart to avoid stale references
  gameOver = false;
  score = 0;
  maxDepth = 0;
  ammo = maxAmmo;
  wasOnGround = false;
  keysState.left = keysState.right = false;
  // Clear globals to force re-creation on next create()
  scoreText = null;
  platforms = [];
  bullets = [];
  scene.scene.restart();
}

// ===== Helper functions for Downwell-like prototype =====
function seedPlatforms(scene, fromY, toY) {
  let maxExistingY = platforms.length ? Math.max(...platforms.map(p => p.y)) : fromY - 100;
  let y = Math.max(fromY, maxExistingY + 70);
  while (y < toY) {
    const p = createPlatform(scene, y);
    platforms.push(p);
    y += Phaser.Math.Between(70, 120);
  }
}

function createPlatform(scene, y) {
  const width = Phaser.Math.Between(70, 180);
  const x = Phaser.Math.Between(40, 760 - width);
  const rect = scene.add.rectangle(x + width / 2, y, width, 12, 0x00aaff);
  scene.physics.add.existing(rect, true); // static body
  if (rect.body) {
    // One-way: collide only on top face
    rect.body.checkCollision.up = true;
    rect.body.checkCollision.down = false;
    rect.body.checkCollision.left = false;
    rect.body.checkCollision.right = false;
  }
  if (platformsGroup) platformsGroup.add(rect);
  if (rect.body && rect.body.updateFromGameObject) rect.body.updateFromGameObject();
  return rect;
}

function positionPlatform(rect, y) {
  const width = Phaser.Math.Between(70, 180);
  const x = Phaser.Math.Between(40, 760 - width);
  rect.setSize(width, 12);
  rect.displayWidth = width;
  rect.displayHeight = 12;
  rect.x = x + width / 2;
  rect.y = y;
  if (rect.body && rect.body.updateFromGameObject) rect.body.updateFromGameObject();
}

function fireBullet(scene) {
  const b = scene.add.rectangle(player.x, player.y + 16, 4, 8, 0xff4444);
  scene.physics.add.existing(b);
  b.body.setVelocityY(550);
  b.body.setAllowGravity(false);
  if (bulletsGroup) bulletsGroup.add(b);
  bullets.push(b);
  ammo -= 1;
  if (scene.ammoText) scene.ammoText.setText('Ammo: ' + ammo);
  // Recoil upwards
  player.body.setVelocityY(Math.min(player.body.velocity.y - recoil, -recoil));
  playTone(scene, 880, 0.05);
}

function playTone(scene, frequency, duration) {
  const audioContext = scene.sound.context;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'square';

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}
