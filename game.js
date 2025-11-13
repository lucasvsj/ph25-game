// Platanus Hack 25: CHAINFALL
// Arcade mapping: P1L/R (move), P1U (jump), P1A (shoot), P1B (ray gun), START1 (restart)

const ARCADE_CONTROLS = {
  // ===== PLAYER 1 CONTROLS (CHAINFALL) =====
  'P1U': ['w'],
  'P1D': ['s'],
  'P1L': ['a'],
  'P1R': ['d'],
  'P1A': ['e'],
  'P1B': ['i'],
  'START1': ['1', 'Enter']
};

// Build reverse lookup: keyboard key → arcade button code
const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keyboardKeys] of Object.entries(ARCADE_CONTROLS)) {
  if (keyboardKeys) {
    const keys = Array.isArray(keyboardKeys) ? keyboardKeys : [keyboardKeys];
    keys.forEach(key => {
      KEYBOARD_TO_ARCADE[key] = arcadeCode;
    });
  }
}

// ======== SAFE HELPERS (avoid destroyed group crashes) ========
function safeChildren(group) {
  if (!group || !group.children || !Array.isArray(group.children.entries)) return [];
  return group.children.entries;
}
function safeEach(group, fn) {
  const list = safeChildren(group);
  for (let i = 0; i < list.length; i++) {
    const child = list[i];
    if (child) fn(child);
  }
}

// ===== Scenes registry =====
const GameScene = { key: 'game', create: create, update: update };
const MenuScene = { key: 'menu', create: menuCreate, update: menuUpdate };

let currentShootKey = 'e';
let currentRayKey = 'i';
let selectedMode = 'challenger'; // 'normal' or 'challenger'
let tutorialCompleted = false; // Tutorial completion flag
let tutorialMode = false; // Currently in tutorial
let tutorialStep = 0; // Current tutorial step (0-5)
let tutorialStep5HoldStart = 0; // Time when player started holding shoot key in Step 5
let tutorialStep5Frozen = false; // Whether game is frozen in Step 5

// Game Over UI state
let gameOverIndex = 0;
let gameOverItems = [];
let gameOverBorders = [];

// Leaderboard state
let nameEntry = ['A', 'A', 'A', 'A'];
let nameEntryIndex = 0;
let nameEntryActive = false;
let leaderboardData = [];
let nameEntryElements = [];

// Failsafe global state (hold P1A+P1B for N ms)
let fsPrimaryDown = false;
let fsSecondaryDown = false;
let failsafeStartTime = 0;

// ======================= MENU SCENE ==========================
function menuCreate() {
  const s = this;
  s.cameras.main.setBackgroundColor('#000000');
  // Load settings from localStorage
  loadSettings();
  // Start background music from Main Menu
  startBackgroundMusic(this);

  // Initialize overlay visibility flags
  s.instructionsVisible = false;
  s.controlsVisible = false;
  s.modeVisible = false;
  // Reset failsafe on entering menu
  fsPrimaryDown = false; fsSecondaryDown = false; failsafeStartTime = 0;

  // Stylish animated title
  const titleText = s.add.text(400, 130, 'CHAINFALL', {
    fontSize: '72px',
    fontFamily: 'Arial, sans-serif',
    color: '#ffffff',
    align: 'center',
    stroke: '#00ffff',
    strokeThickness: 4
  }).setOrigin(0.5);

  // Title pulsing animation
  s.tweens.add({
    targets: titleText,
    scale: { from: 1, to: 1.05 },
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // Subtitle
  const subtitleText = s.add.text(400, 200, 'Chain your combos as you fall', {
    fontSize: '20px',
    fontFamily: 'Arial, sans-serif',
    color: '#00ffff',
    align: 'center',
    style: 'italic'
  }).setOrigin(0.5).setAlpha(0.8);

  // Explicit buttons to avoid mapping errors
  s.menuItems = [];
  s.menuBorders = [];
  const mkBtn = (y, label, onClick) => {
    const border = s.add.rectangle(400, y, 280, 50, 0x001a1a, 0.5);
    border.setStrokeStyle(2, 0x00ffff, 0.8);
    s.menuBorders.push(border);

    const t = s.add.text(400, y, label, {
      fontSize: '32px',
      fontFamily: 'Arial, sans-serif',
      color: '#00ffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => { s.menuIndex = s.menuItems.indexOf(t); updateMenuVisuals(s); });
    t.on('pointerdown', onClick);
    s.menuItems.push(t);
    return t;
  };
  s.btnStart = mkBtn(260, 'Start Game', () => showModeSelect(s));
  s.btnTutorial = mkBtn(320, 'Tutorial', () => startTutorial(s));
  s.btnInstr = mkBtn(380, 'Instructions', () => showInstructions(s));
  s.btnLeaderboard = mkBtn(440, 'Leaderboard', () => showLeaderboard(s));
  s.btnExit  = mkBtn(500, 'Controls', () => showControls(s));
  s.menuIndex = 0; updateMenuVisuals(s);

  // ===== Instructions overlay (hidden by default) =====
  s.instructionsGroup = s.add.group();
  const iOv = s.add.rectangle(400, 300, 800, 600, 0x000000, 0.86);
  const iT = s.add.text(400, 60, 'Instructions', { fontSize: '40px', fontFamily: 'Arial, sans-serif', color: '#ffff00' }).setOrigin(0.5);

  s.instrCategory = 0;
  s.instrCategoryItems = [];
  s.instrCategoryBorders = [];
  const cX = 150, cY = 200, cS = 80;
  const cats = ['Movement', 'Basic Shoot', 'Advanced Shoot'];
  for (let i = 0; i < 3; i++) {
    const b = s.add.rectangle(cX, cY + i * cS, 220, 60, 0x001a1a, 0.5);
    b.setStrokeStyle(2, 0x00ffff, 0.8);
    const t = s.add.text(cX, cY + i * cS, cats[i], {
      fontSize: '22px', fontFamily: 'Arial', color: '#0ff',
      stroke: '#000', strokeThickness: 3, align: 'center'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => { s.instrCategory = i; updateInstrCategoryVisuals(s); });
    t.on('pointerdown', () => { s.instrCategory = i; updateInstrCategoryVisuals(s); });
    s.instrCategoryItems.push(t);
    s.instrCategoryBorders.push(b);
  }

  const iBackBorder = s.add.rectangle(150, 520, 180, 50, 0x003300, 0.6);
  iBackBorder.setStrokeStyle(2, 0x00ff00, 0.8);
  const iBack = s.add.text(150, 520, 'Back', {
    fontSize: '28px', fontFamily: 'Arial', color: '#0f0',
    stroke: '#000', strokeThickness: 3
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  iBack.on('pointerdown', () => hideInstructions(s));

  s.movementGroup = [];
  const mx=500,my=300;
  const gm=s.add.graphics();
  gm.fillStyle(0x00ffff,1);
  gm.fillTriangle(mx-90,my+40,mx-80,my+32,mx-80,my+48);
  gm.fillTriangle(mx+90,my+40,mx+80,my+32,mx+80,my+48);
  gm.fillTriangle(mx,my-40,mx-8,my-30,mx+8,my-30);
  s.movementGroup.push(
    s.add.text(mx,180,'MOVE / JUMP',{fontSize:'24px',fontFamily:'Arial',color:'#fff'}).setOrigin(0.5),
    s.add.rectangle(mx-60,my+40,40,40,0x111111),s.add.rectangle(mx+60,my+40,40,40,0x111111),s.add.rectangle(mx,my-10,40,40,0x111111),
    s.add.text(mx-60,my+40,'A',{fontSize:'24px',fontFamily:'Arial',color:'#0ff'}).setOrigin(0.5),
    s.add.text(mx+60,my+40,'D',{fontSize:'24px',fontFamily:'Arial',color:'#0ff'}).setOrigin(0.5),
    s.add.text(mx,my-10,'W',{fontSize:'24px',fontFamily:'Arial',color:'#0ff'}).setOrigin(0.5),
    s.add.text(mx,380,'A/D: Move • W: Jump',{fontSize:'18px',fontFamily:'Arial',color:'#ddd'}).setOrigin(0.5),
    gm
  );

  s.basicShootingGroup = [];
  const ey=310,sx=400,cx=600;
  const pr=s.add.rectangle(sx,ey-100,18,24,0xffffff);pr.setStrokeStyle(2,0x00ffff,0.6);
  const cp=s.add.rectangle(cx,ey-100,18,24,0xffffff);cp.setStrokeStyle(2,0x00ffff,0.6);
  const gb=s.add.graphics();
  gb.fillStyle(0xff4444,1);gb.fillTriangle(sx,ey+38,sx-8,ey+26,sx+8,ey+26);
  gb.fillStyle(0x00ffff,1);gb.fillTriangle(cx,ey+38,cx-8,ey+26,cx+8,ey+26);
  s.basicShootingGroup.push(
    s.add.text(sx,160,'SHOOT',{fontSize:'22px',fontFamily:'Arial',color:'#ff0'}).setOrigin(0.5),
    s.add.rectangle(sx,ey+14,160,12,0x00aaff),pr,
    s.add.rectangle(sx,ey-34,6,14,0xff4444),s.add.rectangle(sx,ey-60,6,14,0xff4444),
    s.add.rectangle(sx,ey,30,16,0xff2222),
    s.add.text(sx,ey+60,'Press '+currentShootKey.toUpperCase()+' in air',{fontSize:'16px',fontFamily:'Arial',color:'#ddd'}).setOrigin(0.5),
    s.add.text(sx,ey+82,'Land: reload',{fontSize:'16px',fontFamily:'Arial',color:'#aaa'}).setOrigin(0.5),
    s.add.text(cx,160,'COMBO',{fontSize:'22px',fontFamily:'Arial',color:'#ff0'}).setOrigin(0.5),
    s.add.rectangle(cx,ey+14,160,12,0x00aaff),cp,
    s.add.rectangle(cx,ey-34,6,14,0x00ffff),s.add.rectangle(cx,ey-60,6,14,0x00ffff),
    s.add.rectangle(cx,ey,30,16,0xff2222),
    s.add.text(cx,ey+60,'Air kills: combo+',{fontSize:'16px',fontFamily:'Arial',color:'#ddd'}).setOrigin(0.5),
    s.add.text(cx,ey+82,'Gain blue ammo',{fontSize:'16px',fontFamily:'Arial',color:'#aaa'}).setOrigin(0.5),
    gb
  );

  s.advancedShootingGroup = [];
  const ay=280,chx=400,rx=600;
  const chp=s.add.rectangle(chx,ay-66,18,24,0xffffff);chp.setStrokeStyle(2,0xEEF527,1.5);
  const rp=s.add.rectangle(rx,ay-100,18,24,0xffffff);rp.setStrokeStyle(2,0x00ffff,0.6);
  const se=s.add.rectangle(rx,ay,30,16,0xff2222);se.setStrokeStyle(3,0x00ffff,0.8);
  const ga=s.add.graphics();
  ga.fillStyle(0xEEF527,0.3);
  for(let i=0;i<3;i++){ga.fillCircle(chx,ay-66,20+i*8);}
  ga.fillStyle(0xEEF527,1);ga.fillRect(chx-1,ay-86,2,40);
  ga.lineStyle(3,0xEEF527,1);ga.strokeLineShape(new Phaser.Geom.Line(rx,ay-76,rx,ay-14));
  s.advancedShootingGroup.push(
    s.add.text(chx,160,'CHARGE',{fontSize:'22px',fontFamily:'Arial',color:'#ff0'}).setOrigin(0.5),
    s.add.rectangle(chx,ay+14,160,12,0x00aaff),chp,
    s.add.text(chx,ay+50,'Hold '+currentRayKey.toUpperCase()+': charge',{fontSize:'16px',fontFamily:'Arial',color:'#ddd'}).setOrigin(0.5),
    s.add.text(chx,ay+72,'Slow-mo + power',{fontSize:'16px',fontFamily:'Arial',color:'#aaa'}).setOrigin(0.5),
    s.add.text(rx,160,'RAY GUN',{fontSize:'22px',fontFamily:'Arial',color:'#ff0'}).setOrigin(0.5),
    s.add.rectangle(rx,ay+16,160,12,0x00aaff),rp,se,
    s.add.text(rx,ay+50,'Release '+currentRayKey.toUpperCase()+': vertical ray',{fontSize:'16px',fontFamily:'Arial',color:'#ddd'}).setOrigin(0.5),
    s.add.text(rx,ay+72,'Breaks shields',{fontSize:'16px',fontFamily:'Arial',color:'#aaa'}).setOrigin(0.5),
    s.add.text(rx,ay+94,'Can kill multiple enemies',{fontSize:'16px',fontFamily:'Arial',color:'#aaa'}).setOrigin(0.5),
    ga
  );

  // Add all to main group and set initial visibility
  s.instructionsGroup.addMultiple([iOv, iT, iBackBorder, iBack]);
  s.instrCategoryItems.forEach(item => s.instructionsGroup.add(item));
  s.instrCategoryBorders.forEach(border => s.instructionsGroup.add(border));
  s.movementGroup.forEach(item => s.instructionsGroup.add(item));
  s.basicShootingGroup.forEach(item => s.instructionsGroup.add(item));
  s.advancedShootingGroup.forEach(item => s.instructionsGroup.add(item));
  
  s.instrItems = [iBack];
  s.instrBorders = [iBackBorder];
  s.instrIndex = 0; 
  updateInstrCategoryVisuals(s);
  hideInstructions(s);

  s.input.keyboard.on('keydown', (ev) => {
    if (!s.instructionsVisible || s.instructionsJustOpened) return;
    const k = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if (ev.key === 'Escape' || k === 'P1B') { hideInstructions(s); ev.stopPropagation?.(); return; }
    if (k === 'P1U') { 
      s.instrIndex = (s.instrIndex + 3) % 4;
      if (s.instrIndex === 3) s.instrCategory = -1;
      else s.instrCategory = s.instrIndex;
      updateInstrVisuals(s);
      updateInstrCategoryVisuals(s); 
      playTone(s, 440, 0.05);
      ev.stopPropagation?.(); 
      return; 
    }
    if (k === 'P1D') { 
      s.instrIndex = (s.instrIndex + 1) % 4;
      if (s.instrIndex === 3) s.instrCategory = -1;
      else s.instrCategory = s.instrIndex;
      updateInstrVisuals(s);
      updateInstrCategoryVisuals(s); 
      playTone(s, 440, 0.05);
      ev.stopPropagation?.(); 
      return; 
    }
    ev.stopPropagation?.();
  });
  s.input.keyboard.on('keyup', (ev) => {
    if (!s.instructionsVisible || s.instructionsJustOpened) return;
    const k = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if ((ev.key === 'Escape' || k === 'P1B') || (k === 'P1A' && s.instrIndex === 3)) {
      hideInstructions(s);
      ev.stopPropagation?.();
    }
  });

  // ===== Controls overlay (hidden by default) =====
  s.controlsGroup = s.add.group();
  const cOv = s.add.rectangle(400, 300, 800, 600, 0x000000, 0.86);
  const cT = s.add.text(400, 150, 'Controls', { fontSize: '40px', fontFamily: 'Arial, sans-serif', color: '#ffff00' }).setOrigin(0.5);
  s.controlsInfo = s.add.text(400, 200, 'Select an item and press a key to rebind', { fontSize: '18px', fontFamily: 'Arial, sans-serif', color: '#dddddd', align: 'center' }).setOrigin(0.5);

  const cShootBorder = s.add.rectangle(400, 270, 360, 46, 0x001a1a, 0.5);
  cShootBorder.setStrokeStyle(2, 0x00ffff, 0.8);
  const cShoot = s.add.text(400, 270, 'Normal Shoot: ' + currentShootKey.toUpperCase(), {
    fontSize: '28px', fontFamily: 'Arial, sans-serif', color: '#00ffff', stroke: '#000000', strokeThickness: 2
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  cShoot.on('pointerover', () => { s.controlsIndex = 0; updateControlsVisuals(s); });

  const cRayBorder = s.add.rectangle(400, 330, 360, 46, 0x1a1a00, 0.5);
  cRayBorder.setStrokeStyle(2, 0xEEF527, 0.8);
  const cRay = s.add.text(400, 330, 'Ray Gun: ' + currentRayKey.toUpperCase(), {
    fontSize: '28px', fontFamily: 'Arial, sans-serif', color: '#EEF527', stroke: '#000000', strokeThickness: 2
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  cRay.on('pointerover', () => { s.controlsIndex = 1; updateControlsVisuals(s); });

  const cBackBorder = s.add.rectangle(400, 420, 180, 50, 0x003300, 0.6);
  cBackBorder.setStrokeStyle(2, 0x00ff00, 0.8);
  const cBack = s.add.text(400, 420, 'Back', {
    fontSize: '28px',
    fontFamily: 'Arial, sans-serif',
    color: '#00ff00',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  cBack.on('pointerover', () => { s.controlsIndex = 2; updateControlsVisuals(s); });
  cBack.on('pointerdown', () => hideControls(s));

  s.controlsGroup.addMultiple([cOv, cT, s.controlsInfo, cShootBorder, cShoot, cRayBorder, cRay, cBackBorder, cBack]);
  s.controlsItems = [cShoot, cRay, cBack];
  s.controlsBorders = [cShootBorder, cRayBorder, cBackBorder];
  s.controlsIndex = 0; updateControlsVisuals(s); hideControls(s);

  // ===== Leaderboard overlay (hidden by default) =====
  s.leaderboardGroup = s.add.group();
  s.leaderboardVisible = false;
  const lOv = s.add.rectangle(400, 300, 800, 600, 0x000000, 0.90);
  const lT = s.add.text(400, 60, 'LEADERBOARD', { fontSize: '48px', fontFamily: 'Arial', color: '#ffff00', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
  // Category selector (Normal / Challenger)
  s.lbCategory = 0;
  s.lbCatItems = [];
  s.lbCatBorders = [];
  const mkLbCat = (x, label, idx) => {
    const b = s.add.rectangle(x, 110, 180, 44, 0x001a1a, 0.5);
    b.setStrokeStyle(2, 0x00ffff, 0.8);
    const t = s.add.text(x, 110, label, { fontSize: '24px', fontFamily: 'Arial', color: '#00ffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => { s.lbCategory = idx; updateLeaderboardCategoryVisuals(s); });
    t.on('pointerdown', () => { s.lbCategory = idx; updateLeaderboardCategoryVisuals(s); });
    s.leaderboardGroup.add(b); s.leaderboardGroup.add(t);
    s.lbCatBorders.push(b); s.lbCatItems.push(t);
  };
  mkLbCat(260, 'NORMAL', 0);
  mkLbCat(540, 'CHALLENGER', 1);
  
  s.leaderboardTexts = [];
  for (let i = 0; i < 5; i++) {
    const y = 170 + i * 40;
    const rankText = s.add.text(180, y, (i + 1) + '.', {
      fontSize: '24px', fontFamily: 'Arial', color: '#00ffff',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(1, 0.5);
    
    const nameText = s.add.text(200, y, '----', {
      fontSize: '24px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0, 0.5);
    
    const scoreText = s.add.text(620, y, '0', {
      fontSize: '24px', fontFamily: 'Arial', color: '#00ff00',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(1, 0.5);
    
    s.leaderboardTexts.push({ rank: rankText, name: nameText, score: scoreText });
    s.leaderboardGroup.add(rankText);
    s.leaderboardGroup.add(nameText);
    s.leaderboardGroup.add(scoreText);
  }
  
  const lBackBorder = s.add.rectangle(400, 540, 180, 50, 0x003300, 0.6);
  lBackBorder.setStrokeStyle(2, 0x00ff00, 0.8);
  const lBack = s.add.text(400, 540, 'Back', {
    fontSize: '28px', fontFamily: 'Arial', color: '#0f0',
    stroke: '#000', strokeThickness: 3
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  lBack.on('pointerover', () => { s.leaderboardIndex = 0; updateLeaderboardVisuals(s); });
  lBack.on('pointerdown', () => hideLeaderboard(s));
  
  s.leaderboardGroup.addMultiple([lOv, lT, lBackBorder, lBack]);
  s.leaderboardItems = [lBack];
  s.leaderboardBorders = [lBackBorder];
  hideLeaderboard(s);
  
  s.input.keyboard.on('keydown', (ev) => {
    if (!s.leaderboardVisible) return;
    if (s.leaderboardJustOpened) return;
    const k = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if (k === 'P1L') { s.lbCategory = (s.lbCategory + 1) % 2; updateLeaderboardCategoryVisuals(s); playTone(s, 440, 0.05); ev.stopPropagation?.(); return; }
    if (k === 'P1R') { s.lbCategory = (s.lbCategory + 1) % 2; updateLeaderboardCategoryVisuals(s); playTone(s, 440, 0.05); ev.stopPropagation?.(); return; }
    if (k === 'P1U' || k === 'P1D') {
      // Only one item for now, still play feedback and refresh visuals
      updateLeaderboardVisuals(s);
      playTone(s, 440, 0.05);
      ev.stopPropagation?.();
      return;
    }
    if (ev.key === 'Escape' || k === 'P1B') { hideLeaderboard(s); ev.stopPropagation?.(); return; }
    // P1A handled on keyup to avoid keyboard repeat issues
  });
  s.input.keyboard.on('keyup', (ev) => {
    if (!s.leaderboardVisible) return;
    if (s.leaderboardJustOpened) return;
    const k = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if (ev.key === 'Escape' || k === 'P1B' || k === 'P1A') {
      hideLeaderboard(s);
      ev.stopPropagation?.();
    }
  });

  // Panel key handling: Controls (navigation, back and rebinding)
  s.input.keyboard.on('keydown', (ev) => {
    if (!s.controlsVisible) return;
    if (s.controlsJustOpened) return;
    const raw = ev.key;
    const key = KEYBOARD_TO_ARCADE[raw] || raw;
    if (raw === 'Escape' || key === 'P1B') { hideControls(s); return; }
    if (key === 'P1U') { s.controlsIndex = (s.controlsIndex + s.controlsItems.length - 1) % s.controlsItems.length; updateControlsVisuals(s); return; }
    if (key === 'P1D') { s.controlsIndex = (s.controlsIndex + 1) % s.controlsItems.length; updateControlsVisuals(s); return; }
    // Rebind when a single printable key is pressed
    if (raw && raw.length === 1) {
      const k = raw.toLowerCase();
      if (s.controlsIndex === 0) {
        rebindShootKey(k);
        if (s.controlsItems[0] && s.controlsItems[0].setText) s.controlsItems[0].setText('Normal Shoot: ' + currentShootKey.toUpperCase());
      } else if (s.controlsIndex === 1) {
        rebindRayKey(k);
        if (s.controlsItems[1] && s.controlsItems[1].setText) s.controlsItems[1].setText('Ray Gun: ' + currentRayKey.toUpperCase());
      }
      return;
    }
  });
  s.input.keyboard.on('keyup', (ev) => {
    if (!s.controlsVisible) return;
    if (s.controlsJustOpened) return;
    const raw = ev.key;
    const key = KEYBOARD_TO_ARCADE[raw] || raw;
    if (key === 'P1A' && s.controlsIndex === 2) { hideControls(s); return; }
  });

  // Mode Select overlay (hidden by default)
  buildModeSelectOverlay(s);
  hideModeSelect(s);

  // Menu navigation keys (disabled when overlays are open)
  s.input.keyboard.on('keydown', (ev) => {
    const key = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if (s.instructionsVisible || s.controlsVisible || s.modeVisible || s.leaderboardVisible) return;
    if (key === 'P1U') { s.menuIndex = (s.menuIndex + s.menuItems.length - 1) % s.menuItems.length; updateMenuVisuals(s); }
    else if (key === 'P1D') { s.menuIndex = (s.menuIndex + 1) % s.menuItems.length; updateMenuVisuals(s); }
    else if (key === 'P1A') {
      const actions = [
        () => showModeSelect(s),
        () => startTutorial(s),
        () => showInstructions(s),
        () => showLeaderboard(s),
        () => showControls(s)
      ];
      actions[s.menuIndex]();
    }
  });
  // Failsafe key tracking (menu scene)
  s.input.keyboard.on('keydown', (ev) => {
    if (s.instructionsVisible || s.controlsVisible || s.modeVisible || s.leaderboardVisible) return;
    const key = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if (key === 'P1A') fsPrimaryDown = true;
    if (key === 'P1B') fsSecondaryDown = true;
    if (fsPrimaryDown && fsSecondaryDown && failsafeStartTime === 0) failsafeStartTime = s.time.now;
  });
  s.input.keyboard.on('keyup', (ev) => {
    if (s.instructionsVisible || s.controlsVisible || s.modeVisible || s.leaderboardVisible) return;
    const key = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if (key === 'P1A') fsPrimaryDown = false;
    if (key === 'P1B') fsSecondaryDown = false;
    if (!fsPrimaryDown || !fsSecondaryDown) failsafeStartTime = 0;
  });
}

function menuUpdate() {
  // Avoid triggering failsafe while overlays are open in menu
  if (this.instructionsVisible || this.controlsVisible || this.modeVisible || this.leaderboardVisible) return;
  checkFailsafe(this);
}

// ===== Failsafe: hold primary+secondary for N ms to return to menu =====
function checkFailsafe(scene) {
  if (!scene || !scene.time) return;
  if (fsPrimaryDown && fsSecondaryDown) {
    if (failsafeStartTime === 0) failsafeStartTime = scene.time.now;
    const elapsed = scene.time.now - failsafeStartTime;
    if (elapsed >= FAILSAFE_HOLD_MS) {
      fsPrimaryDown = false;
      fsSecondaryDown = false;
      failsafeStartTime = 0;
      if (scene.scene && scene.scene.start) goToMenu(scene);
    }
  } else {
    // reset timer if any of the keys is up
    failsafeStartTime = 0;
  }
}

function updateMenuVisuals(s) {
  s.menuItems.forEach((t, i) => {
    const sel = i === s.menuIndex;
    const border = s.menuBorders[i];
    t.setScale(sel ? 1.15 : 1);
    t.setColor(sel ? '#ffffff' : '#00ffff');
    if (border) {
      border.setScale(sel ? 1.08 : 1);
      border.setStrokeStyle(sel ? 3 : 2, sel ? 0xffffff : 0x00ffff, sel ? 1 : 0.8);
      border.setFillStyle(0x001a1a, sel ? 0.8 : 0.5);
    }
  });
}

// ===== Instructions / Controls visuals =====
function updateInstrVisuals(s) {
  if (!s.instrItems) return;
  const sel = s.instrIndex === 3;
  const t = s.instrItems[0];
  const border = s.instrBorders ? s.instrBorders[0] : null;
  t.setScale(sel ? 1.25 : 1);
  t.setColor(sel ? '#ffff00' : '#00ff00');
  t.setStroke(sel ? '#ffffff' : '#000000', sel ? 4 : 3);
  if (border) {
    border.setScale(sel ? 1.12 : 1);
    border.setStrokeStyle(sel ? 3 : 2, sel ? 0xffff00 : 0x00ff00, sel ? 1 : 0.8);
    border.setFillStyle(0x003300, sel ? 0.9 : 0.6);
  }
}
function updateInstrCategoryVisuals(s) {
  if (!s.instrCategoryItems) return;
  s.instrCategoryItems.forEach((t, i) => {
    const sel = i === s.instrCategory;
    const b = s.instrCategoryBorders ? s.instrCategoryBorders[i] : null;
    t.setScale(sel ? 1.15 : 1);
    t.setColor(sel ? '#ff0' : '#0ff');
    t.setStroke(sel ? '#fff' : '#000', sel ? 4 : 3);
    if (b) {
      b.setScale(sel ? 1.08 : 1);
      b.setStrokeStyle(sel ? 3 : 2, sel ? 0xffff00 : 0x00ffff, sel ? 1 : 0.8);
      b.setFillStyle(0x001a1a, sel ? 0.8 : 0.5);
    }
  });
  const showContent = s.instrCategory >= 0;
  if (s.movementGroup) s.movementGroup.forEach(item => item.setVisible(showContent && s.instrCategory === 0));
  if (s.basicShootingGroup) s.basicShootingGroup.forEach(item => item.setVisible(showContent && s.instrCategory === 1));
  if (s.advancedShootingGroup) s.advancedShootingGroup.forEach(item => item.setVisible(showContent && s.instrCategory === 2));
}
function updateControlsVisuals(s) {
  if (!s.controlsItems) return;
  s.controlsItems.forEach((t, i) => {
    const sel = i === s.controlsIndex;
    const border = s.controlsBorders ? s.controlsBorders[i] : null;
    t.setScale(sel ? 1.25 : 1);
    t.setColor(sel ? '#ffff00' : '#00ff00');
    t.setStroke(sel ? '#ffffff' : '#000000', sel ? 4 : 3);
    if (border) {
      border.setScale(sel ? 1.12 : 1);
      border.setStrokeStyle(sel ? 3 : 2, sel ? 0xffff00 : 0x00ff00, sel ? 1 : 0.8);
      border.setFillStyle(sel ? 0x003300 : 0x003300, sel ? 0.9 : 0.6);
    }
  });
}
function updateLeaderboardVisuals(s) {
  if (!s.leaderboardItems) return;
  s.leaderboardItems.forEach((t, i) => {
    const sel = i === s.leaderboardIndex;
    const border = s.leaderboardBorders ? s.leaderboardBorders[i] : null;
    t.setScale(sel ? 1.25 : 1);
    t.setColor(sel ? '#ffff00' : '#00ff00');
    if (border) {
      border.setScale(sel ? 1.08 : 1);
      border.setStrokeStyle(sel ? 3 : 2, sel ? 0xffff00 : 0x00ff00, sel ? 1 : 0.8);
      border.setFillStyle(0x003300, sel ? 0.9 : 0.6);
    }
  });
}
function refreshLeaderboardList(s) {
  const mode = s.lbCategory === 1 ? 'challenger' : 'normal';
  const list = leaderboardData.filter(e => e.mode === mode).sort((a,b)=>b.score-a.score).slice(0,5);
  for (let i = 0; i < 5; i++) {
    if (i < list.length) {
      const entry = list[i];
      s.leaderboardTexts[i].name.setText(entry.name);
      s.leaderboardTexts[i].score.setText(entry.score.toString());
      s.leaderboardTexts[i].rank.setAlpha(1);
      s.leaderboardTexts[i].name.setAlpha(1);
      s.leaderboardTexts[i].score.setAlpha(1);
    } else {
      s.leaderboardTexts[i].name.setText('----');
      s.leaderboardTexts[i].score.setText('0');
      s.leaderboardTexts[i].rank.setAlpha(0.3);
      s.leaderboardTexts[i].name.setAlpha(0.3);
      s.leaderboardTexts[i].score.setAlpha(0.3);
    }
  }
}
function updateLeaderboardCategoryVisuals(s) {
  if (!s.lbCatItems) return;
  s.lbCatItems.forEach((t, i) => {
    const sel = i === s.lbCategory;
    const b = s.lbCatBorders ? s.lbCatBorders[i] : null;
    t.setScale(sel ? 1.15 : 1);
    t.setColor(sel ? '#ffff00' : '#00ffff');
    t.setStroke(sel ? '#ffffff' : '#000000', sel ? 4 : 3);
    if (b) {
      b.setScale(sel ? 1.08 : 1);
      b.setStrokeStyle(sel ? 3 : 2, sel ? 0xffff00 : 0x00ffff, sel ? 1 : 0.8);
      b.setFillStyle(0x001a1a, sel ? 0.8 : 0.5);
    }
  });
  refreshLeaderboardList(s);
}
function showInstructions(s) {
  s.instructionsVisible = true;
  s.instructionsGroup.setVisible(true);
  s.instrIndex = 0;
  s.instrCategory = 0;
  updateInstrVisuals(s);
  updateInstrCategoryVisuals(s);
  s.instructionsJustOpened = true;
  setTimeout(() => { s.instructionsJustOpened = false; }, 300);
}
function hideInstructions(s) {
  s.instructionsVisible = false;
  s.instructionsGroup.setVisible(false);
  s.instructionsJustOpened = false;
}
function showControls(s) {
  s.controlsVisible = true;
  s.controlsGroup.setVisible(true);
  s.controlsIndex = 0;
  updateControlsVisuals(s);
  s.controlsJustOpened = true;
  setTimeout(() => { s.controlsJustOpened = false; }, 300);
}
function hideControls(s) {
  s.controlsVisible = false;
  s.controlsGroup.setVisible(false);
  s.controlsJustOpened = false;
}
function showLeaderboard(s) {
  loadLeaderboard();
  s.leaderboardVisible = true;
  s.leaderboardGroup.setVisible(true);
  // init selection state
  s.leaderboardIndex = 0;
  updateLeaderboardVisuals(s);
  updateLeaderboardCategoryVisuals(s);
  s.leaderboardJustOpened = true;
  setTimeout(() => { s.leaderboardJustOpened = false; }, 300);
  
  refreshLeaderboardList(s);
}
function hideLeaderboard(s) {
  s.leaderboardVisible = false;
  s.leaderboardGroup.setVisible(false);
  s.leaderboardJustOpened = false;
}

// ===== Mode Select overlay =====
function buildModeSelectOverlay(s) {
  s.modeGroup = s.add.group();

  const overlay = s.add.rectangle(400, 300, 800, 600, 0x000000, 0.86);
  const title = s.add.text(400, 110, 'SELECT MODE', {
    fontSize: '44px', fontFamily: 'Arial, sans-serif', color: '#ffff00', stroke: '#000000', strokeThickness: 4
  }).setOrigin(0.5);

  const help = s.add.text(400, 160, `Use A/D to choose • Press ${currentShootKey.toUpperCase()} to confirm • ${currentRayKey.toUpperCase()} to cancel`, {
    fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#dddddd'
  }).setOrigin(0.5);

  const enemyYValue = 346;

  // Cards
  s.modeIndex = 0;
  const cardW = 270; const cardH = 280;

  // Normal card
  const nCardGlow = s.add.rectangle(250, 330, cardW + 20, cardH + 20, 0x00ffff, 0.15);
  const nCardBorder = s.add.rectangle(250, 330, cardW, cardH, 0x001a1a, 0.55);
  nCardBorder.setStrokeStyle(2, 0x00ffff, 0.8);

  const nTitle = s.add.text(250, 210, 'NORMAL', {
    fontSize: '28px', fontFamily: 'Arial, sans-serif', color: '#00ffff', stroke: '#000000', strokeThickness: 2
  }).setOrigin(0.5);

  const nDesc = s.add.text(250, 250, 'You only loose when taking damage.', {
    fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#dddddd', align: 'center', wordWrap: { width: 260 }
  }).setOrigin(0.5);

  // Normal illustration
  const nG = s.add.graphics();
  nG.lineStyle(2, 0x00ffff, 1);
  const nPlat = s.add.rectangle(250, 360, 160, 12, 0x00aaff);
  const nPlayer = s.add.rectangle(250, 300, 18, 24, 0xffffff);
  const nEnemy = s.add.rectangle(250, enemyYValue, 30, 16, 0xff2222);
  const nBullet = s.add.rectangle(250, enemyYValue - 22, 6, 14, 0xff4444);
  const nSelectedLabel = s.add.text(250, 460, '< SELECTED >', {
    fontSize: '18px', fontFamily: 'Arial, sans-serif', color: '#ffffff', stroke: '#000000', strokeThickness: 3
  }).setOrigin(0.5).setAlpha(0);
  const nHint = s.add.text(250, 420, `Press ${currentShootKey.toUpperCase()} to pick`, {
    fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa'
  }).setOrigin(0.5);

  // Challenger card
  const cCardGlow = s.add.rectangle(550, 330, cardW + 20, cardH + 20, 0xEEF527, 0.15);
  const cCardBorder = s.add.rectangle(550, 330, cardW, cardH, 0x1a1a00, 0.55);
  cCardBorder.setStrokeStyle(2, 0xEEF527, 0.8);

  const cTitle = s.add.text(550, 210, 'CHALLENGER', {
    fontSize: '28px', fontFamily: 'Arial, sans-serif', color: '#EEF527', stroke: '#000000', strokeThickness: 2
  }).setOrigin(0.5);

  const cDesc = s.add.text(550, 250,
    'Istantly loose after landing on any platfrom while in combo mode.',
    {
      fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#dddddd', align: 'center', wordWrap: { width: 260 }
    }).setOrigin(0.5);

  const cG = s.add.graphics();
  cG.lineStyle(2, 0xEEF527, 1);
  const cPlat = s.add.rectangle(550, 360, 160, 12, 0x00aaff);
  const cPlayer = s.add.rectangle(550, 300, 18, 24, 0xffffff);
  const cEnemy = s.add.rectangle(550, enemyYValue, 30, 16, 0xff2222);
  const cBullet = s.add.rectangle(550, enemyYValue - 22, 6, 14, 0x00ffff);
  const cSelectedLabel = s.add.text(550, 460, '< SELECTED >', {
    fontSize: '18px', fontFamily: 'Arial, sans-serif', color: '#ffffff', stroke: '#000000', strokeThickness: 3
  }).setOrigin(0.5).setAlpha(0);
  const cHint = s.add.text(550, 420, `Press ${currentShootKey.toUpperCase()} to pick`, {
    fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa'
  }).setOrigin(0.5);

  // Add to group
  s.modeGroup.addMultiple([
    overlay, title, help,
    nCardGlow, nCardBorder, nTitle, nDesc, nG, nPlat, nPlayer, nEnemy, nBullet, nHint, nSelectedLabel,
    cCardGlow, cCardBorder, cTitle, cDesc, cG, cPlat, cPlayer, cEnemy, cBullet, cHint, cSelectedLabel
  ]);

  // Input for Mode Select
  s.input.keyboard.on('keydown', (ev) => {
    if (!s.modeVisible) return;
    const raw = ev.key;
    const key = KEYBOARD_TO_ARCADE[raw] || raw;
    if (key === 'P1L') { s.modeIndex = 0; updateModeVisuals(); }
    else if (key === 'P1R') { s.modeIndex = 1; updateModeVisuals(); }
    else if (key === 'P1A') { confirmMode(); }
    else if (key === 'P1B' || raw === 'Escape') { hideModeSelect(s); }
  });

  // Click handlers on cards
  [nCardBorder, nTitle, nDesc, nPlat, nPlayer, nEnemy, nBullet, nG].forEach(obj => {
    obj.setInteractive({ useHandCursor: true }).on('pointerdown', () => { s.modeIndex = 0; updateModeVisuals(); confirmMode(); });
    obj.on('pointerover', () => { s.modeIndex = 0; updateModeVisuals(); });
  });
  [cCardBorder, cTitle, cDesc, cPlat, cPlayer, cEnemy, cBullet, cG].forEach(obj => {
    obj.setInteractive({ useHandCursor: true }).on('pointerdown', () => { s.modeIndex = 1; updateModeVisuals(); confirmMode(); });
    obj.on('pointerover', () => { s.modeIndex = 1; updateModeVisuals(); });
  });

  function updateModeVisuals() {
    const leftSel = s.modeIndex === 0;
    const rightSel = s.modeIndex === 1;
    
    // Kill existing tweens
    s.tweens.killTweensOf([nCardBorder, nCardGlow, nTitle, nSelectedLabel]);
    s.tweens.killTweensOf([cCardBorder, cCardGlow, cTitle, cSelectedLabel]);
    
    // Normal card
    nCardBorder.setScale(leftSel ? 1.08 : 1);
    nCardBorder.setStrokeStyle(leftSel ? 4 : 2, leftSel ? 0xffffff : 0x00ffff, 1);
    nCardBorder.setFillStyle(0x001a1a, leftSel ? 0.75 : 0.55);
    nTitle.setScale(leftSel ? 1.12 : 1);
    nTitle.setColor(leftSel ? '#ffffff' : '#00ffff');
    nSelectedLabel.setAlpha(leftSel ? 1 : 0);
    
    if (leftSel) {
      s.tweens.add({
        targets: nCardGlow,
        alpha: { from: 0.2, to: 0.4 },
        scale: { from: 1, to: 1.05 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      s.tweens.add({
        targets: nSelectedLabel,
        scale: { from: 0.95, to: 1.05 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else {
      nCardGlow.setAlpha(0.15);
      nCardGlow.setScale(1);
    }
    
    // Challenger card
    cCardBorder.setScale(rightSel ? 1.08 : 1);
    cCardBorder.setStrokeStyle(rightSel ? 4 : 2, rightSel ? 0xffffff : 0xEEF527, 1);
    cCardBorder.setFillStyle(0x1a1a00, rightSel ? 0.75 : 0.55);
    cTitle.setScale(rightSel ? 1.12 : 1);
    cTitle.setColor(rightSel ? '#ffffff' : '#EEF527');
    cSelectedLabel.setAlpha(rightSel ? 1 : 0);
    
    if (rightSel) {
      s.tweens.add({
        targets: cCardGlow,
        alpha: { from: 0.2, to: 0.4 },
        scale: { from: 1, to: 1.05 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      s.tweens.add({
        targets: cSelectedLabel,
        scale: { from: 0.95, to: 1.05 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else {
      cCardGlow.setAlpha(0.15);
      cCardGlow.setScale(1);
    }
    
    playTone(s, 440, 0.05);
  }

  function confirmMode() {
    selectedMode = s.modeIndex === 0 ? 'normal' : 'challenger';
    hideModeSelect(s);
    s.scene.start('game', { mode: selectedMode });
  }

  s.updateModeVisuals = updateModeVisuals;
}

function showModeSelect(s) {
  s.modeVisible = true;
  s.modeGroup.setVisible(true);
  s.modeIndex = 0;
  if (s.updateModeVisuals) s.updateModeVisuals();
}
function hideModeSelect(s) {
  s.modeVisible = false;
  s.modeGroup.setVisible(false);
}

// ===== Tutorial functions =====
function startTutorial(s) {
  // Simple tutorial: launch game with tutorial flags
  tutorialMode = true;
  tutorialStep = 0;
  selectedMode = 'normal'; // Tutorial uses normal mode
  s.scene.start('game');
}

function updateTutorialText(scene) {
  if (!tutorialMode || !scene.tutorialText) return;
  
  const steps = [
    'Step 1/6: Move left and right (A/D keys)',
    'Step 2/6: Jump! Press W to jump',
    'Step 3/6: Shoot downward! Press ' + currentShootKey.toUpperCase() + ' while in the air',
    'Step 4/6: Kill an enemy while airborne to start a COMBO!',
    'Step 5/6: After you kill an enemy you enter Combo mode.\nKeep killing enemies to increase combo multiplier\n(HOLD ' + currentShootKey.toUpperCase() + ' for 1 second to continue)',
    'Tutorial Complete! Press ESC to return to menu'
  ];
  
  scene.tutorialText.setText(steps[tutorialStep] || '');
}

function checkTutorialProgress(scene) {
  if (!tutorialMode) return;
  
  // Don't check progress while frozen
  if (tutorialStep5Frozen) return;
  
  // Step 0: Move left or right
  if (tutorialStep === 0 && (keysState.left || keysState.right)) {
    tutorialStep = 1;
    updateTutorialText(scene);
    playTone(scene, 660, 0.1);
  }
  
  // Step 3: Spawn tutorial dummy enemy when step becomes active
  if (tutorialStep === 3 && !scene.tutorialEnemySpawned && scene.tutorialPlatform) {
    scene.tutorialEnemySpawned = true;
    spawnTutorialDummy(scene);
  }
  
  // Step 1: Jump (checked in input handler)
  // Step 2: Shoot (checked in input handler)
  // Step 3: Get first combo kill (checked in onBulletHitsEnemy)
  // Step 4: Kill enemy while airborne, then land and hold shoot key (checked in update loop)
  // Step 5: Tutorial complete (displayed after holding key for 1 second)
}

function spawnTutorialDummy(scene) {
  if (!scene.tutorialPlatform || !enemiesGroup) return;
  
  const plat = scene.tutorialPlatform;
  const enemyX = plat.x;
  const enemyY = plat.y - 6 - 7;
  
  const enemy = scene.add.rectangle(enemyX, enemyY, 28, 14, 0xff0000);
  enemy.setStrokeStyle(1, 0xff6666, 0.8);
  scene.physics.add.existing(enemy);
  
  if (enemy.body) {
    enemy.body.setCollideWorldBounds(false);
    enemy.body.setBounce(0, 0);
    enemy.body.setDragX(0);
    enemy.body.setVelocityX(0);
    enemy.body.setAllowGravity(false);
    enemy.body.enable = true;
  }
  
  enemy.type = 'walker';
  enemy.shielded = false;
  enemy.platformRef = plat;
  enemy.vx = 0; // No movement
  enemy.tutorialDummy = true; // Flag to prevent damage
  
  enemiesGroup.add(enemy);
  plat.enemies.push(enemy);
  
  // Visual indicator that it's a dummy (slight pulse)
  scene.tweens.add({
    targets: enemy,
    alpha: { from: 1, to: 0.7 },
    duration: 800,
    ease: 'Sine.easeInOut'
  });
}

// ===== Rebinding helpers =====
function rebindShootKey(newKey) {
  const k = (newKey || '').toLowerCase();
  if (!/^[a-z]$/.test(k)) return;
  if (k === 'w' || k === 'a' || k === 's' || k === 'd') return;
  if (k === currentRayKey) return;
  if (currentShootKey && KEYBOARD_TO_ARCADE[currentShootKey] === 'P1A') {
    delete KEYBOARD_TO_ARCADE[currentShootKey];
  }
  currentShootKey = k;
  ARCADE_CONTROLS['P1A'] = [k];
  KEYBOARD_TO_ARCADE[k] = 'P1A';
}
function rebindRayKey(newKey) {
  const k = (newKey || '').toLowerCase();
  if (!/^[a-z]$/.test(k)) return;
  if (k === 'w' || k === 'a' || k === 's' || k === 'd') return;
  if (k === currentShootKey) return;
  if (currentRayKey && KEYBOARD_TO_ARCADE[currentRayKey] === 'P1B') {
    delete KEYBOARD_TO_ARCADE[currentRayKey];
  }
  currentRayKey = k;
  ARCADE_CONTROLS['P1B'] = [k];
  KEYBOARD_TO_ARCADE[k] = 'P1B';
}

// ======================= GAME SCENE ==========================
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
let score = 0;
let scoreText;
let gameOver = false;

// Downwell-like variables
let player;
let platforms = [];
let bullets = [];
let platformsGroup;
let bulletsGroup;
let hazardsGroup;
let enemyBulletsGroup;
let leftHazard;
let rightHazard;
let hazardOn = true;
let hazardTimer = 0;
let hazardInterval = 1200;
let keysState = { left: false, right: false };
let wasOnGround = false;
let ammo = 3;
let maxAmmo = 10;
let baseMaxAmmo = 10; // Base value for easy mode calculations
let maxDepth = 0;
let speed = 220;
let jump = 300;
let recoil = 240;

// Hitstop/screenshake (solo para muertes del jugador)
let hitstopActive = false;
let hitstopEndTime = 0;
let enemiesGroup;
let powerUpsGroup;
let powerUps = [];
let jetpackActive = false;
let jetpackLeftBlock = null;
let jetpackRightBlock = null;
let debugHitboxes = false;
let debugGraphics;
// Combo system
let comboCount = 0;
let comboMultiplier = 1;
let comboText;

// Milestones tracking (para evitar repetidos)
let milestoneDepth = 500; // Siguiente milestone de profundidad
let milestoneScore = 1000; // Siguiente milestone de score
let highestComboReached = 0; // Máximo combo alcanzado

// Multi-kill tracking
let multiKillCount = 0; // Enemigos matados en la ventana actual
let multiKillTimer = 0; // Timestamp del último kill
const MULTIKILL_WINDOW = 1000; // Ventana de 1 segundo para multi-kills

// Milestone display management
let activeMilestones = []; // Array de milestones actualmente visibles
let milestoneDepthCounter = 10000; // Depth counter para z-index

// String constants
const FONT = 'Arial, sans-serif';
const C_BLACK = '#000000';
const C_WHITE = '#ffffff';
const C_CYAN = '#00ffff';
const C_YELLOW = '#ffff00';
const C_RED = '#ff0000';

// Infinite world helpers
let worldBottom = 20000;
const WORLD_CHUNK = 20000;
const WORLD_MARGIN = 1200;
let worldYOffset = 0;
const REBASE_THRESHOLD = 200000;
const REBASE_DELTA = 150000;

// Charge Shot state
let isCharging = false;
let chargeStartTime = 0;
let chargeVisuals = null;

// ===== Jumper balance constants =====
const JUMPER_SPAWN_CHANCE_BASE = 0.15;
const JUMPER_COOLDOWN_MIN_MS = 1200;
const JUMPER_COOLDOWN_MAX_MS = 2000;
const JUMPER_JUMP_VEL_Y = -250;

// Shooter Up enemy constants
const SHOOTER_SPAWN_CHANCE_BASE = 0.15;
const SHOOTER_COOLDOWN_MIN_MS = 1200;
const SHOOTER_COOLDOWN_MAX_MS = 1800;

// Dynamic Difficulty constants
const DIFFICULTY_DEPTH_STEP = 1000;
const DIFFICULTY_SPAWN_MULT_MAX = 2.5;
const DIFFICULTY_COUNT_MULT_MAX = 1.8;

// Enemy Shield constants
const SHIELDED_SPAWN_CHANCE = 0.08;

// Power-Up constants
const POWERUP_SPAWN_CHANCE = 0.20;
const POWERUP_MAX_ACTIVE = 2;
const FAILSAFE_HOLD_MS = 5000; // hold P1A+P1B for 5s to return to menu

// ===== Enemy bullets (UPWARD TRAJECTORY) =====
const ENEMY_BULLET_SPEED_Y = -360;

// ===== Scoring per enemy type =====
const SCORE_WALKER = 50;
const SCORE_JUMPER = 60;
const SCORE_SHOOTER = 80;
const SHIELD_SCORE_MULT = 1.5;

// ===== Ray Gun (Charge Shot) constants =====
const CHARGE_THRESHOLD_MS = 1000;
const CHARGE_COST_AMMO = 2;
const CHARGE_PIERCE_COUNT = 2;
const CHARGE_SLOWMO_SCALE = 3.33;
const CHARGE_RAY_MAX_DISTANCE = 2000;
const CHARGE_RAY_VISUAL_DURATION = 200;
const CHARGE_RAMP_IN_MS = 150;
const CHARGE_RAMP_OUT_MS = 180;

// ======== AUDIO DINÁMICO PARA CHARGE ========
const CHARGE_AUDIO_MIN_HZ = 440;
const CHARGE_AUDIO_MAX_HZ = 900;
let chargeOsc = null;
let chargeGain = null;
let chargeAudioCompleted = false;

// Background music
let bgMusicNodes = [];
let bgMusicLoopId = null;

function create(data) {
  const scene = this;

  // Save selected mode from menu
  selectedMode = (data && data.mode) ? data.mode : (selectedMode || 'challenger');

  // CHAINFALL scene init tone
  playTone(this, 440, 0.1);

  // Reset world/time
  if (this.physics && this.physics.world && this.physics.world.isPaused) this.physics.world.resume();
  if (this.physics && this.physics.world) this.physics.world.timeScale = 1.0;

  // Reset core state
  gameOver = false;
  score = 0;
  maxDepth = 0;
  ammo = maxAmmo;
  wasOnGround = false;
  keysState.left = keysState.right = false;
  hazardOn = true;
  hazardTimer = 0;
  
  // Reset tutorial state
  scene.tutorialEnemySpawned = false;
  scene.tutorialPlatform = null;
  tutorialStep5HoldStart = 0;
  tutorialStep5Frozen = false;

  // Reset charge shot state
  isCharging = false;
  chargeStartTime = 0;
  chargeVisuals = null;
  chargeAudioCompleted = false;
  stopChargeAudio(this);

  // Reset combo state
  comboCount = 0;
  comboMultiplier = 1;

  // Reset hitstop state
  hitstopActive = false;
  hitstopEndTime = 0;
  
  // Reset milestones
  milestoneDepth = 1000;
  milestoneScore = 1000;
  highestComboReached = 0;
  activeMilestones = [];
  milestoneDepthCounter = 10000;
  
  // Reset multi-kill tracking
  multiKillCount = 0;
  multiKillTimer = 0;

  // Clear runtime arrays
  platforms = [];
  bullets = [];
  powerUps = [];

  // Reset jetpack state
  jetpackActive = false;
  jetpackLeftBlock = null;
  jetpackRightBlock = null;
  // Reset failsafe in game scene
  fsPrimaryDown = false; fsSecondaryDown = false; failsafeStartTime = 0;

  // ===== Downwell-like setup =====
  if (this.physics && this.physics.world) {
    this.physics.world.setBounds(0, 0, 800, worldBottom);
  }

  // Physics groups
  platformsGroup = this.physics.add.staticGroup();
  bulletsGroup = this.physics.add.group();
  hazardsGroup = this.physics.add.staticGroup();
  enemiesGroup = this.physics.add.group();
  enemyBulletsGroup = this.physics.add.group({ allowGravity: false });
  powerUpsGroup = this.physics.add.group({ allowGravity: false });

  // Safe starting platform
  const startWidth = 160;
  const startX = 40 + startWidth / 2;
  const startY = 140;
  const startPlat = this.add.rectangle(startX, startY, startWidth, 12, 0xffff00);
  startPlat.setStrokeStyle(2, 0xffaa00, 0.9);
  this.physics.add.existing(startPlat, true);
  if (startPlat.body) {
    startPlat.body.checkCollision.up = startPlat.body.checkCollision.down = startPlat.body.checkCollision.left = startPlat.body.checkCollision.right = true;
    if (startPlat.body.updateFromGameObject) startPlat.body.updateFromGameObject();
  }
  startPlat.enemies = [];
  startPlat.noEnemies = true;
  if (platformsGroup) platformsGroup.add(startPlat);
  platforms.push(startPlat);

  // Player
  player = this.add.rectangle(startX, startY - 6 - 12, 18, 24, 0xffffff);
  player.setStrokeStyle(2, 0x00ffff, 0.6);
  this.physics.add.existing(player);
  if (player.body && player.body.setSize) player.body.setSize(player.displayWidth, player.displayHeight, true);
  player.body.setCollideWorldBounds(true);
  player.body.setMaxVelocity(300, 700);
  player.body.setDragX(800);
  player.body.enable = true;
  player.body.checkCollision.up = player.body.checkCollision.down = player.body.checkCollision.left = player.body.checkCollision.right = true;

  // Seed platforms
  if (tutorialMode) {
    // Tutorial: create only one large platform with one enemy
    const tutorialPlatWidth = 800; // Extends almost wall-to-wall (800 - 40*2)
    const tutorialPlatX = 400; // Center
    const tutorialPlatY = 350; // Below starting platform
    const tutorialPlat = this.add.rectangle(tutorialPlatX, tutorialPlatY, tutorialPlatWidth, 12, 0x00aaff);
    tutorialPlat.setStrokeStyle(2, 0x00ffff, 0.7);
    this.physics.add.existing(tutorialPlat, true);
    if (tutorialPlat.body) {
      tutorialPlat.body.checkCollision.up = tutorialPlat.body.checkCollision.down = tutorialPlat.body.checkCollision.left = tutorialPlat.body.checkCollision.right = true;
      if (tutorialPlat.body.updateFromGameObject) tutorialPlat.body.updateFromGameObject();
    }
    tutorialPlat.enemies = [];
    if (platformsGroup) platformsGroup.add(tutorialPlat);
    platforms.push(tutorialPlat);
    
    // Store tutorial platform reference for later enemy spawn
    scene.tutorialPlatform = tutorialPlat;
  } else {
    // Normal game: seed multiple platforms
    seedPlatforms(this, 220, this.cameras.main.scrollY + 800);
  }

  // Colliders & overlaps
  this.physics.add.collider(player, platformsGroup, () => {
    // Challenger mode: LANDING on platform while in combo = death
    // Only triggers when touching from above (blocked.down = standing on platform)
    if (selectedMode === 'challenger' && comboCount > 0 && !gameOver && player.body.blocked.down) {
      applyHitstop(this, 100);
      applyScreenshake(this, 5, 150);
      playImpactEffect(this, player.x, player.y, 0xff0000, 12);
      endGame(this);
    }
  });
  this.physics.add.collider(bulletsGroup, platformsGroup, (b, _p) => { if (b && b.destroy) b.destroy(); });
  this.physics.add.overlap(bulletsGroup, enemiesGroup, (b, e) => onBulletHitsEnemy(this, b, e));
  this.physics.add.overlap(enemyBulletsGroup, player, (b, _p) => {
    if (!gameOver) {
      if (b && b.destroy) b.destroy(); // destroy first to avoid multi-triggers
      applyHitstop(this, 90);
      applyScreenshake(this, 4, 120);
      playImpactEffect(this, player.x, player.y, 0xff4444, 10);
      endGame(this);
    }
  });

  // Failsafe key tracking (game scene)
  this.input.keyboard.on('keydown', (ev) => {
    const key = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if (key === 'P1A') fsPrimaryDown = true;
    if (key === 'P1B') fsSecondaryDown = true;
    if (fsPrimaryDown && fsSecondaryDown && failsafeStartTime === 0) failsafeStartTime = scene.time.now;
  });
  this.input.keyboard.on('keyup', (ev) => {
    const key = KEYBOARD_TO_ARCADE[ev.key] || ev.key;
    if (key === 'P1A') fsPrimaryDown = false;
    if (key === 'P1B') fsSecondaryDown = false;
    if (!fsPrimaryDown || !fsSecondaryDown) failsafeStartTime = 0;
  });
  this.physics.add.collider(enemyBulletsGroup, platformsGroup, (b) => { if (b && b.destroy) b.destroy(); });
  this.physics.add.collider(enemiesGroup, platformsGroup);
  this.physics.add.collider(enemiesGroup, enemiesGroup, (a, b) => {
    if (a.platformRef && b.platformRef && a.platformRef === b.platformRef) {
      a.dir = -a.dir; b.dir = -b.dir;
      a.body.setVelocityX(a.dir * a.speed);
      b.body.setVelocityX(b.dir * b.speed);
    }
  });

  // Hazards (not in tutorial)
  if (!tutorialMode) {
    setupHazards(this);
  }
  this.physics.add.overlap(player, hazardsGroup, (_pl, _hz) => {
    if (hazardOn) {
      applyHitstop(this, 100);
      applyScreenshake(this, 6, 150);
      playImpactEffect(this, player.x, player.y, 0xff9900, 14);
      endGame(this);
      hazardOn = false;
    }
  });
  this.physics.add.overlap(player, enemiesGroup, (p, e) => {
    // Ignore tutorial dummy enemies
    if (e && e.tutorialDummy) return;
    
    if (!gameOver) {
      applyHitstop(this, 90);
      applyScreenshake(this, 5, 130);
      playImpactEffect(this, player.x, player.y, 0xff2222, 12);
      endGame(this);
    }
  });

  // Power-Ups overlap
  this.physics.add.overlap(player, powerUpsGroup, (p, powerUp) => onPowerUpCollected(this, powerUp));

  // Camera
  this.cameras.main.startFollow(player, false, 0.1, 0.1);
  this.cameras.main.setBackgroundColor('#000000');

  // HUD
  const hudBg = this.add.rectangle(10, 10, 200, 90, 0x000000, 0.5);
  hudBg.setOrigin(0, 0);
  hudBg.setStrokeStyle(2, 0x00ffff, 0.4);
  hudBg.setScrollFactor(0); hudBg.setDepth(999);

  scoreText = this.add.text(16, 16, 'Score: 0', {
    fontSize: '24px', fontFamily: 'Arial, sans-serif', color: '#00ff00', stroke: '#000000', strokeThickness: 2
  }).setScrollFactor(0).setDepth(1000);

  this.ammoText = this.add.text(16, 44, 'Ammo: ' + ammo, {
    fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#ffff00', stroke: '#000000', strokeThickness: 2
  }).setScrollFactor(0).setDepth(1000);

  comboText = this.add.text(16, 68, '', {
    fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#00ffff', stroke: '#000000', strokeThickness: 2
  }).setScrollFactor(0).setDepth(1000);
  
  // Tutorial instructions
  let tutorialText = null;
  if (tutorialMode) {
    tutorialText = this.add.text(400, 480, '', {
      fontSize: '22px', fontFamily: 'Arial, sans-serif', color: '#ffff00', 
      stroke: '#000000', strokeThickness: 3, align: 'center',
      backgroundColor: '#000000aa', padding: { x: 15, y: 10 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    scene.tutorialText = tutorialText;
    updateTutorialText(scene);
  }

  const titleSplash = this.add.text(400, 200, 'CHAINFALL', {
    fontSize: '64px', fontFamily: 'Arial, sans-serif',
    color: '#ffffff', stroke: '#000000', strokeThickness: 6
  }).setOrigin(0.5).setScrollFactor(0);
  this.tweens.add({
    targets: titleSplash, alpha: { from: 1, to: 0 }, duration: 1200, delay: 300, ease: 'Quad.easeOut',
    onComplete: () => titleSplash.destroy()
  });

  // Input handlers (arcade mapping)
  this.input.keyboard.on('keydown', (event) => {
    const key = KEYBOARD_TO_ARCADE[event.key] || event.key;
    
    // Block all input while tutorial is frozen (except ESC to exit)
    if (tutorialMode && tutorialStep5Frozen && event.key !== 'Escape') {
      return;
    }
    
    if (nameEntryActive) {
      if (key === 'P1U') {
        const charCode = nameEntry[nameEntryIndex].charCodeAt(0);
        nameEntry[nameEntryIndex] = String.fromCharCode(charCode === 90 ? 65 : charCode + 1);
        updateNameEntryVisuals();
        playTone(scene, 440, 0.05);
        return;
      }
      if (key === 'P1D') {
        const charCode = nameEntry[nameEntryIndex].charCodeAt(0);
        nameEntry[nameEntryIndex] = String.fromCharCode(charCode === 65 ? 90 : charCode - 1);
        updateNameEntryVisuals();
        playTone(scene, 440, 0.05);
        return;
      }
      if (key === 'P1L') {
        nameEntryIndex = (nameEntryIndex + 3) % 4;
        updateNameEntryVisuals();
        playTone(scene, 440, 0.05);
        return;
      }
      if (key === 'P1R') {
        nameEntryIndex = (nameEntryIndex + 1) % 4;
        updateNameEntryVisuals();
        playTone(scene, 440, 0.05);
        return;
      }
      if (key === 'P1A' || key === 'START1') {
        const name = nameEntry.join('');
        addScore(name, score, selectedMode);
        playTone(scene, 523, 0.2);
        cleanupNameEntry(scene);
        showGameOverScreen(scene);
        return;
      }
    }
    if (gameOver) {
      if (key === 'P1U') { gameOverIndex = (gameOverIndex + gameOverItems.length - 1) % gameOverItems.length; updateGameOverVisuals(); return; }
      if (key === 'P1D') { gameOverIndex = (gameOverIndex + 1) % gameOverItems.length; updateGameOverVisuals(); return; }
      if (key === 'P1A' || key === 'START1') {
        if (gameOverIndex === 0) { restartGame(scene); }
        else if (gameOverIndex === 1) { goToMenu(scene); }
        return;
      }
    }
    if (key === 'P1L') keysState.left = true;
    if (key === 'P1R') keysState.right = true;
    if (key === 'P1U' && player && player.body && player.body.blocked.down) {
      player.body.setVelocityY(-jump);
      playTone(scene, 523, 0.05);
      
      // Tutorial Step 1: Jump
      if (tutorialMode && tutorialStep === 1) {
        tutorialStep = 2;
        updateTutorialText(scene);
        playTone(scene, 660, 0.1);
      }
    }
    // ESC in tutorial returns to menu
    if (event.key === 'Escape' && tutorialMode) {
      tutorialMode = false;
      scene.scene.start('menu');
      return;
    }
    // P1A: normal shot in air
    if (key === 'P1A' && player && player.body && !player.body.blocked.down && ammo > 0 && !isCharging) {
      fireBullet(scene);
      
      // Tutorial Step 2: Shoot
      if (tutorialMode && tutorialStep === 2) {
        tutorialStep = 3;
        updateTutorialText(scene);
        playTone(scene, 660, 0.1);
      }
    }
    // P1B: start charge if airborne
    if (key === 'P1B' && player && player.body && !player.body.blocked.down && ammo > 1 && !isCharging) {
      startCharging(scene);
    }
  });
  this.input.keyboard.on('keyup', (event) => {
    const key = KEYBOARD_TO_ARCADE[event.key] || event.key;
    
    // Block all input while tutorial is frozen
    if (tutorialMode && tutorialStep5Frozen) {
      return;
    }
    
    if (key === 'P1L') keysState.left = false;
    if (key === 'P1R') keysState.right = false;

    // P1B release: fire ray or cancel
    if (key === 'P1B' && isCharging) {
      const heldTime = scene.time.now - chargeStartTime;
      const isAirborne = player && player.body && !player.body.blocked.down;
      if (heldTime >= CHARGE_THRESHOLD_MS && ammo >= CHARGE_COST_AMMO && isAirborne) {
        stopCharging(scene, true);
        fireChargedBullet(scene);
      } else {
        stopCharging(scene, false);
      }
    }
  });

  // Debug hitboxes with P
  this.input.keyboard.on('keydown-P', () => {
    debugHitboxes = !debugHitboxes;
    if (!debugHitboxes && debugGraphics) debugGraphics.clear();
  });
  if (debugGraphics && !debugGraphics.scene) debugGraphics = null;
  if (debugGraphics) debugGraphics.destroy();
  debugGraphics = this.add.graphics();
  debugGraphics.setDepth(4500);

  // ===== Clean globals on scene shutdown/destroy (prevents stale .entries errors) =====
  const nullGlobals = () => {
    platformsGroup = null;
    bulletsGroup = null;
    hazardsGroup = null;
    enemiesGroup = null;
    enemyBulletsGroup = null;
    powerUpsGroup = null;
  };
  this.events.once('shutdown', nullGlobals);
  this.events.once('destroy', nullGlobals);
}

function update(_time, _delta) {
  checkFailsafe(this);
  if (gameOver) return;
  
  // Check tutorial progress
  checkTutorialProgress(this);
  
  // Tutorial Step 4 -> 5: Hold shoot key for 1 second after landing
  if (tutorialMode && tutorialStep === 4 && tutorialStep5Frozen) {
    const shootKey = this.input.keyboard.addKey(currentShootKey.toUpperCase());
    
    if (shootKey.isDown) {
      // Player is holding the shoot key
      if (tutorialStep5HoldStart === 0) {
        tutorialStep5HoldStart = this.time.now;
      }
      
      const holdDuration = this.time.now - tutorialStep5HoldStart;
      
      // After 1 second, unfreeze and advance to Step 5
      if (holdDuration >= 1000) {
        tutorialStep5Frozen = false;
        tutorialStep5HoldStart = 0;
        tutorialStep = 5; // Advance to Step 5 (Complete)
        
        // Unfreeze the game (resume physics)
        if (this.physics && this.physics.world) {
          this.physics.world.resume();
        }
        
        updateTutorialText(this);
        playTone(this, 1000, 0.2);
        
        // Mark tutorial as completed
        tutorialCompleted = true;
        saveSettings();
      }
    } else {
      // Player released the key, reset timer
      tutorialStep5HoldStart = 0;
    }
    
    // Skip rest of update while frozen
    return;
  }

  // Horizontal control
  if (player && player.body) {
    let vx = 0;
    if (keysState.left) vx -= speed;
    if (keysState.right) vx += speed;

    // keep X feel during slow-mo
    const timeScale = this.physics.world.timeScale || 1.0;
    if (isCharging && timeScale > 1.0) {
      vx = vx * timeScale;
    }
    player.body.setVelocityX(vx);

    // Cancel charge on ground
    if (isCharging && player.body.blocked.down) {
      stopCharging(this, false);
    }

    // Channel visuals
    if (isCharging && chargeVisuals) {
      chargeVisuals.clear();
      const progress = Math.min((this.time.now - chargeStartTime) / CHARGE_THRESHOLD_MS, 1.0);
      for (let i = 0; i < 3; i++) {
        const radius = 20 + (i * 12) + (progress * 10);
        const alpha = 0.6 - (i * 0.15);
        chargeVisuals.lineStyle(2, 0xEEF527, alpha);
        chargeVisuals.strokeCircle(player.x, player.y, radius);
      }
      // Progress bar
      if (progress < 1.0) {
        const barWidth = 30, barHeight = 4;
        const barX = player.x - barWidth / 2, barY = player.y - 20;
        chargeVisuals.fillStyle(0x000000, 0.6);
        chargeVisuals.fillRect(barX, barY, barWidth, barHeight);
        chargeVisuals.fillStyle(0xEEF527, 0.9);
        chargeVisuals.fillRect(barX, barY, barWidth * progress, barHeight);
      }
    }

    // Charge audio sweep
    if (isCharging) updateChargeAudio(this);

    // Land detection: reset ammo/combo with enhanced effects
    const onGround = player.body.blocked.down;
    if (onGround && !wasOnGround) {
      if (ammo > maxAmmo || comboCount > 0) {
        comboCount = 0;
        comboMultiplier = 1;
        if (comboText) { comboText.setText(''); comboText.setScale(1); }
      }
      ammo = maxAmmo;
      if (this.ammoText) { this.ammoText.setText('Ammo: ' + ammo); this.ammoText.setColor('#ffff00'); }
      
      // Improved landing feedback
      playTone(this, 440, 0.08);
      
      // Squash & stretch effect
      player.setScale(1.15, 0.85); // Squash on impact
      this.tweens.add({
        targets: player,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
        ease: 'Back.easeOut'
      });
      
      // Color flash
      player.setFillStyle(0x00ffff, 1);
      this.time.delayedCall(200, () => {
        if (player && player.active) player.setFillStyle(0xffffff, 1);
      });
      
      // Enhanced landing particles (more and varied)
      for (let i = 0; i < 8; i++) {
        const px = player.x + (Math.random() - 0.5) * 25;
        const size = 3 + Math.random() * 2;
        const particle = this.add.rectangle(px, player.y + 12, size, size, 0x00aaff);
        this.physics.add.existing(particle);
        const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.6; // Spread upward
        const speed = 80 + Math.random() * 60;
        particle.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        particle.body.setGravity(0, 500);
        this.tweens.add({ 
          targets: particle, 
          alpha: 0, 
          scale: 0.5,
          duration: 350 + Math.random() * 150, 
          onComplete: () => particle.destroy() 
        });
      }
      
      // Ground impact wave (subtle)
      const wave = this.add.ellipse(player.x, player.y + 13, 20, 4, 0x00aaff, 0.4);
      wave.setDepth(player.depth - 1);
      this.tweens.add({
        targets: wave,
        scaleX: 2.5,
        scaleY: 1.5,
        alpha: 0,
        duration: 300,
        ease: 'Cubic.easeOut',
        onComplete: () => wave.destroy()
      });
    }
    wasOnGround = onGround;
  }

  // Ensure platforms fill below camera; recycle (not in tutorial)
  const cam = this.cameras.main;
  if (!tutorialMode) {
    cam.scrollY = Math.max(cam.scrollY, player.y - 260);
    ensureWorldCapacity(this, cam.scrollY + 1000);
    seedPlatforms(this, cam.scrollY + 100, cam.scrollY + 800);
    
    // Track depth and check milestones
    const currentDepth = Math.floor(player.y - 150);
    if (currentDepth > maxDepth) {
      maxDepth = currentDepth;
      while (maxDepth >= milestoneDepth) {
        showMilestone(this, `${milestoneDepth}m DEPTH!`, '#00ffff');
        milestoneDepth = Math.round(milestoneDepth * 1.5); // Next milestone
      }
    }
    
    // Recycle platforms that went off-screen
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (p.y < cam.scrollY - 60) {
        const maxY = platforms.reduce((m, o) => Math.max(m, o.y), cam.scrollY + 300);
        positionPlatform(this, p, maxY + Phaser.Math.Between(70, 120));
        if (p.body && p.body.updateFromGameObject) p.body.updateFromGameObject();
      }
    }
    // Rebase coordinates to avoid large Y
    maybeRebaseWorld(this);
  }

  // Cleanup bullets below view
  bullets = bullets.filter(b => {
    if (!b.active) return false;
    if (b.y > cam.scrollY + 700) { b.destroy(); return false; }
    return true;
  });

  // Enemy bullets: enforce straight up & cleanup
  if (enemyBulletsGroup) {
    safeEach(enemyBulletsGroup, (b) => {
      if (!b || !b.body) return;
      b.body.setAllowGravity(false);
      if (b.body.velocity.x !== 0) b.body.setVelocityX(0);
      if (b.body.velocity.y === 0) b.body.setVelocityY(ENEMY_BULLET_SPEED_Y);
      if (!b.active || b.y < cam.scrollY - 60 || b.y > cam.scrollY + 1200) { if (b.destroy) b.destroy(); }
    });
  }

  // Game over if player moves above visible area
  if (player && player.y < cam.scrollY - 20) {
    endGame(this);
    return;
  }

  // Cleanup power-ups by distance
  powerUps = powerUps.filter(p => {
    if (!p.active) return false;
    if (p.y > cam.scrollY + 800 || p.y < cam.scrollY - 100) {
      if (p.label && p.label.destroy) p.label.destroy();
      p.destroy();
      return false;
    }
    return true;
  });

  // Update jetpack blocks
  if (jetpackActive) updateJetpackPosition();

  // Hazards follow camera and toggle (not in tutorial)
  if (!tutorialMode) {
    updateHazards(this);
    hazardTimer += _delta || 0;
    if (hazardTimer >= hazardInterval) {
      hazardTimer = 0;
      hazardOn = !hazardOn;
      hazardInterval = Phaser.Math.Between(900, 1800);
      setHazardVisual(this);
    }
  }

  // Enemies movement & behaviors
  updateEnemies(this, _delta || 16);

  // Debug hitboxes
  if (debugHitboxes) drawHitboxes(this);
}

function ensureWorldCapacity(scene, targetY) {
  if (!scene.physics || !scene.physics.world) return;
  const need = (targetY || 0) + WORLD_MARGIN;
  if (need <= worldBottom) return;
  while (worldBottom < need) worldBottom += WORLD_CHUNK;
  scene.physics.world.setBounds(0, 0, 800, worldBottom);
}

function maybeRebaseWorld(scene) {
  const cam = scene.cameras.main;
  if (cam.scrollY < REBASE_THRESHOLD) return;
  const dy = REBASE_DELTA;
  worldYOffset += dy;

  cam.scrollY -= dy;
  if (player) player.y -= dy;

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (!p) continue;
    if (p.y != null) p.y -= dy;
    if (p.body && p.body.updateFromGameObject) p.body.updateFromGameObject();
  }

  safeEach(enemiesGroup, (e) => { if (e && e.y != null) e.y -= dy; });
  safeEach(bulletsGroup, (b) => { if (b && b.y != null) b.y -= dy; });
  safeEach(enemyBulletsGroup, (b) => { if (b && b.y != null) b.y -= dy; });

  safeEach(powerUpsGroup, (p) => {
    if (p && p.y != null) {
      p.y -= dy;
      if (p.label && p.label.y != null) p.label.y -= dy;
    }
  });

  if (jetpackLeftBlock) jetpackLeftBlock.y -= dy;
  if (jetpackRightBlock) jetpackRightBlock.y -= dy;

  if (leftHazard) { leftHazard.y -= dy; if (leftHazard.body && leftHazard.body.updateFromGameObject) leftHazard.body.updateFromGameObject(); }
  if (rightHazard) { rightHazard.y -= dy; if (rightHazard.body && rightHazard.body.updateFromGameObject) rightHazard.body.updateFromGameObject(); }
}

// ===== LEADERBOARD FUNCTIONS =====
function loadLeaderboard() {
  try {
    const data = localStorage.getItem('chainfall_leaderboard');
    const parsed = data ? JSON.parse(data) : [];
    // Migration: ensure mode field exists, default to 'normal'
    leaderboardData = Array.isArray(parsed)
      ? parsed.map(e => ({ name: e.name, score: e.score, mode: e.mode || 'normal' }))
      : [];
  } catch (e) {
    leaderboardData = [];
  }
}

function saveLeaderboard() {
  try {
    localStorage.setItem('chainfall_leaderboard', JSON.stringify(leaderboardData));
  } catch (e) {
    console.error('Failed to save leaderboard');
  }
}

function addScore(name, score, mode) {
  leaderboardData.push({ name, score, mode: mode || 'normal' });
  // Do not slice globally; we limit per-mode to top 10 when displaying
  saveLeaderboard();
}

// ===== SETTINGS/CONFIG FUNCTIONS =====
function loadSettings() {
  try {
    const data = localStorage.getItem('chainfall_settings');
    if (data) {
      const settings = JSON.parse(data);
      tutorialCompleted = settings.tutorialCompleted || false;
    }
  } catch (e) {
    console.error('Failed to load settings');
  }
}

function saveSettings() {
  try {
    const settings = {
      tutorialCompleted: tutorialCompleted
    };
    localStorage.setItem('chainfall_settings', JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings');
  }
}

function isHighScore(score, mode) {
  const m = mode || 'normal';
  const list = leaderboardData.filter(e => e.mode === m).sort((a,b)=>b.score-a.score);
  if (list.length < 10) return true;
  return score > list[list.length - 1].score;
}

function showNameEntry(scene) {
  nameEntryActive = true;
  nameEntry = ['A', 'A', 'A', 'A'];
  nameEntryIndex = 0;
  nameEntryElements = [];
  
  const cx = 400, cy = 300;
  
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.92);
  overlay.fillRect(0, 0, 800, 600);
  overlay.setDepth(10000);
  overlay.setScrollFactor(0);
  nameEntryElements.push(overlay);
  
  const scanLines = scene.add.graphics();
  for (let i = 0; i < 600; i += 4) {
    scanLines.fillStyle(0x000000, 0.15);
    scanLines.fillRect(0, i, 800, 2);
  }
  scanLines.setDepth(10000).setScrollFactor(0);
  nameEntryElements.push(scanLines);
  
  const nameEntryGroup = scene.add.group();
  
  const prompt = scene.add.text(cx, cy - 60, 'NEW HIGH SCORE!', {
    fontSize: '32px', fontFamily: 'Arial', color: '#ffff00',
    stroke: '#000', strokeThickness: 4
  }).setOrigin(0.5).setDepth(10002).setScrollFactor(0);
  nameEntryElements.push(prompt);
  
  const subPrompt = scene.add.text(cx, cy - 20, 'Enter your name:', {
    fontSize: '20px', fontFamily: 'Arial', color: '#ffffff',
    stroke: '#000', strokeThickness: 3
  }).setOrigin(0.5).setDepth(10002).setScrollFactor(0);
  nameEntryElements.push(subPrompt);
  
  const letterBoxes = [];
  const letterTexts = [];
  const letterHighlights = [];
  
  for (let i = 0; i < 4; i++) {
    const x = cx - 90 + i * 60;
    
    const highlight = scene.add.rectangle(x, cy + 40, 50, 70, 0xffff00, 0.2);
    highlight.setDepth(10001).setScrollFactor(0);
    letterHighlights.push(highlight);
    nameEntryElements.push(highlight);
    
    const box = scene.add.rectangle(x, cy + 40, 50, 70, 0x1a1a2e, 0.9);
    box.setStrokeStyle(3, 0x00ffff, 0.8);
    box.setDepth(10002).setScrollFactor(0);
    letterBoxes.push(box);
    nameEntryElements.push(box);
    
    const letter = scene.add.text(x, cy + 40, nameEntry[i], {
      fontSize: '48px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(10003).setScrollFactor(0);
    letterTexts.push(letter);
    nameEntryElements.push(letter);
  }
  
  const arrowUp = scene.add.text(cx, cy + 90, '▲ Change Letter', {
    fontSize: '16px', fontFamily: 'Arial', color: '#aaaaaa',
    stroke: '#000', strokeThickness: 2
  }).setOrigin(0.5).setDepth(10002).setScrollFactor(0);
  nameEntryElements.push(arrowUp);
  
  const arrowLR = scene.add.text(cx, cy + 115, '◄ ► Move', {
    fontSize: '16px', fontFamily: 'Arial', color: '#aaaaaa',
    stroke: '#000', strokeThickness: 2
  }).setOrigin(0.5).setDepth(10002).setScrollFactor(0);
  nameEntryElements.push(arrowLR);
  
  const confirmText = scene.add.text(cx, cy + 145, 'Press ' + currentShootKey.toUpperCase() + ' to Confirm', {
    fontSize: '18px', fontFamily: 'Arial', color: '#00ff00',
    stroke: '#000', strokeThickness: 3
  }).setOrigin(0.5).setDepth(10002).setScrollFactor(0);
  nameEntryElements.push(confirmText);
  
  scene.tweens.add({
    targets: confirmText,
    alpha: { from: 0.6, to: 1 },
    duration: 600,
    yoyo: true,
    repeat: -1
  });
  
  window.updateNameEntryVisuals = () => {
    letterHighlights.forEach((h, i) => {
      h.setVisible(i === nameEntryIndex);
    });
    letterBoxes.forEach((b, i) => {
      if (i === nameEntryIndex) {
        b.setStrokeStyle(4, 0xffff00, 1);
        b.setScale(1.1);
      } else {
        b.setStrokeStyle(3, 0x00ffff, 0.8);
        b.setScale(1);
      }
    });
    letterTexts.forEach((t, i) => {
      t.setText(nameEntry[i]);
      t.setColor(i === nameEntryIndex ? '#ffff00' : '#ffffff');
    });
  };
  
  updateNameEntryVisuals();
}

function cleanupNameEntry(scene) {
  nameEntryActive = false;
  nameEntryElements.forEach(el => {
    if (el && el.destroy) el.destroy();
  });
  nameEntryElements = [];
  if (scene && scene.tweens) scene.tweens.killAll();
}

function goToMenu(scene) {
  gameOver = false;
  nameEntryActive = false;
  cleanupNameEntry(scene);
  scene.scene.start('menu');
}

function showGameOverScreen(scene) {
  // Collect all visual elements for fade in
  const allElements = [];
  
  // Dark overlay with radial gradient effect
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.88);
  overlay.fillRect(0, 0, 800, 600);
  overlay.setDepth(9999);
  overlay.setScrollFactor(0);
  overlay.setAlpha(0); // Start invisible for fade in
  allElements.push(overlay);

  // Add subtle scan lines for retro effect
  const scanLines = scene.add.graphics();
  for (let i = 0; i < 600; i += 4) {
    scanLines.fillStyle(0x000000, 0.15);
    scanLines.fillRect(0, i, 800, 2);
  }
  scanLines.setDepth(9999).setScrollFactor(0);
  scanLines.setAlpha(0);
  allElements.push(scanLines);

  // Animated particles burst
  for (let i = 0; i < 20; i++) {
    const px = 400 + (Math.random() - 0.5) * 600;
    const py = 300 + (Math.random() - 0.5) * 400;
    const particle = scene.add.rectangle(px, py, 3, 3, 0xff0000, 0.8);
    particle.setDepth(9998).setScrollFactor(0);
    particle.setAlpha(0);
    allElements.push(particle);
    scene.tweens.add({
      targets: particle,
      alpha: 0,
      scale: 0,
      y: py - 100,
      duration: 1500 + Math.random() * 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy()
    });
  }

  // Glowing title
  const titleText = scene.add.text(400, 60, 'CHAINFALL', {
    fontSize: '48px',
    fontFamily: 'Arial, sans-serif',
    color: '#ffffff',
    stroke: '#00ffff',
    strokeThickness: 5
  }).setOrigin(0.5).setDepth(10000).setScrollFactor(0).setAlpha(0);
  allElements.push(titleText);
  scene.tweens.add({ 
    targets: titleText, 
    scale: { from: 1, to: 1.05 }, 
    duration: 1800, 
    yoyo: true, 
    repeat: -1, 
    ease: 'Sine.easeInOut' 
  });

  const cam = scene.cameras.main;
  const cx = 400;
  const cy = 200;

  // Epic GAME OVER text with glow
  const gameOverGlow = scene.add.text(cx, cy, 'GAME OVER', {
    fontSize: '72px',
    fontFamily: 'Arial, sans-serif',
    color: '#ff0000',
    align: 'center',
    stroke: '#ff6666',
    strokeThickness: 12
  }).setOrigin(0.5).setDepth(9999).setScrollFactor(0).setAlpha(0);
  allElements.push(gameOverGlow);
  scene.tweens.add({ 
    targets: gameOverGlow, 
    scale: { from: 1.1, to: 1.2 }, 
    alpha: { from: 0.2, to: 0.4 },
    duration: 600, 
    yoyo: true, 
    repeat: -1, 
    ease: 'Sine.easeInOut' 
  });

  const gameOverText = scene.add.text(cx, cy, 'GAME OVER', {
    fontSize: '72px',
    fontFamily: 'Arial, sans-serif',
    color: '#ff3333',
    align: 'center',
    stroke: '#990000',
    strokeThickness: 8
  }).setOrigin(0.5).setDepth(10000).setScrollFactor(0).setAlpha(0);
  allElements.push(gameOverText);
  scene.tweens.add({ 
    targets: gameOverText, 
    scale: { from: 1, to: 1.08 }, 
    duration: 800, 
    yoyo: true, 
    repeat: -1, 
    ease: 'Sine.easeInOut' 
  });

  // Score panel with border
  const scorePanelBg = scene.add.rectangle(cx, cy + 90, 400, 70, 0x0a0a1a, 0.85);
  scorePanelBg.setStrokeStyle(3, 0x00ffff, 0.6);
  scorePanelBg.setDepth(10000).setScrollFactor(0).setAlpha(0);
  allElements.push(scorePanelBg);

  const finalScoreLabel = scene.add.text(cx, cy + 75, 'FINAL SCORE', {
    fontSize: '18px', 
    fontFamily: 'Arial, sans-serif', 
    color: '#aaaaaa', 
    stroke: '#000000', 
    strokeThickness: 2
  }).setOrigin(0.5).setDepth(10001).setScrollFactor(0).setAlpha(0);
  allElements.push(finalScoreLabel);

  const finalScoreText = scene.add.text(cx, cy + 100, score.toString(), {
    fontSize: '42px', 
    fontFamily: 'Arial, sans-serif', 
    color: '#00ffff', 
    stroke: '#004444', 
    strokeThickness: 5
  }).setOrigin(0.5).setDepth(10001).setScrollFactor(0).setAlpha(0);
  allElements.push(finalScoreText);
  scene.tweens.add({
    targets: finalScoreText,
    scale: { from: 0.95, to: 1.05 },
    duration: 1200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // Instructions text with pulse
  const instructText = scene.add.text(cx, cy + 155, 'Use Arrow Keys  •  Press ' + currentShootKey.toUpperCase() + ' to Select', {
    fontSize: '16px', 
    fontFamily: 'Arial, sans-serif', 
    color: '#ffff00', 
    stroke: '#000000', 
    strokeThickness: 3
  }).setOrigin(0.5).setDepth(10001).setScrollFactor(0).setAlpha(0);
  allElements.push(instructText);
  scene.tweens.add({ 
    targets: instructText, 
    alpha: { from: 0.6, to: 1 }, 
    duration: 800, 
    yoyo: true, 
    repeat: -1, 
    ease: 'Sine.easeInOut' 
  });

  // Retry button
  const retryY = cy + 220;
  const retryBorder = scene.add.rectangle(cx, retryY, 280, 60, 0x001a1a, 0.7);
  retryBorder.setStrokeStyle(3, 0x00ff00, 0.9);
  retryBorder.setDepth(10000).setScrollFactor(0).setAlpha(0);
  allElements.push(retryBorder);
  
  const retryGlow = scene.add.rectangle(cx, retryY, 280, 60, 0x00ff00, 0.1);
  retryGlow.setDepth(9999).setScrollFactor(0).setAlpha(0);
  allElements.push(retryGlow);
  scene.tweens.add({
    targets: retryGlow,
    alpha: { from: 0.1, to: 0.25 },
    scale: { from: 1, to: 1.15 },
    duration: 1000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  const retryBtn = scene.add.text(cx, retryY, '↻ RETRY', {
    fontSize: '32px', 
    fontFamily: 'Arial, sans-serif', 
    color: '#00ff00', 
    stroke: '#003300', 
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(10001).setScrollFactor(0).setAlpha(0);
  allElements.push(retryBtn);

  // Main Menu button
  const menuY = cy + 300;
  const menuBorder = scene.add.rectangle(cx, menuY, 280, 60, 0x001a1a, 0.7);
  menuBorder.setStrokeStyle(3, 0x00ffff, 0.9);
  menuBorder.setDepth(10000).setScrollFactor(0).setAlpha(0);
  allElements.push(menuBorder);
  
  const menuGlow = scene.add.rectangle(cx, menuY, 280, 60, 0x00ffff, 0.1);
  menuGlow.setDepth(9999).setScrollFactor(0).setAlpha(0);
  allElements.push(menuGlow);

  const menuBtn = scene.add.text(cx, menuY, '⌂ MAIN MENU', {
    fontSize: '32px', 
    fontFamily: 'Arial, sans-serif', 
    color: '#00ffff', 
    stroke: '#003333', 
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(10001).setScrollFactor(0).setAlpha(0);
  allElements.push(menuBtn);

  // Store elements for navigation
  gameOverItems = [retryBtn, menuBtn];
  gameOverBorders = [retryBorder, menuBorder];
  const gameOverGlows = [retryGlow, menuGlow];
  gameOverIndex = 0;

  // Update visuals function
  window.updateGameOverVisuals = () => {
    gameOverItems.forEach((item, idx) => {
      const isSelected = idx === gameOverIndex;
      const border = gameOverBorders[idx];
      const glow = gameOverGlows[idx];
      
      if (isSelected) {
        item.setScale(1.15);
        item.setColor(idx === 0 ? '#ffffff' : '#ffffff');
        border.setStrokeStyle(4, 0xffffff, 1);
        border.setFillStyle(idx === 0 ? 0x003300 : 0x003333, 0.9);
        border.setScale(1.1);
        scene.tweens.killTweensOf(glow);
        scene.tweens.add({
          targets: glow,
          alpha: { from: 0.3, to: 0.5 },
          scale: { from: 1.1, to: 1.25 },
          duration: 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else {
        item.setScale(1);
        item.setColor(idx === 0 ? '#00ff00' : '#00ffff');
        border.setStrokeStyle(3, idx === 0 ? 0x00ff00 : 0x00ffff, 0.9);
        border.setFillStyle(0x001a1a, 0.7);
        border.setScale(1);
        scene.tweens.killTweensOf(glow);
        scene.tweens.add({
          targets: glow,
          alpha: { from: 0.1, to: 0.25 },
          scale: { from: 1, to: 1.15 },
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });
    playTone(scene, 440, 0.05);
  };

  updateGameOverVisuals();
  
  // Smooth fade in for all elements (300ms)
  scene.tweens.add({
    targets: allElements,
    alpha: { from: 0, to: 1 },
    duration: 300,
    ease: 'Quad.easeOut',
    onComplete: () => {
      // After fade in, restore proper alpha values for special elements
      gameOverGlow.setAlpha(0.3); // Was 0, now visible with glow effect
      retryGlow.setAlpha(0.1); // Will pulse via its tween
      menuGlow.setAlpha(0.1); // Will pulse via its tween
      // Particles will fade naturally via their own tweens
    }
  });

  // Mouse interactions
  retryBtn.setInteractive({ useHandCursor: true });
  retryBtn.on('pointerover', () => { gameOverIndex = 0; updateGameOverVisuals(); });
  retryBtn.on('pointerdown', () => { restartGame(scene); });

  menuBtn.setInteractive({ useHandCursor: true });
  menuBtn.on('pointerover', () => { gameOverIndex = 1; updateGameOverVisuals(); });
  menuBtn.on('pointerdown', () => { goToMenu(scene); });
}

function endGame(scene) {
  gameOver = true;
  stopBackgroundMusic();
  playTone(scene, 220, 0.5);

  // Clear charge
  if (isCharging) stopCharging(scene, false);
  stopChargeAudio(scene);

  // Clear jetpack
  if (jetpackActive) deactivateJetpack(scene);

  // Reset player visuals
  if (player) {
    player.setAlpha(1);
    player.setScale(1, 1);
  }

  // Restore time scale
  if (scene.physics && scene.physics.world) scene.physics.world.timeScale = 1.0;

  // Stop gameplay
  if (scene.physics && scene.physics.world) scene.physics.world.pause();
  if (scene.cameras && scene.cameras.main) scene.cameras.main.stopFollow();

  // Check if this is a high score
  loadLeaderboard();
  if (isHighScore(score, selectedMode)) {
    showNameEntry(scene);
    return;
  }

  showGameOverScreen(scene);
}

function restartGame(scene) {
  gameOver = false;
  nameEntryActive = false;
  score = 0;
  maxDepth = 0;
  ammo = maxAmmo;
  wasOnGround = false;
  keysState.left = keysState.right = false;
  comboCount = 0;
  comboMultiplier = 1;

  // Reset charge state + audio
  isCharging = false;
  chargeStartTime = 0;
  if (chargeVisuals) { chargeVisuals.destroy(); chargeVisuals = null; }
  chargeAudioCompleted = false;
  stopChargeAudio(scene);

  scoreText = null;
  comboText = null;
  platforms = [];
  bullets = [];
  // Restart with current mode preserved
  startBackgroundMusic(scene);
  scene.scene.restart({ mode: selectedMode });
}

// ===== Helper functions =====
function seedPlatforms(scene, fromY, toY) {
  let maxExistingY = platforms.length ? Math.max(...platforms.map(p => p.y)) : fromY - 100;
  let y = Math.max(fromY, maxExistingY + 70);
  while (y < toY) {
    const p = createPlatform(scene, y);
    platforms.push(p);
    maybeSpawnEnemies(scene, p);
    y += Phaser.Math.Between(70, 120);
  }
}
function createPlatform(scene, y) {
  const width = Phaser.Math.Between(70, 180);
  const x = Phaser.Math.Between(40, 760 - width);
  const rect = scene.add.rectangle(x + width / 2, y, width, 12, 0x00aaff);
  rect.setStrokeStyle(1, 0x0088dd, 0.8);
  scene.physics.add.existing(rect, true);
  if (rect.body) {
    rect.body.checkCollision.up = rect.body.checkCollision.down = rect.body.checkCollision.left = rect.body.checkCollision.right = true;
  }
  rect.enemies = [];
  if (platformsGroup) platformsGroup.add(rect);
  if (rect.body && rect.body.updateFromGameObject) rect.body.updateFromGameObject();
  return rect;
}
function positionPlatform(scene, rect, y) {
  const width = Phaser.Math.Between(70, 180);
  const x = Phaser.Math.Between(40, 760 - width);
  rect.setSize(width, 12);
  rect.displayWidth = width;
  rect.displayHeight = 12;
  rect.x = x + width / 2;
  rect.y = y;
  rect.setFillStyle(0x00aaff);
  rect.setStrokeStyle(1, 0x0088dd, 0.8);
  rect.noEnemies = false;
  if (rect.body) {
    rect.body.checkCollision.up = rect.body.checkCollision.down = rect.body.checkCollision.left = rect.body.checkCollision.right = true;
    if (rect.body.updateFromGameObject) rect.body.updateFromGameObject();
  }
  if (rect.enemies && rect.enemies.length) {
    rect.enemies.forEach(e => e.destroy());
    rect.enemies = [];
  } else if (!rect.enemies) {
    rect.enemies = [];
  }
  maybeSpawnEnemies(scene, rect);
}

function fireBullet(scene) {
  const useBlue = comboCount > 0;
  const bulletColor = useBlue ? 0x00ffff : 0xff4444;
  const strokeColor = useBlue ? 0x88ffff : 0xff8888;

  const b = scene.add.rectangle(player.x, player.y + 16, 6, 14, bulletColor);
  b.setStrokeStyle(1, strokeColor, 0.7);
  scene.physics.add.existing(b);
  if (b.body && b.body.setSize) b.body.setSize(6, 14, true);
  b.body.setAllowGravity(false);
  b.body.enable = true;
  b.body.checkCollision.up = b.body.checkCollision.down = b.body.checkCollision.left = b.body.checkCollision.right = true;
  b.body.setVelocityY(550);
  if (bulletsGroup) bulletsGroup.add(b);
  bullets.push(b);

  // Jetpack side shots
  if (jetpackActive && jetpackLeftBlock && jetpackRightBlock) {
    const bL = scene.add.rectangle(jetpackLeftBlock.x, jetpackLeftBlock.y + 10, 6, 14, bulletColor);
    bL.setStrokeStyle(1, strokeColor, 0.7);
    scene.physics.add.existing(bL);
    if (bL.body && bL.body.setSize) bL.body.setSize(6, 14, true);
    bL.body.setAllowGravity(false);
    bL.body.enable = true;
    bL.body.checkCollision.up = bL.body.checkCollision.down = bL.body.checkCollision.left = bL.body.checkCollision.right = true;
    bL.body.setVelocityY(550);
    if (bulletsGroup) bulletsGroup.add(bL);
    bullets.push(bL);

    const bR = scene.add.rectangle(jetpackRightBlock.x, jetpackRightBlock.y + 10, 6, 14, bulletColor);
    bR.setStrokeStyle(1, strokeColor, 0.7);
    scene.physics.add.existing(bR);
    if (bR.body && bR.body.setSize) bR.body.setSize(6, 14, true);
    bR.body.setAllowGravity(false);
    bR.body.enable = true;
    bR.body.checkCollision.up = bR.body.checkCollision.down = bR.body.checkCollision.left = bR.body.checkCollision.right = true;
    bR.body.setVelocityY(550);
    if (bulletsGroup) bulletsGroup.add(bR);
    bullets.push(bR);
  }

  ammo -= 1;
  if (scene.ammoText) {
    scene.ammoText.setText('Ammo: ' + ammo);
    scene.ammoText.setColor(comboCount > 0 ? '#00ffff' : '#ffff00');
  }
  // Recoil upwards
  player.body.setVelocityY(Math.min(player.body.velocity.y - recoil, -recoil));
  playTone(scene, 880, 0.05);
}

function spawnCosmeticBullet(scene) {
  const useBlue = comboCount > 0;
  const bulletColor = useBlue ? 0x00ffff : 0xff4444;
  const strokeColor = useBlue ? 0x88ffff : 0xff8888;

  const b = scene.add.rectangle(player.x, player.y + 16, 6, 14, bulletColor);
  b.setStrokeStyle(1, strokeColor, 0.7);
  scene.physics.add.existing(b);
  if (b.body && b.body.setSize) b.body.setSize(6, 14, true);
  b.body.setAllowGravity(false);
  b.body.enable = true;
  b.body.checkCollision.up = b.body.checkCollision.down = b.body.checkCollision.left = b.body.checkCollision.right = true;
  b.body.setVelocityY(550);
  if (bulletsGroup) bulletsGroup.add(b);
  bullets.push(b);

  if (jetpackActive && jetpackLeftBlock && jetpackRightBlock) {
    const bL = scene.add.rectangle(jetpackLeftBlock.x, jetpackLeftBlock.y + 10, 6, 14, bulletColor);
    bL.setStrokeStyle(1, strokeColor, 0.7);
    scene.physics.add.existing(bL);
    if (bL.body && bL.body.setSize) bL.body.setSize(6, 14, true);
    bL.body.setAllowGravity(false);
    bL.body.enable = true;
    bL.body.checkCollision.up = bL.body.checkCollision.down = bL.body.checkCollision.left = bL.body.checkCollision.right = true;
    bL.body.setVelocityY(550);
    if (bulletsGroup) bulletsGroup.add(bL);
    bullets.push(bL);

    const bR = scene.add.rectangle(jetpackRightBlock.x, jetpackRightBlock.y + 10, 6, 14, bulletColor);
    bR.setStrokeStyle(1, strokeColor, 0.7);
    scene.physics.add.existing(bR);
    if (bR.body && bR.body.setSize) bR.body.setSize(6, 14, true);
    bR.body.setAllowGravity(false);
    bR.body.enable = true;
    bR.body.checkCollision.up = bR.body.checkCollision.down = bR.body.checkCollision.left = bR.body.checkCollision.right = true;
    bR.body.setVelocityY(550);
    if (bulletsGroup) bulletsGroup.add(bR);
    bullets.push(bR);
  }

  player.body.setVelocityY(Math.min(player.body.velocity.y - recoil, -recoil));
  playTone(scene, 880, 0.05);
}

// ===== Enemy helpers =====
function getDifficultyMultiplier() {
  const depth = Math.max(0, player.y - 150);
  const steps = Math.floor(depth / DIFFICULTY_DEPTH_STEP);
  return Math.min(steps * 0.15, 1);
}
function maybeSpawnEnemies(scene, platform) {
  if (!enemiesGroup) return;
  if (platform && platform.noEnemies) return;
  const pw = platform.displayWidth || 100;
  const diffMult = getDifficultyMultiplier();
  const countMult = 1 + (diffMult * (DIFFICULTY_COUNT_MULT_MAX - 1));
  let count = 0;
  const baseChance = 75 + Math.floor(diffMult * 15);
  if (Phaser.Math.Between(0, 99) < baseChance) count = 1;
  const secondChance = 12 + Math.floor(diffMult * 28);
  if (pw > 140 && Phaser.Math.Between(0, 99) < secondChance) count = Math.min(2, count + 1);
  const maxEnemies = Math.floor(2 * countMult);
  for (let i = 0; i < count && platform.enemies.length < maxEnemies; i++) {
    spawnEnemy(scene, platform);
  }
}
function spawnEnemy(scene, platform) {
  const diffMult = getDifficultyMultiplier();
  const shooterChance = SHOOTER_SPAWN_CHANCE_BASE + (diffMult * (DIFFICULTY_SPAWN_MULT_MAX - 1) * SHOOTER_SPAWN_CHANCE_BASE);
  const jumperChance = JUMPER_SPAWN_CHANCE_BASE + (diffMult * (DIFFICULTY_SPAWN_MULT_MAX - 1) * JUMPER_SPAWN_CHANCE_BASE);
  const isShooter = Math.random() < shooterChance;
  const isJumper = !isShooter && Math.random() < jumperChance;
  const pw = platform.displayWidth;
  const minX = platform.x - pw / 2 + 16;
  const maxX = platform.x + pw / 2 - 16;
  const ex = Phaser.Math.Between(Math.floor(minX), Math.floor(maxX));
  const ph = platform.displayHeight || 12;
  const eh = 14;
  const ew = 28;
  const ey = platform.y - ph / 2 - eh / 2;
  const enemy = scene.add.rectangle(ex, ey, ew, eh, isShooter ? 0xF527EE : (isJumper ? 0x27f565 : 0xff2222));
  enemy.type = isShooter ? 'shooterUp' : (isJumper ? 'jumper' : 'walker');

  enemy.shielded = Math.random() < SHIELDED_SPAWN_CHANCE;
  const strokeWidth = enemy.shielded ? 3 : 1;
  const strokeColor = enemy.shielded ? 0x00ffff : (isShooter ? 0xF74DF2 : (isJumper ? 0x27f565 : 0xff6666));
  enemy.setStrokeStyle(strokeWidth, strokeColor, 0.8);

  scene.physics.add.existing(enemy);

  scene.tweens.add({
    targets: enemy,
    alpha: { from: 1, to: enemy.shielded ? 0.7 : 0.85 },
    duration: enemy.shielded ? 600 : 800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  if (enemy.body && enemy.body.setAllowGravity) {
    enemy.body.setAllowGravity(isJumper);
  }

  enemy.body.setSize(ew, eh, true);
  enemy.body.enable = true;
  enemy.body.checkCollision.up = enemy.body.checkCollision.down = enemy.body.checkCollision.left = enemy.body.checkCollision.right = true;

  enemy.minX = platform.x - pw / 2 + 14;
  enemy.maxX = platform.x + pw / 2 - 14;
  enemy.dir = Phaser.Math.Between(0, 1) ? 1 : -1;
  enemy.speed = isShooter ? Phaser.Math.Between(10, 30) : Phaser.Math.Between(40, 80);
  enemy.platformRef = platform;

  if (isJumper) {
    enemy.jumpCooldownMs = Phaser.Math.Between(JUMPER_COOLDOWN_MIN_MS, JUMPER_COOLDOWN_MAX_MS);
    enemy.jumpTimerMs = 0;
    enemy.jumpVelY = JUMPER_JUMP_VEL_Y;
  }
  if (isShooter) {
    enemy.shootCooldownMs = Phaser.Math.Between(SHOOTER_COOLDOWN_MIN_MS, SHOOTER_COOLDOWN_MAX_MS);
    enemy.shootTimerMs = 0;
  }

  enemy.body.setVelocityX(enemy.dir * enemy.speed);
  enemy.body.setVelocityY(0);

  enemiesGroup.add(enemy);
  platform.enemies.push(enemy);
}

function updateEnemies(scene, deltaMs) {
  safeEach(enemiesGroup, (e) => {
    if (!e.active || !e.body) return;
    
    // Skip update for tutorial dummy enemies
    if (e.tutorialDummy) {
      // Keep them completely still
      if (e.body.velocity.x !== 0) e.body.setVelocityX(0);
      if (e.body.velocity.y !== 0) e.body.setVelocityY(0);
      return;
    }
    
    const isJumper = e.type === 'jumper';
    const isShooter = e.type === 'shooterUp';
    if (!isJumper && e.body.velocity.y !== 0) e.body.setVelocityY(0);
    if (Math.abs(e.body.velocity.x) < 5) e.body.setVelocityX(e.dir * e.speed);
    if (e.x <= e.minX && e.body.velocity.x < 0) { e.dir = 1; e.body.setVelocityX(e.dir * e.speed); }
    else if (e.x >= e.maxX && e.body.velocity.x > 0) { e.dir = -1; e.body.setVelocityX(e.dir * e.speed); }

    if (isJumper) {
      e.jumpTimerMs = (e.jumpTimerMs || 0) + (deltaMs || 0);
      if (e.body.blocked && e.body.blocked.down && e.jumpTimerMs >= (e.jumpCooldownMs || JUMPER_COOLDOWN_MIN_MS)) {
        e.body.setVelocityY(e.jumpVelY || JUMPER_JUMP_VEL_Y);
        e.jumpTimerMs = 0;
        scene.tweens.add({ targets: e, scaleY: { from: 0.9, to: 1 }, duration: 120, ease: 'Quad.easeOut' });
      }
    }

    if (isShooter) {
      e.shootTimerMs = (e.shootTimerMs || 0) + (deltaMs || 0);
      if (e.shootTimerMs >= (e.shootCooldownMs || SHOOTER_COOLDOWN_MIN_MS)) {
        // enemy bullet straight up
        const by = e.y - (e.displayHeight || 14) / 2;
        const b = scene.add.rectangle(e.x, by, 4, 12, 0xFC03F5);
        scene.physics.add.existing(b);
        if (b.body) {
          b.body.setAllowGravity(false);
          b.body.setGravity(0, 0);
          b.body.setDrag(0, 0);
          b.body.setAcceleration(0, 0);
          b.body.setImmovable(false);
          b.body.moves = true;
          b.body.setVelocityX(0);
          b.body.setVelocityY(ENEMY_BULLET_SPEED_Y);
        }
        if (enemyBulletsGroup) enemyBulletsGroup.add(b);
        e.shootTimerMs = 0;
        const shooters = safeChildren(enemiesGroup).filter(x => x && x.type === 'shooterUp').length;
        const mult = shooters > 2 ? 1.3 : 1;
        e.shootCooldownMs = Phaser.Math.Between(SHOOTER_COOLDOWN_MIN_MS, SHOOTER_COOLDOWN_MAX_MS) * mult;
      }
    }
  });

  platforms.forEach(p => {
    if (p.enemies) p.enemies = p.enemies.filter(e => e.active);
  });
}

function onBulletHitsEnemy(scene, bullet, enemy) {
  // Shield logic
  if (enemy && enemy.active && enemy.shielded) {
    const isChargedBullet = bullet && bullet.isCharged;
    if (!isChargedBullet) {
      if (bullet && bullet.destroy) bullet.destroy();
      const flash = scene.add.circle(enemy.x, enemy.y, enemy.displayWidth / 2 + 4, 0x00ffff, 0.6);
      flash.setDepth(1500);
      scene.tweens.add({ targets: flash, scale: 1.4, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const p = scene.add.rectangle(enemy.x, enemy.y, 3, 3, 0x00ffff);
        scene.physics.add.existing(p);
        p.body.setVelocity(Math.cos(angle) * 180, Math.sin(angle) * 180);
        p.body.setGravity(0, 0);
        scene.tweens.add({ targets: p, alpha: 0, scale: 0, duration: 250, onComplete: () => p.destroy() });
      }
      playTone(scene, 800, 0.08);
      return; // Enemy survives
    }
  }

  // Bullet cleanup
  if (bullet && bullet.isCharged && bullet.pierceCount > 0) {
    bullet.pierceCount--;
    if (bullet.pierceCount <= 0 && bullet.destroy) bullet.destroy();
  } else {
    if (bullet && bullet.destroy) bullet.destroy();
  }

  // Enemy death & scoring/combo rules
  if (enemy && enemy.active) {
    // Preserve properties needed after destroy
    const wasShielded = !!enemy.shielded;
    const ex = enemy.x; const ey = enemy.y;
    
    // death particles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const particle = scene.add.rectangle(enemy.x, enemy.y, 4, 4, 0xff6666);
      scene.physics.add.existing(particle);
      particle.body.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
      particle.body.setGravity(0, 300);
      scene.tweens.add({ targets: particle, alpha: 0, scale: 0, duration: 500, onComplete: () => particle.destroy() });
    }
    
    // Multi-kill detection
    const now = scene.time.now;
    if (now - multiKillTimer <= MULTIKILL_WINDOW) {
      multiKillCount++;
    } else {
      multiKillCount = 1;
    }
    multiKillTimer = now;
    
    // Show multi-kill milestone
    if (multiKillCount >= 2) {
      const multiKillMessages = [
        null, // 0 kills
        null, // 1 kill (no message)
        { text: 'DOUBLE KILL!', color: '#00ff00' },
        { text: 'TRIPLE KILL!', color: '#ffaa00' },
        { text: 'QUAD KILL!', color: '#ff4400' },
        { text: 'PENTA KILL!', color: '#ff00ff' },
        { text: 'MEGA KILL!', color: '#ff0000' }
      ];
      
      const killMsg = multiKillCount <= 6 
        ? multiKillMessages[multiKillCount]
        : { text: 'UNSTOPPABLE!', color: '#ffffff' };
      
      if (killMsg) {
        showMilestone(scene, killMsg.text, killMsg.color);
      }
    }

    const p = enemy.platformRef;
    if (p && p.enemies) p.enemies = p.enemies.filter(x => x !== enemy);

    const isAirborne = player && player.body && !player.body.blocked.down;
    const baseTypeScore = enemy.type === 'jumper' ? SCORE_JUMPER : (enemy.type === 'shooterUp' ? SCORE_SHOOTER : SCORE_WALKER);
    const baseScore = enemy.shielded ? Math.floor(baseTypeScore * SHIELD_SCORE_MULT) : baseTypeScore;

    let earnedScore = baseScore;

    if (isAirborne) {
      // === Full combo logic (same for BOTH modes) ===
      const wasComboZero = comboCount === 0;
      comboCount++;
      comboMultiplier = 1 + (comboCount * 0.5);
      earnedScore = Math.floor(baseScore * comboMultiplier);
      score += earnedScore;
      
      // Tutorial Step 3 -> 4: Kill enemy with combo - FIRE, then FREEZE after a short delay
      if (tutorialMode && tutorialStep === 3 && comboCount === 1) {
        tutorialStep = 4;
        tutorialStep5HoldStart = 0;
        spawnCosmeticBullet(scene);
        // Schedule the freeze shortly after so the bullet is visible
        if (!scene.tutorialFreezeScheduled) scene.tutorialFreezeScheduled = true;
        scene.time.delayedCall(140, () => {
          // Validate state before freezing
          if (!tutorialMode || tutorialStep !== 4 || tutorialStep5Frozen) { scene.tutorialFreezeScheduled = false; return; }
          tutorialStep5Frozen = true;
          
          // Reset key states to prevent stuck keys
          keysState.left = false;
          keysState.right = false;
          
          // Freeze the game (pause physics, but audio continues)
          if (scene.physics && scene.physics.world) {
            scene.physics.world.pause();
          }
          
          // Stop player movement
          if (player && player.body) {
            player.body.setVelocity(0, 0);
          }
          
          updateTutorialText(scene);
          playTone(scene, 880, 0.15);
          scene.tutorialFreezeScheduled = false;
        });
      }

      // VFX/SFX like Challenger
      const tiers = [
        [10,'#ff00ff',28,5,0.02,'GODLIKE!'],
        [7,'#ff0080',24,4,0.015,'INSANE!'],
        [5,'#ff4400',22,4,0.012,'AMAZING!'],
        [3,'#ffff00',20,3,0.008,'GREAT!']
      ];
      const tier = tiers.find(t => comboCount >= t[0]) || [0,'#00ffff',18,3,0.005,''];
      let [, textColor, textSize, strokeThickness, shakeIntensity, comboMessage] = tier;

      const t = scene.add.text(enemy.x, enemy.y - 10, '+' + earnedScore, {
        fontSize: textSize + 'px', fontFamily: FONT, color: textColor, stroke: C_BLACK, strokeThickness: strokeThickness
      }).setOrigin(0.5);
      scene.tweens.add({ targets: t, y: t.y - 30, scale: { from: 0.5, to: 1.2 }, alpha: 0, duration: 700, ease: 'Back.easeOut', onComplete: () => t.destroy() });

      if (!comboMessage && comboCount === 1) comboMessage = 'COMBO START!';
      if (comboMessage) {
        const msg = scene.add.text(enemy.x, enemy.y - 35, comboMessage, {
          fontSize: (textSize + 4) + 'px', fontFamily: FONT, color: textColor, stroke: C_WHITE, strokeThickness: 2
        }).setOrigin(0.5);
        scene.tweens.add({ targets: msg, y: msg.y - 40, scale: { from: 1.5, to: 0.8 }, alpha: { from: 1, to: 0 }, duration: 1000, ease: 'Power2', onComplete: () => msg.destroy() });
      }
      if (comboText) {
        comboText.setText('COMBO x' + comboMultiplier.toFixed(1) + ' (' + comboCount + ')');
        const scale = 1 + (comboCount * 0.1); comboText.setScale(Math.min(scale, 2));
      }
      if (scene.cameras && scene.cameras.main) scene.cameras.main.shake(200, shakeIntensity);
      const pitchMultiplier = 1 + (comboCount * 0.1);
      playTone(scene, 660 * pitchMultiplier, 0.08);

      // === Ammo rules: both modes refill on airborne kill ===
      ammo = maxAmmo;

      if (scene.ammoText) {
        scene.ammoText.setText('Ammo: ' + ammo);
        pulseHudElement(scene, scene.ammoText, textColor, 1.25, 150);
      }
      
      // Check combo milestones
      if (comboCount > highestComboReached) {
        highestComboReached = comboCount;
        if (comboCount === 5) showMilestone(scene, '5 COMBO!', '#ff4400');
        else if (comboCount === 10) showMilestone(scene, '10 COMBO!', '#ff00ff');
        else if (comboCount === 15) showMilestone(scene, '15 COMBO! UNSTOPPABLE!', '#ffff00');
      }
    } else {
      // Grounded kill (no combo gain)
      score += earnedScore;

      // Ammo rules: both modes refill on grounded kill
      ammo = maxAmmo;

      const t = scene.add.text(enemy.x, enemy.y - 10, '+' + baseScore, {
        fontSize: '16px', fontFamily: FONT, color: '#ffdd55', stroke: C_BLACK, strokeThickness: 2
      }).setOrigin(0.5);
      scene.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 500, onComplete: () => t.destroy() });

      if (scene.ammoText) {
        scene.ammoText.setText('Ammo: ' + ammo);
        pulseHudElement(scene, scene.ammoText, '#ffff00', 1.15, 120);
      }
      playTone(scene, 660, 0.08);
    }

    if (scoreText) {
      scoreText.setText('Score: ' + score);
      pulseHudElement(scene, scoreText, '#00ff00', 1.2, 150);
    }
    
    // Check score milestones
    while (score >= milestoneScore) {
      showMilestone(scene, `${milestoneScore} POINTS!`, '#00ff00');
      milestoneScore += 1000; // Next milestone
    }
    enemy.destroy();
    
    // Tutorial: respawn dummy enemy endlessly
    if (tutorialMode && enemy && enemy.tutorialDummy) {
      spawnTutorialDummy(scene);
    }

    // Guaranteed Jetpack drop for shielded enemies, unless player already has jetpack
    let spawnedPU = false;
    if (wasShielded && !jetpackActive) {
      spawnPowerUp(scene, ex, ey - 40);
      spawnedPU = true;
    }

    // Spawn power-up on airborne kills (only if jetpack not active and none spawned yet)
    const isAirborneAfter = player && player.body && !player.body.blocked.down;
    if (!spawnedPU && isAirborneAfter && !jetpackActive && false && Math.random() < POWERUP_SPAWN_CHANCE && powerUps.length < POWERUP_MAX_ACTIVE) {
      spawnPowerUp(scene, ex, ey - 40);
    }
  }
}


function spawnPowerUp(scene, x, y) {
  if (!powerUpsGroup) return;
  const powerUp = scene.add.rectangle(x, y, 20, 20, 0xff9900, 0.9);
  powerUp.setStrokeStyle(3, 0xffcc00, 1);

  const label = scene.add.text(x, y, '🚀', { fontSize: '16px', align: 'center' }).setOrigin(0.5);
  label.setDepth(1500);
  powerUp.label = label;

  scene.physics.add.existing(powerUp);
  powerUp.body.setAllowGravity(false);
  if (powerUpsGroup) powerUpsGroup.add(powerUp);
  powerUps.push(powerUp);

  scene.tweens.add({
    targets: [powerUp, label],
    scale: { from: 0.9, to: 1.1 },
    duration: 500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });
  scene.tweens.add({ targets: powerUp, angle: 360, duration: 3000, repeat: -1, ease: 'Linear' });
}

function onPowerUpCollected(scene, powerUp) {
  if (!powerUp || !powerUp.active) return;
  activateJetpack(scene);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const p = scene.add.rectangle(powerUp.x, powerUp.y, 4, 4, 0xff9900);
    scene.physics.add.existing(p);
    p.body.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
    p.body.setGravity(0, 0);
    scene.tweens.add({ targets: p, alpha: 0, scale: 0, duration: 400, onComplete: () => p.destroy() });
  }
  playTone(scene, 880, 0.1); playTone(scene, 1100, 0.1);
  if (powerUp.label && powerUp.label.destroy) powerUp.label.destroy();
  powerUp.destroy();
  powerUps = powerUps.filter(p => p !== powerUp);
}

function activateJetpack(scene) {
  jetpackActive = true;
  const offsetX = 14;
  jetpackLeftBlock = scene.add.rectangle(player.x - offsetX, player.y, 8, 16, 0x888888);
  jetpackLeftBlock.setStrokeStyle(1, 0xaaaaaa, 0.8);
  jetpackLeftBlock.setDepth(player.depth - 1);
  jetpackRightBlock = scene.add.rectangle(player.x + offsetX, player.y, 8, 16, 0x888888);
  jetpackRightBlock.setStrokeStyle(1, 0xaaaaaa, 0.8);
  jetpackRightBlock.setDepth(player.depth - 1);
  scene.tweens.add({
    targets: [jetpackLeftBlock, jetpackRightBlock],
    alpha: { from: 1, to: 0.6 },
    duration: 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
  });
  playTone(scene, 660, 0.15);
}
function deactivateJetpack(scene) {
  jetpackActive = false;
  if (jetpackLeftBlock) { jetpackLeftBlock.destroy(); jetpackLeftBlock = null; }
  if (jetpackRightBlock) { jetpackRightBlock.destroy(); jetpackRightBlock = null; }
  playTone(scene, 440, 0.1);
}
function updateJetpackPosition() {
  if (!jetpackActive || !player) return;
  const offsetX = 14;
  if (jetpackLeftBlock) { jetpackLeftBlock.x = player.x - offsetX; jetpackLeftBlock.y = player.y; }
  if (jetpackRightBlock) { jetpackRightBlock.x = player.x + offsetX; jetpackRightBlock.y = player.y; }
}

// ===== Charge Shot helpers =====
function startCharging(scene) {
  if (isCharging) return;
  isCharging = true;
  chargeStartTime = scene.time.now;
  chargeAudioCompleted = false;

  if (scene.physics && scene.physics.world) scene.physics.world.timeScale = CHARGE_SLOWMO_SCALE;
  if (!chargeVisuals) {
    chargeVisuals = scene.add.graphics();
    chargeVisuals.setDepth(999);
    chargeVisuals.setScrollFactor(1);
  }
  scene.tweens.add({
    targets: chargeVisuals,
    alpha: { from: 0.8, to: 0.3 },
    duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
  });

  startChargeAudio(scene);
}
function stopCharging(scene, fired = false) {
  if (!isCharging) return;
  isCharging = false;

  if (scene.physics && scene.physics.world) scene.physics.world.timeScale = 1.0;

  if (chargeVisuals) {
    scene.tweens.killTweensOf(chargeVisuals);
    chargeVisuals.clear();
    chargeVisuals.destroy();
    chargeVisuals = null;
  }

  stopChargeAudio(scene);
  chargeAudioCompleted = false;

  if (fired) {
    const ring = scene.add.circle(player.x, player.y, 10, 0xEEF527, 0.7);
    ring.setDepth(1000);
    scene.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 250, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const p = scene.add.rectangle(player.x, player.y, 4, 4, 0xEEF527);
      p.setDepth(1000);
      scene.physics.add.existing(p);
      p.body.setVelocity(Math.cos(angle) * 200, Math.sin(angle) * 200);
      p.body.setGravity(0, 0);
      scene.tweens.add({ targets: p, alpha: 0, scale: 0, duration: 300, onComplete: () => p.destroy() });
    }
    scene.cameras.main.shake(150, 0.006);
    playTone(scene, 1000, 0.12);
  }
}
function fireChargedBullet(scene) {
  // Instant ray down
  const rayColor = 0xEEF527;
  const rayStart = { x: player.x, y: player.y + 12 };
  const rayEnd = { x: player.x, y: player.y + CHARGE_RAY_MAX_DISTANCE };

  const CHARGE_RAY_WIDTH_OUTER = 40;
  const CHARGE_RAY_WIDTH_MID   = 20;
  const CHARGE_RAY_WIDTH_CORE  = 10;

  const rayGraphics = scene.add.graphics();
  rayGraphics.setDepth(1500);
  rayGraphics.lineStyle(CHARGE_RAY_WIDTH_OUTER, rayColor, 0.3); rayGraphics.lineBetween(rayStart.x, rayStart.y, rayEnd.x, rayEnd.y);
  rayGraphics.lineStyle(CHARGE_RAY_WIDTH_MID, rayColor, 0.7); rayGraphics.lineBetween(rayStart.x, rayStart.y, rayEnd.x, rayEnd.y);
  rayGraphics.lineStyle(CHARGE_RAY_WIDTH_CORE, 0xFFFFFF, 1.0); rayGraphics.lineBetween(rayStart.x, rayStart.y, rayEnd.x, rayEnd.y);
  scene.tweens.add({ targets: rayGraphics, alpha: 0, duration: CHARGE_RAY_VISUAL_DURATION, ease: 'Quad.easeOut', onComplete: () => rayGraphics.destroy() });

  // Detect enemies under player within narrow X alignment
  const hitEnemies = [];
  safeEach(enemiesGroup, (enemy) => {
    if (!enemy.active) return;
    const horizontalDist = Math.abs(enemy.x - player.x);
    if (horizontalDist <= 20 && enemy.y > player.y) {
      const distanceFromPlayer = enemy.y - player.y;
      hitEnemies.push({ enemy, distance: distanceFromPlayer });
    }
  });
  hitEnemies.sort((a, b) => a.distance - b.distance);
  const maxHits = CHARGE_PIERCE_COUNT;
  const actualHits = Math.min(hitEnemies.length, maxHits);
  for (let i = 0; i < actualHits; i++) {
    const { enemy } = hitEnemies[i];
    const impactFlash = scene.add.circle(enemy.x, enemy.y, 12, rayColor, 0.8);
    impactFlash.setDepth(1600);
    scene.tweens.add({ targets: impactFlash, scale: 2.5, alpha: 0, duration: 250, ease: 'Power2', onComplete: () => impactFlash.destroy() });
    for (let j = 0; j < 6; j++) {
      const angle = (j / 6) * Math.PI * 2;
      const p = scene.add.rectangle(enemy.x, enemy.y, 3, 3, rayColor);
      p.setDepth(1600);
      scene.physics.add.existing(p);
      p.body.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
      p.body.setGravity(0, 0);
      scene.tweens.add({ targets: p, alpha: 0, scale: 0, duration: 300, onComplete: () => p.destroy() });
    }
    onBulletHitsEnemy(scene, { isCharged: true, pierceCount: 999 }, enemy);
  }

  // Ammo & recoil
  ammo -= CHARGE_COST_AMMO;
  if (scene.ammoText) {
    scene.ammoText.setText('Ammo: ' + ammo);
    scene.ammoText.setColor(comboCount > 0 ? '#00ffff' : '#ffff00');
  }
  if (player && player.body) {
    const recoilY = recoil * 0.5;
    player.body.setVelocityY(Math.min(player.body.velocity.y - recoilY, -recoilY));
  }
  playTone(scene, 1200, 0.15);
}

// ===== Debug helpers =====
function drawHitboxes(scene) {
  if (!debugGraphics) return;
  debugGraphics.clear();
  if (player && player.body) {
    debugGraphics.lineStyle(1, 0x00ff00, 1);
    debugGraphics.strokeRect(player.body.x, player.body.y, player.body.width, player.body.height);
  }
  safeEach(enemiesGroup, (e) => {
    if (e.body) {
      debugGraphics.lineStyle(1, 0xffa500, 1);
      debugGraphics.strokeRect(e.body.x, e.body.y, e.body.width, e.body.height);
    }
  });
  safeEach(bulletsGroup, (b) => {
    if (b.body) {
      debugGraphics.lineStyle(1, 0xffff00, 1);
      debugGraphics.strokeRect(b.body.x, b.body.y, b.body.width, b.body.height);
    }
  });
}

// ===== Side hazard helpers =====
function setupHazards(scene) {
  const cam = scene.cameras.main;
  leftHazard = scene.add.rectangle(6, cam.scrollY + 300, 12, 640, 0xff2222, hazardOn ? 0.6 : 0.12);
  scene.physics.add.existing(leftHazard, true);
  hazardsGroup.add(leftHazard);
  if (leftHazard.body && leftHazard.body.updateFromGameObject) leftHazard.body.updateFromGameObject();
  rightHazard = scene.add.rectangle(794, cam.scrollY + 300, 12, 640, 0xff2222, hazardOn ? 0.6 : 0.12);
  scene.physics.add.existing(rightHazard, true);
  hazardsGroup.add(rightHazard);
  if (rightHazard.body && rightHazard.body.updateFromGameObject) rightHazard.body.updateFromGameObject();
}
function updateHazards(scene) {
  const cam = scene.cameras.main;
  if (leftHazard) { leftHazard.y = cam.scrollY + 300; if (leftHazard.body && leftHazard.body.updateFromGameObject) leftHazard.body.updateFromGameObject(); }
  if (rightHazard) { rightHazard.y = cam.scrollY + 300; if (rightHazard.body && rightHazard.body.updateFromGameObject) rightHazard.body.updateFromGameObject(); }
}
function setHazardVisual(_scene) {
  const a = hazardOn ? 0.6 : 0.12;
  if (leftHazard) leftHazard.setFillStyle(0xff2222, a);
  if (rightHazard) rightHazard.setFillStyle(0xff2222, a);
}

// ====== AUDIO ======
function playTone(scene, frequency, duration) {
  const audioContext = scene.sound.context;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'square';

  gainNode.gain.setValueAtTime(0.03, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// ====== HITSTOP & SCREENSHAKE ======
function applyHitstop(scene, duration = 80) {
  if (!scene || !scene.physics || !scene.physics.world) return;
  
  hitstopActive = true;
  hitstopEndTime = scene.time.now + duration;
  
  // Pause physics briefly
  const originalTimeScale = scene.physics.world.timeScale;
  scene.physics.world.timeScale = 0;
  
  scene.time.delayedCall(duration, () => {
    if (scene.physics && scene.physics.world) {
      scene.physics.world.timeScale = originalTimeScale;
    }
    hitstopActive = false;
  });
}

function applyScreenshake(scene, intensity = 3, duration = 100) {
  if (!scene || !scene.cameras || !scene.cameras.main) return;
  
  const camera = scene.cameras.main;
  camera.shake(duration, intensity / 1000); // Phaser expects intensity as decimal
}

function playImpactEffect(scene, x, y, color = 0xff0000, particleCount = 8) {
  if (!scene || gameOver) return;
  
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const speed = 100 + Math.random() * 100;
    const size = 3 + Math.random() * 3;
    
    const particle = scene.add.rectangle(x, y, size, size, color);
    scene.physics.add.existing(particle);
    particle.body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
    particle.body.setGravity(0, 300);
    
    scene.tweens.add({
      targets: particle,
      alpha: 0,
      scale: 0.3,
      duration: 300 + Math.random() * 200,
      onComplete: () => particle.destroy()
    });
  }
  
  // Impact sound
  playTone(scene, 150 + Math.random() * 100, 0.08);
}

// ====== FEEDBACK POSITIVO Y TRANSICIONES ======
// Componente reutilizable para texto flotante
function spawnFloatingText(scene, x, y, text, options = {}) {
  if (!scene || gameOver) return;
  
  const defaults = {
    fontSize: '20px',
    color: '#ffffff',
    strokeThickness: 3,
    duration: 700,
    yOffset: -40,
    startScale: 0.5,
    endScale: 1.2,
    ease: 'Back.easeOut'
  };
  
  const opts = { ...defaults, ...options };
  
  const floatingText = scene.add.text(x, y, text, {
    fontSize: opts.fontSize,
    fontFamily: FONT,
    color: opts.color,
    stroke: C_BLACK,
    strokeThickness: opts.strokeThickness
  }).setOrigin(0.5);
  
  scene.tweens.add({
    targets: floatingText,
    y: y + opts.yOffset,
    scale: { from: opts.startScale, to: opts.endScale },
    alpha: { from: 1, to: 0 },
    duration: opts.duration,
    ease: opts.ease,
    onComplete: () => floatingText.destroy()
  });
  
  return floatingText;
}

// Pulso visual en elementos del HUD
function pulseHudElement(scene, element, color = null, scaleFactor = 1.15, duration = 150) {
  if (!scene || !element) return;
  
  // Kill existing tweens to avoid stacking
  scene.tweens.killTweensOf(element);
  
  // Color flash if provided
  if (color) {
    const originalColor = element.style.color;
    element.setColor(color);
    scene.time.delayedCall(duration, () => {
      if (element && element.setColor) element.setColor(originalColor);
    });
  }
  
  // Scale pulse
  scene.tweens.add({
    targets: element,
    scale: { from: 1, to: scaleFactor },
    duration: duration / 2,
    yoyo: true,
    ease: 'Quad.easeOut'
  });
}

// Pop-up de milestone (no intrusivo)
function showMilestone(scene, message, color = '#ffff00') {
  if (!scene || gameOver) return;
  
  // Empujar milestones existentes hacia arriba
  activeMilestones.forEach((existingMilestone) => {
    if (existingMilestone && existingMilestone.active) {
      scene.tweens.add({
        targets: existingMilestone,
        y: existingMilestone.y - 50, // Desplazar 50px arriba
        duration: 200,
        ease: 'Quad.easeOut'
      });
    }
  });
  
  // Incrementar depth counter para que el más nuevo esté siempre encima
  milestoneDepthCounter++;
  
  const milestone = scene.add.text(400, 150, message, {
    fontSize: '32px',
    fontFamily: FONT,
    color: color,
    stroke: C_BLACK,
    strokeThickness: 4
  }).setOrigin(0.5).setScrollFactor(0).setDepth(milestoneDepthCounter);
  
  // Añadir al array de activos
  activeMilestones.push(milestone);
  
  // Audio feedback
  playTone(scene, 880, 0.12);
  
  // Bounce in, hold, fade out
  scene.tweens.add({
    targets: milestone,
    scale: { from: 0, to: 1.2 },
    duration: 250,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(800, () => {
        scene.tweens.add({
          targets: milestone,
          alpha: 0,
          scale: 0.8,
          duration: 300,
          ease: 'Quad.easeIn',
          onComplete: () => {
            // Remover del array cuando se destruye
            activeMilestones = activeMilestones.filter(m => m !== milestone);
            milestone.destroy();
          }
        });
      });
    }
  });
  
  return milestone;
}

// Fade in para overlays
function fadeInOverlay(scene, container, duration = 250, onComplete = null) {
  if (!scene || !container) return;
  
  container.setAlpha(0);
  scene.tweens.add({
    targets: container,
    alpha: 1,
    duration: duration,
    ease: 'Quad.easeOut',
    onComplete: onComplete
  });
}

// Fade out para overlays
function fadeOutOverlay(scene, container, duration = 250, onComplete = null) {
  if (!scene || !container) return;
  
  scene.tweens.add({
    targets: container,
    alpha: 0,
    duration: duration,
    ease: 'Quad.easeIn',
    onComplete: () => {
      if (onComplete) onComplete();
    }
  });
}

// ====== BACKGROUND MUSIC ======
// Globals expected somewhere in your code:
// let bgMusicNodes = [];
// let bgMusicLoopId = null;

function startBackgroundMusic(scene) {
  if (!scene || !scene.sound || !scene.sound.context) return;

  // Stop any previous loop
  stopBackgroundMusic();

  const ctx = scene.sound.context;
  const tempo = 112; // slower + groovier BPM
  const beatDuration = 60 / tempo; // one beat in seconds

  const beatsPerBar = 4;
  const barsPerLoop = 4;
  const totalBeatsPerLoop = beatsPerBar * barsPerLoop; // 16 beats
  const loopLength = totalBeatsPerLoop * beatDuration;

  // Slight offset so first notes don't get cut
  const baseStartTime = ctx.currentTime + 0.1;

  // ---- Helper functions ----

  function scheduleTone({ note, time, dur, volume, type = 'sawtooth', pan = 0, detune = 0 }, loopStartTime) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    const t = loopStartTime + time * beatDuration;
    const d = dur * beatDuration;

    osc.type = type;
    osc.frequency.value = note;
    if (detune !== 0) osc.detune.value = detune;

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.setValueAtTime(pan, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + d);

    osc.start(t);
    osc.stop(t + d + 0.1);

    bgMusicNodes.push({ osc, gain, panner });
  }

  function scheduleChord({ notes, time, dur, volume, pan = 0, detuneSpread = 8 }, loopStartTime) {
    notes.forEach((note, i) => {
      const detune = (i - (notes.length - 1) / 2) * detuneSpread;
      scheduleTone({ note, time, dur, volume, pan, detune, type: 'sawtooth' }, loopStartTime);
    });
  }

  function scheduleKick(timeBeat, loopStartTime) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const t = loopStartTime + timeBeat * beatDuration;
    const d = 0.35 * beatDuration;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + d);

    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + d);

    osc.start(t);
    osc.stop(t + d + 0.05);

    bgMusicNodes.push({ osc, gain });
  }

  function scheduleNoiseHit({ timeBeat, duration, volume, highpassFreq, bandpassFreq, pan = 0 }, loopStartTime) {
    const t = loopStartTime + timeBeat * beatDuration;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    let filter = null;
    if (highpassFreq || bandpassFreq) {
      filter = ctx.createBiquadFilter();
      if (bandpassFreq) {
        filter.type = 'bandpass';
        filter.frequency.value = bandpassFreq;
        filter.Q.value = 1;
      } else {
        filter.type = 'highpass';
        filter.frequency.value = highpassFreq;
      }
      noise.connect(filter);
      filter.connect(gain);
    } else {
      noise.connect(gain);
    }

    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.setValueAtTime(pan, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.start(t);
    noise.stop(t + duration + 0.05);

    bgMusicNodes.push({ osc: noise, gain, filter, panner });
  }

  function scheduleSnare(timeBeat, loopStartTime) {
    // Short, bright noise burst
    scheduleNoiseHit({
      timeBeat,
      duration: 0.13,
      volume: 0.22,
      highpassFreq: null,
      bandpassFreq: 2000,
      pan: 0
    }, loopStartTime);
  }

  function scheduleHiHat(timeBeat, loopStartTime) {
    const isOffBeat = (timeBeat % 1) !== 0; // 0.5, 1.5, etc
    scheduleNoiseHit({
      timeBeat,
      duration: isOffBeat ? 0.09 : 0.05,
      volume: isOffBeat ? 0.16 : 0.10,
      highpassFreq: 7000,
      bandpassFreq: null,
      pan: isOffBeat ? 0.2 : -0.1
    }, loopStartTime);
  }

  // ---- Musical patterns (in beats) ----
  // C minor funk: C, D, E♭, F, G, B♭

  // Bass: two variations that alternate each loop
  const bassPatterns = [
    // Pattern 0
    [
      { note: 65.41, time: 0,   dur: 0.9 },  // C2
      { note: 65.41, time: 1.5, dur: 0.5 },  // ghost C2
      { note: 73.42, time: 2,   dur: 0.7 },  // D2
      { note: 77.78, time: 3,   dur: 0.7 },  // Eb2

      { note: 65.41, time: 4,   dur: 0.8 },  // C2
      { note: 98.00, time: 5.5, dur: 0.6 },  // G2
      { note: 87.31, time: 6.5, dur: 0.6 },  // F2
      { note: 73.42, time: 7.5, dur: 0.5 },  // D2

      { note: 65.41, time: 8,   dur: 0.9 },  // C2
      { note: 58.27, time: 9.5, dur: 0.5 },  // Bb1
      { note: 65.41, time:10.0, dur: 0.5 },  // C2
      { note: 73.42, time:11.0, dur: 0.6 },  // D2

      { note: 77.78, time:12.0, dur: 0.7 },  // Eb2
      { note: 98.00, time:13.0, dur: 0.7 },  // G2
      { note: 65.41, time:14.5, dur: 0.4 },  // C2 pickup
      { note: 73.42, time:15.0, dur: 0.6 }   // D2
    ],
    // Pattern 1 – jumps an octave sometimes
    [
      { note: 65.41,  time: 0,   dur: 0.9 }, // C2
      { note: 73.42,  time: 0.75,dur: 0.4 }, // D2
      { note: 77.78,  time: 1.5, dur: 0.5 }, // Eb2
      { note: 98.00,  time: 2.0, dur: 0.6 }, // G2
      { note: 130.81, time: 3.0, dur: 0.4 }, // C3

      { note: 98.00,  time: 4.0, dur: 0.7 }, // G2
      { note: 87.31,  time: 4.75,dur: 0.4 }, // F2
      { note: 73.42,  time: 5.5, dur: 0.5 }, // D2
      { note: 65.41,  time: 6.0, dur: 0.8 }, // C2
      { note: 58.27,  time: 7.5, dur: 0.5 }, // Bb1

      { note: 65.41,  time: 8.0, dur: 0.8 }, // C2
      { note: 73.42,  time: 9.0, dur: 0.5 }, // D2
      { note: 77.78,  time:10.0, dur: 0.5 }, // Eb2
      { note: 98.00,  time:11.5, dur: 0.6 }, // G2

      { note: 130.81, time:12.0, dur: 0.5 }, // C3
      { note: 98.00,  time:13.0, dur: 0.6 }, // G2
      { note: 73.42,  time:14.5, dur: 0.4 }, // D2
      { note: 65.41,  time:15.0, dur: 0.7 }  // C2
    ]
  ];

  // Melody: two call & response variations (higher octave)
  const melodyPatterns = [
    // Pattern 0
    [
      { note: 261.63, time: 0.5, dur: 0.4 }, // C4
      { note: 311.13, time: 1.5, dur: 0.4 }, // Eb4
      { note: 392.00, time: 2.5, dur: 0.35 },// G4
      { note: 293.66, time: 3.5, dur: 0.4 }, // D4

      { note: 261.63, time: 4.5, dur: 0.4 }, // C4
      { note: 392.00, time: 5.5, dur: 0.4 }, // G4
      { note: 466.16, time: 6.5, dur: 0.35 },// Bb4
      { note: 311.13, time: 7.5, dur: 0.4 }, // Eb4

      { note: 261.63, time: 9.0, dur: 0.35 },// C4
      { note: 293.66, time:10.0, dur: 0.35 },// D4
      { note: 311.13, time:10.5, dur: 0.35 },// Eb4
      { note: 392.00, time:11.5, dur: 0.4 }, // G4

      { note: 349.23, time:12.5, dur: 0.35 },// F4
      { note: 311.13, time:13.0, dur: 0.35 },// Eb4
      { note: 261.63, time:14.0, dur: 0.4 }, // C4
      { note: 392.00, time:15.0, dur: 0.4 }  // G4
    ],
    // Pattern 1 – a bit more angular
    [
      { note: 392.00, time: 0.5, dur: 0.4 }, // G4
      { note: 349.23, time: 1.5, dur: 0.3 }, // F4
      { note: 311.13, time: 2.25,dur: 0.3 }, // Eb4
      { note: 293.66, time: 3.0, dur: 0.35 },// D4

      { note: 261.63, time: 4.0, dur: 0.4 }, // C4
      { note: 293.66, time: 4.75,dur: 0.3 }, // D4
      { note: 311.13, time: 5.5, dur: 0.3 }, // Eb4
      { note: 466.16, time: 6.0, dur: 0.35 },// Bb4

      { note: 392.00, time: 8.0, dur: 0.35 },// G4
      { note: 349.23, time: 8.75,dur: 0.3 }, // F4
      { note: 311.13, time: 9.5, dur: 0.3 }, // Eb4
      { note: 261.63, time:10.0, dur: 0.4 }, // C4

      { note: 293.66, time:12.0, dur: 0.4 }, // D4
      { note: 311.13, time:12.75,dur: 0.3 }, // Eb4
      { note: 392.00, time:13.5,dur: 0.4 }, // G4
      { note: 261.63, time:15.0,dur: 0.4 }  // C4
    ]
  ];

  // Chord stabs: two variations
  const chordPatterns = [
    [
      { notes: [261.63, 311.13, 392.00], time: 0.0, dur: 0.6, volume: 0.045, pan: -0.2 }, // Cmin
      { notes: [349.23, 440.00, 523.25], time: 4.0, dur: 0.6, volume: 0.045, pan:  0.2 }, // F
      { notes: [392.00, 493.88, 587.33], time: 8.0, dur: 0.6, volume: 0.045, pan: -0.2 }, // G
      { notes: [261.63, 311.13, 392.00], time:12.0, dur: 0.6, volume: 0.045, pan:  0.2 }  // Cmin
    ],
    [
      { notes: [261.63, 311.13, 392.00], time: 0.0, dur: 0.6, volume: 0.045, pan:  0.2 }, // Cmin
      { notes: [233.08, 293.66, 349.23], time: 4.0, dur: 0.6, volume: 0.045, pan: -0.2 }, // Bb
      { notes: [196.00, 246.94, 293.66], time: 8.0, dur: 0.6, volume: 0.045, pan:  0.2 }, // Gm
      { notes: [261.63, 311.13, 392.00], time:12.0, dur: 0.6, volume: 0.045, pan: -0.2 }  // Cmin
    ]
  ];

  // Drums: kick, snare, hi-hat (in beats)
  const kickBeats  = [0, 2, 4.5, 6, 8, 10, 12.5, 14];
  const snareBeats = [2, 6, 10, 14];

  const hihatBeats = [];
  for (let b = 0; b < totalBeatsPerLoop; b += 0.5) {
    hihatBeats.push(b); // 8th-note hats
  }

  // ---- Loop scheduling ----
  function scheduleLoop(loopIndex) {
    const loopStartTime = baseStartTime + loopIndex * loopLength;

    const bassPattern    = bassPatterns[loopIndex % bassPatterns.length];
    const melodyPattern  = melodyPatterns[loopIndex % melodyPatterns.length];
    const chordPattern   = chordPatterns[loopIndex % chordPatterns.length];

    // Bass (slightly left)
    bassPattern.forEach(ev => {
      scheduleTone({
        note: ev.note,
        time: ev.time,
        dur: ev.dur,
        volume: 0.10,
        type: 'sawtooth',
        pan: -0.15
      }, loopStartTime);
    });

    // Melody (slightly right, square wave lead)
    melodyPattern.forEach(ev => {
      scheduleTone({
        note: ev.note,
        time: ev.time,
        dur: ev.dur,
        volume: 0.055,
        type: 'square',
        pan: 0.18
      }, loopStartTime);
    });

    // Chord stabs (wide & soft)
    chordPattern.forEach(ch => {
      scheduleChord(ch, loopStartTime);
    });

    // Drums
    kickBeats.forEach(beat => scheduleKick(beat, loopStartTime));
    snareBeats.forEach(beat => scheduleSnare(beat, loopStartTime));
    hihatBeats.forEach(beat => scheduleHiHat(beat, loopStartTime));
  }

  // Schedule first loop immediately
  let loopIndex = 0;
  scheduleLoop(loopIndex);
  loopIndex++;

  // Schedule recurring loops a bit early for seamless playback
  bgMusicLoopId = setInterval(() => {
    if (ctx.state === 'running') {
      scheduleLoop(loopIndex);
      loopIndex++;
    }
  }, loopLength * 1000 - 100);
}

function stopBackgroundMusic() {
  // Clear loop timer
  if (bgMusicLoopId) {
    clearInterval(bgMusicLoopId);
    bgMusicLoopId = null;
  }

  // Stop and disconnect all nodes
  if (Array.isArray(bgMusicNodes)) {
    bgMusicNodes.forEach(({ osc, gain, filter, panner }) => {
      try {
        if (osc && typeof osc.stop === 'function') {
          osc.stop();
        }
      } catch (_e) {
        // node already stopped
      }
      if (gain && gain.disconnect) gain.disconnect();
      if (filter && filter.disconnect) filter.disconnect();
      if (panner && panner.disconnect) panner.disconnect();
    });
  }

  bgMusicNodes = [];
}


/* =========================
   AUDIO DINÁMICO DE CARGA
   ========================= */
function startChargeAudio(scene) {
  stopChargeAudio(scene);
  const ac = scene.sound.context;
  chargeOsc = ac.createOscillator();
  chargeGain = ac.createGain();
  chargeOsc.type = 'sine';
  chargeOsc.frequency.value = CHARGE_AUDIO_MIN_HZ;
  chargeGain.gain.setValueAtTime(0.02, ac.currentTime);
  chargeOsc.connect(chargeGain);
  chargeGain.connect(ac.destination);
  chargeOsc.start();
}
function stopChargeAudio(scene) {
  const ac = scene?.sound?.context;
  const now = ac?.currentTime ?? 0;
  try {
    if (chargeGain && ac) {
      chargeGain.gain.cancelScheduledValues(now);
      chargeGain.gain.setValueAtTime(chargeGain.gain.value ?? 0.02, now);
      chargeGain.gain.linearRampToValueAtTime(0.0001, now + 0.03);
    }
    if (chargeOsc) chargeOsc.stop(now + 0.03);
  } catch (_) {}
  try { if (chargeOsc) chargeOsc.disconnect(); } catch (_) {}
  try { if (chargeGain) chargeGain.disconnect(); } catch (_) {}
  chargeOsc = null;
  chargeGain = null;
}
function updateChargeAudio(scene) {
  if (!chargeOsc || !scene) return;
  const threshold = Math.max(1, CHARGE_THRESHOLD_MS);
  const elapsed = scene.time.now - chargeStartTime;
  const rawProgress = elapsed / threshold;
  const progress = Phaser.Math.Clamp(rawProgress, 0, 1);
  const t = progress;
  const freq = CHARGE_AUDIO_MIN_HZ + (CHARGE_AUDIO_MAX_HZ - CHARGE_AUDIO_MIN_HZ) * t;
  const ac = scene.sound.context;
  chargeOsc.frequency.setValueAtTime(freq, ac.currentTime);
  if (!chargeAudioCompleted && progress >= 1) {
    chargeAudioCompleted = true;
    stopChargeAudio(scene);
    // Optional ready ping:
    // playTone(scene, 750, 0.06);
  }
}
