console.log("main.js is running!");

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ─── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('arm-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// ─── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080808);

// ─── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 10, 18);
camera.lookAt(0, 3, 0);

// ─── Lighting — rich, orange-accented ────────────────────────────────────────
// Warm ambient so model isn't gray
scene.add(new THREE.AmbientLight(0xff8833, 0.6));

// Strong top-front key light
const keyLight = new THREE.DirectionalLight(0xfff0e0, 3.5);
keyLight.position.set(6, 14, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far  = 80;
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -15;
keyLight.shadow.camera.right = keyLight.shadow.camera.top   =  15;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

// Orange rim light from behind-left
const rimLight = new THREE.DirectionalLight(0xff5500, 2.5);
rimLight.position.set(-8, 6, -6);
scene.add(rimLight);

// Orange point light near model for warm fill
const warmFill = new THREE.PointLight(0xff6600, 5.0, 25);
warmFill.position.set(3, 8, 3);
scene.add(warmFill);

// Subtle cool back fill to separate from bg
const coolBack = new THREE.DirectionalLight(0x223366, 0.8);
coolBack.position.set(0, -4, -10);
scene.add(coolBack);

// ─── Ground — extend further, better material ─────────────────────────────────
const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0d0d0d,
    roughness: 0.95,
    metalness: 0.05,
    envMapIntensity: 0.2,
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y  = 0;
ground.receiveShadow = true;
scene.add(ground);

// Grid — much larger, finer, orange lines extend far
const gridHelper = new THREE.GridHelper(200, 100, 0xff6600, 0x1a1a1a);
gridHelper.position.y = 0.002; // just above ground to avoid z-fight
// Make the center lines more visible
const gridMat = gridHelper.material;
if (Array.isArray(gridMat)) {
    gridMat[0].opacity = 1;   // center lines
    gridMat[1].opacity = 0.4; // other lines
    gridMat[1].transparent = true;
}
scene.add(gridHelper);

// ─── Joint Hierarchy ─────────────────────────────────────────────────────────
const rootGroup     = new THREE.Group(); scene.add(rootGroup);
const turntable     = new THREE.Group(); rootGroup.add(turntable);
const upperArmPivot = new THREE.Group(); turntable.add(upperArmPivot);
const foreArmPivot  = new THREE.Group(); upperArmPivot.add(foreArmPivot);
const wristPivot    = new THREE.Group(); foreArmPivot.add(wristPivot);

// ─── Joint Config ────────────────────────────────────────────────────────────
// axis: which axis the joint rotates on
// dragAxis: 'h' = horizontal drag, 'v' = vertical drag
// dragSign: flip direction
const joints = [
    { pivot: turntable,     axis: 'y', dragAxis: 'h', dragSign: -1, min: -Math.PI,   max: Math.PI,   label: 'Turntable' },
    { pivot: upperArmPivot, axis: 'z', dragAxis: 'h', dragSign:  1, min: -Math.PI/2, max: Math.PI/3, label: 'Upper-Arm' },
    { pivot: foreArmPivot,  axis: 'z', dragAxis: 'h', dragSign:  1, min: -Math.PI/2, max: Math.PI/2, label: 'Fore-Arm'  },
    { pivot: wristPivot,    axis: 'z', dragAxis: 'h', dragSign:  1, min: -Math.PI/3, max: Math.PI/3, label: 'Wrist'     },
];

// ─── Loaders ─────────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
const draco  = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
loader.setDRACOLoader(draco);

const draggableMeshes = [];
let modelsLoaded = 0;
const TOTAL_MODELS = 4;

function loadModel(path, parent, jointIndex) {
    loader.load(path, gltf => {
        console.log('Loaded:', path);
        gltf.scene.scale.set(50, 50, 50);
        // Rotate upright: -90° on X
        gltf.scene.rotation.x = -Math.PI / 2;

        gltf.scene.traverse(o => {
            if (!o.isMesh) return;
            o.castShadow = o.receiveShadow = true;

            // Boost material to look less gray/dull
            if (o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach(m => {
                    if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
                        m.roughness   = Math.min(m.roughness, 0.6);
                        m.metalness   = Math.max(m.metalness, 0.2);
                        m.envMapIntensity = 1.0;
                        m.needsUpdate = true;
                    }
                });
            }

            if (jointIndex !== undefined)
                draggableMeshes.push({ mesh: o, joint: joints[jointIndex] });
        });

        parent.add(gltf.scene);
        modelsLoaded++;
        if (modelsLoaded === TOTAL_MODELS) autoFrame();

    }, undefined, err => console.error('Error loading', path, err));
}

loadModel('/models/base.gltf',      rootGroup,     undefined);
loadModel('/models/turntable.gltf', turntable,     0);
loadModel('/models/arm.gltf',       upperArmPivot, 1);
loadModel('/models/joint.gltf',     wristPivot,    3);

// ─── Auto-frame ───────────────────────────────────────────────────────────────
function autoFrame() {
    const box = new THREE.Box3().setFromObject(rootGroup);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    console.log('bbox center:', center, 'size:', size);

    // Lift rootGroup so its bottom sits ON the ground (y=0)
    const bottomY = box.min.y;
    rootGroup.position.y -= bottomY; // shift up so min.y = 0

    // Re-measure after lift
    const box2   = new THREE.Box3().setFromObject(rootGroup);
    const center2 = box2.getCenter(new THREE.Vector3());

    orbit.target.copy(center2);
    orbit.target.y = center2.y; // look at model center height
    orbit.radius   = maxDim * 1.2; // tight zoom
    orbit.phi      = 0.42;

    console.log('Lifted by:', -bottomY, '| new center:', center2, '| radius:', orbit.radius);
}

// ─── Raycaster ───────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();

function getNDC(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(
        ((cx - r.left) / r.width)  *  2 - 1,
        ((cy - r.top)  / r.height) * -2 + 1
    );
}

function pickJoint(cx, cy) {
    raycaster.setFromCamera(getNDC(cx, cy), camera);
    const hits = raycaster.intersectObjects(draggableMeshes.map(d => d.mesh), true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj) {
        const e = draggableMeshes.find(d => d.mesh === obj);
        if (e) return e.joint;
        obj = obj.parent;
    }
    return null;
}

function pickMesh(cx, cy) {
    raycaster.setFromCamera(getNDC(cx, cy), camera);
    const hits = raycaster.intersectObjects(draggableMeshes.map(d => d.mesh), true);
    return hits.length ? hits[0].object : null;
}

// ─── Highlight ───────────────────────────────────────────────────────────────
let hoveredMesh = null;
const ORANGE = new THREE.Color(0xff6600);

function highlight(mesh, on) {
    if (!mesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(m => {
        if (!m) return;
        if (!m._origEm) m._origEm = m.emissive ? m.emissive.clone() : new THREE.Color(0);
        if (!m.emissive) m.emissive = new THREE.Color(0);
        m.emissive.copy(on ? ORANGE : m._origEm);
        m.emissiveIntensity = on ? 0.6 : 0;
    });
}

// ─── Orbit State ─────────────────────────────────────────────────────────────
const orbit = {
    theta: 0.6, phi: 0.42, radius: 18,
    target: new THREE.Vector3(0, 3, 0),
    tV: 0, pV: 0,
};

let isDragging  = false;
let mode        = 'orbit';
let activeJoint = null;
let lastX = 0, lastY = 0;

const DRAG_SPEED  = 0.007;
const JOINT_SPEED = 0.013;
const INERTIA     = 0.86;
const MIN_PHI     = 0.05;
const MAX_PHI     = Math.PI / 2 - 0.02;

canvas.style.cursor = 'grab';

// ─── Input ───────────────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', e => {
    isDragging = true;
    lastX = e.clientX; lastY = e.clientY;
    orbit.tV = orbit.pV = 0;
    const joint = pickJoint(e.clientX, e.clientY);
    if (joint) {
        mode = 'joint'; activeJoint = joint;
        canvas.style.cursor = 'ew-resize';
        showLabel(joint.label);
    } else {
        mode = 'orbit'; activeJoint = null;
        canvas.style.cursor = 'grabbing';
    }
});

window.addEventListener('mouseup', () => {
    isDragging = false; activeJoint = null; mode = 'orbit';
    canvas.style.cursor = hoveredMesh ? 'pointer' : 'grab';
    hideLabel();
});

window.addEventListener('mousemove', e => {
    if (!isDragging) {
        const m = pickMesh(e.clientX, e.clientY);
        if (m !== hoveredMesh) { highlight(hoveredMesh, false); hoveredMesh = m; highlight(hoveredMesh, true); }
        canvas.style.cursor = hoveredMesh ? 'pointer' : 'grab';
        return;
    }
    applyDrag(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
});

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    isDragging = true;
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    const joint = pickJoint(lastX, lastY);
    if (joint) { mode = 'joint'; activeJoint = joint; showLabel(joint.label); }
    else        { mode = 'orbit'; activeJoint = null; }
}, { passive: false });

window.addEventListener('touchend', () => { isDragging = false; activeJoint = null; mode = 'orbit'; hideLabel(); });

window.addEventListener('touchmove', e => {
    if (!isDragging) return;
    e.preventDefault();
    applyDrag(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY);
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
}, { passive: false });

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    orbit.radius = THREE.MathUtils.clamp(orbit.radius + e.deltaY * 0.015, 2, 80);
}, { passive: false });

// ─── Drag Handler ────────────────────────────────────────────────────────────
function applyDrag(dx, dy) {
    if (mode === 'joint' && activeJoint) {
        // All arm joints: horizontal drag = forward/back rotation (Z axis after -90x rotation)
        const raw   = activeJoint.dragAxis === 'h' ? dx : -dy;
        const delta = raw * JOINT_SPEED * activeJoint.dragSign;
        activeJoint.pivot.rotation[activeJoint.axis] = THREE.MathUtils.clamp(
            activeJoint.pivot.rotation[activeJoint.axis] + delta,
            activeJoint.min, activeJoint.max
        );
        updateJointUI();
    } else {
        orbit.tV = -dx * DRAG_SPEED;
        orbit.pV = -dy * DRAG_SPEED;
        orbit.theta += orbit.tV;
        orbit.phi = THREE.MathUtils.clamp(orbit.phi + orbit.pV, MIN_PHI, MAX_PHI);
    }
}

// ─── Camera ──────────────────────────────────────────────────────────────────
function updateCamera() {
    if (!isDragging || mode === 'joint') {
        orbit.tV *= INERTIA; orbit.pV *= INERTIA;
        orbit.theta += orbit.tV;
        orbit.phi = THREE.MathUtils.clamp(orbit.phi + orbit.pV, MIN_PHI, MAX_PHI);
    }
    const { theta, phi, radius, target } = orbit;
    camera.position.set(
        target.x + radius * Math.cos(phi) * Math.sin(theta),
        target.y + radius * Math.sin(phi),
        target.z + radius * Math.cos(phi) * Math.cos(theta)
    );
    camera.lookAt(target);
}

// ─── UI ──────────────────────────────────────────────────────────────────────
function showLabel(text) {
    const el = document.getElementById('joint-label');
    if (el) { el.textContent = '⬡ ' + text.toUpperCase(); el.style.opacity = '1'; }
}
function hideLabel() {
    const el = document.getElementById('joint-label');
    if (el) el.style.opacity = '0';
}
function updateJointUI() {
    joints.forEach(j => {
        const el = document.getElementById('jv-' + j.label);
        if (el) el.textContent = (j.pivot.rotation[j.axis] * 180 / Math.PI).toFixed(1) + '°';
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// XBOX CONTROLLER  (Gamepad API — works in all modern browsers)
// ─────────────────────────────────────────────────────────────────────────────
// Layout:
//   Left  stick  X/Y  → orbit camera (theta / phi)
//   Right stick  X    → rotate active joint
//   Right stick  Y    → zoom in/out
//   RB / LB           → cycle active joint forward / back
//   A button          → reset all joints to 0
//   Y button          → reset camera
// ═══════════════════════════════════════════════════════════════════════════════

let activeJointIndex = 0;   // which joint is selected for gamepad control
const DEADZONE        = 0.12;
const GP_ORBIT_SPEED  = 0.03;
const GP_JOINT_SPEED  = 0.025;
const GP_ZOOM_SPEED   = 0.18;

// Button state tracking to detect rising edges (press, not hold)
const gpPrev = { rb: false, lb: false, a: false, y: false };

function applyDeadzone(v) { return Math.abs(v) < DEADZONE ? 0 : v; }

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
        if (!gp) continue;

        // ── Sticks ──────────────────────────────────────────────────────────
        const lx = applyDeadzone(gp.axes[0]);  // left  stick X
        const ly = applyDeadzone(gp.axes[1]);  // left  stick Y
        const rx = applyDeadzone(gp.axes[2]);  // right stick X
        const ry = applyDeadzone(gp.axes[3]);  // right stick Y

        // Left stick → orbit
        if (lx !== 0 || ly !== 0) {
            orbit.theta += -lx * GP_ORBIT_SPEED;
            orbit.phi    = THREE.MathUtils.clamp(
                orbit.phi + ly * GP_ORBIT_SPEED * 0.6, MIN_PHI, MAX_PHI
            );
        }

        // Right stick Y → zoom
        if (ry !== 0) {
            orbit.radius = THREE.MathUtils.clamp(orbit.radius + ry * GP_ZOOM_SPEED, 2, 80);
        }

        // Right stick X → rotate selected joint
        if (rx !== 0) {
            const j = joints[activeJointIndex];
            j.pivot.rotation[j.axis] = THREE.MathUtils.clamp(
                j.pivot.rotation[j.axis] + rx * GP_JOINT_SPEED * j.dragSign,
                j.min, j.max
            );
            updateJointUI();
            showLabel(j.label);
        } else {
            hideLabel();
        }

        // ── Buttons ─────────────────────────────────────────────────────────
        const rb = gp.buttons[5]?.pressed;  // Right bumper
        const lb = gp.buttons[4]?.pressed;  // Left  bumper
        const a  = gp.buttons[0]?.pressed;  // A
        const y  = gp.buttons[3]?.pressed;  // Y

        // RB — next joint (rising edge)
        if (rb && !gpPrev.rb) {
            activeJointIndex = (activeJointIndex + 1) % joints.length;
            showLabel(joints[activeJointIndex].label);
            updateControllerUI();
        }
        // LB — prev joint
        if (lb && !gpPrev.lb) {
            activeJointIndex = (activeJointIndex - 1 + joints.length) % joints.length;
            showLabel(joints[activeJointIndex].label);
            updateControllerUI();
        }
        // A — reset all joints
        if (a && !gpPrev.a) {
            joints.forEach(j => { j.pivot.rotation[j.axis] = 0; });
            updateJointUI();
        }
        // Y — reset camera
        if (y && !gpPrev.y) {
            orbit.theta = 0.6; orbit.phi = 0.42;
            autoFrame();
        }

        gpPrev.rb = rb; gpPrev.lb = lb; gpPrev.a = a; gpPrev.y = y;
        break; // use first connected gamepad only
    }
}

window.addEventListener('gamepadconnected', e => {
    console.log('Gamepad connected:', e.gamepad.id);
    updateControllerUI();
    setControllerStatus('xbox', true, e.gamepad.id);
});
window.addEventListener('gamepaddisconnected', e => {
    console.log('Gamepad disconnected:', e.gamepad.id);
    setControllerStatus('xbox', false);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ARDUINO  (Web Serial API — Chrome / Edge only, requires HTTPS or localhost)
// ─────────────────────────────────────────────────────────────────────────────
// Expected Arduino serial format (115200 baud), one line per frame:
//   J0:512,J1:300,J2:700,J3:512\n
//   Where each value is a raw 0–1023 analog read mapped to joint angle.
//   OR send axis deltas:  DX:-12,DY:5\n  for camera orbit.
// ═══════════════════════════════════════════════════════════════════════════════

let serialPort   = null;
let serialReader = null;
let serialBuffer = '';

async function connectArduino() {
    if (!('serial' in navigator)) {
        alert('Web Serial not supported. Use Chrome or Edge.');
        return;
    }
    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });
        setControllerStatus('arduino', true, 'Serial connected');
        readSerial();
    } catch (err) {
        console.error('Serial connect failed:', err);
        setControllerStatus('arduino', false);
    }
}

async function disconnectArduino() {
    try {
        if (serialReader) { await serialReader.cancel(); serialReader = null; }
        if (serialPort)   { await serialPort.close();   serialPort   = null; }
        setControllerStatus('arduino', false);
    } catch(e) { console.error(e); }
}

async function readSerial() {
    const decoder = new TextDecoderStream();
    serialPort.readable.pipeTo(decoder.writable);
    serialReader = decoder.readable.getReader();
    try {
        while (true) {
            const { value, done } = await serialReader.read();
            if (done) break;
            serialBuffer += value;
            const lines = serialBuffer.split('\n');
            serialBuffer = lines.pop(); // keep incomplete line
            lines.forEach(parseSerialLine);
        }
    } catch (e) {
        console.warn('Serial read ended:', e);
    }
}

function parseSerialLine(line) {
    line = line.trim();
    if (!line) return;

    // Format: J0:512,J1:300,J2:700,J3:512
    if (line.startsWith('J')) {
        line.split(',').forEach(chunk => {
            const [key, val] = chunk.split(':');
            if (!key || val === undefined) return;
            const idx = parseInt(key.replace('J',''));
            const raw = parseInt(val);
            if (isNaN(idx) || isNaN(raw) || idx >= joints.length) return;
            const j = joints[idx];
            // Map 0–1023 → joint min..max
            j.pivot.rotation[j.axis] = j.min + (raw / 1023) * (j.max - j.min);
        });
        updateJointUI();
    }

    // Format: DX:-12,DY:5  (camera orbit deltas, scaled down)
    if (line.startsWith('DX') || line.startsWith('DY')) {
        line.split(',').forEach(chunk => {
            const [key, val] = chunk.split(':');
            if (!key || val === undefined) return;
            const v = parseFloat(val) * 0.001;
            if (key === 'DX') orbit.theta += -v;
            if (key === 'DY') orbit.phi = THREE.MathUtils.clamp(orbit.phi + v, MIN_PHI, MAX_PHI);
        });
    }
}

// ─── Controller UI helpers ────────────────────────────────────────────────────
function setControllerStatus(type, connected, label = '') {
    const el = document.getElementById(`ctrl-${type}`);
    if (!el) return;
    el.classList.toggle('connected', connected);
    const lbl = el.querySelector('.ctrl-label');
    if (lbl) lbl.textContent = connected ? label.substring(0, 28) : (type === 'xbox' ? 'No controller' : 'Not connected');
}

function updateControllerUI() {
    const el = document.getElementById('ctrl-joint-name');
    if (el) el.textContent = joints[activeJointIndex].label.toUpperCase();
    // Highlight active joint row
    joints.forEach((j, i) => {
        const row = document.getElementById('jv-' + j.label)?.closest('.joint-row');
        if (row) row.classList.toggle('active-joint', i === activeJointIndex);
    });
}

// ─── Render Loop ─────────────────────────────────────────────────────────────
(function animate() {
    requestAnimationFrame(animate);
    pollGamepad();
    updateCamera();
    renderer.render(scene, camera);
})();

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});