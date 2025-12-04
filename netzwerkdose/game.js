// ============================================
// Netzwerk-Verkabelung - Interaktives Lernspiel
// Level 1: Kabelkanal
// Level 2: Netzwerkdose (T568A)
// Level 3: Patchpanel (T568A)
// ============================================

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
        name: 'Patchpanel',
        description: 'Belege den Port am Patchpanel (T568A)',
        icon: '🖥️'
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
    // Level 1 Zustand (Kabelkanal)
    level1: {
        cableSegments: [],      // Kabelsegmente die platziert wurden
        totalSegments: 6,       // Anzahl der zu platzierenden Segmente
        placedSegments: 0,
        selectedSegment: null,
        cableInHand: false
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

// ============================================
// Initialisierung
// ============================================

function init() {
    initThreeJS();
    initUI();
    initEventListeners();
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
    
    // Clear existing scene
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }
    
    // Reset state
    resetGameState();
    
    // Create scene based on level
    if (currentLevel === 1) {
        createLevel1Scene();
        updateLevel1UI();
    } else if (currentLevel === 2) {
        createScene();
        updateCableCoresUI();
    }
    
    // Update header
    document.querySelector('#header h1').textContent = 
        `${LEVELS[currentLevel].icon} ${LEVELS[currentLevel].name}`;
    
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
    gameState.level1 = {
        cableSegments: [],
        totalSegments: 6,
        placedSegments: 0,
        selectedSegment: null,
        cableInHand: false
    };
    
    // Reset 3D objects
    lsaClipMeshes = { 1: [], 2: [] };
    wireMeshes = { 1: [], 2: [] };
    cableMeshes = { 1: null, 2: null };
    kabelkanalSlots = [];
    cableSegmentMeshes = [];
    floatingCableMesh = null;
}

function updateStartModal() {
    const modal = document.getElementById('start-modal');
    const header = modal.querySelector('.modal-header h2');
    const body = modal.querySelector('.start-info');
    
    if (currentLevel === 1) {
        header.textContent = '📏 Level 1: Kabelkanal';
        body.innerHTML = `
            <p>Willkommen zu Level 1!</p>
            <p>Deine Aufgabe ist es, das <strong>orangene Verlegekabel</strong> korrekt im <strong>weißen Kabelkanal</strong> zu verlegen.</p>
            <h3>So funktioniert's:</h3>
            <ol>
                <li>Klicke auf "Kabel aufnehmen" um das Kabel zu greifen</li>
                <li>Klicke auf die freien Positionen im Kabelkanal</li>
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
                <li>Wähle eine Kabelader aus der Seitenleiste</li>
                <li>Klicke auf die entsprechende LSA-Klemme in Dose A</li>
                <li>Belege alle 8 Klemmen korrekt</li>
                <li>Prüfe deine Belegung</li>
            </ol>
            <p class="tip">💡 <strong>Tipp:</strong> Die Farbmarkierungen über den LSA-Klemmen zeigen die korrekte Belegung nach T568A!</p>
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

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 30;
    controls.target.set(0, 0, 0);

    // Raycaster für Klick-Erkennung
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Resize Handler
    window.addEventListener('resize', onWindowResize);
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

    // Realistische Doppeldose (Rückseite mit LSA-Klemmen)
    createRealisticSocket();

    // Nur ein Ethernet-Kabel zum Spielen (Kabel 1 für Dose A)
    createEthernetCable(1, -3.5, -4);
    
    // Kabel 2 bereits fertig verlegt (visuell angedeutet)
    createCompletedCable(2, 3.5, -4);
}

function createCompletedCable(cableNum, x, y) {
    const cableGroup = new THREE.Group();
    cableGroup.position.set(x, y, 4);

    // Kabelmantel (orange - Verlegekabel)
    const cableGeometry = new THREE.CylinderGeometry(0.5, 0.5, 4, 16);
    const cableMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF8C00,  // Orange für Verlegekabel
        roughness: 0.5
    });
    const cable = new THREE.Mesh(cableGeometry, cableMaterial);
    cable.rotation.x = Math.PI / 2;
    cable.position.set(0, 0, 2);
    cableGroup.add(cable);

    // Kabelende
    const cableEndGeometry = new THREE.CylinderGeometry(0.5, 0.35, 0.5, 16);
    const cableEnd = new THREE.Mesh(cableEndGeometry, cableMaterial);
    cableEnd.rotation.x = Math.PI / 2;
    cableEnd.position.set(0, 0, 0);
    cableGroup.add(cableEnd);

    // Kabel-Label
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
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture });
    const label = new THREE.Sprite(labelMaterial);
    label.position.set(0, 1.2, 2);
    label.scale.set(1.8, 0.9, 1);
    cableGroup.add(label);

    // Abisolierte Adern am Kabelende (wie bei Kabel 1)
    T568A_COLORS.forEach((core, index) => {
        const wireGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8);
        const wireMaterial = createWireMaterial(core);

        const wire = new THREE.Mesh(wireGeometry, wireMaterial);

        // Fächerförmige Anordnung nach vorne (zur Dose hin)
        const spreadX = ((index % 4) - 1.5) * 0.25;
        const spreadY = index < 4 ? 0.4 : -0.4;
        
        wire.rotation.x = Math.PI / 2;
        wire.position.set(spreadX, spreadY, -0.75);

        cableGroup.add(wire);
    });

    scene.add(cableGroup);
    cableMeshes[cableNum] = cableGroup;

    // Fertige Drähte zur Dose B - starten von Kabelende
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

    completedWires.forEach((wireInfo, idx) => {
        const core = T568A_COLORS.find(c => c.id === wireInfo.coreId);
        
        // Zielposition der Klemme (Dose B = rechts = centerX 2.2)
        const clipX = 2.2 - 0.75 + wireInfo.index * 0.5;
        const clipY = wireInfo.row === 'top' ? 0.5 + 0.8 : 0.5 - 0.2;
        const clipZ = 1.05;

        // Startposition am Kabelende (passend zu den abisolierten Adern)
        const spreadX = ((idx % 4) - 1.5) * 0.25;
        const spreadY = idx < 4 ? 0.4 : -0.4;
        const startPos = new THREE.Vector3(x + spreadX, y + spreadY, 4 - 1.5); // Ende der abisolierten Ader

        // Endposition an der Klemme
        const endPos = new THREE.Vector3(clipX, clipY, clipZ + 0.3);

        // Kurve mit besseren Kontrollpunkten
        const curve = new THREE.CatmullRomCurve3([
            startPos,
            new THREE.Vector3(startPos.x * 0.7 + endPos.x * 0.3, startPos.y, 2),
            new THREE.Vector3(endPos.x, (startPos.y + endPos.y) / 2, 1.5),
            endPos
        ]);

        const tubeGeometry = new THREE.TubeGeometry(curve, 48, 0.05, 8, false);
        const wireMaterial = createWireMaterial(core);
        const wire = new THREE.Mesh(tubeGeometry, wireMaterial);
        wire.castShadow = true;
        scene.add(wire);
    });
}

function createRealisticSocket() {
    const socketGroup = new THREE.Group();

    // ========== RÜCKSEITE (LSA-Klemmen Seite) ==========
    const backGroup = new THREE.Group();
    backGroup.position.z = 0;

    // Metallrahmen (Montagerahmen) - achteckig wie im Foto
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

    // Montagelöcher (oval wie im Foto)
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

    // Weißer Kunststoff-Einsatz (Hauptkörper) - durchgehend bis zur Vorderseite
    const bodyGeometry = new THREE.BoxGeometry(9, 9, 2.5);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0xf8f8f8,
        roughness: 0.4,
        metalness: 0.05
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.z = -0.5;
    backGroup.add(body);

    // Innerer Bereich (leicht vertieft) - Rückseite
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

    // LSA-Klemmen erstellen - Dose A (links) - zum Spielen
    createLSABlock(backGroup, 1, -2.2, 0.5);

    // LSA-Klemmen erstellen - Dose B (rechts) - bereits fertig
    createLSABlockCompleted(backGroup, 2, 2.2, 0.5);

    // T568A/B Beschriftung
    createStandardLabel(backGroup, 'T568A', 0, -2.8, 1.0);

    socketGroup.add(backGroup);

    // ========== VORDERSEITE (RJ45 Buchsen) ==========
    const frontGroup = new THREE.Group();
    frontGroup.position.z = -1.8;  // Direkt an der Rückseite anliegend

    // Grauer Zentraleinsatz (wie im Foto)
    const frontPlateGeometry = new THREE.BoxGeometry(5.5, 3.5, 0.4);
    const frontPlateMaterial = new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.5,
        metalness: 0.1
    });
    const frontPlate = new THREE.Mesh(frontPlateGeometry, frontPlateMaterial);
    frontPlate.position.set(0, 0, -0.2);
    frontGroup.add(frontPlate);

    // L und R Beschriftungen (gespiegelt da Vorderseite)
    createFrontLabel(frontGroup, 'L', 1.8, 1.5, 0.05);
    createFrontLabel(frontGroup, 'R', -1.8, 1.5, 0.05);
    createFrontLabel(frontGroup, 'L', 1.8, -1.5, 0.05);
    createFrontLabel(frontGroup, 'R', -1.8, -1.5, 0.05);

    // RJ45 Buchsen (gespiegelt)
    createRJ45JackFront(frontGroup, 1.4, 0);   // Dose A (links von hinten = rechts von vorne)
    createRJ45JackFront(frontGroup, -1.4, 0);  // Dose B (rechts von hinten = links von vorne)

    // Metallrahmen auch für Vorderseite
    const frontFrameGeometry = new THREE.ExtrudeGeometry(frameShape, frameExtrudeSettings);
    const frontFrame = new THREE.Mesh(frontFrameGeometry, frameMaterial);
    frontFrame.position.z = -0.5;
    frontFrame.rotation.y = Math.PI;
    frontGroup.add(frontFrame);

    socketGroup.add(frontGroup);

    // ========== A/B Labels als separate Sprites (immer sichtbar) ==========
    createFloatingLabel(socketGroup, 'A', -2.2, 3.5, 1.2, '#4169E1');
    createFloatingLabel(socketGroup, 'B', 2.2, 3.5, 1.2, '#2E8B57');

    socketMesh = socketGroup;
    scene.add(socketGroup);
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

function createColorIndicator(parent, x, y, z, color1, color2) {
    // Legacy-Funktion - nicht mehr verwendet
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

function createEthernetCable(cableNum, x, y) {
    const cableGroup = new THREE.Group();
    cableGroup.position.set(x, y, 4);

    // Kabelmantel (orange - Verlegekabel)
    const cableGeometry = new THREE.CylinderGeometry(0.5, 0.5, 4, 16);
    const cableMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF8C00,  // Orange für Verlegekabel
        roughness: 0.5
    });
    const cable = new THREE.Mesh(cableGeometry, cableMaterial);
    cable.rotation.x = Math.PI / 2;
    cable.position.set(0, 0, 2);  // Kabel zeigt nach hinten (weg von Dose)
    cableGroup.add(cable);

    // Kabelende (wo Adern rauskommen)
    const cableEndGeometry = new THREE.CylinderGeometry(0.5, 0.35, 0.5, 16);
    const cableEnd = new THREE.Mesh(cableEndGeometry, cableMaterial);
    cableEnd.rotation.x = Math.PI / 2;
    cableEnd.position.set(0, 0, 0);
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
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture });
    const label = new THREE.Sprite(labelMaterial);
    label.position.set(0, 1.2, 2);
    label.scale.set(1.8, 0.9, 1);
    cableGroup.add(label);

    // Speichere Kabelende-Position für Drahtverbindungen
    cableGroup.userData.cableEndWorldPos = new THREE.Vector3(x, y, 4);

    // Abisolierte Kabeladern (fächerförmig nach vorne zur Dose)
    T568A_COLORS.forEach((core, index) => {
        const wireGeometry = new THREE.CylinderGeometry(0.06, 0.06, 2, 8);
        const wireMaterial = createWireMaterial(core);

        const wire = new THREE.Mesh(wireGeometry, wireMaterial);

        // Fächerförmige Anordnung nach vorne (zur Dose hin)
        const spreadX = ((index % 4) - 1.5) * 0.25;
        const spreadY = index < 4 ? 0.4 : -0.4;
        
        wire.rotation.x = Math.PI / 2;
        wire.position.set(spreadX, spreadY, -1);

        wire.userData = { coreId: core.id, cableNum: cableNum };
        cableGroup.add(wire);
    });

    cableMeshes[cableNum] = cableGroup;
    scene.add(cableGroup);
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

function setActiveCable(cableNum) {
    // Nur Kabel 1 ist spielbar - diese Funktion wird nicht mehr benötigt
    gameState.activeCable = 1;
}

function animateCameraTarget(targetX) {
    const startX = controls.target.x;
    const duration = 500;
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        controls.target.x = startX + (targetX - startX) * eased;

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    animate();
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
    const cablePos = cableGroup.position.clone();
    const coreIndex = T568A_COLORS.findIndex(c => c.id === coreId);
    
    // Berechne die Aderposition am Kabelende
    const spreadX = ((coreIndex % 4) - 1.5) * 0.25;
    const spreadY = coreIndex < 4 ? 0.4 : -0.4;
    const startPos = new THREE.Vector3(
        cablePos.x + spreadX,
        cablePos.y + spreadY,
        cablePos.z - 2  // Vorderes Ende der abisolierten Adern
    );

    // Kontrollpunkte für schöne Kurve
    const midZ = (startPos.z + clipWorldPos.z) / 2 + 1;
    const midY = (startPos.y + clipWorldPos.y) / 2;
    
    const controlPoint1 = new THREE.Vector3(
        startPos.x,
        startPos.y,
        startPos.z - 1
    );
    
    const controlPoint2 = new THREE.Vector3(
        (startPos.x + clipWorldPos.x) / 2,
        midY + 0.5,
        midZ
    );

    const curve = new THREE.CatmullRomCurve3([
        startPos,
        controlPoint1,
        controlPoint2,
        new THREE.Vector3(clipWorldPos.x, clipWorldPos.y, clipWorldPos.z + 0.3)
    ]);

    const tubeGeometry = new THREE.TubeGeometry(curve, 48, 0.05, 8, false);
    const wireMaterial = createWireMaterial(core);

    const wire = new THREE.Mesh(tubeGeometry, wireMaterial);
    wire.castShadow = true;
    scene.add(wire);

    wireMeshes[cableNum].push(wire);
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

    overlay.textContent = message;
    overlay.style.background = type === 'success'
        ? 'rgba(34, 197, 94, 0.8)'
        : type === 'warning'
            ? 'rgba(245, 158, 11, 0.8)'
            : 'rgba(239, 68, 68, 0.8)';

    setTimeout(() => {
        overlay.innerHTML = '<p>🖱️ Linke Maustaste + Ziehen = Drehen | Scrollrad = Zoomen | Rechte Maustaste = Verschieben</p>';
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
}

function updateTimer() {
    if (!gameState.isStarted) return;

    gameState.elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(gameState.elapsedTime / 60).toString().padStart(2, '0');
    const seconds = (gameState.elapsedTime % 60).toString().padStart(2, '0');

    document.getElementById('timer-display').textContent = `${minutes}:${seconds}`;
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function checkSolution() {
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

    detailsEl.innerHTML = `
        <p>${message}</p>
        ${gameState.helpUsed > 0 ? `<p style="color: var(--warning-color);">Hilfe Stufe ${gameState.helpUsed} verwendet (-${gameState.helpUsed * 5} Punkte)</p>` : ''}
    `;

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
    } else {
        errorsEl.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

function resetGame() {
    // Timer stoppen
    stopTimer();

    // Spielzustand zurücksetzen
    gameState.isStarted = false;
    gameState.startTime = null;
    gameState.elapsedTime = 0;
    gameState.selectedCore = null;
    gameState.activeCable = 1;
    gameState.cables = {
        1: { assignments: {}, used: new Set() },
        2: { assignments: {}, used: new Set() }
    };

    // Timer Display zurücksetzen
    document.getElementById('timer-display').textContent = '00:00';

    // LSA-Clips zurücksetzen
    [1, 2].forEach(cableNum => {
        lsaClipMeshes[cableNum].forEach(clip => {
            clip.material.color = new THREE.Color(0x888888);
            clip.material.emissive = new THREE.Color(0x000000);
            clip.material.emissiveIntensity = 0;
            clip.userData.assigned = null;
        });

        // Drähte entfernen
        wireMeshes[cableNum].forEach(wire => {
            scene.remove(wire);
            wire.geometry.dispose();
            wire.material.dispose();
        });
        wireMeshes[cableNum] = [];
    });

    // UI zurücksetzen
    document.querySelectorAll('.socket-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.socket === '1');
    });

    updateCableCoresUI();
    updateProgress();

    // Check Button deaktivieren
    document.getElementById('check-btn').disabled = true;
    document.getElementById('check-btn').classList.remove('pulse');

    // Modals schließen
    document.getElementById('result-modal').classList.add('hidden');

    // Start Modal anzeigen
    document.getElementById('start-modal').classList.remove('hidden');
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
// Start
// ============================================

window.addEventListener('DOMContentLoaded', init);
