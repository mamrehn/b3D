// ============================================
// Netzwerk-Verkabelung - Interaktives Lernspiel
// Level 1: Kabelkanal
// Level 2: Netzwerkdose (T568A)
// Level 3: Patchpanel (T568A)
// Level 4: PC-Vernetzung & Ping
// ============================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Level-System
const LEVELS = {
    1: {
        name: 'Kabelkanal',
        description: 'Verlege das Verlegekabel im Kabelkanal',
        icon: '📏'
    },
    2: {
        name: 'Netzwerkdose',
        description: 'Belege die LSA-Klemmen der Netzwerkdose (T568A)',
        icon: '🔌'
    },
    3: {
        name: 'Patchpanel & Switches',
        description: 'Verbinde alle 24 Patchpanel-Ports mit den Switches',
        icon: '🖥️',
        timeLimit: 180  // 3 Minuten Zeitlimit für 24 Verbindungen
    },
    4: {
        name: 'PC-Vernetzung',
        description: 'Verbinde zwei PCs mit der Netzwerkdose und teste mit Ping',
        icon: '🖧'
    }
};

let currentLevel = 1;

// T568A Farbschema (Reihenfolge Pin 1-8)
// Bei LSA-Klemmen: Paare sind nebeneinander angeordnet
const T568A_COLORS = [
    { id: 'wg', name: 'Weiß-Grün', color1: '#FFFFFF', color2: '#2E8B57', pin: 1, pair: 3 },
    { id: 'g', name: 'Grün', color1: '#2E8B57', color2: '#2E8B57', pin: 2, pair: 3 },
    { id: 'wo', name: 'Weiß-Orange', color1: '#FFFFFF', color2: '#FF8C00', pin: 3, pair: 2 },
    { id: 'bl', name: 'Blau', color1: '#4169E1', color2: '#4169E1', pin: 4, pair: 1 },
    { id: 'wbl', name: 'Weiß-Blau', color1: '#FFFFFF', color2: '#4169E1', pin: 5, pair: 1 },
    { id: 'o', name: 'Orange', color1: '#FF8C00', color2: '#FF8C00', pin: 6, pair: 2 },
    { id: 'wbr', name: 'Weiß-Braun', color1: '#FFFFFF', color2: '#8B4513', pin: 7, pair: 4 },
    { id: 'br', name: 'Braun', color1: '#8B4513', color2: '#8B4513', pin: 8, pair: 4 }
];

// LSA-Klemmen Reihenfolge (wie auf dem Bild - Paare zusammen)
// Obere Reihe: Paar 2 (Orange), Paar 1 (Blau) - Pins 3,6,4,5 -> aber paarweise: wo,o,bl,wbl
// Untere Reihe: Paar 3 (Grün), Paar 4 (Braun) - Pins 1,2,7,8 -> wg,g,wbr,br
const LSA_LAYOUT = {
    topRow: ['wo', 'o', 'bl', 'wbl'],      // Weiß-Orange, Orange, Blau, Weiß-Blau
    bottomRow: ['wg', 'g', 'wbr', 'br']    // Weiß-Grün, Grün, Weiß-Braun, Braun
};

// Spielzustand
const gameState = {
    isStarted: false,
    startTime: null,
    elapsedTime: 0,
    timerInterval: null,
    selectedCore: null,
    activeCable: 1,  // Welches Kabel ist aktiv (1 oder 2)
    cables: {
        1: { assignments: {}, used: new Set() },  // Kabel 1 für Dose A
        2: { assignments: {}, used: new Set() }   // Kabel 2 für Dose B
    },
    helpUsed: 0,
    undoHistory: [],  // Undo-Verlauf für Level 2
    // Punktestand pro Level für Gesamtstatistik
    levelScores: {
        1: { score: 0, time: 0, completed: false },
        2: { score: 0, time: 0, completed: false },
        3: { score: 0, time: 0, completed: false },
        4: { score: 0, time: 0, completed: false }
    },
    // Level 1 Zustand (Kabelkanal)
    level1: {
        cableSegments: [],      // Kabelsegmente die platziert wurden
        totalSegments: 6,       // Anzahl der zu platzierenden Segmente
        placedSegments: 0,
        selectedSegment: null,
        cableInHand: false
    },
    // Level 3 Zustand (Patchpanel & Switches)
    level3: {
        selectedPatchPort: null,    // Ausgewählter Patchpanel-Port
        selectedSwitchPort: null,   // Ausgewählter Switch-Port
        connections: [],             // Hergestellte Verbindungen [{patchPort, switchPort, targetSwitch}]
        requiredConnections: 24,     // Alle 24 Ports müssen verbunden werden
        timeRemaining: 180,          // Verbleibende Zeit in Sekunden
        timerActive: false
    },
    // Level 4 Zustand (PC-Vernetzung & Ping)
    level4: {
        selectedCable: null,         // 'left' | 'right' | null
        cablePhase: 'pickUp',       // 'pickUp' | 'connectPC' | 'connectSocket'
        connections: {
            left:  { pcConnected: false, socketConnected: false },
            right: { pcConnected: false, socketConnected: false }
        },
        bothConnected: false,
        pingStarted: false,
        pingComplete: false
    }
};

// Three.js Variablen
let scene, camera, renderer, controls;
let socketMesh = null;
let lsaClipMeshes = { 1: [], 2: [] };  // LSA-Klemmen für beide Dosen
let wireMeshes = { 1: [], 2: [] };
let cableMeshes = { 1: null, 2: null };
let raycaster, mouse;

// Level 1 spezifische 3D-Objekte
let kabelkanalMesh = null;
let kabelkanalSlots = [];           // Slot-Positionen im Kabelkanal
let cableSegmentMeshes = [];        // Platzierte Kabelsegmente
let floatingCableMesh = null;       // Kabel das der Nutzer gerade hält
let kabelkanalDeckel = null;        // Deckel zum Schließen

// Level 3 spezifische 3D-Objekte
let rackMesh = null;                // 19" Rack
let patchpanelMesh = null;          // Patchpanel
let switch1Mesh = null;             // Switch Büro 1 (oberer Switch)
let switch2Mesh = null;             // Switch Büro 2 (unterer Switch)
let patchPortMeshes = [];           // Patchpanel RJ45-Ports (24 Stück)
let switch1PortMeshes = [];         // Switch 1 RJ45-Ports (16 Stück)
let switch2PortMeshes = [];         // Switch 2 RJ45-Ports (16 Stück)
let patchCableMeshes = [];          // Verlegte Patchkabel
let wallCableMeshes = [];           // Kabel von der Wand zum Patchpanel (24 Stück)

// Level 4 spezifische 3D-Objekte
let level4PcPorts = [];             // PC Ethernet-Ports (Rückseite der Tower)
let level4SocketPorts = [];         // Doppeldose RJ45-Ports
let level4CablePickups = [];        // Patchkabel auf dem Tisch (zum Aufnehmen)
let level4RoutedCables = [];        // Fertig verlegte Kabel
let level4ScreenMeshes = { left: null, right: null };   // Monitor-Bildschirme
let level4ScreenCanvases = { left: null, right: null };  // Canvas für Bildschirm-Texturen

// ============================================
// Mobile / Touch Hilfsfunktionen
// ============================================

function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function setInstructionsText() {
    const el = document.getElementById('instructions-text');
    if (!el) return;
    if (isTouchDevice()) {
        el.textContent = '👆 Tippen = Auswählen | 1 Finger ziehen = Drehen | 2 Finger = Zoomen';
    } else {
        el.textContent = '🖱️ Linke Maustaste + Ziehen = Drehen | Scrollrad = Zoomen | Rechte Maustaste = Verschieben';
    }
}

function autoAnimateCamera() {
    if (!controls || !camera) return;

    // Final (working) position — where the level scene set the camera
    const endPos = camera.position.clone();
    const endTarget = controls.target.clone();

    // Start position: electrician approaching from further back at eye level (~1.7 units)
    // Walk-in along Z axis (forward), slight offset for natural path
    const startPos = new THREE.Vector3(
        endPos.x + 0.5,       // slight lateral offset (natural gait)
        Math.max(endPos.y, 1.7), // eye level, at least 1.7
        endPos.z + 12          // 12 units further back
    );
    // Look straight ahead initially, then settle on the work target
    const startTarget = new THREE.Vector3(
        endTarget.x,
        endTarget.y + 1,       // looking slightly higher at first (scanning the room)
        endTarget.z
    );

    // Set camera to starting position
    camera.position.copy(startPos);
    controls.target.copy(startTarget);

    const duration = 2500;
    const startTime = Date.now();

    // Ease-out cubic: fast start, gentle settle (feels like decelerating walk)
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function animateWalkIn() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const e = easeOutCubic(t);

        // Interpolate position: walk forward
        camera.position.lerpVectors(startPos, endPos, e);

        // Add subtle vertical bob for walking feel (2 steps over duration)
        if (t < 0.85) {
            const bobAmount = 0.04 * (1 - t); // diminish as we arrive
            camera.position.y += Math.sin(t * Math.PI * 4) * bobAmount;
        }

        // Interpolate look target: gaze shifts from scanning to work area
        controls.target.lerpVectors(startTarget, endTarget, e);

        controls.update();

        if (t < 1) {
            requestAnimationFrame(animateWalkIn);
        }
    }
    animateWalkIn();
}

function showLandscapeHint() {
    const hint = document.getElementById('landscape-hint');
    if (!hint) return;
    if (currentLevel === 3 && isMobile() && window.matchMedia('(orientation: portrait)').matches) {
        hint.classList.add('visible');
        setTimeout(() => { hint.classList.remove('visible'); }, 4000);
    }
}

// ============================================
// Hilfsfunktionen
// ============================================

function disposeObject(obj) {
    if (!obj) return;
    obj.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => {
                    if (m.map) m.map.dispose();
                    m.dispose();
                });
            } else {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        }
    });
}

function clearScene() {
    while (scene.children.length > 0) {
        const obj = scene.children[0];
        scene.remove(obj);
        disposeObject(obj);
    }
}

// ============================================
// Initialisierung
// ============================================

function init() {
    initThreeJS();
    initUI();
    initEventListeners();
    setInstructionsText();
    // Zeige Level-Auswahl statt direkt Scene zu erstellen
    showLevelSelect();
    animate();
}

function showLevelSelect() {
    document.getElementById('start-modal').classList.add('hidden');
    document.getElementById('level-select-modal').classList.remove('hidden');
}

function selectLevel(level) {
    currentLevel = level;
    document.getElementById('level-select-modal').classList.add('hidden');

    // Stop any running timer from previous level
    stopTimer();

    // Clear existing scene (recursive dispose of all objects)
    clearScene();

    // Reset state
    resetGameState();
    resetHelpModal();
    
    // Create scene based on level
    if (currentLevel === 1) {
        createLevel1Scene();
        updateLevel1UI();
    } else if (currentLevel === 2) {
        createScene();
        updateCableCoresUI();
    } else if (currentLevel === 3) {
        createLevel3Scene();
        updateLevel3UI();
    } else if (currentLevel === 4) {
        createLevel4Scene();
        updateLevel4UI();
    }

    // Update header
    document.querySelector('#header h1').textContent =
        `${LEVELS[currentLevel].icon} ${LEVELS[currentLevel].name}`;

    // Adjust camera for screen size
    onWindowResize();

    // Show landscape hint for Level 3 on mobile portrait
    showLandscapeHint();

    // Show start modal
    updateStartModal();
    document.getElementById('start-modal').classList.remove('hidden');
}

function resetGameState() {
    gameState.isStarted = false;
    gameState.startTime = null;
    gameState.elapsedTime = 0;
    gameState.selectedCore = null;
    gameState.cables = {
        1: { assignments: {}, used: new Set() },
        2: { assignments: {}, used: new Set() }
    };
    gameState.helpUsed = 0;
    gameState.undoHistory = [];
    gameState.level1 = {
        cableSegments: [],
        totalSegments: 6,
        placedSegments: 0,
        selectedSegment: null,
        cableInHand: false
    };
    gameState.level3 = {
        selectedPatchPort: null,
        selectedSwitchPort: null,
        connections: [],
        requiredConnections: 24,
        timeRemaining: LEVELS[3].timeLimit,
        timerActive: false
    };
    gameState.level4 = {
        selectedCable: null,
        cablePhase: 'pickUp',
        connections: {
            left:  { pcConnected: false, socketConnected: false },
            right: { pcConnected: false, socketConnected: false }
        },
        bothConnected: false,
        pingStarted: false,
        pingComplete: false
    };

    // Reset 3D objects
    lsaClipMeshes = { 1: [], 2: [] };
    wireMeshes = { 1: [], 2: [] };
    cableMeshes = { 1: null, 2: null };
    kabelkanalSlots = [];
    cableSegmentMeshes = [];
    floatingCableMesh = null;
    
    // Level 3 3D objects
    patchPortMeshes = [];
    switch1PortMeshes = [];
    switch2PortMeshes = [];
    patchCableMeshes = [];
    wallCableMeshes = [];

    // Level 4 3D objects
    level4PcPorts = [];
    level4SocketPorts = [];
    level4CablePickups = [];
    level4RoutedCables = [];
    level4ScreenMeshes = { left: null, right: null };
    level4ScreenCanvases = { left: null, right: null };
}

function updateStartModal() {
    const modal = document.getElementById('start-modal');
    const header = modal.querySelector('.modal-header h2');
    const body = modal.querySelector('.start-info');
    const touch = isTouchDevice();
    const tapOrClick = touch ? 'Tippe auf' : 'Klicke auf';
    const sidebarLabel = isMobile() ? 'im unteren Bereich' : 'in der Seitenleiste';

    if (currentLevel === 1) {
        header.textContent = '📏 Level 1: Kabelkanal';
        body.innerHTML = `
            <p>Willkommen zu Level 1!</p>
            <p>Deine Aufgabe ist es, das <strong>orangene Verlegekabel</strong> korrekt im <strong>weißen Kabelkanal</strong> zu verlegen.</p>
            <h3>So funktioniert's:</h3>
            <ol>
                <li>${tapOrClick} "Kabel aufnehmen" um das Kabel zu greifen</li>
                <li>${tapOrClick} die freien Positionen im Kabelkanal</li>
                <li>Verlege das Kabel von links nach rechts</li>
                <li>Schließe den Deckel wenn fertig</li>
            </ol>
            <p class="tip">💡 <strong>Tipp:</strong> Das Kabel muss ordentlich im Kanal liegen, nicht knicken!</p>
        `;
    } else if (currentLevel === 2) {
        header.textContent = '🔌 Level 2: Netzwerkdose';
        body.innerHTML = `
            <p>Willkommen zu Level 2!</p>
            <p>Deine Aufgabe ist es, ein <strong>Ethernet-Kabel</strong> (8 Adern) korrekt in die <strong>LSA-Klemmen</strong> der Dose A einzulegen.</p>
            <p class="info-note">ℹ️ Die Dose B ist bereits fertig verkabelt - nutze sie als Referenz!</p>
            <h3>So funktioniert's:</h3>
            <ol>
                <li>Wähle eine Kabelader ${sidebarLabel}</li>
                <li>${tapOrClick} die entsprechende LSA-Klemme in Dose A</li>
                <li>Belege alle 8 Klemmen korrekt</li>
                <li>Prüfe deine Belegung</li>
            </ol>
            <p class="tip">💡 <strong>Tipp:</strong> Die Farbmarkierungen über den LSA-Klemmen zeigen die korrekte Belegung nach T568A!</p>
        `;
    } else if (currentLevel === 3) {
        header.textContent = '🖥️ Level 3: Patchpanel & Switches';
        body.innerHTML = `
            <p>Willkommen zu Level 3!</p>
            <p>Im <strong>Serverraum</strong> sind 24 Verlegekabel am Patchpanel aufgelegt. Jetzt müssen alle Ports mit den Switches verbunden werden!</p>
            <p class="info-note">⏱️ <strong>Zeitlimit: 3 Minuten!</strong></p>
            <h3>Deine Aufgabe:</h3>
            <ol>
                <li>Verbinde <strong>Ports 1-12</strong> des Patchpanels mit <strong>Switch Büro 1</strong> (oben)</li>
                <li>Verbinde <strong>Ports 13-24</strong> des Patchpanels mit <strong>Switch Büro 2</strong> (unten)</li>
                <li>${tapOrClick} einen Patchpanel-Port, dann auf den passenden Switch-Port</li>
            </ol>
            <p class="tip">💡 <strong>Tipp:</strong> Das <span style="color: #FF8C00;">orangene Kabel</span> ist das Kabel aus Level 1 & 2 (DD1-1). Die anderen 23 Kabel sind <span style="color: #FFD700;">gelb</span>.</p>
        `;
    } else if (currentLevel === 4) {
        header.textContent = '🖧 Level 4: PC-Vernetzung';
        body.innerHTML = `
            <p>Willkommen zu Level 4!</p>
            <p>Zwei PCs stehen bereit, aber sind noch <strong>nicht mit dem Netzwerk verbunden</strong>. Die Doppeldose an der Wand führt über das Patchpanel zum Switch.</p>
            <h3>Deine Aufgabe:</h3>
            <ol>
                <li>${tapOrClick} ein <strong>Patchkabel</strong> auf dem Tisch</li>
                <li>${tapOrClick} den <strong>Ethernet-Port am PC</strong> (Rückseite)</li>
                <li>${tapOrClick} einen <strong>Port der Doppeldose</strong> an der Wand</li>
                <li>Verbinde <strong>beide PCs</strong> mit der Doppeldose</li>
                <li>Führe einen <strong>Ping-Test</strong> durch ${sidebarLabel}</li>
            </ol>
            <p class="tip">💡 <strong>Tipp:</strong> Sobald beide PCs verbunden sind, zeigen die Bildschirme eine aktive Netzwerkverbindung!</p>
        `;
    }
}

function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b);

    // Camera
    const container = document.getElementById('canvas-container');
    camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 2, 18);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('scene'),
        antialias: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Touch-action to prevent browser gesture interference
    renderer.domElement.style.touchAction = 'none';

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = isMobile() ? 3 : 5;
    controls.maxDistance = 30;
    controls.target.set(0, 0, 0);

    // Raycaster für Klick-Erkennung
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Resize Handler
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', () => {
        setTimeout(onWindowResize, 150);
    });
}

function initUI() {
    // Kabeladern erstellen (für aktives Kabel)
    updateCableCoresUI();
}

function updateCableCoresUI() {
    const cableCoresContainer = document.getElementById('cable-cores');
    cableCoresContainer.innerHTML = '';
    
    // Für Level 2: Kabeladern anzeigen
    if (currentLevel === 2) {
        const activeCable = gameState.activeCable;

        T568A_COLORS.forEach(core => {
            const coreEl = document.createElement('div');
            coreEl.className = 'cable-core';
            coreEl.dataset.coreId = core.id;

            const isStriped = core.color1 !== core.color2;
            const gradient = isStriped
                ? `linear-gradient(90deg, ${core.color1} 50%, ${core.color2} 50%)`
                : core.color1;

            coreEl.innerHTML = `
                <div class="color-indicator" style="background: ${gradient};"></div>
                <span class="core-name">${core.name}</span>
            `;
            
            // Prüfen ob diese Ader bereits verwendet wurde
            if (gameState.cables[activeCable].used.has(core.id)) {
                coreEl.classList.add('used');
            }

            coreEl.addEventListener('click', () => selectCore(core.id));
            cableCoresContainer.appendChild(coreEl);
        });

        // Panel-Titel für Level 2
        document.querySelector('#cable-panel h3').textContent = '📦 Kabeladern';
        
        // Socket-Status für Level 2
        const socketStatus = document.getElementById('socket-status');
        if (socketStatus) {
            socketStatus.innerHTML = `
                <div class="socket-status-item active-cable">
                    <span>📍 Kabel 1 → Dose A:</span>
                    <span id="socket1-progress">0/8</span>
                </div>
                <div class="socket-status-item completed-cable">
                    <span>✅ Kabel 2 → Dose B:</span>
                    <span id="socket2-progress">8/8 ✓</span>
                </div>
            `;
        }
    }
}

function initEventListeners() {
    // Level Select Buttons
    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const level = parseInt(btn.dataset.level);
            selectLevel(level);
        });
    });

    // Start Button
    document.getElementById('start-btn').addEventListener('click', startGame);

    // Back to Level Select
    document.getElementById('menu-btn').addEventListener('click', goToLevelSelect);

    // Help Modal
    document.getElementById('help-btn').addEventListener('click', () => {
        document.getElementById('help-modal').classList.remove('hidden');
    });
    document.getElementById('help-close').addEventListener('click', () => {
        document.getElementById('help-modal').classList.add('hidden');
    });

    // Help Level Buttons
    document.querySelectorAll('.btn-hint').forEach(btn => {
        btn.addEventListener('click', () => {
            const level = btn.dataset.level;
            const content = btn.previousElementSibling;
            content.classList.remove('hidden');
            btn.classList.add('revealed');
            btn.textContent = '✓ Angezeigt';
            btn.disabled = true;
            gameState.helpUsed = Math.max(gameState.helpUsed, parseInt(level));
        });
    });

    // Reset Button
    document.getElementById('reset-btn').addEventListener('click', resetGame);

    // Undo Button
    document.getElementById('undo-btn').addEventListener('click', undoLastAction);

    // Check Button
    document.getElementById('check-btn').addEventListener('click', checkSolution);

    // Result Modal
    document.getElementById('result-close').addEventListener('click', () => {
        document.getElementById('result-modal').classList.add('hidden');
    });
    document.getElementById('result-retry').addEventListener('click', () => {
        document.getElementById('result-modal').classList.add('hidden');
        resetGame();
    });

    // Canvas Click
    document.getElementById('scene').addEventListener('click', onCanvasClick);

    // Level 1 spezifische Buttons
    document.getElementById('pickup-cable-btn')?.addEventListener('click', pickupCable);
    document.getElementById('close-deckel-btn')?.addEventListener('click', closeDeckel);
}

// ============================================
// 3D Scene Erstellung
// ============================================

function createScene() {
    // Beleuchtung
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(0, -10, -10);
    scene.add(backLight);

    // Wand als Hintergrund
    createWallForLevel2();

    // Kabelkanal mit eingebetteter Dose und offenem Deckel
    createKabelkanalWithSocket();

    // Kamera für Level 2 - gute Sicht auf die Dose die auf dem Tisch liegt
    camera.position.set(0, 3, 10);
    controls.target.set(0, -2, 4);
}

function createWallForLevel2() {
    // Wand (hellgrau)
    const wallGeometry = new THREE.PlaneGeometry(30, 20);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8,
        roughness: 0.9,
        side: THREE.DoubleSide
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(0, 0, -2);
    wall.receiveShadow = true;
    scene.add(wall);
}

function createKabelkanalWithSocket() {
    // Kabelkanal mit eingebetteter Doppeldose (wie im Foto)
    const kanalGroup = new THREE.Group();
    
    const kanalLength = 20;
    const kanalHeight = 6.0;  // Höher für die Doppeldose
    const kanalDepth = 2.5;
    const wallThickness = 0.15;

    const kanalMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3
    });

    // Boden des Kabelkanals
    const bottomGeometry = new THREE.BoxGeometry(kanalLength, wallThickness, kanalDepth);
    const bottom = new THREE.Mesh(bottomGeometry, kanalMaterial);
    bottom.position.set(0, -kanalHeight/2, 0);
    kanalGroup.add(bottom);

    // Rückwand (an der Wand)
    const backGeometry = new THREE.BoxGeometry(kanalLength, kanalHeight, wallThickness);
    const back = new THREE.Mesh(backGeometry, kanalMaterial);
    back.position.set(0, 0, -kanalDepth/2 + wallThickness/2);
    kanalGroup.add(back);

    // Decke des Kabelkanals
    const topGeometry = new THREE.BoxGeometry(kanalLength, wallThickness, kanalDepth);
    const topMesh = new THREE.Mesh(topGeometry, kanalMaterial);
    topMesh.position.set(0, kanalHeight/2, 0);
    kanalGroup.add(topMesh);

    // Endkappen (links und rechts)
    const endCapMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 });
    
    const leftCapGeometry = new THREE.BoxGeometry(wallThickness, kanalHeight, kanalDepth);
    const leftCap = new THREE.Mesh(leftCapGeometry, endCapMaterial);
    leftCap.position.set(-kanalLength/2, 0, 0);
    kanalGroup.add(leftCap);

    const rightCap = new THREE.Mesh(leftCapGeometry.clone(), endCapMaterial);
    rightCap.position.set(kanalLength/2, 0, 0);
    kanalGroup.add(rightCap);

    // Kabeldurchführung links (Eingang)
    const holeGeometry = new THREE.CylinderGeometry(0.3, 0.3, wallThickness + 0.1, 16);
    const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const holeLeft = new THREE.Mesh(holeGeometry, holeMaterial);
    holeLeft.rotation.z = Math.PI / 2;
    holeLeft.position.set(-kanalLength/2, 0, 0);
    kanalGroup.add(holeLeft);

    // Vorderer Deckel (offen - nach vorne geklappt wie im Foto)
    const deckelGeometry = new THREE.BoxGeometry(kanalLength - 0.2, kanalHeight - 0.2, wallThickness);
    const deckelMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3
    });
    const deckel = new THREE.Mesh(deckelGeometry, deckelMaterial);
    // Liegt horizontal nach vorne geklappt
    deckel.position.set(0, -kanalHeight/2 - 0.5, kanalDepth/2 + (kanalHeight-0.2)/2);
    deckel.rotation.x = -Math.PI / 2;
    kanalGroup.add(deckel);

    // Kabel im Kanal (chaotisch wie im Foto - verschiedene Farben)
    createCablesInKanal(kanalGroup, kanalLength, kanalHeight, kanalDepth);

    kanalGroup.position.set(0, 0, 0);
    scene.add(kanalGroup);

    // Doppeldose eingebettet in den Kabelkanal (herausragend nach vorne)
    createEmbeddedSocket(kanalGroup);
}

function createCablesInKanal(parent, length, height, depth) {
    // Verschiedene Kabel im Kabelkanal (ohne Orange - die kommen von createEthernetCableAtSocket)
    const cableColors = [
        0x4169E1, // Blau
        0xFFD700, // Gelb
        0x2E8B57, // Grün
        0x8B4513, // Braun
    ];

    cableColors.forEach((color, index) => {
        const cableMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5 });
        
        // Jedes Kabel etwas anders positioniert
        const yOffset = (index - 1.5) * 0.5;
        const zOffset = (index % 2 - 0.5) * 0.4;
        
        // Gerade Kabel durch den Kanal
        const cableGeometry = new THREE.CylinderGeometry(0.12, 0.12, length - 4, 12);
        const cable = new THREE.Mesh(cableGeometry, cableMaterial);
        cable.rotation.z = Math.PI / 2;
        cable.position.set(0, yOffset, zOffset);
        parent.add(cable);
    });
}

function createEmbeddedSocket(kanalGroup) {
    // Doppeldose eingebettet im Kabelkanal
    // Vorderseite ragt durch den Deckel nach vorne
    // Rückseite (LSA-Klemmen) ist im Kanal sichtbar
    
    const socketGroup = new THREE.Group();

    // ========== RÜCKSEITE (LSA-Klemmen Seite) - zeigt in den Kanal ==========
    const backGroup = new THREE.Group();

    // Metallrahmen (Montagerahmen) - achteckig
    const frameShape = new THREE.Shape();
    const fw = 5.5, fh = 5.5, corner = 1.2;
    frameShape.moveTo(-fw + corner, -fh);
    frameShape.lineTo(fw - corner, -fh);
    frameShape.lineTo(fw, -fh + corner);
    frameShape.lineTo(fw, fh - corner);
    frameShape.lineTo(fw - corner, fh);
    frameShape.lineTo(-fw + corner, fh);
    frameShape.lineTo(-fw, fh - corner);
    frameShape.lineTo(-fw, -fh + corner);
    frameShape.closePath();

    const frameExtrudeSettings = { depth: 0.15, bevelEnabled: false };
    const frameGeometry = new THREE.ExtrudeGeometry(frameShape, frameExtrudeSettings);
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0xc0c0c0,
        roughness: 0.3,
        metalness: 0.8
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.z = -0.3;
    backGroup.add(frame);

    // Montagelöcher
    const holePositions = [
        [0, 5.2], [0, -5.2], [-5.2, 0], [5.2, 0]
    ];
    holePositions.forEach(([x, y]) => {
        const holeGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const hole = new THREE.Mesh(holeGeometry, holeMaterial);
        hole.rotation.x = Math.PI / 2;
        hole.position.set(x, y, -0.2);
        backGroup.add(hole);
    });

    // Weißer Kunststoff-Einsatz (Hauptkörper)
    const bodyGeometry = new THREE.BoxGeometry(9, 9, 2.5);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0xf8f8f8,
        roughness: 0.4,
        metalness: 0.05
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.z = -0.5;
    backGroup.add(body);

    // Innerer Bereich (leicht vertieft)
    const innerGeometry = new THREE.BoxGeometry(7.5, 6, 0.3);
    const innerMaterial = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.5
    });
    const inner = new THREE.Mesh(innerGeometry, innerMaterial);
    inner.position.z = 0.8;
    backGroup.add(inner);

    // Transparente Schutzkappe
    const coverGeometry = new THREE.BoxGeometry(7, 4.5, 0.08);
    const coverMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        roughness: 0.05
    });
    const cover = new THREE.Mesh(coverGeometry, coverMaterial);
    cover.position.set(0, 0.8, 1.1);
    backGroup.add(cover);

    socketGroup.add(backGroup);

    // LSA-Klemmen für Dose A (links) - zum Spielen
    createLSABlock(socketGroup, 1, -2.2, 0.5);
    
    // LSA-Klemmen für Dose B (rechts) - bereits fertig
    createLSABlockCompleted(socketGroup, 2, 2.2, 0.5);

    // A/B Labels
    createFloatingLabel(socketGroup, 'A', -2.2, 4.0, 1.5, '#4169E1');
    createFloatingLabel(socketGroup, 'B', 2.2, 4.0, 1.5, '#2E8B57');

    // RJ45 Port Labels (DD1-1, DD1-2) - sichtbar auf der LSA-Seite
    createPortLabel(socketGroup, 'DD1-1', -2.2, -4.0, 1.5);
    createPortLabel(socketGroup, 'DD1-2', 2.2, -4.0, 1.5);

    // T568A Beschriftung
    createStandardLabel(socketGroup, 'T568A', 0, -3.5, 1.5);

    // ========== VORDERSEITE (RJ45 Buchsen) - ragt durch Deckel ==========
    const frontGroup = new THREE.Group();
    
    // Frontplatte
    const frontPlateGeometry = new THREE.BoxGeometry(9, 9, 0.3);
    const frontPlateMaterial = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.4
    });
    const frontPlate = new THREE.Mesh(frontPlateGeometry, frontPlateMaterial);
    frontPlate.position.z = -2.5;
    frontGroup.add(frontPlate);

    // RJ45 Buchsen (Dose A und B)
    const portLabels = ['DD1-1', 'DD1-2'];
    [-2.2, 2.2].forEach((xPos, index) => {
        // RJ45 Öffnung
        const jackGeometry = new THREE.BoxGeometry(1.4, 1.2, 0.4);
        const jackMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const jack = new THREE.Mesh(jackGeometry, jackMaterial);
        jack.position.set(xPos, 0, -2.7);
        frontGroup.add(jack);

        // RJ45 Inneres (goldene Kontakte angedeutet)
        const innerJackGeometry = new THREE.BoxGeometry(1.2, 0.9, 0.3);
        const innerJackMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.3
        });
        const innerJack = new THREE.Mesh(innerJackGeometry, innerJackMaterial);
        innerJack.position.set(xPos, 0, -2.55);
        frontGroup.add(innerJack);

        // Port-Label (DD1-1, DD1-2)
        const labelCanvas = document.createElement('canvas');
        const ctx = labelCanvas.getContext('2d');
        labelCanvas.width = 128;
        labelCanvas.height = 64;
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(portLabels[index], 64, 32);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMat = new THREE.SpriteMaterial({ map: labelTexture });
        const label = new THREE.Sprite(labelMat);
        label.position.set(xPos, -1.2, -2.6);
        label.scale.set(1.5, 0.75, 1);
        frontGroup.add(label);
    });

    socketGroup.add(frontGroup);

    // Dose positionieren:
    // - Dose liegt auf dem Tisch (Z nach vorne, vor dem Kabelkanal)
    // - Rückseite (LSA-Klemmen) zeigt zum Benutzer für die Verkabelung
    // - Nach erfolgreicher Prüfung wird die Dose in den Kabelkanal gesetzt
    socketGroup.position.set(0, -2.5, 4);
    socketGroup.scale.set(0.5, 0.5, 0.5);
    // Dose liegt flach auf dem Tisch (LSA-Klemmen zeigen nach oben)
    socketGroup.rotation.x = -Math.PI / 2;
    
    scene.add(socketGroup);
    socketMesh = socketGroup;

    // Kabel 1 (zum Spielen) - kommt von links, hinter der Dose
    createEthernetCableAtSocket(1, -5, 0, 3.2);

    // Kabel 2 (fertig) - kommt auch von links (leicht versetzt in Y)
    createCompletedCableAtSocket(2, -5, -0.4, 3.2);
}

function createEthernetCableAtSocket(cableNum, x, y, z) {
    const cableGroup = new THREE.Group();
    cableGroup.position.set(x, y, z);

    const cableMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF8C00,
        roughness: 0.5
    });

    // Kabelmantel - durchgehend von links
    const cableLength = 4;
    const cableGeometry = new THREE.CylinderGeometry(0.15, 0.15, cableLength, 16);
    const cable = new THREE.Mesh(cableGeometry, cableMaterial);
    cable.rotation.z = Math.PI / 2; // Horizontal entlang X-Achse
    cable.position.set(-cableLength / 2, 0, 0); // Kabel endet bei x=0
    cableGroup.add(cable);

    // Kabelende (konisch, wo die Adern rauskommen) - direkt anschließend
    const taperLength = 0.3;
    const cableEndGeometry = new THREE.CylinderGeometry(0.15, 0.06, taperLength, 16);
    const cableEnd = new THREE.Mesh(cableEndGeometry, cableMaterial);
    cableEnd.rotation.z = Math.PI / 2;
    cableEnd.position.set(taperLength / 2, 0, 0); // Beginnt bei x=0, endet bei x=0.3
    cableGroup.add(cableEnd);

    // Kabel-Label
    const labelCanvas = document.createElement('canvas');
    const ctx = labelCanvas.getContext('2d');
    labelCanvas.width = 128;
    labelCanvas.height = 64;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Kabel ${cableNum}`, 64, 32);

    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTexture });
    const label = new THREE.Sprite(labelMat);
    label.position.set(-2, 0.6, 0);
    label.scale.set(1.2, 0.6, 1);
    cableGroup.add(label);

    // Abisolierte Kabeladern - kurze Stücke die aus dem Kabel ragen
    const wireStartX = 0.3; // Beginnen wo das konische Ende aufhört
    T568A_COLORS.forEach((core, index) => {
        const wireGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
        const wireMaterial = createWireMaterial(core);

        const wire = new THREE.Mesh(wireGeometry, wireMaterial);

        // Adern fächern sich auf (Y und Z Richtung)
        const spreadY = ((index % 4) - 1.5) * 0.1;
        const spreadZ = index < 4 ? 0.1 : -0.1;

        wire.rotation.z = Math.PI / 2; // Horizontal
        wire.position.set(wireStartX + 0.25, spreadY, spreadZ);

        wire.userData = { coreId: core.id, cableNum: cableNum };
        cableGroup.add(wire);
    });

    cableGroup.userData.cableEndWorldPos = new THREE.Vector3(x, y, z);
    cableMeshes[cableNum] = cableGroup;
    scene.add(cableGroup);
}

function createCompletedCableAtSocket(cableNum, x, y, z) {
    const cableGroup = new THREE.Group();
    cableGroup.position.set(x, y, z);

    const cableMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF8C00,
        roughness: 0.5
    });

    // Kabelmantel - durchgehend von links
    const cableLength = 4;
    const cableGeometry = new THREE.CylinderGeometry(0.15, 0.15, cableLength, 16);
    const cable = new THREE.Mesh(cableGeometry, cableMaterial);
    cable.rotation.z = Math.PI / 2;
    cable.position.set(-cableLength / 2, 0, 0);
    cableGroup.add(cable);

    // Kabelende (konisch) - direkt anschließend
    const taperLength = 0.3;
    const cableEndGeometry = new THREE.CylinderGeometry(0.15, 0.06, taperLength, 16);
    const cableEnd = new THREE.Mesh(cableEndGeometry, cableMaterial);
    cableEnd.rotation.z = Math.PI / 2;
    cableEnd.position.set(taperLength / 2, 0, 0);
    cableGroup.add(cableEnd);

    // Label
    const labelCanvas = document.createElement('canvas');
    const ctx = labelCanvas.getContext('2d');
    labelCanvas.width = 128;
    labelCanvas.height = 64;
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Kabel 2 ✓', 64, 32);

    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTexture });
    const label = new THREE.Sprite(labelMat);
    label.position.set(-2, 0.6, 0);
    label.scale.set(1.2, 0.6, 1);
    cableGroup.add(label);

    cableMeshes[cableNum] = cableGroup;
    scene.add(cableGroup);

    // Fertige Drähte zur Dose B
    // Dose ist bei (0, -2.5, 4) mit rotation.x = -PI/2 (liegt flach auf Tisch)
    // Bei rotation.x = -PI/2: lokal Y -> Welt -Z, lokal Z -> Welt +Y
    const completedWires = [
        { coreId: 'wo', row: 'top', index: 0 },
        { coreId: 'o', row: 'top', index: 1 },
        { coreId: 'bl', row: 'top', index: 2 },
        { coreId: 'wbl', row: 'top', index: 3 },
        { coreId: 'wg', row: 'bottom', index: 0 },
        { coreId: 'g', row: 'bottom', index: 1 },
        { coreId: 'wbr', row: 'bottom', index: 2 },
        { coreId: 'br', row: 'bottom', index: 3 },
    ];

    const scale = 0.5;
    const socketBaseX = 0;
    const socketBaseY = -2.5;
    const socketBaseZ = 4;

    // LSA Block B: centerX=2.2, centerY=0.5 (in lokalen Koordinaten)
    const centerX = 2.2;
    const centerY = 0.5;

    completedWires.forEach((wireInfo, idx) => {
        const core = T568A_COLORS.find(c => c.id === wireInfo.coreId);

        // Lokale Clip-Position (vor Skalierung und Rotation)
        const localX = centerX - 0.75 + wireInfo.index * 0.5;
        const localY = wireInfo.row === 'top' ? (centerY + 0.8) : (centerY - 0.2);
        const localZ = 1.05;

        // Transformation: erst scale, dann rotation.x = -PI/2
        // rotation.x = -PI/2 bedeutet: (x, y, z) -> (x, z, -y)
        // Welt = socketBase + (localX * scale, localZ * scale, -localY * scale)
        const clipX = socketBaseX + localX * scale;
        const clipY = socketBaseY + localZ * scale;
        const clipZ = socketBaseZ - localY * scale;

        // Startposition - Adern kommen aus dem Kabelende
        const wireStartX = 0.55;
        const spreadY = ((idx % 4) - 1.5) * 0.08;
        const spreadZ = idx < 4 ? 0.08 : -0.08;
        const startPos = new THREE.Vector3(x + wireStartX, y + spreadY, z + spreadZ);

        const endPos = new THREE.Vector3(clipX, clipY, clipZ);

        // Kurve: von hinten nach oben schwingen, dann von oben auf die Klemme
        const highPointY = Math.max(startPos.y, endPos.y) + 1.0;
        const midZ = (startPos.z + endPos.z) / 2;
        const curve = new THREE.CatmullRomCurve3([
            startPos,
            new THREE.Vector3(startPos.x + 2, startPos.y + 0.5, startPos.z + 0.3),
            new THREE.Vector3((startPos.x + endPos.x) / 2 + 0.5, highPointY, midZ),
            new THREE.Vector3(endPos.x, endPos.y + 0.4, endPos.z),
            endPos
        ]);

        const tubeGeometry = new THREE.TubeGeometry(curve, 48, 0.025, 8, false);
        const wireMaterial = createWireMaterial(core);
        const wire = new THREE.Mesh(tubeGeometry, wireMaterial);
        scene.add(wire);
        wireMeshes[2].push(wire);
    });
}

// Bereits fertig verkabelte LSA-Klemmen für Dose B
function createLSABlockCompleted(parent, socketNum, centerX, centerY) {
    // LSA-Klemmenblock
    const blockGeometry = new THREE.BoxGeometry(2.4, 2.4, 0.3);
    const blockMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8,
        roughness: 0.5
    });
    const block = new THREE.Mesh(blockGeometry, blockMaterial);
    block.position.set(centerX, centerY + 0.3, 0.85);
    parent.add(block);

    // Farbmarkierungen
    createColorStrip(parent, centerX, centerY + 1.3, socketNum);

    // Bereits eingelegte Adern mit korrekten Farben
    const topRowColors = [
        { c1: '#FFFFFF', c2: '#FF8C00' }, // Weiß-Orange
        { c1: '#FF8C00', c2: '#FF8C00' }, // Orange
        { c1: '#4169E1', c2: '#4169E1' }, // Blau
        { c1: '#FFFFFF', c2: '#4169E1' }, // Weiß-Blau
    ];
    
    const bottomRowColors = [
        { c1: '#FFFFFF', c2: '#2E8B57' }, // Weiß-Grün
        { c1: '#2E8B57', c2: '#2E8B57' }, // Grün
        { c1: '#FFFFFF', c2: '#8B4513' }, // Weiß-Braun
        { c1: '#8B4513', c2: '#8B4513' }, // Braun
    ];

    // Obere Reihe - fertig belegt
    topRowColors.forEach((color, index) => {
        createCompletedClip(parent, centerX - 0.75 + index * 0.5, centerY + 0.8, 1.05, color);
    });

    // Untere Reihe - fertig belegt
    bottomRowColors.forEach((color, index) => {
        createCompletedClip(parent, centerX - 0.75 + index * 0.5, centerY - 0.2, 1.05, color);
    });
}

function createCompletedClip(parent, x, y, z, color) {
    const clipGeometry = new THREE.BoxGeometry(0.35, 0.5, 0.3);
    const isStriped = color.c1 !== color.c2;
    
    const clipMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color.c2),
        roughness: 0.4,
        metalness: 0.3,
        emissive: isStriped ? new THREE.Color(color.c1) : new THREE.Color(color.c2),
        emissiveIntensity: isStriped ? 0.3 : 0.2
    });
    
    const clip = new THREE.Mesh(clipGeometry, clipMaterial);
    clip.position.set(x, y, z);
    clip.castShadow = true;
    parent.add(clip);
}

function createFloatingLabel(parent, text, x, y, z, bgColor) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;

    // Kreis mit Farbe
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fill();

    // Weißer Rand
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 68);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        depthTest: false,  // Immer sichtbar
        depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(1.2, 1.2, 1);
    sprite.renderOrder = 999;  // Über allem anderen rendern
    parent.add(sprite);
}

function createFrontLabel(parent, text, x, y, z) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;

    ctx.fillStyle = '#333333';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(0.5, 0.5, 1);
    parent.add(sprite);
}

function createRJ45JackFront(parent, x, y) {
    // Äußerer Rahmen der RJ45-Buchse (hellgrau für Kontrast)
    const frameGeometry = new THREE.BoxGeometry(2.2, 1.8, 0.15);
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.6
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.set(x, y, -0.95);
    parent.add(frame);

    // Schwarze RJ45-Buchse (Hauptkörper)
    const jackOuterGeometry = new THREE.BoxGeometry(1.9, 1.5, 0.3);
    const jackMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.7
    });
    const jackOuter = new THREE.Mesh(jackOuterGeometry, jackMaterial);
    jackOuter.position.set(x, y, -1.05);
    parent.add(jackOuter);

    // Trapezförmige Buchsenöffnung (typische RJ45 Form)
    // Oberer Teil breiter
    const jackOpeningGeometry = new THREE.BoxGeometry(1.5, 1.1, 0.4);
    const jackOpeningMaterial = new THREE.MeshStandardMaterial({
        color: 0x050505,
        roughness: 0.95
    });
    const jackOpening = new THREE.Mesh(jackOpeningGeometry, jackOpeningMaterial);
    jackOpening.position.set(x, y - 0.05, -1.15);
    parent.add(jackOpening);

    // Plastik-Clip-Führung oben (typisch für RJ45)
    const clipGuideGeometry = new THREE.BoxGeometry(0.8, 0.15, 0.3);
    const clipGuideMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.8
    });
    const clipGuide = new THREE.Mesh(clipGuideGeometry, clipGuideMaterial);
    clipGuide.position.set(x, y + 0.35, -1.1);
    parent.add(clipGuide);

    // 8 goldene Kontakte im Inneren (deutlich sichtbar)
    for (let i = 0; i < 8; i++) {
        const contactGeometry = new THREE.BoxGeometry(0.12, 0.5, 0.08);
        const contactMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.9,
            roughness: 0.2,
            emissive: 0x332200,
            emissiveIntensity: 0.3
        });
        const contact = new THREE.Mesh(contactGeometry, contactMaterial);
        contact.position.set(x - 0.56 + i * 0.16, y + 0.1, -1.0);
        parent.add(contact);
    }

    // Beschriftung "RJ45" unter der Buchse
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 128;
    labelCanvas.height = 32;
    const labelCtx = labelCanvas.getContext('2d');
    labelCtx.fillStyle = '#666666';
    labelCtx.font = 'bold 20px Arial';
    labelCtx.textAlign = 'center';
    labelCtx.fillText('RJ45', 64, 22);
    
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMaterial = new THREE.SpriteMaterial({ 
        map: labelTexture,
        transparent: true
    });
    const labelSprite = new THREE.Sprite(labelMaterial);
    labelSprite.position.set(x, y - 1.1, -1.0);
    labelSprite.scale.set(1.2, 0.3, 1);
    parent.add(labelSprite);
}

function createStandardLabel(parent, text, x, y, z) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 32;

    ctx.fillStyle = '#333333';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 16);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(1.5, 0.4, 1);
    parent.add(sprite);
}

function createPortLabel(parent, text, x, y, z) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 48;

    // Hintergrund (abgerundetes Rechteck)
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(4, 4, 120, 40, 8);
    ctx.fill();

    // Weißer Rand
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 24);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        depthTest: false,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(1.5, 0.6, 1);
    sprite.renderOrder = 999;
    parent.add(sprite);
}

function createLSABlock(parent, socketNum, centerX, centerY) {
    // LSA-Klemmenblock (wie im Bild - zwei Reihen mit je 4 Klemmen)
    const blockGeometry = new THREE.BoxGeometry(2.4, 2.4, 0.3);
    const blockMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8,
        roughness: 0.5
    });
    const block = new THREE.Mesh(blockGeometry, blockMaterial);
    block.position.set(centerX, centerY + 0.3, 0.85);
    parent.add(block);

    // Farbmarkierungen über den Klemmen (wie im Bild)
    createColorStrip(parent, centerX, centerY + 1.3, socketNum);

    // LSA-Klemmen erstellen - 2 Reihen mit je 4 Klemmen
    const clips = [];
    
    // Obere Reihe (Paar 2: Orange, Paar 1: Blau)
    LSA_LAYOUT.topRow.forEach((coreId, index) => {
        const clip = createLSAClip(parent, centerX - 0.75 + index * 0.5, centerY + 0.8, 1.05, coreId, socketNum, 'top', index);
        clips.push(clip);
    });

    // Untere Reihe (Paar 3: Grün, Paar 4: Braun)  
    LSA_LAYOUT.bottomRow.forEach((coreId, index) => {
        const clip = createLSAClip(parent, centerX - 0.75 + index * 0.5, centerY - 0.2, 1.05, coreId, socketNum, 'bottom', index);
        clips.push(clip);
    });

    lsaClipMeshes[socketNum] = clips;
}

function createColorStrip(parent, centerX, y, socketNum) {
    // Farbstreifen über den Klemmen (zeigt korrektes Schema)
    // Als 3D-Objekte statt Sprites für bessere Sichtbarkeit
    const colors = [
        { c1: '#FFFFFF', c2: '#FF8C00' }, // Weiß-Orange
        { c1: '#FF8C00', c2: '#FF8C00' }, // Orange
        { c1: '#4169E1', c2: '#4169E1' }, // Blau
        { c1: '#FFFFFF', c2: '#4169E1' }, // Weiß-Blau
    ];

    const colors2 = [
        { c1: '#FFFFFF', c2: '#2E8B57' }, // Weiß-Grün
        { c1: '#2E8B57', c2: '#2E8B57' }, // Grün
        { c1: '#FFFFFF', c2: '#8B4513' }, // Weiß-Braun
        { c1: '#8B4513', c2: '#8B4513' }, // Braun
    ];

    // Obere Farbreihe
    colors.forEach((color, index) => {
        create3DColorIndicator(parent, centerX - 0.75 + index * 0.5, y, 1.0, color.c1, color.c2);
    });

    // Untere Farbreihe
    colors2.forEach((color, index) => {
        create3DColorIndicator(parent, centerX - 0.75 + index * 0.5, y - 1.0, 1.0, color.c1, color.c2);
    });
}

function create3DColorIndicator(parent, x, y, z, color1, color2) {
    // 3D-Box statt Sprite für bessere Sichtbarkeit aus allen Winkeln
    const indicatorGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.15);
    
    let indicatorMaterial;
    if (color1 !== color2) {
        // Gestreift - Canvas-Textur
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, 16, 32);
        ctx.fillStyle = color2;
        ctx.fillRect(16, 0, 16, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        indicatorMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.5
        });
    } else {
        indicatorMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color1),
            roughness: 0.5
        });
    }

    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    indicator.position.set(x, y, z);
    parent.add(indicator);
}

function createLSAClip(parent, x, y, z, expectedCoreId, socketNum, row, index) {
    // LSA-Klemme (Schneidklemme)
    const clipGeometry = new THREE.BoxGeometry(0.35, 0.5, 0.3);
    const clipMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.4,
        metalness: 0.6
    });
    const clip = new THREE.Mesh(clipGeometry, clipMaterial);
    clip.position.set(x, y, z);
    clip.userData = {
        socketNum: socketNum,
        expectedCoreId: expectedCoreId,
        row: row,
        index: index,
        isLSAClip: true,
        assigned: null
    };
    clip.castShadow = true;
    parent.add(clip);

    return clip;
}

function createWireMaterial(core) {
    if (core.color1 !== core.color2) {
        // Gestreifte Ader
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = core.color1;
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = core.color2;
        for (let i = 0; i < 8; i += 2) {
            ctx.fillRect(0, i * 8, 64, 8);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 4);

        return new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.5
        });
    } else {
        return new THREE.MeshStandardMaterial({
            color: new THREE.Color(core.color1),
            roughness: 0.5
        });
    }
}

// ============================================
// Interaktion
// ============================================

function selectCore(coreId) {
    const activeCable = gameState.activeCable;
    
    if (gameState.cables[activeCable].used.has(coreId)) {
        return;
    }

    // Vorherige Auswahl zurücksetzen
    document.querySelectorAll('.cable-core').forEach(el => {
        el.classList.remove('selected');
    });

    if (gameState.selectedCore === coreId) {
        gameState.selectedCore = null;
    } else {
        gameState.selectedCore = coreId;
        const coreEl = document.querySelector(`[data-core-id="${coreId}"]`);
        if (coreEl) {
            coreEl.classList.add('selected');
        }
    }
}

function onCanvasClick(event) {
    if (!gameState.isStarted) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (currentLevel === 1) {
        handleLevel1Click();
    } else if (currentLevel === 2) {
        handleLevel2Click();
    } else if (currentLevel === 3) {
        handleLevel3Click();
    } else if (currentLevel === 4) {
        handleLevel4Click();
    }
}

function handleLevel1Click() {
    if (!gameState.level1.cableInHand) return;

    const intersects = raycaster.intersectObjects(kabelkanalSlots);

    if (intersects.length > 0) {
        const clickedSlot = intersects[0].object;
        
        if (clickedSlot.userData.filled) {
            showFeedback('Diese Position ist bereits belegt!', 'warning');
            return;
        }

        // Prüfen ob Reihenfolge stimmt (von links nach rechts)
        const slotIndex = clickedSlot.userData.index;
        if (slotIndex !== gameState.level1.placedSegments) {
            showFeedback('Verlege das Kabel der Reihe nach von links nach rechts!', 'warning');
            return;
        }

        placeCableSegment(clickedSlot);
    }
}

function handleLevel2Click() {
    if (!gameState.selectedCore) return;

    // Prüfen welche Dose zum aktiven Kabel gehört
    const targetSocket = gameState.activeCable;
    const clips = lsaClipMeshes[targetSocket];
    
    if (!clips || clips.length === 0) return;

    const intersects = raycaster.intersectObjects(clips);

    if (intersects.length > 0) {
        const clickedClip = intersects[0].object;
        
        // Prüfen ob Clip bereits belegt
        if (clickedClip.userData.assigned) {
            showFeedback('Diese Klemme ist bereits belegt!', 'warning');
            return;
        }

        // Ader zuweisen
        assignCoreToClip(gameState.selectedCore, clickedClip);
    }
}

function assignCoreToClip(coreId, clip) {
    const cableNum = gameState.activeCable;
    const core = T568A_COLORS.find(c => c.id === coreId);
    const clipData = clip.userData;

    // Zuweisung speichern
    const clipKey = `${clipData.row}-${clipData.index}`;
    gameState.cables[cableNum].assignments[clipKey] = {
        coreId: coreId,
        expectedCoreId: clipData.expectedCoreId
    };
    gameState.cables[cableNum].used.add(coreId);
    clip.userData.assigned = coreId;

    // Clip färben
    const isStriped = core.color1 !== core.color2;
    if (isStriped) {
        clip.material.color = new THREE.Color(core.color2);
        clip.material.emissive = new THREE.Color(core.color1);
        clip.material.emissiveIntensity = 0.3;
    } else {
        clip.material.color = new THREE.Color(core.color1);
        clip.material.emissive = new THREE.Color(core.color1);
        clip.material.emissiveIntensity = 0.2;
    }

    // Draht zum Clip erstellen
    createWireToClip(cableNum, coreId, clip);

    // Aktion im Undo-Verlauf speichern
    gameState.undoHistory.push({
        cableNum: cableNum,
        coreId: coreId,
        clipKey: clipKey,
        clip: clip
    });
    updateUndoButton();

    // UI aktualisieren
    updateCableCoresUI();
    updateProgress();

    // Auswahl zurücksetzen
    gameState.selectedCore = null;
    document.querySelectorAll('.cable-core').forEach(el => {
        el.classList.remove('selected');
    });

    showFeedback(`${core.name} eingelegt`, 'success');
}

function createWireToClip(cableNum, coreId, clip) {
    const core = T568A_COLORS.find(c => c.id === coreId);
    const cableGroup = cableMeshes[cableNum];

    // Weltposition des Clips
    const clipWorldPos = new THREE.Vector3();
    clip.getWorldPosition(clipWorldPos);

    // Startposition (vom Kabelende - wo die Adern rauskommen)
    // Kabel kommt von links und zeigt nach rechts
    const cablePos = cableGroup.position.clone();
    const coreIndex = T568A_COLORS.findIndex(c => c.id === coreId);

    // Berechne die Aderposition am Kabelende (passend zu createEthernetCableAtSocket)
    const wireStartX = 0.55;
    const spreadY = ((coreIndex % 4) - 1.5) * 0.1;
    const spreadZ = coreIndex < 4 ? 0.1 : -0.1;
    const startPos = new THREE.Vector3(
        cablePos.x + wireStartX,
        cablePos.y + spreadY,
        cablePos.z + spreadZ
    );

    // Kurve: von hinten nach oben schwingen, dann von oben auf die Klemme
    const highPointY = Math.max(startPos.y, clipWorldPos.y) + 1.0;
    const midZ = (startPos.z + clipWorldPos.z) / 2;
    const curve = new THREE.CatmullRomCurve3([
        startPos,
        new THREE.Vector3(startPos.x + 2, startPos.y + 0.5, startPos.z + 0.3),
        new THREE.Vector3((startPos.x + clipWorldPos.x) / 2 + 0.5, highPointY, midZ),
        new THREE.Vector3(clipWorldPos.x, clipWorldPos.y + 0.4, clipWorldPos.z),
        clipWorldPos
    ]);

    const tubeGeometry = new THREE.TubeGeometry(curve, 48, 0.03, 8, false);
    const wireMaterial = createWireMaterial(core);

    const wire = new THREE.Mesh(tubeGeometry, wireMaterial);
    wire.castShadow = true;
    scene.add(wire);

    wireMeshes[cableNum].push(wire);
}

function undoLastAction() {
    if (currentLevel === 3) {
        undoLevel3Action();
        return;
    }
    if (currentLevel === 4) {
        undoLevel4Action();
        return;
    }
    
    if (gameState.undoHistory.length === 0) {
        showFeedback('Nichts zum Rückgängig machen', 'warning');
        return;
    }

    const lastAction = gameState.undoHistory.pop();
    const { cableNum, coreId, clipKey, clip } = lastAction;

    // Zuweisung entfernen
    delete gameState.cables[cableNum].assignments[clipKey];
    gameState.cables[cableNum].used.delete(coreId);
    clip.userData.assigned = null;

    // Clip zurücksetzen (grau)
    clip.material.color = new THREE.Color(0x888888);
    clip.material.emissive = new THREE.Color(0x000000);
    clip.material.emissiveIntensity = 0;

    // Letzten Draht entfernen
    if (wireMeshes[cableNum].length > 0) {
        const wire = wireMeshes[cableNum].pop();
        scene.remove(wire);
        wire.geometry.dispose();
        wire.material.dispose();
    }

    // UI aktualisieren
    updateCableCoresUI();
    updateProgress();
    updateUndoButton();

    const core = T568A_COLORS.find(c => c.id === coreId);
    showFeedback(`${core.name} entfernt`, 'info');
}

function updateUndoButton() {
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.disabled = gameState.undoHistory.length === 0;
    }
}

// ============================================
// UI Updates
// ============================================

function updateProgress() {
    // Nur für Level 2
    if (currentLevel !== 2) return;
    
    const cable1Count = gameState.cables[1].used.size;

    const socket1El = document.getElementById('socket1-progress');
    const socket2El = document.getElementById('socket2-progress');
    
    if (socket1El) socket1El.textContent = `${cable1Count}/8`;
    if (socket2El) socket2El.textContent = `8/8 ✓`;

    // Check-Button aktivieren wenn Kabel 1 vollständig verlegt
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.disabled = !(cable1Count === 8);

        if (cable1Count === 8) {
            checkBtn.classList.add('pulse');
        }
    }
}

function showFeedback(message, type) {
    // Einfaches visuelles Feedback
    const overlay = document.getElementById('instructions-overlay');
    const textEl = document.getElementById('instructions-text');

    if (textEl) {
        textEl.textContent = message;
    } else {
        overlay.textContent = message;
    }
    const bgColors = {
        success: 'rgba(34, 197, 94, 0.8)',
        warning: 'rgba(245, 158, 11, 0.8)',
        info: 'rgba(37, 99, 235, 0.8)',
        error: 'rgba(239, 68, 68, 0.8)'
    };
    overlay.style.background = bgColors[type] || bgColors.info;

    setTimeout(() => {
        setInstructionsText();
        overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    }, 2000);
}

// ============================================
// Spiellogik
// ============================================

function startGame() {
    document.getElementById('start-modal').classList.add('hidden');
    gameState.isStarted = true;
    gameState.startTime = Date.now();

    // Timer starten
    gameState.timerInterval = setInterval(updateTimer, 1000);

    // Level 3: Countdown-Timer starten
    if (currentLevel === 3) {
        startLevel3Timer();
    }

    // Subtle camera swing to hint that scene is interactive 3D
    autoAnimateCamera();
}

function updateTimer() {
    if (!gameState.isStarted) return;

    gameState.elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(gameState.elapsedTime / 60).toString().padStart(2, '0');
    const seconds = (gameState.elapsedTime % 60).toString().padStart(2, '0');

    document.getElementById('timer-display').textContent = `${minutes}:${seconds}`;
    
    // Level 3: Countdown aktualisieren
    if (currentLevel === 3) {
        updateLevel3Timer();
    }
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function checkSolution() {
    if (currentLevel === 3) {
        checkLevel3Solution();
        return;
    }
    if (currentLevel === 4) {
        checkLevel4Solution();
        return;
    }
    
    stopTimer();

    let correctCount = 0;
    let totalPins = 8;  // Nur Kabel 1 / Dose A
    const errors = [];

    // Nur Kabel 1 prüfen
    const assignments = gameState.cables[1].assignments;

    // Prüfe jede Zuweisung
    Object.entries(assignments).forEach(([clipKey, data]) => {
        if (data.coreId === data.expectedCoreId) {
            correctCount++;
        } else {
            const core = T568A_COLORS.find(c => c.id === data.coreId);
            const expectedCore = T568A_COLORS.find(c => c.id === data.expectedCoreId);
            errors.push({
                cable: 1,
                placed: core ? core.name : data.coreId,
                expected: expectedCore ? expectedCore.name : data.expectedCoreId,
                position: clipKey
            });
        }
    });

    // Score berechnen
    const accuracy = correctCount / totalPins;
    const timeBonus = calculateTimeBonus();
    const helpPenalty = gameState.helpUsed * 5;
    const finalScore = Math.max(0, Math.round(accuracy * 100 * timeBonus - helpPenalty));

    showResult(correctCount, totalPins, errors, finalScore);
}

function calculateTimeBonus() {
    // Beste Zeit: unter 60 Sekunden = 1.0
    // Über 5 Minuten = 0.5 Minimum
    const time = gameState.elapsedTime;
    if (time <= 60) return 1.0;
    if (time <= 120) return 0.95;
    if (time <= 180) return 0.9;
    if (time <= 240) return 0.8;
    if (time <= 300) return 0.7;
    return 0.5;
}

function calculateLevel3TimeBonus(timeUsed) {
    // 3-Minuten-Limit: schneller = besser
    // Unter 60s = 1.0, unter 90s = 0.95, unter 120s = 0.9, unter 150s = 0.8, darüber = 0.7
    if (timeUsed <= 60) return 1.0;
    if (timeUsed <= 90) return 0.95;
    if (timeUsed <= 120) return 0.9;
    if (timeUsed <= 150) return 0.8;
    return 0.7;
}

function showResult(correct, total, errors, score) {
    const modal = document.getElementById('result-modal');
    const iconEl = document.getElementById('result-icon');
    const scoreEl = document.getElementById('result-score');
    const timeEl = document.getElementById('result-time');
    const detailsEl = document.getElementById('result-details');
    const errorsEl = document.getElementById('result-errors');

    // Icon und Farbe basierend auf Score
    let icon, scoreClass, message;
    if (score >= 95) {
        icon = '🏆';
        scoreClass = 'score-perfect';
        message = 'Ausgezeichnet! Perfekte Arbeit!';
    } else if (score >= 80) {
        icon = '🎉';
        scoreClass = 'score-good';
        message = 'Sehr gut! Fast perfekt!';
    } else if (score >= 60) {
        icon = '👍';
        scoreClass = 'score-medium';
        message = 'Gut gemacht! Etwas Übung noch nötig.';
    } else {
        icon = '📚';
        scoreClass = 'score-poor';
        message = 'Weiter üben! Schau dir die Hilfen an.';
    }

    iconEl.textContent = icon;
    scoreEl.innerHTML = `<span class="${scoreClass}">${score} Punkte</span>`;

    const minutes = Math.floor(gameState.elapsedTime / 60);
    const seconds = gameState.elapsedTime % 60;
    timeEl.textContent = `Zeit: ${minutes}:${seconds.toString().padStart(2, '0')} | Richtig: ${correct}/${total}`;

    // Level 2 Score speichern (nur bei Erfolg)
    if (errors.length === 0) {
        gameState.levelScores[2] = {
            score: score,
            time: gameState.elapsedTime,
            completed: true
        };
    }

    detailsEl.innerHTML = `
        <p>${message}</p>
        ${gameState.helpUsed > 0 ? `<p style="color: var(--warning-color);">Hilfe Stufe ${gameState.helpUsed} verwendet (-${gameState.helpUsed * 5} Punkte)</p>` : ''}
    `;

    // Retry-Button konfigurieren
    const retryBtn = document.getElementById('result-retry');

    if (errors.length > 0) {
        errorsEl.classList.remove('hidden');
        errorsEl.innerHTML = `
            <h4>❌ Fehler:</h4>
            <ul>
                ${errors.map(e => `
                    <li>Kabel ${e.cable}: ${e.placed} eingelegt, aber ${e.expected} erwartet</li>
                `).join('')}
            </ul>
        `;
        // Bei Fehlern: Neustart-Button
        retryBtn.textContent = '🔄 Nochmal versuchen';
        retryBtn.onclick = () => {
            modal.classList.add('hidden');
            resetGame();
        };
    } else {
        errorsEl.classList.add('hidden');
        // Bei korrekter Lösung: Dose drehen (RJ45 zum Deckel)
        rotateSocketToFront();

        // Button zu Level 3 ändern
        detailsEl.innerHTML += `
            <p style="color: var(--primary-color); font-weight: bold;">
                ➡️ Weiter zu Level 3: RJ45-Stecker!
            </p>
        `;
        retryBtn.textContent = '➡️ Level 3 starten';
        retryBtn.onclick = () => {
            modal.classList.add('hidden');
            selectLevel(3);
        };
    }

    modal.classList.remove('hidden');
}

function rotateSocketToFront() {
    // Animierte Bewegung der Dose vom Tisch in den Kabelkanal
    // Endposition: vertikal im Kanal, RJ45-Buchsen zeigen zur Kamera
    if (!socketMesh) return;

    const duration = 2000; // 2 Sekunden
    const startTime = Date.now();

    // Startposition Dose (auf dem Tisch, flach liegend)
    const startPos = socketMesh.position.clone();
    const startRotX = socketMesh.rotation.x;
    const startRotY = socketMesh.rotation.y;

    // Zielposition Dose (im Kabelkanal, vertikal, RJ45 zur Kamera)
    const targetPos = new THREE.Vector3(0, 0, 0.5);
    const targetRotX = 0; // Aufrecht
    const targetRotY = Math.PI; // RJ45-Seite (Vorderseite) zur Kamera

    // Kabel-Startpositionen speichern
    const cable1Start = cableMeshes[1] ? cableMeshes[1].position.clone() : null;
    const cable2Start = cableMeshes[2] ? cableMeshes[2].position.clone() : null;

    // Kabel-Zielpositionen (im Kabelkanal, horizontal - nah an der Dose)
    const cable1Target = new THREE.Vector3(-2, 0.2, 0.5);
    const cable2Target = new THREE.Vector3(-2, -0.2, 0.5);

    // Drähte ausblenden (sie sind jetzt "hinter" der Dose im Kanal)
    wireMeshes[1].forEach(wire => {
        wire.visible = false;
    });
    wireMeshes[2].forEach(wire => {
        wire.visible = false;
    });

    function animateInstallation() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing (ease-in-out)
        const eased = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Dose Position und Rotation interpolieren
        socketMesh.position.lerpVectors(startPos, targetPos, eased);
        socketMesh.rotation.x = startRotX + (targetRotX - startRotX) * eased;
        socketMesh.rotation.y = startRotY + (targetRotY - startRotY) * eased;

        // Kabel mitbewegen
        if (cableMeshes[1] && cable1Start) {
            cableMeshes[1].position.lerpVectors(cable1Start, cable1Target, eased);
        }
        if (cableMeshes[2] && cable2Start) {
            cableMeshes[2].position.lerpVectors(cable2Start, cable2Target, eased);
        }

        if (progress < 1) {
            requestAnimationFrame(animateInstallation);
        }
    }

    animateInstallation();
    showFeedback('Dose wird eingebaut - RJ45-Buchsen zeigen jetzt nach vorne!', 'success');
}

function resetGame() {
    // Timer stoppen
    stopTimer();

    // Gemeinsamer Spielzustand zurücksetzen
    gameState.isStarted = false;
    gameState.startTime = null;
    gameState.elapsedTime = 0;
    gameState.selectedCore = null;
    gameState.activeCable = 1;
    gameState.cables = {
        1: { assignments: {}, used: new Set() },
        2: { assignments: {}, used: new Set() }
    };
    gameState.undoHistory = [];
    updateUndoButton();

    // Timer Display zurücksetzen
    document.getElementById('timer-display').textContent = '00:00';

    // Level-spezifischer Reset
    if (currentLevel === 1) {
        resetLevel1();
    } else if (currentLevel === 2) {
        resetLevel2();
    } else if (currentLevel === 3) {
        resetLevel3();
    } else if (currentLevel === 4) {
        resetLevel4();
    }

    // Hilfe-Modal zurücksetzen
    resetHelpModal();

    // Check Button deaktivieren
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.disabled = true;
        checkBtn.classList.remove('pulse');
    }

    // Modals schließen
    document.getElementById('result-modal').classList.add('hidden');

    // Start Modal anzeigen
    updateStartModal();
    document.getElementById('start-modal').classList.remove('hidden');
}

function resetLevel1() {
    // Kabel-Segmente aus der Szene entfernen
    cableSegmentMeshes.forEach(seg => {
        scene.remove(seg);
        disposeObject(seg);
    });
    cableSegmentMeshes = [];

    // Slots zurücksetzen
    kabelkanalSlots.forEach(slot => {
        slot.userData.filled = false;
        slot.material.color.setHex(0x90EE90);
        slot.material.opacity = 0.3;
    });

    // Deckel verstecken
    if (kabelkanalDeckel) {
        kabelkanalDeckel.visible = false;
        kabelkanalDeckel.rotation.x = -Math.PI / 2;
        kabelkanalDeckel.position.y = -1.5 / 2 - 0.5;
        kabelkanalDeckel.position.z = 1.2 / 2 + 1.5 / 2;
    }

    // Level 1 State zurücksetzen
    gameState.level1.placedSegments = 0;
    gameState.level1.cableInHand = false;
    gameState.level1.selectedSegment = null;
    gameState.level1.cableSegments = [];

    // UI zurücksetzen
    updateLevel1UI();
    updateLevel1Progress();
}

function resetLevel2() {
    // Dose zurück auf den Tisch (flach liegend, LSA-Klemmen nach oben)
    if (socketMesh) {
        socketMesh.position.set(0, -2.5, 4);
        socketMesh.rotation.x = -Math.PI / 2;
        socketMesh.rotation.y = 0;
    }

    // Kabel zurück auf Startposition
    if (cableMeshes[1]) {
        cableMeshes[1].position.set(-5, 0, 3.2);
    }
    if (cableMeshes[2]) {
        cableMeshes[2].position.set(-5, -0.4, 3.2);
    }

    // LSA-Clips zurücksetzen (nur für Kabel 1, Kabel 2 ist bereits fertig)
    lsaClipMeshes[1].forEach(clip => {
        clip.material.color = new THREE.Color(0x888888);
        clip.material.emissive = new THREE.Color(0x000000);
        clip.material.emissiveIntensity = 0;
        clip.userData.assigned = null;
    });

    // Drähte von Kabel 1 entfernen
    wireMeshes[1].forEach(wire => {
        scene.remove(wire);
        disposeObject(wire);
    });
    wireMeshes[1] = [];

    // Drähte von Kabel 2 wieder sichtbar machen (wurden beim Einbau versteckt)
    wireMeshes[2].forEach(wire => {
        wire.visible = true;
    });

    // UI zurücksetzen
    document.querySelectorAll('.socket-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.socket === '1');
    });

    updateCableCoresUI();
    updateProgress();
}

function resetLevel3() {
    // Level 3 Timer stoppen
    gameState.level3.timerActive = false;

    // Patchkabel aus der Szene entfernen
    patchCableMeshes.forEach(cable => {
        scene.remove(cable);
        disposeObject(cable);
    });
    patchCableMeshes = [];

    // Port-Zustände zurücksetzen
    patchPortMeshes.forEach(port => {
        port.userData.isConnected = false;
        port.material.color = new THREE.Color(0x1a1a1a);
        port.material.emissive = new THREE.Color(0x000000);
    });
    switch1PortMeshes.forEach(port => {
        port.userData.isConnected = false;
        port.material.color = new THREE.Color(0x1a1a1a);
    });
    switch2PortMeshes.forEach(port => {
        port.userData.isConnected = false;
        port.material.color = new THREE.Color(0x1a1a1a);
    });

    // Level 3 State zurücksetzen
    gameState.level3.selectedPatchPort = null;
    gameState.level3.selectedSwitchPort = null;
    gameState.level3.connections = [];
    gameState.level3.timeRemaining = LEVELS[3].timeLimit;
    gameState.level3.timerActive = false;

    // UI zurücksetzen
    updateLevel3UI();
}

function resetHelpModal() {
    gameState.helpUsed = 0;
    document.querySelectorAll('.btn-hint').forEach(btn => {
        const content = btn.previousElementSibling;
        if (content) content.classList.add('hidden');
        btn.classList.remove('revealed');
        btn.textContent = 'Hilfe anzeigen';
        btn.disabled = false;
    });
}

function goToLevelSelect() {
    stopTimer();
    gameState.isStarted = false;
    gameState.level3.timerActive = false;

    // Modals schließen
    document.getElementById('start-modal').classList.add('hidden');
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('help-modal').classList.add('hidden');

    // Level-Auswahl anzeigen
    document.getElementById('level-select-modal').classList.remove('hidden');
}

// ============================================
// Animation Loop
// ============================================

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    // Wider FOV on mobile for better framing in portrait
    camera.fov = isMobile() ? 55 : 45;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// ============================================
// LEVEL 1: Kabelkanal
// ============================================

function createLevel1Scene() {
    // Beleuchtung
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    // Wand als Hintergrund
    createWall();

    // Kabelkanal erstellen
    createKabelkanal();

    // Kabelrolle/Vorrat an der Seite
    createCableRoll();

    // Kamera für Level 1 anpassen (Seitenansicht)
    camera.position.set(0, 2, 20);
    controls.target.set(0, 0, 0);
}

function createWall() {
    // Wand (hellgrau)
    const wallGeometry = new THREE.PlaneGeometry(30, 20);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8,
        roughness: 0.9,
        side: THREE.DoubleSide
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(0, 0, -2);
    wall.receiveShadow = true;
    scene.add(wall);

    // Strukturlinie für Realismus
    const lineGeometry = new THREE.BoxGeometry(30, 0.02, 0.05);
    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    for (let y = -8; y <= 8; y += 4) {
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(0, y, -1.9);
        scene.add(line);
    }
}

function createKabelkanal() {
    const kanalGroup = new THREE.Group();
    
    const kanalLength = 18;
    const kanalHeight = 1.5;
    const kanalDepth = 1.2;
    const wallThickness = 0.15;

    // Hauptkörper des Kabelkanals (weiß)
    const kanalMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3
    });

    // Boden (geschlossen)
    const bottomGeometry = new THREE.BoxGeometry(kanalLength, wallThickness, kanalDepth);
    const bottom = new THREE.Mesh(bottomGeometry, kanalMaterial);
    bottom.position.set(0, -kanalHeight/2, 0);
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    kanalGroup.add(bottom);

    // Rückwand (an der Wand befestigt - geschlossen)
    const backGeometry = new THREE.BoxGeometry(kanalLength, kanalHeight, wallThickness);
    const back = new THREE.Mesh(backGeometry, kanalMaterial);
    back.position.set(0, 0, -kanalDepth/2 + wallThickness/2);
    back.castShadow = true;
    kanalGroup.add(back);

    // Decke/Oberseite (geschlossen)
    const topGeometry = new THREE.BoxGeometry(kanalLength, wallThickness, kanalDepth);
    const top = new THREE.Mesh(topGeometry, kanalMaterial);
    top.position.set(0, kanalHeight/2, 0);
    top.castShadow = true;
    kanalGroup.add(top);

    // Endkappen (links und rechts) - mit Löchern für Kabel
    const endCapMaterial = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.4
    });
    
    // Linke Endkappe (mit Kabeldurchführung)
    const leftCapGeometry = new THREE.BoxGeometry(wallThickness, kanalHeight + wallThickness, kanalDepth);
    const leftCap = new THREE.Mesh(leftCapGeometry, endCapMaterial);
    leftCap.position.set(-kanalLength/2, 0, 0);
    leftCap.castShadow = true;
    kanalGroup.add(leftCap);

    // Kabeldurchführung links (Loch)
    const holeGeometry = new THREE.CylinderGeometry(0.3, 0.3, wallThickness + 0.1, 16);
    const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const hole = new THREE.Mesh(holeGeometry, holeMaterial);
    hole.rotation.z = Math.PI / 2;
    hole.position.set(-kanalLength/2, 0, 0);
    kanalGroup.add(hole);

    // Rechte Endkappe (mit Kabeldurchführung für Ausgang zur Dose)
    const rightCap = new THREE.Mesh(leftCapGeometry.clone(), endCapMaterial);
    rightCap.position.set(kanalLength/2, 0, 0);
    rightCap.castShadow = true;
    kanalGroup.add(rightCap);

    // Kabeldurchführung rechts
    const holeRight = new THREE.Mesh(holeGeometry.clone(), holeMaterial);
    holeRight.rotation.z = Math.PI / 2;
    holeRight.position.set(kanalLength/2, 0, 0);
    kanalGroup.add(holeRight);

    // Vorderer Deckel (zum Schließen von der Seite/vorne)
    // Startet geöffnet (nach vorne geklappt)
    const deckelGeometry = new THREE.BoxGeometry(kanalLength - 0.1, kanalHeight - 0.1, wallThickness);
    const deckelMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3
    });
    kabelkanalDeckel = new THREE.Mesh(deckelGeometry, deckelMaterial);
    // Startet offen - nach vorne gekippt
    kabelkanalDeckel.position.set(0, -kanalHeight/2 - 0.5, kanalDepth/2 + kanalHeight/2);
    kabelkanalDeckel.rotation.x = -Math.PI / 2;  // Liegt horizontal nach vorne
    kabelkanalDeckel.visible = false;
    kabelkanalDeckel.castShadow = true;
    kanalGroup.add(kabelkanalDeckel);

    // Kleine Lippe unten vorne (Scharnier-Andeutung)
    const hingeGeometry = new THREE.BoxGeometry(kanalLength - 0.1, wallThickness * 0.5, wallThickness * 0.5);
    const hingeMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const hinge = new THREE.Mesh(hingeGeometry, hingeMaterial);
    hinge.position.set(0, -kanalHeight/2 + wallThickness * 0.25, kanalDepth/2 - wallThickness * 0.25);
    kanalGroup.add(hinge);

    // Beschriftung
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 64;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Kabelkanal 40x40mm', 256, 40);
    
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture });
    const label = new THREE.Sprite(labelMaterial);
    label.position.set(0, kanalHeight + 0.5, 0);
    label.scale.set(6, 0.8, 1);
    kanalGroup.add(label);

    // Slot-Markierungen im Kanal (sichtbar durch offene Vorderseite)
    const slotCount = gameState.level1.totalSegments;
    const slotWidth = (kanalLength - 2) / slotCount;
    
    for (let i = 0; i < slotCount; i++) {
        const slotX = -kanalLength/2 + 1 + slotWidth/2 + i * slotWidth;
        
        const slotGeometry = new THREE.BoxGeometry(slotWidth - 0.2, kanalHeight - 0.4, kanalDepth - 0.3);
        const slotMaterial = new THREE.MeshStandardMaterial({
            color: 0x90EE90,
            transparent: true,
            opacity: 0.3
        });
        const slot = new THREE.Mesh(slotGeometry, slotMaterial);
        slot.position.set(slotX, 0, 0.1);
        slot.userData = { isSlot: true, index: i, filled: false };
        kanalGroup.add(slot);
        kabelkanalSlots.push(slot);

        // Positionsnummer
        const numCanvas = document.createElement('canvas');
        numCanvas.width = 64;
        numCanvas.height = 64;
        const numCtx = numCanvas.getContext('2d');
        numCtx.fillStyle = '#aaaaaa';
        numCtx.font = 'bold 40px Arial';
        numCtx.textAlign = 'center';
        numCtx.textBaseline = 'middle';
        numCtx.fillText((i + 1).toString(), 32, 32);
        
        const numTexture = new THREE.CanvasTexture(numCanvas);
        const numMaterial = new THREE.SpriteMaterial({ map: numTexture, transparent: true, opacity: 0.5 });
        const numSprite = new THREE.Sprite(numMaterial);
        numSprite.position.set(slotX, 0, kanalDepth/2 + 0.3);
        numSprite.scale.set(0.6, 0.6, 1);
        kanalGroup.add(numSprite);
    }

    kanalGroup.position.set(0, 0, 0);
    scene.add(kanalGroup);
    kabelkanalMesh = kanalGroup;
}

function createCableRoll() {
    const rollGroup = new THREE.Group();
    rollGroup.position.set(-12, -4, 3);

    // Kabelrolle/Trommel
    const drumGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.6, 32);
    const drumMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        roughness: 0.7
    });
    const drum = new THREE.Mesh(drumGeometry, drumMaterial);
    drum.rotation.x = Math.PI / 2;
    rollGroup.add(drum);

    // Aufgerolltes Kabel (orange)
    const cableRollGeometry = new THREE.TorusGeometry(1.2, 0.25, 16, 64);
    const cableMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF8C00,
        roughness: 0.5
    });
    const cableRoll = new THREE.Mesh(cableRollGeometry, cableMaterial);
    cableRoll.rotation.y = Math.PI / 2;
    rollGroup.add(cableRoll);

    // Beschriftung
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = '#FF8C00';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Cat.7 Verlegekabel', 128, 40);
    
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture });
    const label = new THREE.Sprite(labelMaterial);
    label.position.set(0, -2.5, 0);
    label.scale.set(3, 0.8, 1);
    rollGroup.add(label);

    scene.add(rollGroup);

    // Kabel von der Rolle zum linken Rand des Kabelkanals
    // Kurve von Rolle hoch zur Wand und dann zum Kabelkanal-Eingang
    const cableToKanal = createCablePathToKanal();
    scene.add(cableToKanal);
}

function createCablePathToKanal() {
    const cableGroup = new THREE.Group();
    const cableMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF8C00,
        roughness: 0.5
    });

    // Kurve von Kabelrolle zum Kabelkanal-Eingang (links)
    const points = [
        new THREE.Vector3(-12, -3.5, 3.5),   // Start bei Kabelrolle
        new THREE.Vector3(-12, -1, 2),        // Hoch
        new THREE.Vector3(-11, 1, 0),         // Zur Wand
        new THREE.Vector3(-9.5, 0, 0)         // Eingang Kabelkanal (links)
    ];

    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 48, 0.2, 12, false);
    const tube = new THREE.Mesh(tubeGeometry, cableMaterial);
    tube.castShadow = true;
    cableGroup.add(tube);

    return cableGroup;
}

function pickupCable() {
    if (!gameState.isStarted) return;
    
    gameState.level1.cableInHand = true;
    showFeedback('Kabel aufgenommen! Klicke auf Position 1 im Kabelkanal.', 'success');
    
    // Button-Status aktualisieren
    const pickupBtn = document.getElementById('pickup-cable-btn');
    if (pickupBtn) {
        pickupBtn.textContent = '📦 Kabel in der Hand';
        pickupBtn.disabled = true;
        pickupBtn.classList.add('active');
    }

    // Slots hervorheben
    kabelkanalSlots.forEach(slot => {
        if (!slot.userData.filled) {
            slot.material.opacity = 0.5;
        }
    });
}

function placeCableSegment(slot) {
    const slotPos = new THREE.Vector3();
    slot.getWorldPosition(slotPos);
    
    const cableMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF8C00,
        roughness: 0.5
    });

    const slotIndex = slot.userData.index;
    const kanalLength = 18;
    const slotCount = gameState.level1.totalSegments;
    const slotWidth = (kanalLength - 2) / slotCount;

    // Berechne Start- und Endpunkt für dieses Segment
    const segmentStartX = -kanalLength/2 + 1 + slotIndex * slotWidth;
    const segmentEndX = segmentStartX + slotWidth;

    // Wenn erstes Segment, verbinde mit Kabelkanal-Eingang
    if (slotIndex === 0) {
        // Kurzes Stück vom Eingang zum ersten Slot
        const entryPoints = [
            new THREE.Vector3(-9.5, 0, 0),  // Eingang
            new THREE.Vector3(segmentStartX, 0, 0.3)  // Start erstes Segment
        ];
        const entryCurve = new THREE.CatmullRomCurve3(entryPoints);
        const entryGeometry = new THREE.TubeGeometry(entryCurve, 8, 0.2, 12, false);
        const entryTube = new THREE.Mesh(entryGeometry, cableMaterial);
        entryTube.castShadow = true;
        scene.add(entryTube);
        cableSegmentMeshes.push(entryTube);
    }

    // Hauptsegment als durchgehendes Rohr
    const segmentPoints = [
        new THREE.Vector3(segmentStartX, 0, 0.3),
        new THREE.Vector3(segmentEndX, 0, 0.3)
    ];
    const segmentCurve = new THREE.CatmullRomCurve3(segmentPoints);
    const segmentGeometry = new THREE.TubeGeometry(segmentCurve, 8, 0.2, 12, false);
    const segment = new THREE.Mesh(segmentGeometry, cableMaterial);
    segment.castShadow = true;
    scene.add(segment);
    cableSegmentMeshes.push(segment);

    // Wenn letztes Segment, zeige Kabelende das rausschaut
    if (slotIndex === slotCount - 1) {
        const endPoints = [
            new THREE.Vector3(segmentEndX, 0, 0.3),
            new THREE.Vector3(segmentEndX + 0.5, 0, 0.5)  // Leicht rausragend
        ];
        const endCurve = new THREE.CatmullRomCurve3(endPoints);
        const endGeometry = new THREE.TubeGeometry(endCurve, 8, 0.2, 12, false);
        const endTube = new THREE.Mesh(endGeometry, cableMaterial);
        endTube.castShadow = true;
        scene.add(endTube);
        cableSegmentMeshes.push(endTube);
    }

    // Slot als gefüllt markieren
    slot.userData.filled = true;
    slot.material.color.setHex(0x32CD32);
    slot.material.opacity = 0.1;

    // Fortschritt aktualisieren
    gameState.level1.placedSegments++;
    updateLevel1Progress();

    showFeedback(`Segment ${gameState.level1.placedSegments} von ${gameState.level1.totalSegments} verlegt!`, 'success');

    // Prüfen ob alle Segmente verlegt
    if (gameState.level1.placedSegments >= gameState.level1.totalSegments) {
        gameState.level1.cableInHand = false;
        
        // Deckel-Button aktivieren
        const closeBtn = document.getElementById('close-deckel-btn');
        if (closeBtn) {
            closeBtn.disabled = false;
            closeBtn.classList.add('pulse');
        }
        
        // Deckel sichtbar machen
        if (kabelkanalDeckel) {
            kabelkanalDeckel.visible = true;
        }
        
        showFeedback('Alle Segmente verlegt! Schließe nun den Deckel.', 'success');
    }
}

function closeDeckel() {
    if (!kabelkanalDeckel) return;

    const kanalDepth = 1.2;
    const kanalHeight = 1.5;
    
    // Animation: Deckel klappt von vorne hoch (wie eine Tür die sich schließt)
    // Start: horizontal liegend vor dem Kanal
    // Ende: vertikal an der Vorderseite des Kanals
    
    const startRotation = -Math.PI / 2;  // Horizontal
    const endRotation = 0;               // Vertikal
    
    const startY = -kanalHeight/2 - 0.5;
    const endY = 0;
    
    const startZ = kanalDepth/2 + kanalHeight/2;
    const endZ = kanalDepth/2 - 0.075;  // An der Vorderseite
    
    const duration = 800;
    const startTime = Date.now();

    function animateDeckel() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);  // Ease out

        kabelkanalDeckel.rotation.x = startRotation + (endRotation - startRotation) * eased;
        kabelkanalDeckel.position.y = startY + (endY - startY) * eased;
        kabelkanalDeckel.position.z = startZ + (endZ - startZ) * eased;

        if (progress < 1) {
            requestAnimationFrame(animateDeckel);
        } else {
            // Level abgeschlossen
            checkLevel1Solution();
        }
    }
    animateDeckel();
}

function checkLevel1Solution() {
    stopTimer();

    // Bei Level 1 ist es einfach - wenn alle Segmente platziert wurden, ist es korrekt
    const correct = gameState.level1.placedSegments === gameState.level1.totalSegments;
    const score = correct ? 100 - (gameState.helpUsed * 5) : 0;

    // Zeitbonus
    const timeBonus = calculateTimeBonus();
    const finalScore = Math.round(score * timeBonus);

    showLevel1Result(finalScore);
}

function showLevel1Result(score) {
    const modal = document.getElementById('result-modal');
    const iconEl = document.getElementById('result-icon');
    const scoreEl = document.getElementById('result-score');
    const timeEl = document.getElementById('result-time');
    const detailsEl = document.getElementById('result-details');
    const errorsEl = document.getElementById('result-errors');

    // Level 1 Score speichern
    gameState.levelScores[1] = {
        score: score,
        time: gameState.elapsedTime,
        completed: true
    };

    iconEl.textContent = '🏆';
    scoreEl.innerHTML = `<span class="score-perfect">${score} Punkte</span>`;

    const minutes = Math.floor(gameState.elapsedTime / 60);
    const seconds = gameState.elapsedTime % 60;
    timeEl.textContent = `Zeit: ${minutes}:${seconds.toString().padStart(2, '0')}`;

    detailsEl.innerHTML = `
        <p>Ausgezeichnet! Das Kabel wurde korrekt im Kabelkanal verlegt.</p>
        <p style="color: var(--primary-color); font-weight: bold;">
            ➡️ Weiter zu Level 2: Netzwerkdose!
        </p>
    `;
    
    errorsEl.classList.add('hidden');

    // Retry-Button Text ändern
    const retryBtn = document.getElementById('result-retry');
    retryBtn.textContent = '➡️ Level 2 starten';
    retryBtn.onclick = () => {
        modal.classList.add('hidden');
        selectLevel(2);
    };

    modal.classList.remove('hidden');
}

function updateLevel1UI() {
    const cableCoresContainer = document.getElementById('cable-cores');
    cableCoresContainer.innerHTML = '';

    // Level 1 UI (keine Adern, sondern Kabel-Aktionen)
    const actionDiv = document.createElement('div');
    actionDiv.className = 'level1-actions';
    actionDiv.innerHTML = `
        <p class="panel-description">Verlege das Kabel im Kabelkanal:</p>
        <button id="pickup-cable-btn" class="btn btn-primary" style="width: 100%; margin-bottom: 10px;">
            📦 Kabel aufnehmen
        </button>
        <button id="close-deckel-btn" class="btn btn-secondary" style="width: 100%;" disabled>
            🔒 Deckel schließen
        </button>
    `;
    cableCoresContainer.appendChild(actionDiv);

    // Event Listener hinzufügen
    document.getElementById('pickup-cable-btn').addEventListener('click', pickupCable);
    document.getElementById('close-deckel-btn').addEventListener('click', closeDeckel);

    // Panel-Titel anpassen
    document.querySelector('#cable-panel h3').textContent = '📦 Kabel';
    
    // Socket-Status für Level 1 anpassen
    const socketStatus = document.getElementById('socket-status');
    socketStatus.innerHTML = `
        <div class="socket-status-item active-cable">
            <span>📏 Kabelkanal:</span>
            <span id="level1-progress">0/${gameState.level1.totalSegments}</span>
        </div>
    `;
}

function updateLevel1Progress() {
    const progressEl = document.getElementById('level1-progress');
    if (progressEl) {
        progressEl.textContent = `${gameState.level1.placedSegments}/${gameState.level1.totalSegments}`;
    }
}

// ============================================
// LEVEL 3: Patchpanel & Switches
// ============================================

function createLevel3Scene() {
    // Beleuchtung
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(5, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 5, -5);
    scene.add(fillLight);

    // Serverraum Hintergrund
    createServerRoom();

    // 19" Rack erstellen (breiter für 24 Ports)
    create19InchRack();

    // 24 Kabel von der Wand zum Patchpanel
    createWallCables();

    // Kamera für Level 3 (Frontalansicht auf Rack)
    camera.position.set(0, 0, 14);
    controls.target.set(0, 0, 0);
}

function createServerRoom() {
    // Boden (dunkelgrau/Antistatik-Optik)
    const floorGeometry = new THREE.PlaneGeometry(40, 25);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -8;
    floor.receiveShadow = true;
    scene.add(floor);

    // Rückwand
    const wallGeometry = new THREE.PlaneGeometry(40, 25);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a3a4a,
        roughness: 0.7
    });
    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
    backWall.position.set(0, 0, -5);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Großer Kabelkanal an der Wand (für 24 Kabel)
    const kanalGeometry = new THREE.BoxGeometry(3, 1.5, 0.8);
    const kanalMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const kanalAuslass = new THREE.Mesh(kanalGeometry, kanalMaterial);
    kanalAuslass.position.set(-10.5, 4, -4.5);
    scene.add(kanalAuslass);

    // Label für Kabelkanal
    createLevel3Label(scene, 'Kabelkanal\n24 Verlegekabel', -10.5, 6, -4);
}

function create19InchRack() {
    const rackGroup = new THREE.Group();
    
    // 19" Rack Maße (breiter für 24 Ports in einer Reihe)
    const rackWidth = 10;     // Breiter für 24 Ports
    const rackHeight = 10;    // Höhe des Racks
    const rackDepth = 3;
    
    // Rack-Rahmen (schwarz)
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.5,
        metalness: 0.3
    });

    // Vertikale Pfosten
    const postGeometry = new THREE.BoxGeometry(0.3, rackHeight, 0.3);
    const positions = [
        [-rackWidth/2 + 0.15, 0, rackDepth/2 - 0.15],
        [rackWidth/2 - 0.15, 0, rackDepth/2 - 0.15],
        [-rackWidth/2 + 0.15, 0, -rackDepth/2 + 0.15],
        [rackWidth/2 - 0.15, 0, -rackDepth/2 + 0.15]
    ];
    positions.forEach(pos => {
        const post = new THREE.Mesh(postGeometry, frameMaterial);
        post.position.set(...pos);
        post.castShadow = true;
        rackGroup.add(post);
    });

    // Oberer und unterer Rahmen
    const topFrameGeometry = new THREE.BoxGeometry(rackWidth, 0.2, rackDepth);
    const topFrame = new THREE.Mesh(topFrameGeometry, frameMaterial);
    topFrame.position.y = rackHeight / 2;
    rackGroup.add(topFrame);

    const bottomFrame = new THREE.Mesh(topFrameGeometry.clone(), frameMaterial);
    bottomFrame.position.y = -rackHeight / 2;
    rackGroup.add(bottomFrame);

    // Rückwand des Racks (perforiert - angedeutet)
    const backPanelGeometry = new THREE.PlaneGeometry(rackWidth - 0.6, rackHeight - 0.4);
    const backPanelMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.9,
        side: THREE.DoubleSide
    });
    const backPanel = new THREE.Mesh(backPanelGeometry, backPanelMaterial);
    backPanel.position.z = -rackDepth/2 + 0.2;
    rackGroup.add(backPanel);

    scene.add(rackGroup);
    rackMesh = rackGroup;

    // Patchpanel im Rack (oben) - 24 Ports in einer Reihe
    createPatchpanel24(rackGroup, 0, 3, rackDepth/2 - 0.3);

    // Switch Büro 1 im Rack (Mitte) - 16 Ports, für Patchpanel Ports 1-12
    createSwitch16(rackGroup, 0, 1, rackDepth/2 - 0.3, 1, 'Switch Büro 1');

    // Switch Büro 2 im Rack (unten) - 16 Ports, für Patchpanel Ports 13-24
    createSwitch16(rackGroup, 0, -1, rackDepth/2 - 0.3, 2, 'Switch Büro 2');

    // Rack-Beschriftung
    createLevel3Label(rackGroup, '19" Rack - Serverraum', 0, rackHeight/2 + 0.8, rackDepth/2);
}

function createPatchpanel24(parent, x, y, z) {
    const panelGroup = new THREE.Group();
    panelGroup.position.set(x, y, z);

    // Patchpanel-Gehäuse (1 HE = 1.75") - breiter für 24 Ports
    const panelWidth = 9;
    const panelHeight = 0.8;
    const panelDepth = 0.4;

    const panelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);
    const panelMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.6,
        metalness: 0.2
    });
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panelGroup.add(panel);

    // Beschriftungsstreifen oben
    const labelStripGeometry = new THREE.BoxGeometry(panelWidth - 0.2, 0.12, 0.05);
    const labelStripMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const labelStrip = new THREE.Mesh(labelStripGeometry, labelStripMaterial);
    labelStrip.position.set(0, panelHeight/2 - 0.12, panelDepth/2 + 0.03);
    panelGroup.add(labelStrip);

    // 24 RJ45 Ports in einer Reihe
    const numPorts = 24;
    const portWidth = 0.3;
    const portHeight = 0.22;
    const startX = -panelWidth/2 + 0.45;
    const spacing = (panelWidth - 0.9) / (numPorts - 1);

    for (let i = 0; i < numPorts; i++) {
        const portNum = i + 1;
        const portX = startX + i * spacing;

        // Port-Gehäuse
        const portGeometry = new THREE.BoxGeometry(portWidth, portHeight, 0.12);
        const portMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.7
        });
        const port = new THREE.Mesh(portGeometry, portMaterial);
        port.position.set(portX, 0, panelDepth/2 + 0.07);
        port.userData = {
            type: 'patchPort',
            portNum: portNum,
            isConnected: false,
            targetSwitch: portNum <= 12 ? 1 : 2,  // Ports 1-12 → Switch 1, 13-24 → Switch 2
            label: `Port ${portNum}`
        };
        panelGroup.add(port);
        patchPortMeshes.push(port);

        // Port-Nummer Label für jeden Port
        createSmallPortLabel(panelGroup, `${portNum}`, portX, panelHeight/2 - 0.05, panelDepth/2 + 0.06);
    }

    // Bereichsmarkierungen
    createLevel3Label(panelGroup, '← Ports 1-12: Switch Büro 1', -2.5, -0.6, 0.3);
    createLevel3Label(panelGroup, 'Ports 13-24: Switch Büro 2 →', 2.5, -0.6, 0.3);

    // Patchpanel Label
    createLevel3Label(panelGroup, 'PATCHPANEL - 24 Port Cat.6', 0, panelHeight/2 + 0.5, 0.3);

    parent.add(panelGroup);
    patchpanelMesh = panelGroup;
}

function createSwitch16(parent, x, y, z, switchNum, switchName) {
    const switchGroup = new THREE.Group();
    switchGroup.position.set(x, y, z);

    // Switch-Gehäuse (1 HE) - für 16 Ports
    const switchWidth = 7;
    const switchHeight = 0.7;
    const switchDepth = 0.5;

    // Unterschiedliche Farben für die Switches
    const switchColors = {
        1: 0x1e3a5f,  // Dunkelblau für Switch 1
        2: 0x3f1e5f   // Dunkelviolett für Switch 2
    };

    const switchGeometry = new THREE.BoxGeometry(switchWidth, switchHeight, switchDepth);
    const switchMaterial = new THREE.MeshStandardMaterial({
        color: switchColors[switchNum],
        roughness: 0.5,
        metalness: 0.3
    });
    const switchBody = new THREE.Mesh(switchGeometry, switchMaterial);
    switchGroup.add(switchBody);

    // Status-LEDs (links)
    const ledGeometry = new THREE.CircleGeometry(0.03, 16);
    const ledColors = [0x22ff22, 0x22ff22, 0xffaa00]; // Power, Link, Activity
    ledColors.forEach((color, i) => {
        const ledMaterial = new THREE.MeshBasicMaterial({ color: color });
        const led = new THREE.Mesh(ledGeometry, ledMaterial);
        led.position.set(-switchWidth/2 + 0.15 + i * 0.12, switchHeight/2 - 0.12, switchDepth/2 + 0.01);
        switchGroup.add(led);
    });

    // 16 RJ45 Ports in einer Reihe
    const numPorts = 16;
    const portWidth = 0.3;
    const portHeight = 0.2;
    const startX = -switchWidth/2 + 0.6;
    const spacing = (switchWidth - 1.2) / (numPorts - 1);

    const portMeshArray = switchNum === 1 ? switch1PortMeshes : switch2PortMeshes;

    for (let i = 0; i < numPorts; i++) {
        const portNum = i + 1;
        const portX = startX + i * spacing;

        // Port-Gehäuse
        const portGeometry = new THREE.BoxGeometry(portWidth, portHeight, 0.12);
        const portMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.7
        });
        const port = new THREE.Mesh(portGeometry, portMaterial);
        port.position.set(portX, -0.05, switchDepth/2 + 0.07);
        port.userData = {
            type: 'switchPort',
            portNum: portNum,
            switchNum: switchNum,
            isConnected: false
        };
        switchGroup.add(port);
        portMeshArray.push(port);

        // Port-Nummer Labels (jeder 4. Port)
        if (portNum === 1 || portNum === 8 || portNum === 16 || portNum % 4 === 0) {
            createSmallPortLabel(switchGroup, `${portNum}`, portX, 0.2, switchDepth/2 + 0.06);
        }
    }

    // Switch-Label
    createLevel3Label(switchGroup, switchName, 0, switchHeight/2 + 0.4, 0.3);

    parent.add(switchGroup);
    
    if (switchNum === 1) {
        switch1Mesh = switchGroup;
    } else {
        switch2Mesh = switchGroup;
    }
}

function createWallCables() {
    // 24 Verlegekabel vom Kabelkanal zum Patchpanel
    // Kabel 1 (DD1-1) ist orange, die anderen 23 sind gelb
    
    const orangeColor = 0xFF8C00;  // Das Kabel aus Level 1 & 2
    const yellowColor = 0xFFD700;  // Die anderen 23 Kabel
    
    for (let i = 0; i < 24; i++) {
        const cableColor = i === 0 ? orangeColor : yellowColor;
        const portNum = i + 1;
        
        // Berechne die Zielposition am Patchpanel
        const panelWidth = 9;
        const startX = -panelWidth/2 + 0.45;
        const spacing = (panelWidth - 0.9) / 23;
        const targetX = startX + i * spacing;
        
        // Kabel verläuft vom Kabelkanal zum Patchpanel
        // Gestaffelte Austrittspunkte aus dem Kabelkanal (zentriert im 3-Einheiten breiten Kanal)
        const kanalExitY = 4 + (i % 4) * 0.15;
        const kanalExitX = -11.5 + (i * 0.09);
        
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(kanalExitX, kanalExitY, -4.3),           // Kabelkanal-Auslass
            new THREE.Vector3(kanalExitX, kanalExitY, -3),             // Raus aus Wand
            new THREE.Vector3(-8 + i * 0.2, 5 + (i % 3) * 0.2, -1),    // Bogen nach oben
            new THREE.Vector3(targetX, 5, 0.5),                         // Über dem Rack
            new THREE.Vector3(targetX, 3.8, 1.2),                       // Hinter Patchpanel
            new THREE.Vector3(targetX, 3, 1.0)                          // Zum Patchpanel (Rückseite)
        ]);

        const tubeGeometry = new THREE.TubeGeometry(curve, 48, 0.04, 8, false);
        const cableMaterial = new THREE.MeshStandardMaterial({
            color: cableColor,
            roughness: 0.5
        });
        const cable = new THREE.Mesh(tubeGeometry, cableMaterial);
        cable.castShadow = true;
        cable.userData = { portNum: portNum, isOrange: i === 0 };
        scene.add(cable);
        wallCableMeshes.push(cable);
    }

    // Labels für die Kabel
    createLevel3Label(scene, 'Orange = DD1-1\n(aus Level 1 & 2)', -12.5, 6, 0);
}

function createSmallPortLabel(parent, text, x, y, z) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 32;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 16);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(0.3, 0.15, 1);
    parent.add(sprite);
}

function createLevel3Label(parent, text, x, y, z) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 256, 64);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Mehrzeiligen Text unterstützen
    const lines = text.split('\n');
    const lineHeight = 20;
    const startY = 32 - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, i) => {
        ctx.fillText(line, 128, startY + i * lineHeight);
    });

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(2.2, 0.55, 1);
    sprite.renderOrder = 100;
    parent.add(sprite);
}

function updateLevel3UI() {
    const cableCoresContainer = document.getElementById('cable-cores');
    cableCoresContainer.innerHTML = '';

    // Level 3 Anweisungen
    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = 'level3-instructions';
    instructionsDiv.innerHTML = `
        <p class="panel-description"><strong>Verbinde alle 24 Patchpanel-Ports:</strong></p>
        <div class="switch-assignment">
            <div class="assignment-row">
                <span class="port-range">Ports 1-12</span>
                <span class="arrow">→</span>
                <span class="switch-name switch1">Switch Büro 1</span>
            </div>
            <div class="assignment-row">
                <span class="port-range">Ports 13-24</span>
                <span class="arrow">→</span>
                <span class="switch-name switch2">Switch Büro 2</span>
            </div>
        </div>
        <div class="connection-guide">
            <div class="port-indicator" id="selected-patch">
                <span class="port-label">Patchpanel:</span>
                <span class="port-value">-</span>
            </div>
            <div class="arrow">→</div>
            <div class="port-indicator" id="selected-switch">
                <span class="port-label">Switch:</span>
                <span class="port-value">-</span>
            </div>
        </div>
        <p class="hint-text">💡 ${isTouchDevice() ? 'Tippe auf' : 'Klicke auf'} einen Patchpanel-Port, dann auf den passenden Switch-Port</p>
    `;
    cableCoresContainer.appendChild(instructionsDiv);

    // Panel-Titel anpassen
    document.querySelector('#cable-panel h3').textContent = '🔗 Patch-Verbindungen';
    
    // Socket-Status für Level 3 anpassen
    const socketStatus = document.getElementById('socket-status');
    socketStatus.innerHTML = `
        <div class="socket-status-item timer-display">
            <span>⏱️ Zeit:</span>
            <span id="level3-timer">${formatTime(gameState.level3.timeRemaining)}</span>
        </div>
        <div class="socket-status-item">
            <span>🔗 Verbindungen:</span>
            <span id="level3-connections">0/${gameState.level3.requiredConnections}</span>
        </div>
        <div class="socket-status-item switch1-status">
            <span>📦 Switch Büro 1:</span>
            <span id="switch1-connections">0/12</span>
        </div>
        <div class="socket-status-item switch2-status">
            <span>📦 Switch Büro 2:</span>
            <span id="switch2-connections">0/12</span>
        </div>
    `;

    // Undo Button für Level 3 anpassen
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.textContent = '↩️ Letztes Kabel entfernen';
        undoBtn.disabled = true;
    }

    // Check-Button anpassen
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.textContent = '✅ Verbindungen prüfen';
        checkBtn.disabled = true;
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function handleLevel3Click() {
    // Prüfen ob auf Patchpanel- oder Switch-Port geklickt wurde
    const allPorts = [...patchPortMeshes, ...switch1PortMeshes, ...switch2PortMeshes];
    const intersects = raycaster.intersectObjects(allPorts);

    if (intersects.length > 0) {
        const clickedPort = intersects[0].object;
        const portData = clickedPort.userData;

        if (portData.type === 'patchPort') {
            handlePatchPortClick(clickedPort, portData);
        } else if (portData.type === 'switchPort') {
            handleSwitchPortClick(clickedPort, portData);
        }
    }
}

function handlePatchPortClick(port, portData) {
    if (portData.isConnected) {
        showFeedback('Dieser Port ist bereits verbunden!', 'warning');
        return;
    }

    // Vorherige Auswahl zurücksetzen
    if (gameState.level3.selectedPatchPort) {
        gameState.level3.selectedPatchPort.material.emissive = new THREE.Color(0x000000);
    }

    // Port auswählen
    gameState.level3.selectedPatchPort = port;
    port.material.emissive = new THREE.Color(0x4444ff);
    port.material.emissiveIntensity = 0.5;

    // UI aktualisieren
    updateLevel3PortSelection();
    
    const targetSwitchName = portData.targetSwitch === 1 ? 'Switch Büro 1' : 'Switch Büro 2';
    showFeedback(`Port ${portData.portNum} ausgewählt → ${targetSwitchName}`, 'info');
}

function handleSwitchPortClick(port, portData) {
    if (!gameState.level3.selectedPatchPort) {
        showFeedback('Wähle zuerst einen Patchpanel-Port!', 'warning');
        return;
    }

    if (portData.isConnected) {
        showFeedback('Dieser Switch-Port ist bereits verbunden!', 'warning');
        return;
    }

    const patchPortData = gameState.level3.selectedPatchPort.userData;
    
    // Prüfen ob richtiger Switch gewählt wurde
    if (patchPortData.targetSwitch !== portData.switchNum) {
        const correctSwitch = patchPortData.targetSwitch === 1 ? 'Switch Büro 1' : 'Switch Büro 2';
        showFeedback(`Falscher Switch! Port ${patchPortData.portNum} gehört zu ${correctSwitch}`, 'warning');
        return;
    }

    // Verbindung herstellen
    createPatchCableConnection(gameState.level3.selectedPatchPort, port);
}

function createPatchCableConnection(patchPort, switchPort) {
    const patchData = patchPort.userData;
    const switchData = switchPort.userData;

    // Patchkabel erstellen
    const patchWorldPos = new THREE.Vector3();
    const switchWorldPos = new THREE.Vector3();
    patchPort.getWorldPosition(patchWorldPos);
    switchPort.getWorldPosition(switchWorldPos);

    // Einheitliche Kabelfarbe: Hellgrau
    const cableColor = 0xB0B0B0;

    // Kurve für Patchkabel
    const midY = (patchWorldPos.y + switchWorldPos.y) / 2;
    const curve = new THREE.CatmullRomCurve3([
        patchWorldPos.clone().add(new THREE.Vector3(0, 0, 0.1)),
        patchWorldPos.clone().add(new THREE.Vector3(0, -0.2, 0.5)),
        new THREE.Vector3(
            (patchWorldPos.x + switchWorldPos.x) / 2,
            midY,
            Math.max(patchWorldPos.z, switchWorldPos.z) + 0.6
        ),
        switchWorldPos.clone().add(new THREE.Vector3(0, 0.2, 0.5)),
        switchWorldPos.clone().add(new THREE.Vector3(0, 0, 0.1))
    ]);

    const tubeGeometry = new THREE.TubeGeometry(curve, 32, 0.035, 8, false);
    const cableMaterial = new THREE.MeshStandardMaterial({
        color: cableColor,
        roughness: 0.6
    });
    const cable = new THREE.Mesh(tubeGeometry, cableMaterial);
    cable.castShadow = true;
    cable.userData = {
        patchPortNum: patchData.portNum,
        switchNum: switchData.switchNum,
        switchPortNum: switchData.portNum
    };
    scene.add(cable);
    patchCableMeshes.push(cable);

    // Ports als verbunden markieren
    patchPort.userData.isConnected = true;
    patchPort.material.color = new THREE.Color(0x22aa22);
    patchPort.material.emissive = new THREE.Color(0x000000);

    switchPort.userData.isConnected = true;
    switchPort.material.color = new THREE.Color(0x22aa22);

    // Verbindung speichern
    gameState.level3.connections.push({
        patchPort: patchData.portNum,
        switchNum: switchData.switchNum,
        switchPort: switchData.portNum,
        cable: cable
    });

    // Undo-History
    gameState.undoHistory.push({
        type: 'level3Connection',
        patchPort: patchPort,
        switchPort: switchPort,
        cable: cable
    });

    // Auswahl zurücksetzen
    gameState.level3.selectedPatchPort = null;

    // UI aktualisieren
    updateLevel3PortSelection();
    updateLevel3Progress();

    const switchName = switchData.switchNum === 1 ? 'Büro 1' : 'Büro 2';
    showFeedback(`Verbunden: Port ${patchData.portNum} ↔ Switch ${switchName} Port ${switchData.portNum}`, 'success');
}

function updateLevel3PortSelection() {
    const patchIndicator = document.querySelector('#selected-patch .port-value');
    const switchIndicator = document.querySelector('#selected-switch .port-value');

    if (patchIndicator) {
        if (gameState.level3.selectedPatchPort) {
            const portData = gameState.level3.selectedPatchPort.userData;
            patchIndicator.textContent = `Port ${portData.portNum}`;
            patchIndicator.classList.add('selected');
        } else {
            patchIndicator.textContent = '-';
            patchIndicator.classList.remove('selected');
        }
    }

    if (switchIndicator) {
        switchIndicator.textContent = '-';
        switchIndicator.classList.remove('selected');
    }
}

function updateLevel3Progress() {
    const connections = gameState.level3.connections;
    const totalConnections = connections.length;
    
    // Zähle Verbindungen pro Switch
    const switch1Count = connections.filter(c => c.switchNum === 1).length;
    const switch2Count = connections.filter(c => c.switchNum === 2).length;

    // Update UI
    const connectionsEl = document.getElementById('level3-connections');
    if (connectionsEl) {
        connectionsEl.textContent = `${totalConnections}/${gameState.level3.requiredConnections}`;
    }

    const switch1El = document.getElementById('switch1-connections');
    if (switch1El) {
        switch1El.textContent = `${switch1Count}/12`;
        if (switch1Count === 12) {
            switch1El.parentElement.classList.add('completed');
        }
    }

    const switch2El = document.getElementById('switch2-connections');
    if (switch2El) {
        switch2El.textContent = `${switch2Count}/12`;
        if (switch2Count === 12) {
            switch2El.parentElement.classList.add('completed');
        }
    }

    // Undo-Button aktivieren wenn Verbindungen vorhanden
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.disabled = totalConnections === 0;
    }

    // Check-Button aktivieren wenn alle Verbindungen hergestellt
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.disabled = totalConnections < gameState.level3.requiredConnections;
        if (totalConnections >= gameState.level3.requiredConnections) {
            checkBtn.classList.add('pulse');
        }
    }
}

function startLevel3Timer() {
    gameState.level3.timerActive = true;
    gameState.level3.timeRemaining = LEVELS[3].timeLimit;
    
    updateLevel3TimerDisplay();
}

function updateLevel3Timer() {
    if (!gameState.level3.timerActive || !gameState.isStarted) return;

    gameState.level3.timeRemaining--;

    if (gameState.level3.timeRemaining <= 0) {
        gameState.level3.timeRemaining = 0;
        updateLevel3TimerDisplay();
        gameState.level3.timerActive = false;
        handleLevel3TimeUp();
    } else {
        updateLevel3TimerDisplay();
    }
}

function updateLevel3TimerDisplay() {
    const timerEl = document.getElementById('level3-timer');
    if (timerEl) {
        timerEl.textContent = formatTime(gameState.level3.timeRemaining);
        
        // Warnung wenn wenig Zeit
        if (gameState.level3.timeRemaining <= 60) {
            timerEl.classList.add('warning');
        }
        if (gameState.level3.timeRemaining <= 30) {
            timerEl.classList.remove('warning');
            timerEl.classList.add('critical');
        }
    }
}

function handleLevel3TimeUp() {
    showFeedback('Zeit abgelaufen!', 'warning');
    
    // Automatische Prüfung
    setTimeout(() => {
        checkLevel3Solution();
    }, 1000);
}

function checkLevel3Solution() {
    stopTimer();
    const connections = gameState.level3.connections;
    const required = gameState.level3.requiredConnections;
    
    let correctSwitch1 = 0;
    let correctSwitch2 = 0;
    let wrongConnections = [];

    // Prüfen: Ports 1-12 müssen mit Switch 1 verbunden sein
    // Ports 13-24 müssen mit Switch 2 verbunden sein
    connections.forEach(conn => {
        if (conn.patchPort <= 12 && conn.switchNum === 1) {
            correctSwitch1++;
        } else if (conn.patchPort > 12 && conn.switchNum === 2) {
            correctSwitch2++;
        } else {
            wrongConnections.push(`Port ${conn.patchPort} → falscher Switch`);
        }
    });

    const correct = correctSwitch1 + correctSwitch2;
    const success = correct >= required && wrongConnections.length === 0;
    const timeUsed = LEVELS[3].timeLimit - gameState.level3.timeRemaining;

    // Fehlende Ports ermitteln
    const missingPorts = [];
    for (let i = 1; i <= 24; i++) {
        if (!connections.some(c => c.patchPort === i)) {
            missingPorts.push(i);
        }
    }

    showLevel3Result(success, correct, required, wrongConnections, missingPorts, timeUsed);
}

function showLevel3Result(success, correct, total, wrongConnections, missingPorts, timeUsed) {
    const modal = document.getElementById('result-modal');
    const titleEl = document.getElementById('result-title');
    const iconEl = document.getElementById('result-icon');
    const scoreEl = document.getElementById('result-score');
    const timeEl = document.getElementById('result-time');
    const detailsEl = document.getElementById('result-details');
    const errorsEl = document.getElementById('result-errors');
    const retryBtn = document.getElementById('result-retry');

    // Level 3 Score berechnen mit Zeitbonus
    const accuracy = correct / total;
    const timeBonus = success ? calculateLevel3TimeBonus(timeUsed) : 0;
    const level3Score = success ? Math.round(accuracy * 100 * timeBonus) : 0;
    if (success) {
        gameState.levelScores[3] = {
            score: level3Score,
            time: timeUsed,
            completed: true
        };
    }

    if (success) {
        titleEl.textContent = '🎉 Level 3 geschafft!';
        iconEl.innerHTML = '🏆';
        iconEl.className = 'success-icon';
    } else {
        titleEl.textContent = '❌ Nicht ganz geschafft';
        iconEl.innerHTML = '❌';
        iconEl.className = 'error-icon';
    }

    scoreEl.innerHTML = `<strong>${correct}/${total}</strong> Verbindungen korrekt`;
    timeEl.innerHTML = `⏱️ Zeit: ${formatTime(timeUsed)} / ${formatTime(LEVELS[3].timeLimit)}`;

    if (success) {
        detailsEl.innerHTML = `
            <p>Alle 24 Patchpanel-Ports sind korrekt mit den Switches verbunden!</p>
            <p>Das Netzwerk für beide Büros ist jetzt betriebsbereit. 🌐</p>
            <p style="margin-top: 10px;"><strong>Weiter geht's:</strong> Verbinde jetzt die PCs und teste die Verbindung!</p>
        `;

        retryBtn.textContent = '▶ Level 4 starten';
        retryBtn.onclick = () => {
            modal.classList.add('hidden');
            selectLevel(4);
        };
    } else {
        let detailHtml = '<p>Es gibt noch Probleme:</p><ul>';
        if (missingPorts.length > 0) {
            detailHtml += `<li>Fehlende Verbindungen: Ports ${missingPorts.slice(0, 5).join(', ')}${missingPorts.length > 5 ? '...' : ''}</li>`;
        }
        if (wrongConnections.length > 0) {
            detailHtml += `<li>Falsche Zuordnungen: ${wrongConnections.length}</li>`;
        }
        detailHtml += '</ul>';
        detailsEl.innerHTML = detailHtml;

        // Button zum Wiederholen von Level 3
        retryBtn.textContent = '🔄 Nochmal versuchen';
        retryBtn.onclick = () => {
            modal.classList.add('hidden');
            selectLevel(3);
        };
    }

    if (wrongConnections.length > 0) {
        errorsEl.innerHTML = '<h4>Falsche Zuordnungen:</h4><ul>' +
            wrongConnections.slice(0, 5).map(e => `<li>${e}</li>`).join('') +
            (wrongConnections.length > 5 ? '<li>...</li>' : '') +
            '</ul>';
        errorsEl.classList.remove('hidden');
    } else {
        errorsEl.classList.add('hidden');
    }

    modal.classList.remove('hidden');

    // Timer stoppen
    gameState.level3.timerActive = false;
}

function undoLevel3Action() {
    if (gameState.undoHistory.length === 0) {
        showFeedback('Nichts zum Rückgängig machen', 'warning');
        return;
    }

    const lastAction = gameState.undoHistory.pop();
    
    if (lastAction.type === 'level3Connection') {
        // Kabel entfernen
        scene.remove(lastAction.cable);
        lastAction.cable.geometry.dispose();
        lastAction.cable.material.dispose();

        // Ports zurücksetzen
        lastAction.patchPort.userData.isConnected = false;
        lastAction.patchPort.material.color = new THREE.Color(0x1a1a1a);

        lastAction.switchPort.userData.isConnected = false;
        lastAction.switchPort.material.color = new THREE.Color(0x1a1a1a);

        // Aus Verbindungsliste entfernen
        gameState.level3.connections = gameState.level3.connections.filter(
            c => c.cable !== lastAction.cable
        );

        // Aus patchCableMeshes entfernen
        const index = patchCableMeshes.indexOf(lastAction.cable);
        if (index > -1) {
            patchCableMeshes.splice(index, 1);
        }

        updateLevel3Progress();
        showFeedback('Letzte Verbindung entfernt', 'info');
    }
}

// ============================================
// Level 4: PC-Vernetzung & Ping
// ============================================

function createLevel4Scene() {
    // Beleuchtung
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.7);
    mainLight.position.set(5, 10, 8);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -3);
    scene.add(fillLight);

    // Büroraum
    createLevel4Room();

    // Schreibtisch
    createLevel4Desk();

    // Linker PC
    createLevel4PC('left', -3.5);

    // Rechter PC
    createLevel4PC('right', 3.5);

    // Doppeldose an der Wand
    createLevel4Doppeldose();

    // Verlegekabel in der Wand (Referenz, nicht interaktiv)
    createLevel4WallCables();

    // Patchkabel auf dem Tisch
    createLevel4PatchCables();

    // Kamera-Position
    camera.position.set(0, 3, 8);
    controls.target.set(0, 1, 0);
}

function createLevel4Room() {
    // Boden
    const floorGeometry = new THREE.PlaneGeometry(20, 15);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B7355,
        roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // Rückwand
    const wallGeometry = new THREE.PlaneGeometry(20, 10);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8e0d0,
        roughness: 0.9
    });
    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
    backWall.position.set(0, 3.5, -2);
    backWall.receiveShadow = true;
    scene.add(backWall);
}

function createLevel4Desk() {
    const deskGroup = new THREE.Group();

    // Tischplatte
    const topGeometry = new THREE.BoxGeometry(12, 0.15, 3);
    const topMaterial = new THREE.MeshStandardMaterial({
        color: 0x6B4226,
        roughness: 0.6
    });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 0;
    top.castShadow = true;
    top.receiveShadow = true;
    deskGroup.add(top);

    // Tischbeine
    const legGeometry = new THREE.BoxGeometry(0.15, 1.5, 0.15);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
    const legPositions = [[-5.8, -0.75, -1.3], [5.8, -0.75, -1.3], [-5.8, -0.75, 1.3], [5.8, -0.75, 1.3]];
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(...pos);
        deskGroup.add(leg);
    });

    deskGroup.position.set(0, 0.75, 0);
    scene.add(deskGroup);
}

function createLevel4PC(side, x) {
    const pcGroup = new THREE.Group();
    const sideSign = side === 'left' ? 1 : -1;

    // === Monitor ===
    const monitorGroup = new THREE.Group();

    // Monitor-Rahmen
    const frameGeometry = new THREE.BoxGeometry(2.4, 1.6, 0.1);
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.3,
        metalness: 0.5
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    monitorGroup.add(frame);

    // Bildschirm (Canvas-Textur)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 340;
    level4ScreenCanvases[side] = canvas;

    const texture = new THREE.CanvasTexture(canvas);
    const screenGeometry = new THREE.PlaneGeometry(2.2, 1.4);
    const screenMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.z = 0.06;
    monitorGroup.add(screen);
    level4ScreenMeshes[side] = screen;

    // Monitor-Standfuß
    const standGeometry = new THREE.BoxGeometry(0.3, 0.6, 0.3);
    const standMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
    const stand = new THREE.Mesh(standGeometry, standMaterial);
    stand.position.y = -1.1;
    monitorGroup.add(stand);

    // Standfuß-Basis
    const baseGeometry = new THREE.BoxGeometry(1.0, 0.08, 0.5);
    const base = new THREE.Mesh(baseGeometry, standMaterial);
    base.position.y = -1.38;
    monitorGroup.add(base);

    monitorGroup.position.set(0, 2.2, -0.5);
    pcGroup.add(monitorGroup);

    // === Tower (PC-Gehäuse) ===
    const towerGroup = new THREE.Group();

    const towerGeometry = new THREE.BoxGeometry(0.8, 1.4, 1.2);
    const towerMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.4,
        metalness: 0.3
    });
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    towerGroup.add(tower);

    // Power-LED am Tower (Vorderseite)
    const ledGeometry = new THREE.CircleGeometry(0.03, 16);
    const ledMaterial = new THREE.MeshBasicMaterial({ color: 0x22ff22 });
    const led = new THREE.Mesh(ledGeometry, ledMaterial);
    led.position.set(-0.2, 0.5, 0.61);
    towerGroup.add(led);

    // Ethernet-Port (Rückseite des Towers) — interaktiv
    const portGeometry = new THREE.BoxGeometry(0.25, 0.18, 0.08);
    const portMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a3a3a,
        roughness: 0.7
    });
    const ethernetPort = new THREE.Mesh(portGeometry, portMaterial);
    ethernetPort.position.set(0.15, -0.3, -0.61);
    ethernetPort.userData = {
        type: 'level4PcPort',
        side: side,
        isConnected: false,
        label: side === 'left' ? 'PC Links' : 'PC Rechts'
    };
    towerGroup.add(ethernetPort);
    level4PcPorts.push(ethernetPort);

    // Port-Label
    createLevel4Label(towerGroup, 'LAN', 0.15, -0.1, -0.65);

    towerGroup.position.set(sideSign * 1.8, 0.85, 0);
    pcGroup.add(towerGroup);

    // === Tastatur ===
    const kbGeometry = new THREE.BoxGeometry(1.4, 0.05, 0.5);
    const kbMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.5
    });
    const keyboard = new THREE.Mesh(kbGeometry, kbMaterial);
    keyboard.position.set(0, 0.85, 0.8);
    pcGroup.add(keyboard);

    // PC-Label über dem Monitor
    createLevel4Label(pcGroup, side === 'left' ? 'PC 1 (192.168.1.1)' : 'PC 2 (192.168.1.2)', 0, 3.3, -0.5);

    pcGroup.position.set(x, 0, 0);
    scene.add(pcGroup);

    // Bildschirm initial zeichnen
    updateLevel4Screen(side, 'disconnected');
}

function createLevel4Doppeldose() {
    const doseGroup = new THREE.Group();

    // Dosen-Rahmen (Unterputz-Dose)
    const frameGeometry = new THREE.BoxGeometry(1.6, 1.0, 0.15);
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.5
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    doseGroup.add(frame);

    // Innenfläche (leicht vertieft)
    const innerGeometry = new THREE.BoxGeometry(1.4, 0.8, 0.05);
    const innerMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 });
    const inner = new THREE.Mesh(innerGeometry, innerMaterial);
    inner.position.z = 0.06;
    doseGroup.add(inner);

    // Port DD1-1 (links)
    const portGeometry = new THREE.BoxGeometry(0.3, 0.22, 0.1);
    const portMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.7
    });
    const port1 = new THREE.Mesh(portGeometry, portMaterial);
    port1.position.set(-0.4, 0, 0.1);
    port1.userData = {
        type: 'level4SocketPort',
        portName: 'DD1-1',
        portIndex: 0,
        isConnected: false
    };
    doseGroup.add(port1);
    level4SocketPorts.push(port1);

    // Port DD1-2 (rechts)
    const port2 = new THREE.Mesh(portGeometry, portMaterial.clone());
    port2.position.set(0.4, 0, 0.1);
    port2.userData = {
        type: 'level4SocketPort',
        portName: 'DD1-2',
        portIndex: 1,
        isConnected: false
    };
    doseGroup.add(port2);
    level4SocketPorts.push(port2);

    // Port-Labels
    createLevel4Label(doseGroup, 'DD1-1', -0.4, -0.5, 0.15);
    createLevel4Label(doseGroup, 'DD1-2', 0.4, -0.5, 0.15);

    // Dose-Label
    createLevel4Label(doseGroup, 'Doppeldose (aus Level 2)', 0, 0.8, 0.15);

    doseGroup.position.set(0, 2.5, -1.9);
    scene.add(doseGroup);
}

function createLevel4WallCables() {
    // Zwei Verlegekabel von der Doppeldose in die Wand (visuell, nicht interaktiv)
    const cableColor = 0xFF8C00;
    const cableMaterial = new THREE.MeshStandardMaterial({
        color: cableColor,
        roughness: 0.6
    });

    [-0.4, 0.4].forEach(portX => {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(portX, 2.5, -1.9),
            new THREE.Vector3(portX, 2.5, -1.95),
            new THREE.Vector3(portX, 3.5, -2.0)
        ]);
        const tubeGeometry = new THREE.TubeGeometry(curve, 12, 0.04, 8, false);
        const cable = new THREE.Mesh(tubeGeometry, cableMaterial);
        scene.add(cable);
    });

    // Label
    createLevel4Label(scene, '→ zum Patchpanel (Level 3)', 0, 4.0, -1.8);
}

function createLevel4PatchCables() {
    // Zwei Patchkabel auf dem Tisch, eines pro PC-Seite
    const cableData = [
        { side: 'left', x: -2.5, color: 0x4488ff },
        { side: 'right', x: 2.5, color: 0x44bb44 }
    ];

    cableData.forEach(data => {
        const cableGroup = new THREE.Group();

        // Kabelstrang auf dem Tisch (aufgerolltes Patchkabel)
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.3, 0, 0),
            new THREE.Vector3(-0.1, 0.05, 0.15),
            new THREE.Vector3(0.15, 0.03, -0.1),
            new THREE.Vector3(0.3, 0, 0.05)
        ]);
        const tubeGeometry = new THREE.TubeGeometry(curve, 16, 0.04, 8, false);
        const cableMaterial = new THREE.MeshStandardMaterial({
            color: data.color,
            roughness: 0.5
        });
        const cable = new THREE.Mesh(tubeGeometry, cableMaterial);
        cableGroup.add(cable);

        // RJ45-Stecker Anzeige (kleiner Block am Ende)
        const plugGeometry = new THREE.BoxGeometry(0.12, 0.08, 0.2);
        const plugMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const plug1 = new THREE.Mesh(plugGeometry, plugMaterial);
        plug1.position.set(-0.3, 0, 0);
        cableGroup.add(plug1);
        const plug2 = new THREE.Mesh(plugGeometry, plugMaterial);
        plug2.position.set(0.3, 0, 0.05);
        cableGroup.add(plug2);

        cableGroup.position.set(data.x, 0.85, 1.0);
        cableGroup.userData = {
            type: 'level4Cable',
            side: data.side,
            color: data.color
        };
        scene.add(cableGroup);
        level4CablePickups.push(cableGroup);
    });
}

function createLevel4Label(parent, text, x, y, z) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 48;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, 256, 48);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 24);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(2.0, 0.4, 1);
    sprite.renderOrder = 100;
    parent.add(sprite);
}

// ============================================
// Level 4: Bildschirm-Texturen
// ============================================

function updateLevel4Screen(side, state) {
    const canvas = level4ScreenCanvases[side];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Bildschirm löschen
    ctx.clearRect(0, 0, w, h);

    if (state === 'disconnected') {
        drawLevel4NetworkDiagram(ctx, w, h, false);
    } else if (state === 'connected') {
        drawLevel4NetworkDiagram(ctx, w, h, true);
    } else if (state === 'terminal') {
        drawLevel4Terminal(ctx, w, h);
    }

    // Textur aktualisieren
    if (level4ScreenMeshes[side]) {
        level4ScreenMeshes[side].material.map.needsUpdate = true;
    }
}

function drawLevel4NetworkDiagram(ctx, w, h, connected) {
    // Desktop-Hintergrund
    ctx.fillStyle = connected ? '#1a3a1a' : '#1a1a2a';
    ctx.fillRect(0, 0, w, h);

    // Taskbar unten
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, h - 30, w, 30);

    // Netzwerk-Icon in Taskbar
    if (connected) {
        ctx.fillStyle = '#22ff22';
        ctx.font = '16px Arial';
        ctx.fillText('🖧', w - 40, h - 10);
    } else {
        ctx.fillStyle = '#ff4444';
        ctx.font = '16px Arial';
        ctx.fillText('✕', w - 40, h - 10);
    }

    // Titel
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Netzwerkplan', w / 2, 35);

    // Netzwerkdiagramm zeichnen
    const centerY = h / 2 + 10;
    const pc1X = 80;
    const switchX = w / 2;
    const pc2X = w - 80;

    // PC 1 Icon
    ctx.fillStyle = '#4488cc';
    ctx.fillRect(pc1X - 25, centerY - 20, 50, 35);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    ctx.fillText('PC 1', pc1X, centerY + 30);

    // Switch Icon
    ctx.fillStyle = '#7744aa';
    ctx.fillRect(switchX - 30, centerY - 15, 60, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    ctx.fillText('Switch 1', switchX, centerY + 30);

    // PC 2 Icon
    ctx.fillStyle = '#44aa44';
    ctx.fillRect(pc2X - 25, centerY - 20, 50, 35);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    ctx.fillText('PC 2', pc2X, centerY + 30);

    // Verbindungslinien
    ctx.lineWidth = 3;
    if (connected) {
        ctx.strokeStyle = '#22ff22';
        ctx.setLineDash([]);
    } else {
        ctx.strokeStyle = '#ff4444';
        ctx.setLineDash([8, 6]);
    }

    // PC1 → Switch
    ctx.beginPath();
    ctx.moveTo(pc1X + 25, centerY);
    ctx.lineTo(switchX - 30, centerY);
    ctx.stroke();

    // Switch → PC2
    ctx.beginPath();
    ctx.moveTo(switchX + 30, centerY);
    ctx.lineTo(pc2X - 25, centerY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Status-Text
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    if (connected) {
        ctx.fillStyle = '#22ff22';
        ctx.fillText('✓ Verbunden!', w / 2, h - 55);
    } else {
        ctx.fillStyle = '#ff6666';
        ctx.fillText('✕ Nicht verbunden', w / 2, h - 55);
    }
}

function drawLevel4Terminal(ctx, w, h) {
    // Terminal-Hintergrund
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, w, h);

    // Terminal-Titelbar
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, w, 22);
    ctx.fillStyle = '#cccccc';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('  Eingabeaufforderung', 5, 15);

    // Cursor-Prompt
    ctx.fillStyle = '#cccccc';
    ctx.font = '13px Courier New, monospace';
    ctx.fillText('C:\\> ping 192.168.1.2', 10, 50);
    ctx.fillText('_', 250, 50);
}

// ============================================
// Level 4: Interaktion
// ============================================

function handleLevel4Click() {
    const state = gameState.level4;

    // Alle interaktiven Objekte sammeln
    const clickableObjects = [
        ...level4CablePickups,
        ...level4PcPorts,
        ...level4SocketPorts
    ];

    // Auch Kinder der Gruppen für Raycasting
    const allMeshes = [];
    clickableObjects.forEach(obj => {
        if (obj.isGroup) {
            obj.traverse(child => {
                if (child.isMesh) {
                    child.userData._parentGroup = obj;
                    allMeshes.push(child);
                }
            });
        } else {
            allMeshes.push(obj);
        }
    });

    const intersects = raycaster.intersectObjects(allMeshes);
    if (intersects.length === 0) return;

    // Das getroffene Objekt oder seine Elterngruppe finden
    let clickedObj = intersects[0].object;
    if (clickedObj.userData._parentGroup) {
        clickedObj = clickedObj.userData._parentGroup;
    }

    const objData = clickedObj.userData;

    if (state.cablePhase === 'pickUp') {
        // Phase 1: Kabel aufnehmen
        if (objData.type === 'level4Cable') {
            handleLevel4CablePickup(clickedObj, objData);
        }
    } else if (state.cablePhase === 'connectPC') {
        // Phase 2: Am PC-Port anschließen
        if (objData.type === 'level4PcPort') {
            handleLevel4PCConnect(clickedObj, objData);
        } else {
            showFeedback('Stecke das Kabel zuerst in den Ethernet-Port des PCs!', 'warning');
        }
    } else if (state.cablePhase === 'connectSocket') {
        // Phase 3: An der Doppeldose anschließen
        if (objData.type === 'level4SocketPort') {
            handleLevel4SocketConnect(clickedObj, objData);
        } else {
            showFeedback('Stecke das andere Ende in einen Port der Doppeldose!', 'warning');
        }
    }
}

function handleLevel4CablePickup(cable, data) {
    const side = data.side;
    const conn = gameState.level4.connections[side];

    // Bereits vollständig verbunden?
    if (conn.pcConnected && conn.socketConnected) {
        showFeedback('Dieses Kabel ist bereits angeschlossen!', 'warning');
        return;
    }

    gameState.level4.selectedCable = side;
    gameState.level4.cablePhase = 'connectPC';

    // Kabel hervorheben
    cable.traverse(child => {
        if (child.isMesh && child.material.emissive) {
            child.material.emissive = new THREE.Color(0x4444ff);
            child.material.emissiveIntensity = 0.4;
        }
    });

    showFeedback(`Patchkabel aufgenommen — verbinde es mit ${side === 'left' ? 'PC 1' : 'PC 2'}!`, 'info');
    updateLevel4Progress();
}

function handleLevel4PCConnect(port, portData) {
    const selectedSide = gameState.level4.selectedCable;

    // Prüfen ob richtiger PC (Kabel muss zum passenden PC)
    if (portData.side !== selectedSide) {
        showFeedback(`Dieses Kabel gehört zu ${selectedSide === 'left' ? 'PC 1' : 'PC 2'}!`, 'warning');
        return;
    }

    if (portData.isConnected) {
        showFeedback('Dieser PC ist bereits verbunden!', 'warning');
        return;
    }

    // PC-Port als verbunden markieren
    portData.isConnected = true;
    port.material.color = new THREE.Color(0x22aa22);
    gameState.level4.connections[selectedSide].pcConnected = true;
    gameState.level4.cablePhase = 'connectSocket';

    showFeedback(`Am ${portData.label} eingesteckt — jetzt zur Doppeldose!`, 'success');
    updateLevel4Progress();
}

function handleLevel4SocketConnect(port, portData) {
    if (portData.isConnected) {
        showFeedback('Dieser Dosen-Port ist bereits belegt!', 'warning');
        return;
    }

    const selectedSide = gameState.level4.selectedCable;

    // Dosen-Port als verbunden markieren
    portData.isConnected = true;
    port.material.color = new THREE.Color(0x22aa22);
    gameState.level4.connections[selectedSide].socketConnected = true;

    // Kabel-Highlight entfernen & Kabel auf dem Tisch ausblenden
    const cablePickup = level4CablePickups.find(c => c.userData.side === selectedSide);
    if (cablePickup) {
        cablePickup.visible = false;
    }

    // Verlegtes Kabel als TubeGeometry erstellen
    createLevel4RoutedCable(selectedSide, portData.portName);

    // Undo-History
    gameState.undoHistory.push({
        type: 'level4Connection',
        side: selectedSide,
        pcPort: level4PcPorts.find(p => p.userData.side === selectedSide),
        socketPort: port,
        cablePickup: cablePickup
    });

    // Zurück zur Kabel-Aufnahme-Phase
    gameState.level4.selectedCable = null;
    gameState.level4.cablePhase = 'pickUp';

    showFeedback(`${portData.portName} verbunden!`, 'success');

    // Prüfen ob beide PCs verbunden
    checkLevel4Connectivity();
    updateLevel4Progress();
}

function createLevel4RoutedCable(side, socketPortName) {
    const pcX = side === 'left' ? -3.5 : 3.5;
    const towerOffsetX = side === 'left' ? 1.8 : -1.8;
    const socketX = socketPortName === 'DD1-1' ? -0.4 : 0.4;
    const cableColor = side === 'left' ? 0x4488ff : 0x44bb44;

    // Kabelroute: PC-Rückseite → runter → entlang Wand → hoch zur Dose
    const startPos = new THREE.Vector3(pcX + towerOffsetX + 0.15, 0.85 + 0.55, -0.61);
    const endPos = new THREE.Vector3(socketX, 2.5, -1.8);

    const curve = new THREE.CatmullRomCurve3([
        startPos,
        new THREE.Vector3(startPos.x, startPos.y, startPos.z - 0.3),
        new THREE.Vector3(startPos.x, -0.5, -1.0),
        new THREE.Vector3(endPos.x, -0.5, -1.5),
        new THREE.Vector3(endPos.x, endPos.y - 0.5, -1.8),
        endPos
    ]);

    const tubeGeometry = new THREE.TubeGeometry(curve, 40, 0.035, 8, false);
    const cableMaterial = new THREE.MeshStandardMaterial({
        color: cableColor,
        roughness: 0.5
    });
    const cable = new THREE.Mesh(tubeGeometry, cableMaterial);
    cable.castShadow = true;
    cable.userData = { side: side };
    scene.add(cable);
    level4RoutedCables.push(cable);
}

function checkLevel4Connectivity() {
    const conn = gameState.level4.connections;
    const leftDone = conn.left.pcConnected && conn.left.socketConnected;
    const rightDone = conn.right.pcConnected && conn.right.socketConnected;

    if (leftDone && rightDone && !gameState.level4.bothConnected) {
        gameState.level4.bothConnected = true;

        // Bildschirme auf "verbunden" aktualisieren
        updateLevel4Screen('left', 'connected');
        updateLevel4Screen('right', 'connected');

        showFeedback('Netzwerkverbindung hergestellt! Führe jetzt den Ping-Test durch.', 'success');

        // UI aktualisieren: Ping-Terminal anzeigen
        setTimeout(() => {
            updateLevel4UI();
        }, 1500);
    }
}

// ============================================
// Level 4: Ping-Test
// ============================================

function startLevel4Ping() {
    if (gameState.level4.pingStarted) return;
    gameState.level4.pingStarted = true;

    // Linken Bildschirm auf Terminal umschalten
    updateLevel4Screen('left', 'terminal');

    const terminalEl = document.getElementById('level4-terminal-output');
    if (!terminalEl) return;

    const lines = [
        { text: 'C:\\> ping 192.168.1.2', cls: 'prompt', delay: 0 },
        { text: '', cls: '', delay: 500 },
        { text: 'Ping wird ausgeführt für 192.168.1.2 mit 32 Bytes Daten:', cls: 'info', delay: 800 },
        { text: 'Antwort von 192.168.1.2: Bytes=32 Zeit<1ms TTL=128', cls: 'reply', delay: 1600 },
        { text: 'Antwort von 192.168.1.2: Bytes=32 Zeit<1ms TTL=128', cls: 'reply', delay: 2400 },
        { text: 'Antwort von 192.168.1.2: Bytes=32 Zeit<1ms TTL=128', cls: 'reply', delay: 3200 },
        { text: 'Antwort von 192.168.1.2: Bytes=32 Zeit<1ms TTL=128', cls: 'reply', delay: 4000 },
        { text: '', cls: '', delay: 4500 },
        { text: 'Ping-Statistik für 192.168.1.2:', cls: 'stats', delay: 4800 },
        { text: '    Pakete: Gesendet = 4, Empfangen = 4, Verloren = 0 (0% Verlust)', cls: 'stats', delay: 5200 }
    ];

    lines.forEach(line => {
        setTimeout(() => {
            const lineEl = document.createElement('div');
            lineEl.className = line.cls;
            lineEl.textContent = line.text || '\u00A0';
            terminalEl.appendChild(lineEl);
            terminalEl.scrollTop = terminalEl.scrollHeight;
        }, line.delay);
    });

    // Nach Ping fertig: Level abschließen
    setTimeout(() => {
        gameState.level4.pingComplete = true;

        // Check-Button aktivieren
        const checkBtn = document.getElementById('check-btn');
        if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.classList.add('pulse');
        }

        showFeedback('Ping erfolgreich! Prüfe jetzt dein Ergebnis.', 'success');
        updateLevel4Progress();
    }, 5800);
}

// ============================================
// Level 4: UI
// ============================================

function updateLevel4UI() {
    const cableCoresContainer = document.getElementById('cable-cores');
    cableCoresContainer.innerHTML = '';

    if (!gameState.level4.bothConnected) {
        // Phase 1: Kabel-Verbindungsanweisungen
        const instructionsDiv = document.createElement('div');
        instructionsDiv.className = 'level4-instructions';
        instructionsDiv.innerHTML = `
            <p class="panel-description"><strong>Verbinde beide PCs mit der Doppeldose:</strong></p>
            <div class="connection-status-list">
                <div class="conn-item ${gameState.level4.connections.left.socketConnected ? 'done' : ''}">
                    <span class="conn-icon">${gameState.level4.connections.left.socketConnected ? '✅' : '⬜'}</span>
                    <span>PC 1 → Doppeldose</span>
                </div>
                <div class="conn-item ${gameState.level4.connections.right.socketConnected ? 'done' : ''}">
                    <span class="conn-icon">${gameState.level4.connections.right.socketConnected ? '✅' : '⬜'}</span>
                    <span>PC 2 → Doppeldose</span>
                </div>
            </div>
            <p class="hint-text">💡 ${isTouchDevice() ? 'Tippe auf' : 'Klicke auf'} ein Patchkabel, dann den PC-Port, dann die Dose</p>
        `;
        cableCoresContainer.appendChild(instructionsDiv);
    } else {
        // Phase 2: Ping-Terminal
        const terminalDiv = document.createElement('div');
        terminalDiv.className = 'level4-instructions';
        terminalDiv.innerHTML = `
            <p class="panel-description"><strong>Ping-Test durchführen:</strong></p>
            <p class="hint-text">Teste ob PC 1 den PC 2 über das Netzwerk erreichen kann.</p>
            <div id="level4-terminal" class="ping-terminal">
                <div id="level4-terminal-output"></div>
            </div>
            ${!gameState.level4.pingStarted ? `
                <button id="ping-btn" class="btn btn-primary" style="margin-top: 0.5rem; width: 100%;">
                    ▶ ping 192.168.1.2
                </button>
            ` : ''}
        `;
        cableCoresContainer.appendChild(terminalDiv);

        // Ping-Button Event Listener
        const pingBtn = document.getElementById('ping-btn');
        if (pingBtn) {
            pingBtn.addEventListener('click', () => {
                pingBtn.disabled = true;
                pingBtn.textContent = '⏳ Ping läuft...';
                startLevel4Ping();
            });
        }
    }

    // Panel-Titel anpassen
    document.querySelector('#cable-panel h3').textContent = '🖧 PC-Vernetzung';

    // Socket-Status für Level 4
    const socketStatus = document.getElementById('socket-status');
    socketStatus.innerHTML = `
        <div class="socket-status-item">
            <span>🔗 Kabel:</span>
            <span id="level4-cables">${getLevel4CableCount()}/2</span>
        </div>
        <div class="socket-status-item">
            <span>📡 Ping:</span>
            <span id="level4-ping-status">${gameState.level4.pingComplete ? '✅ Erfolgreich' : gameState.level4.pingStarted ? '⏳ Läuft...' : '⏸ Ausstehend'}</span>
        </div>
    `;

    // Undo Button
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.textContent = '↩️ Letztes Kabel entfernen';
        undoBtn.disabled = gameState.undoHistory.length === 0;
    }

    // Check-Button
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.textContent = '✅ Ergebnis prüfen';
        checkBtn.disabled = !gameState.level4.pingComplete;
    }
}

function getLevel4CableCount() {
    let count = 0;
    if (gameState.level4.connections.left.socketConnected) count++;
    if (gameState.level4.connections.right.socketConnected) count++;
    return count;
}

function updateLevel4Progress() {
    const cablesEl = document.getElementById('level4-cables');
    if (cablesEl) {
        cablesEl.textContent = `${getLevel4CableCount()}/2`;
    }

    const pingEl = document.getElementById('level4-ping-status');
    if (pingEl) {
        pingEl.textContent = gameState.level4.pingComplete ? '✅ Erfolgreich' :
            gameState.level4.pingStarted ? '⏳ Läuft...' : '⏸ Ausstehend';
    }

    // Undo Button
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.disabled = gameState.undoHistory.length === 0 || gameState.level4.bothConnected;
    }

    // Check-Button
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.disabled = !gameState.level4.pingComplete;
        if (gameState.level4.pingComplete) {
            checkBtn.classList.add('pulse');
        }
    }
}

// ============================================
// Level 4: Lösung & Bewertung
// ============================================

function checkLevel4Solution() {
    stopTimer();

    const conn = gameState.level4.connections;
    const cablesCorrect = conn.left.socketConnected && conn.right.socketConnected;
    const pingDone = gameState.level4.pingComplete;

    // Score berechnen
    let score = 0;
    if (conn.left.socketConnected) score += 40;
    if (conn.right.socketConnected) score += 40;
    if (pingDone) score += 20;

    const timeBonus = calculateTimeBonus();
    const helpPenalty = gameState.helpUsed * 5;
    const finalScore = Math.max(0, Math.round(score * timeBonus - helpPenalty));

    const success = cablesCorrect && pingDone;

    // Score speichern
    if (success) {
        gameState.levelScores[4] = {
            score: finalScore,
            time: gameState.elapsedTime,
            completed: true
        };
    }

    showLevel4Result(success, finalScore);
}

function showLevel4Result(success, score) {
    const modal = document.getElementById('result-modal');
    const titleEl = document.getElementById('result-title');
    const iconEl = document.getElementById('result-icon');
    const scoreEl = document.getElementById('result-score');
    const timeEl = document.getElementById('result-time');
    const detailsEl = document.getElementById('result-details');
    const errorsEl = document.getElementById('result-errors');
    const retryBtn = document.getElementById('result-retry');

    if (success) {
        titleEl.textContent = '🎉 Alle Level geschafft!';
        iconEl.innerHTML = '🏆';
        iconEl.className = 'success-icon';

        scoreEl.innerHTML = `<strong>${score}</strong> Punkte`;
        timeEl.innerHTML = `⏱️ Zeit: ${formatTime(gameState.elapsedTime)}`;

        // Gesamtstatistik
        const totalScore = gameState.levelScores[1].score +
                          gameState.levelScores[2].score +
                          gameState.levelScores[3].score +
                          gameState.levelScores[4].score;
        const totalTime = gameState.levelScores[1].time +
                         gameState.levelScores[2].time +
                         gameState.levelScores[3].time +
                         gameState.levelScores[4].time;

        detailsEl.innerHTML = `
            <p>Beide PCs sind verbunden und der Ping war erfolgreich!</p>
            <p>Das gesamte Netzwerk von der Verlegung bis zur Verbindung steht. 🌐</p>
            <hr style="margin: 15px 0; border-color: var(--border-color);">
            <h3 style="margin-bottom: 10px;">📊 Gesamtstatistik</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <th style="text-align: left; padding: 5px;">Level</th>
                    <th style="text-align: center; padding: 5px;">Punkte</th>
                    <th style="text-align: center; padding: 5px;">Zeit</th>
                </tr>
                <tr>
                    <td style="padding: 5px;">1. Kabelkanal</td>
                    <td style="text-align: center; padding: 5px;">${gameState.levelScores[1].score}</td>
                    <td style="text-align: center; padding: 5px;">${formatTime(gameState.levelScores[1].time)}</td>
                </tr>
                <tr>
                    <td style="padding: 5px;">2. Netzwerkdose</td>
                    <td style="text-align: center; padding: 5px;">${gameState.levelScores[2].score}</td>
                    <td style="text-align: center; padding: 5px;">${formatTime(gameState.levelScores[2].time)}</td>
                </tr>
                <tr>
                    <td style="padding: 5px;">3. Patchpanel</td>
                    <td style="text-align: center; padding: 5px;">${gameState.levelScores[3].score}</td>
                    <td style="text-align: center; padding: 5px;">${formatTime(gameState.levelScores[3].time)}</td>
                </tr>
                <tr>
                    <td style="padding: 5px;">4. PC-Vernetzung</td>
                    <td style="text-align: center; padding: 5px;">${gameState.levelScores[4].score}</td>
                    <td style="text-align: center; padding: 5px;">${formatTime(gameState.levelScores[4].time)}</td>
                </tr>
                <tr style="border-top: 2px solid var(--primary-color); font-weight: bold;">
                    <td style="padding: 5px;">Gesamt</td>
                    <td style="text-align: center; padding: 5px; color: var(--primary-color);">${totalScore}</td>
                    <td style="text-align: center; padding: 5px;">${formatTime(totalTime)}</td>
                </tr>
            </table>
            <p style="text-align: center; font-size: 1.2em; color: var(--success-color);">
                🎓 Herzlichen Glückwunsch! Du hast alle Aufgaben gemeistert!
            </p>
        `;

        retryBtn.textContent = '🔄 Alle Level wiederholen';
        retryBtn.onclick = () => {
            modal.classList.add('hidden');
            gameState.levelScores = {
                1: { score: 0, time: 0, completed: false },
                2: { score: 0, time: 0, completed: false },
                3: { score: 0, time: 0, completed: false },
                4: { score: 0, time: 0, completed: false }
            };
            selectLevel(1);
        };
    } else {
        titleEl.textContent = '❌ Noch nicht fertig';
        iconEl.innerHTML = '❌';
        iconEl.className = 'error-icon';

        scoreEl.innerHTML = `<strong>${score}</strong> Punkte`;
        timeEl.innerHTML = `⏱️ Zeit: ${formatTime(gameState.elapsedTime)}`;

        let detailHtml = '<p>Es fehlen noch Schritte:</p><ul>';
        if (!gameState.level4.connections.left.socketConnected) {
            detailHtml += '<li>PC 1 ist nicht verbunden</li>';
        }
        if (!gameState.level4.connections.right.socketConnected) {
            detailHtml += '<li>PC 2 ist nicht verbunden</li>';
        }
        if (!gameState.level4.pingComplete) {
            detailHtml += '<li>Ping-Test nicht durchgeführt</li>';
        }
        detailHtml += '</ul>';
        detailsEl.innerHTML = detailHtml;

        retryBtn.textContent = '🔄 Nochmal versuchen';
        retryBtn.onclick = () => {
            modal.classList.add('hidden');
            selectLevel(4);
        };
    }

    errorsEl.classList.add('hidden');
    modal.classList.remove('hidden');
}

// ============================================
// Level 4: Reset & Undo
// ============================================

function resetLevel4() {
    // Verlegte Kabel entfernen
    level4RoutedCables.forEach(cable => {
        scene.remove(cable);
        disposeObject(cable);
    });
    level4RoutedCables = [];

    // Kabel-Pickups wieder sichtbar machen
    level4CablePickups.forEach(cable => {
        cable.visible = true;
        cable.traverse(child => {
            if (child.isMesh && child.material.emissive) {
                child.material.emissive = new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });
    });

    // Ports zurücksetzen
    level4PcPorts.forEach(port => {
        port.userData.isConnected = false;
        port.material.color = new THREE.Color(0x3a3a3a);
    });
    level4SocketPorts.forEach(port => {
        port.userData.isConnected = false;
        port.material.color = new THREE.Color(0x1a1a1a);
    });

    // Bildschirme zurücksetzen
    updateLevel4Screen('left', 'disconnected');
    updateLevel4Screen('right', 'disconnected');

    // State zurücksetzen
    gameState.level4 = {
        selectedCable: null,
        cablePhase: 'pickUp',
        connections: {
            left:  { pcConnected: false, socketConnected: false },
            right: { pcConnected: false, socketConnected: false }
        },
        bothConnected: false,
        pingStarted: false,
        pingComplete: false
    };

    // UI zurücksetzen
    updateLevel4UI();
}

function undoLevel4Action() {
    if (gameState.undoHistory.length === 0) {
        showFeedback('Nichts zum Rückgängig machen', 'warning');
        return;
    }

    const lastAction = gameState.undoHistory.pop();

    if (lastAction.type === 'level4Connection') {
        const side = lastAction.side;

        // Verlegtes Kabel entfernen
        const routedCable = level4RoutedCables.find(c => c.userData.side === side);
        if (routedCable) {
            scene.remove(routedCable);
            disposeObject(routedCable);
            level4RoutedCables = level4RoutedCables.filter(c => c !== routedCable);
        }

        // Ports zurücksetzen
        lastAction.pcPort.userData.isConnected = false;
        lastAction.pcPort.material.color = new THREE.Color(0x3a3a3a);

        lastAction.socketPort.userData.isConnected = false;
        lastAction.socketPort.material.color = new THREE.Color(0x1a1a1a);

        // Kabel-Pickup wieder sichtbar
        if (lastAction.cablePickup) {
            lastAction.cablePickup.visible = true;
        }

        // State zurücksetzen
        gameState.level4.connections[side] = { pcConnected: false, socketConnected: false };
        gameState.level4.bothConnected = false;
        gameState.level4.selectedCable = null;
        gameState.level4.cablePhase = 'pickUp';

        // Bildschirme zurück auf disconnected
        updateLevel4Screen('left', 'disconnected');
        updateLevel4Screen('right', 'disconnected');

        updateLevel4UI();
        updateLevel4Progress();
        showFeedback('Letzte Verbindung entfernt', 'info');
    }
}

// ============================================
// Start
// ============================================

window.addEventListener('DOMContentLoaded', init);
