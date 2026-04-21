import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const canvas = document.getElementById('arm-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.Fog(0x0a0a0a, 35, 80);

// Root container rotated to stand upright
const rootGroup = new THREE.Group();
rootGroup.rotation.x = -Math.PI / 2;
scene.add(rootGroup);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(12, 12, 16);
camera.lookAt(0, 0, 0);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(10, 10, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// Cool Grid Floor
const grid = new THREE.GridHelper(60, 60, 0xff6600, 0x1c1c1c);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 })
);
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// Hierarchy
const turntable = new THREE.Group(); rootGroup.add(turntable);
const upperArmPivot = new THREE.Group(); turntable.add(upperArmPivot);
const foreArmPivot = new THREE.Group(); upperArmPivot.add(foreArmPivot);
const wristPivot = new THREE.Group(); foreArmPivot.add(wristPivot);

const joints = [
    { pivot: turntable, axis: 'z', min: -Math.PI, max: Math.PI, label: 'Turntable' }, // Changed to Z for upright rotation
    { pivot: upperArmPivot, axis: 'x', min: -Math.PI/2, max: Math.PI/3, label: 'Upper-Arm' },
    { pivot: foreArmPivot, axis: 'x', min: -Math.PI/2, max: Math.PI/2, label: 'Fore-Arm' },
    { pivot: wristPivot, axis: 'x', min: -Math.PI/3, max: Math.PI/3, label: 'Wrist' },
];

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
loader.setDRACOLoader(draco);

const draggableMeshes = [];

function loadModel(path, parent, jointIndex) {
    loader.load(path, gltf => {
        gltf.scene.scale.set(50, 50, 50);
        gltf.scene.traverse(o => {
            if (!o.isMesh) return;
            o.castShadow = o.receiveShadow = true;
            if (jointIndex !== undefined) draggableMeshes.push({ mesh: o, joint: joints[jointIndex] });
        });
        parent.add(gltf.scene);
    });
}

loadModel('/models/base.gltf', rootGroup);
loadModel('/models/turntable.gltf', turntable, 0);
loadModel('/models/arm.gltf', upperArmPivot, 1);
loadModel('/models/joint.gltf', wristPivot, 3);

// Interaction Logic
let isDragging = false, lastX = 0, lastY = 0, activeJoint = null;
const raycaster = new THREE.Raycaster();

function getNDC(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, ((cy - r.top) / r.height) * -2 + 1);
}

canvas.addEventListener('mousedown', e => {
    isDragging = true;
    lastX = e.clientX; lastY = e.clientY;
    raycaster.setFromCamera(getNDC(e.clientX, e.clientY), camera);
    const hits = raycaster.intersectObjects(draggableMeshes.map(d => d.mesh), true);
    if (hits.length) {
        let obj = hits.object;
        while (obj && !obj.userData.joint) {
            const found = draggableMeshes.find(d => d.mesh === obj);
            if (found) { activeJoint = found.joint; break; }
            obj = obj.parent;
        }
    }
});

window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (activeJoint) {
        const delta = (activeJoint.axis === 'z' ? dx : -dy) * 0.01;
        activeJoint.pivot.rotation[activeJoint.axis] = THREE.MathUtils.clamp(
            activeJoint.pivot.rotation[activeJoint.axis] + delta, activeJoint.min, activeJoint.max
        );
    } else {
        rootGroup.rotation.z += dx * 0.01;
    }
    lastX = e.clientX; lastY = e.clientY;
});

window.addEventListener('mouseup', () => { isDragging = false; activeJoint = null; });

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();