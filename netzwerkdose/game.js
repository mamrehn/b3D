// ============================================
// Netzwerkdose Belegung - Interaktives Lernspiel
// T568A Standard für RJ45 Doppeldose
// Realistische LSA-Klemmen Ansicht (Rückseite)
// ============================================

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
    helpUsed: 0
};

// Three.js Variablen
let scene, camera, renderer, controls;
let socketMesh = null;
let lsaClipMeshes = { 1: [], 2: [] };  // LSA-Klemmen für beide Dosen
let wireMeshes = { 1: [], 2: [] };
let cableMeshes = { 1: null, 2: null };
let raycaster, mouse;

// ============================================
// Initialisierung
// ============================================

function init() {
    initThreeJS();
    initUI();
    initEventListeners();
    createScene();
    animate();
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
}

function initEventListeners() {
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
    if (!gameState.isStarted || !gameState.selectedCore) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

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
    const cable1Count = gameState.cables[1].used.size;

    document.getElementById('socket1-progress').textContent = `${cable1Count}/8`;
    document.getElementById('socket2-progress').textContent = `8/8 ✓`;

    // Check-Button aktivieren wenn Kabel 1 vollständig verlegt
    const checkBtn = document.getElementById('check-btn');
    checkBtn.disabled = !(cable1Count === 8);

    if (cable1Count === 8) {
        checkBtn.classList.add('pulse');
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
// Start
// ============================================

window.addEventListener('DOMContentLoaded', init);
