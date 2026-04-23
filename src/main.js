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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// ─── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080808);

// ─── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 10, 18);
camera.lookAt(0, 3, 0);

// ─── Lighting ────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xff8833, 0.6));
const keyLight = new THREE.DirectionalLight(0xfff0e0, 3.5);
keyLight.position.set(6, 14, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1; keyLight.shadow.camera.far = 80;
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -15;
keyLight.shadow.camera.right = keyLight.shadow.camera.top = 15;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xff5500, 2.5);
rimLight.position.set(-8, 6, -6); scene.add(rimLight);
const warmFill = new THREE.PointLight(0xff6600, 5.0, 25);
warmFill.position.set(3, 8, 3); scene.add(warmFill);
const coolBack = new THREE.DirectionalLight(0x223366, 0.8);
coolBack.position.set(0, -4, -10); scene.add(coolBack);

// ─── Ground ──────────────────────────────────────────────────────────────────
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.95, metalness: 0.05 })
);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(200, 100, 0xff6600, 0x1a1a1a);
grid.position.y = 0.002;
if (Array.isArray(grid.material)) {
    grid.material[0].opacity = 1;
    grid.material[1].opacity = 0.35; grid.material[1].transparent = true;
}
scene.add(grid);

// ─── Pivots ──────────────────────────────────────────────────────────────────
const rootGroup = new THREE.Group();
rootGroup.position.y = 2.545;
scene.add(rootGroup);

const turntablePivot = new THREE.Group();
turntablePivot.position.set(0, 0, 0);
rootGroup.add(turntablePivot);

const upperArmPivot = new THREE.Group();
upperArmPivot.position.set(0, 0, 0);
turntablePivot.add(upperArmPivot);

const foreArmPivot = new THREE.Group();
foreArmPivot.position.set(0, 0, 0);
upperArmPivot.add(foreArmPivot);

const wristPivot = new THREE.Group();
wristPivot.position.set(0, 4.130, 0);
foreArmPivot.add(wristPivot);

// ─── Joint Config ────────────────────────────────────────────────────────────
const joints = [
    { pivot: turntablePivot, axis: 'y', dragAxis: 'h', dragSign: -1, min: -Math.PI,   max: Math.PI,   label: 'Turntable' },
    { pivot: upperArmPivot,  axis: 'z', dragAxis: 'h', dragSign:  1, min: -Math.PI/2, max: Math.PI/3, label: 'Upper-Arm' },
    { pivot: foreArmPivot,   axis: 'z', dragAxis: 'h', dragSign:  1, min: -Math.PI/2, max: Math.PI/2, label: 'Fore-Arm'  },
    { pivot: wristPivot,     axis: 'z', dragAxis: 'h', dragSign:  1, min: -Math.PI/3, max: Math.PI/3, label: 'Wrist'     },
];

// ─── Loaders ─────────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
const draco  = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
loader.setDRACOLoader(draco);

const draggableMeshes = [];
let modelsLoaded = 0;
const TOTAL_MODELS = 4;

function applyMaterials(obj) {
    obj.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
            if (m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) {
                m.roughness = Math.min(m.roughness, 0.6);
                m.metalness = Math.max(m.metalness, 0.2);
                m.needsUpdate = true;
            }
        });
    });
}

function loadModel(path, parent, jointIndex, modelKey, meshYOffset) {
    loader.load(path, gltf => {
        gltf.scene.scale.set(50, 50, 50);
        gltf.scene.rotation.x = -Math.PI / 2;
        if (meshYOffset !== undefined) gltf.scene.position.y = meshYOffset;
        applyMaterials(gltf.scene);
        gltf.scene.traverse(o => {
            if (!o.isMesh || jointIndex === undefined) return;
            draggableMeshes.push({ mesh: o, joint: joints[jointIndex] });
        });
        parent.add(gltf.scene);
        const b = new THREE.Box3().setFromObject(gltf.scene);
        const c = b.getCenter(new THREE.Vector3());
        console.log(`[${modelKey}] center: ${c.x.toFixed(3)}, ${c.y.toFixed(3)}, ${c.z.toFixed(3)} | min.y: ${b.min.y.toFixed(3)} | max.y: ${b.max.y.toFixed(3)}`);
        if (++modelsLoaded === TOTAL_MODELS) autoFrame();
    }, undefined, err => console.error('Error loading', path, err));
}

loadModel('/models/base.gltf',      rootGroup,      undefined, 'base',      undefined);
loadModel('/models/turntable.gltf', turntablePivot, 0,         'turntable', 0);
loadModel('/models/arm.gltf',       upperArmPivot,  1,         'arm',       0);
loadModel('/models/joint.gltf',     foreArmPivot,   2,         'joint',     0);

// ─── Auto-frame ───────────────────────────────────────────────────────────────
function autoFrame() {
    const box = new THREE.Box3().setFromObject(rootGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    orbit.target.copy(center);
    orbit.radius = Math.max(size.x, size.y, size.z) * 1.1;
    orbit.phi = 0.38; orbit.theta = 0.6;
}

// ─── Raycaster ───────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
function getNDC(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((cx-r.left)/r.width)*2-1, ((cy-r.top)/r.height)*-2+1);
}
function pickJoint(cx, cy) {
    raycaster.setFromCamera(getNDC(cx,cy), camera);
    const hits = raycaster.intersectObjects(draggableMeshes.map(d=>d.mesh), true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj) { const e = draggableMeshes.find(d=>d.mesh===obj); if (e) return e.joint; obj=obj.parent; }
    return null;
}
function pickMesh(cx, cy) {
    raycaster.setFromCamera(getNDC(cx,cy), camera);
    const hits = raycaster.intersectObjects(draggableMeshes.map(d=>d.mesh), true);
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
        if (!m._origEm) m._origEm = m.emissive?.clone() ?? new THREE.Color(0);
        if (!m.emissive) m.emissive = new THREE.Color(0);
        m.emissive.copy(on ? ORANGE : m._origEm);
        m.emissiveIntensity = on ? 0.6 : 0;
    });
}

// ─── Orbit ───────────────────────────────────────────────────────────────────
const orbit = { theta:0.6, phi:0.38, radius:18, target:new THREE.Vector3(0,6,0), tV:0, pV:0 };
let isDragging=false, mode='orbit', activeJoint=null, lastX=0, lastY=0;
const DRAG_SPEED=0.007, JOINT_SPEED=0.0035, INERTIA=0.86, MIN_PHI=0.05, MAX_PHI=Math.PI/2-0.02;
canvas.style.cursor='grab';

canvas.addEventListener('mousedown', e => {
    isDragging=true; lastX=e.clientX; lastY=e.clientY; orbit.tV=orbit.pV=0;
    const joint=pickJoint(e.clientX,e.clientY);
    if (joint) { mode='joint'; activeJoint=joint; canvas.style.cursor='ew-resize'; showLabel(joint.label); }
    else        { mode='orbit'; activeJoint=null;  canvas.style.cursor='grabbing'; }
});
window.addEventListener('mouseup', () => {
    isDragging=false; activeJoint=null; mode='orbit';
    canvas.style.cursor=hoveredMesh?'pointer':'grab'; hideLabel();
});
window.addEventListener('mousemove', e => {
    if (!isDragging) {
        const m=pickMesh(e.clientX,e.clientY);
        if (m!==hoveredMesh) { highlight(hoveredMesh,false); hoveredMesh=m; highlight(hoveredMesh,true); }
        canvas.style.cursor=hoveredMesh?'pointer':'grab'; return;
    }
    applyDrag(e.clientX-lastX, e.clientY-lastY); lastX=e.clientX; lastY=e.clientY;
});
canvas.addEventListener('touchstart', e => {
    e.preventDefault(); isDragging=true; lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
    const joint=pickJoint(lastX,lastY);
    if (joint) { mode='joint'; activeJoint=joint; showLabel(joint.label); }
    else        { mode='orbit'; activeJoint=null; }
}, {passive:false});
window.addEventListener('touchend', () => { isDragging=false; activeJoint=null; mode='orbit'; hideLabel(); });
window.addEventListener('touchmove', e => {
    if (!isDragging) return; e.preventDefault();
    applyDrag(e.touches[0].clientX-lastX, e.touches[0].clientY-lastY);
    lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
}, {passive:false});
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    orbit.radius=THREE.MathUtils.clamp(orbit.radius+e.deltaY*0.015, 2, 80);
}, {passive:false});

function applyDrag(dx, dy) {
    if (mode==='joint' && activeJoint) {
        const raw=activeJoint.dragAxis==='h'?dx:-dy;
        const delta=raw*JOINT_SPEED*activeJoint.dragSign;
        activeJoint.pivot.rotation[activeJoint.axis]=THREE.MathUtils.clamp(
            activeJoint.pivot.rotation[activeJoint.axis]+delta, activeJoint.min, activeJoint.max);
        updateJointUI();
        sendJointAnglesToArduino();
    } else {
        orbit.tV=-dx*DRAG_SPEED; orbit.pV=-dy*DRAG_SPEED;
        orbit.theta+=orbit.tV; orbit.phi=THREE.MathUtils.clamp(orbit.phi+orbit.pV, MIN_PHI, MAX_PHI);
    }
}
function updateCamera() {
    if (!isDragging||mode==='joint') {
        orbit.tV*=INERTIA; orbit.pV*=INERTIA;
        orbit.theta+=orbit.tV; orbit.phi=THREE.MathUtils.clamp(orbit.phi+orbit.pV, MIN_PHI, MAX_PHI);
    }
    const {theta,phi,radius,target}=orbit;
    camera.position.set(
        target.x+radius*Math.cos(phi)*Math.sin(theta),
        target.y+radius*Math.sin(phi),
        target.z+radius*Math.cos(phi)*Math.cos(theta));
    camera.lookAt(target);
}

// ─── IK ──────────────────────────────────────────────────────────────────────
const L1=8.425, L2=4.130;
let ikTarget=null;
const ikMarker=new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8),new THREE.MeshBasicMaterial({color:0xff6600}));
scene.add(ikMarker); ikMarker.visible=false;

function solveIK(targetWorld) {
    const local=turntablePivot.worldToLocal(targetWorld.clone());
    const dx=Math.sqrt(local.x*local.x+local.z*local.z), dy=local.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    const reach=Math.min(dist,L1+L2-0.01);
    const nx=dx>0?(dx/dist)*reach:reach, ny=(dy/dist)*reach;
    const cosA=(L1*L1+reach*reach-L2*L2)/(2*L1*reach);
    const cosB=(L1*L1+L2*L2-reach*reach)/(2*L1*L2);
    const a1=Math.atan2(ny,nx)-Math.acos(THREE.MathUtils.clamp(cosA,-1,1));
    const a2=Math.PI-Math.acos(THREE.MathUtils.clamp(cosB,-1,1));
    joints[1].pivot.rotation[joints[1].axis]=THREE.MathUtils.clamp(-a1,joints[1].min,joints[1].max);
    joints[2].pivot.rotation[joints[2].axis]=THREE.MathUtils.clamp(-a2,joints[2].min,joints[2].max);
    updateJointUI();
}
canvas.addEventListener('click', e => {
    if (!e.shiftKey) return;
    raycaster.setFromCamera(getNDC(e.clientX,e.clientY), camera);
    const hit=new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit);
    if (hit) { ikTarget=hit; ikMarker.position.copy(hit); ikMarker.visible=true; solveIK(hit); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const MAX_SLOTS=3;
const animSlots=[null,null,null];
let activeSlot=0;
const anim={recording:false,playing:false,keyframes:[],startTime:0,playStart:0,duration:0,recordInterval:null,currentSlot:null};
const PRESETS={
    Wave:[{time:0,angles:[0,0,0,0]},{time:1.5,angles:[0,.5,0,.3]},{time:2,angles:[0,0,-.3,-.3]},{time:3.5,angles:[0,.5,0,.3]},{time:4,angles:[0,0,0,0]}],
    Sweep:[{time:0,angles:[0,.2,0,0]},{time:1,angles:[Math.PI,.2,0,0]},{time:2,angles:[0,.2,0,0]}],
    Salute:[{time:0,angles:[0,0,0,0]},{time:.8,angles:[0,.8,.5,.5]},{time:1.6,angles:[0,.8,.5,.5]},{time:2.4,angles:[0,0,0,0]}],
};
function getCurrentAngles(){return joints.map(j=>j.pivot.rotation[j.axis]);}
function startRecording(slotIdx){
    anim.keyframes=[];anim.recording=true;anim.currentSlot=slotIdx;
    anim.startTime=performance.now();anim.playing=false;
    clearInterval(anim.recordInterval);
    anim.recordInterval=setInterval(()=>{anim.keyframes.push({time:(performance.now()-anim.startTime)/1000,angles:getCurrentAngles()});},50);
    updateAnimUI();
}
function stopRecording(){
    clearInterval(anim.recordInterval);anim.recording=false;
    anim.duration=anim.keyframes.length>0?anim.keyframes[anim.keyframes.length-1].time:0;
    if(anim.currentSlot!==null&&anim.keyframes.length>1){
        animSlots[anim.currentSlot]={keyframes:[...anim.keyframes],duration:anim.duration,name:`Slot ${anim.currentSlot+1}`};
        saveAnimSlots();
    }
    updateAnimUI();updateSlotUI();
}
function playSlot(slotIdx,kfs,dur){
    if(!kfs||kfs.length<2)return;
    anim.playing=true;anim.keyframes=kfs;anim.duration=dur;anim.playStart=performance.now();anim.currentSlot=slotIdx;updateAnimUI();
}
function stopPlayback(){anim.playing=false;updateAnimUI();}
function playPreset(name){const kfs=PRESETS[name];if(!kfs)return;playSlot(null,kfs,kfs[kfs.length-1].time);}
function tickPlayback(){
    if(!anim.playing||anim.keyframes.length<2)return;
    const elapsed=((performance.now()-anim.playStart)/1000)%anim.duration;
    let lo=anim.keyframes[0],hi=anim.keyframes[anim.keyframes.length-1];
    for(let i=0;i<anim.keyframes.length-1;i++){
        if(anim.keyframes[i].time<=elapsed&&anim.keyframes[i+1].time>=elapsed){lo=anim.keyframes[i];hi=anim.keyframes[i+1];break;}
    }
    const span=hi.time-lo.time,t=span>0?(elapsed-lo.time)/span:0;
    joints.forEach((j,i)=>{j.pivot.rotation[j.axis]=lo.angles[i]+(hi.angles[i]-lo.angles[i])*t;});
    updateJointUI();
}
function saveAnimSlots(){try{localStorage.setItem('budx-anim-slots',JSON.stringify(animSlots));}catch(e){}}
function loadAnimSlots(){
    try{const saved=JSON.parse(localStorage.getItem('budx-anim-slots'));if(Array.isArray(saved))saved.forEach((s,i)=>{if(s)animSlots[i]=s;});}catch(e){}
    updateSlotUI();
}
window.animRecord=slotIdx=>{anim.recording?stopRecording():startRecording(slotIdx??activeSlot);};
window.animPlay=slotIdx=>{
    if(anim.playing){stopPlayback();return;}
    const idx=slotIdx??activeSlot;const slot=animSlots[idx];if(slot)playSlot(idx,slot.keyframes,slot.duration);
};
window.animReset=()=>{
    stopPlayback();stopRecording();joints.forEach(j=>{j.pivot.rotation[j.axis]=0;});anim.keyframes=[];anim.duration=0;updateJointUI();updateAnimUI();
};
window.playPreset=playPreset;
window.setActiveSlot=idx=>{activeSlot=idx;updateSlotUI();};
function updateAnimUI(){
    const recBtn=document.getElementById('anim-record');const playBtn=document.getElementById('anim-play');
    if(recBtn){recBtn.classList.toggle('active',anim.recording);recBtn.textContent=anim.recording?'⏹ Stop':'⏺ Record';}
    if(playBtn){playBtn.classList.toggle('active',anim.playing);playBtn.textContent=anim.playing?'⏹ Stop':'▶ Play';playBtn.disabled=!animSlots[activeSlot]&&!anim.playing;}
}
function updateSlotUI(){
    for(let i=0;i<MAX_SLOTS;i++){
        const btn=document.getElementById(`slot-${i}`);if(!btn)continue;
        btn.classList.toggle('has-data',!!animSlots[i]);btn.classList.toggle('active-slot',i===activeSlot);
        btn.textContent=animSlots[i]?`● Slot ${i+1}`:`○ Slot ${i+1}`;
    }
    updateAnimUI();
}

// ═══════════════════════════════════════════════════════════════════════════════
// XBOX CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════
let activeJointIndex=0;
const DEADZONE=0.12,GP_ORBIT=0.05,GP_JOINT=0.05,GP_ZOOM=0.3;
const gpPrev={rb:false,lb:false,a:false,y:false,x:false,start:false,p1:false,p2:false,p3:false};
function dead(v){return Math.abs(v)<DEADZONE?0:v;}
function pollGamepad(){
    const gps=navigator.getGamepads?navigator.getGamepads():[];
    for(const gp of gps){
        if(!gp)continue;
        const lx=dead(gp.axes[0]),ly=dead(gp.axes[1]),rx=dead(gp.axes[2]),ry=dead(gp.axes[3]);
        if(lx||ly){orbit.theta+=-lx*GP_ORBIT;orbit.phi=THREE.MathUtils.clamp(orbit.phi+ly*GP_ORBIT*0.6,MIN_PHI,MAX_PHI);}
        if(ry)orbit.radius=THREE.MathUtils.clamp(orbit.radius+ry*GP_ZOOM,2,80);
        if(rx){const j=joints[activeJointIndex];j.pivot.rotation[j.axis]=THREE.MathUtils.clamp(j.pivot.rotation[j.axis]+rx*GP_JOINT*j.dragSign,j.min,j.max);updateJointUI();showLabel(j.label);}else{hideLabel();}
        const rb=gp.buttons[5]?.pressed,lb=gp.buttons[4]?.pressed,a=gp.buttons[0]?.pressed,y=gp.buttons[3]?.pressed,x=gp.buttons[2]?.pressed,start=gp.buttons[9]?.pressed;
        const p1=gp.buttons[12]?.pressed,p2=gp.buttons[13]?.pressed,p3=gp.buttons[14]?.pressed;
        if(rb&&!gpPrev.rb){activeJointIndex=(activeJointIndex+1)%joints.length;showLabel(joints[activeJointIndex].label);updateControllerUI();}
        if(lb&&!gpPrev.lb){activeJointIndex=(activeJointIndex-1+joints.length)%joints.length;showLabel(joints[activeJointIndex].label);updateControllerUI();}
        if(a&&!gpPrev.a){joints.forEach(j=>{j.pivot.rotation[j.axis]=0;});updateJointUI();}
        if(y&&!gpPrev.y)autoFrame();
        if(x&&!gpPrev.x){anim.playing?stopPlayback():window.animPlay();}
        if(start&&!gpPrev.start){anim.recording?stopRecording():startRecording(activeSlot);}
        if(p1&&!gpPrev.p1)playPreset('Wave');
        if(p2&&!gpPrev.p2)playPreset('Sweep');
        if(p3&&!gpPrev.p3)playPreset('Salute');
        gpPrev.rb=rb;gpPrev.lb=lb;gpPrev.a=a;gpPrev.y=y;gpPrev.x=x;gpPrev.start=start;gpPrev.p1=p1;gpPrev.p2=p2;gpPrev.p3=p3;
        break;
    }
}
window.addEventListener('gamepadconnected',e=>{setControllerStatus('xbox',true,e.gamepad.id);updateControllerUI();});
window.addEventListener('gamepaddisconnected',()=>{setControllerStatus('xbox',false);});

// ═══════════════════════════════════════════════════════════════════════════════
// ARDUINO Web Serial
// ═══════════════════════════════════════════════════════════════════════════════
let serialPort=null,serialReader=null,serialBuffer='';
window.connectArduino=async()=>{
    if(serialPort){await disconnectArduino();return;}
    if(!('serial' in navigator)){alert('Web Serial not supported.\nUse Chrome or Edge on localhost/HTTPS.');return;}
    try{
        serialPort=await navigator.serial.requestPort();
        await serialPort.open({baudRate:115200});
        setControllerStatus('arduino',true,'Serial connected');
        document.getElementById('arduino-btn').textContent='⬡ Disconnect Arduino';
        readSerial();
    }catch(err){console.error('Serial connect failed:',err);setControllerStatus('arduino',false);}
};
async function disconnectArduino(){
    try{if(serialReader){await serialReader.cancel();serialReader=null;}if(serialPort){await serialPort.close();serialPort=null;}}catch(e){}
    setControllerStatus('arduino',false);
    const btn=document.getElementById('arduino-btn');if(btn)btn.textContent='⬡ Connect Arduino';
}
async function readSerial(){
    try{
        const dec=new TextDecoderStream();serialPort.readable.pipeTo(dec.writable);
        serialReader=dec.readable.getReader();
        while(true){const{value,done}=await serialReader.read();if(done)break;
            serialBuffer+=value;const lines=serialBuffer.split('\n');serialBuffer=lines.pop();lines.forEach(parseSerialLine);}
    }catch(e){console.warn('Serial ended:',e);disconnectArduino();}
}
let lastBrowserSend=0;
function sendJointAnglesToArduino(){
    if(!serialPort||!serialPort.writable)return;
    const parts=joints.map((j,i)=>{const t=(j.pivot.rotation[j.axis]-j.min)/(j.max-j.min);return `S${i}:${Math.round(t*180)}`;});
    try{const w=serialPort.writable.getWriter();w.write(new TextEncoder().encode(parts.join(',')+'\n'));w.releaseLock();lastBrowserSend=performance.now();}catch(e){}
}
function parseSerialLine(line){
    line=line.trim();if(!line)return;
    if(line.startsWith('P')){
        if(performance.now()-lastBrowserSend<500)return;
        line.split(',').forEach(chunk=>{
            const[key,val]=chunk.split(':');if(!key||val===undefined)return;
            const idx=parseInt(key.replace('P','')),deg=parseInt(val);
            if(isNaN(idx)||isNaN(deg)||idx>=joints.length)return;
            const j=joints[idx];j.pivot.rotation[j.axis]=j.min+(deg/180)*(j.max-j.min);
        });updateJointUI();
    }
    if(line.startsWith('DX')||line.startsWith('DY')){
        line.split(',').forEach(chunk=>{
            const[key,val]=chunk.split(':');if(!key||val===undefined)return;
            const v=parseFloat(val)*0.001;
            if(key==='DX')orbit.theta+=-v;
            if(key==='DY')orbit.phi=THREE.MathUtils.clamp(orbit.phi+v,MIN_PHI,MAX_PHI);
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HAND TRACKING — MediaPipe Hands + Face Detection
// ═══════════════════════════════════════════════════════════════════════════════
//
// MIRROR STRATEGY
// ───────────────
// The <video> element is CSS-flipped (transform:scaleX(-1)) so it looks like a
// selfie mirror to the user. The <canvas> is NOT CSS-flipped. Instead, when we
// draw landmarks we flip the X coordinate ourselves:  drawX = (1 - lm.x) * W
// This makes the skeleton overlay land exactly on top of the mirrored video.
//
// For joint mapping we also use the un-flipped lm.x so that:
//   hand physically on RIGHT side of frame → robot turntable turns RIGHT
//   (lm.x is 0=left edge of raw camera, 1=right edge of raw camera)
//
// FACE BLUR
// ─────────
// MediaPipe FaceDetection runs in parallel on the same video element.
// When a face bbox is returned we use ctx.filter='blur(Npx)' to paint a
// blurred rectangle over that region on the canvas, layered above the skeleton.

let htEnabled   = false;
let htSmoothing = true;
let htFaceBlur  = false;

let mpHands      = null;
let mpFace       = null;
let htMpCamera   = null;

// Latest face bbox in normalised coords {x,y,w,h}, updated by face callback
let latestFaceBbox = null;

const htSmoothed = [0, 0, 0, 0];
const HT_LERP    = 0.10;

const htVideoEl  = document.getElementById('ht-video');
const htCanvasEl = document.getElementById('ht-canvas');
const htCtx      = htCanvasEl ? htCanvasEl.getContext('2d') : null;
const htStatusEl = document.getElementById('ht-status');

// ── Preview resize ────────────────────────────────────────────────────────────
// Drag the bottom-right handle to resize the preview box.
// The panel width tracks the preview width + padding.
const htPreviewEl = document.getElementById('ht-preview');
const htPanelEl   = document.getElementById('cam-panel');
const htResizeEl  = document.getElementById('ht-resize-handle');

const HT_MIN_W = 140, HT_MAX_W = 520;
const HT_MIN_H = 80,  HT_MAX_H = 400;
let htResizing = false, htResizeStartX = 0, htResizeStartY = 0, htResizeStartW = 228, htResizeStartH = 128;

htResizeEl.addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    htResizing = true;
    htResizeStartX = e.clientX; htResizeStartY = e.clientY;
    htResizeStartW = htPreviewEl.offsetWidth;
    htResizeStartH = htPreviewEl.offsetHeight;
    document.body.style.cursor = 'nwse-resize';
});
window.addEventListener('mousemove', e => {
    if (!htResizing) return;
    const newW = Math.max(HT_MIN_W, Math.min(HT_MAX_W, htResizeStartW + (e.clientX - htResizeStartX)));
    const newH = Math.max(HT_MIN_H, Math.min(HT_MAX_H, htResizeStartH + (e.clientY - htResizeStartY)));
    htPreviewEl.style.width  = newW + 'px';
    htPreviewEl.style.height = newH + 'px';
    // Keep panel wide enough to hold the preview
    htPanelEl.style.width = (newW + 32) + 'px'; // 16px padding each side
});
window.addEventListener('mouseup', () => {
    if (!htResizing) return;
    htResizing = false;
    document.body.style.cursor = '';
});
// Touch resize
htResizeEl.addEventListener('touchstart', e => {
    e.preventDefault();
    htResizing = true;
    htResizeStartX = e.touches[0].clientX; htResizeStartY = e.touches[0].clientY;
    htResizeStartW = htPreviewEl.offsetWidth; htResizeStartH = htPreviewEl.offsetHeight;
}, {passive:false});
window.addEventListener('touchmove', e => {
    if (!htResizing) return;
    const newW = Math.max(HT_MIN_W, Math.min(HT_MAX_W, htResizeStartW + (e.touches[0].clientX - htResizeStartX)));
    const newH = Math.max(HT_MIN_H, Math.min(HT_MAX_H, htResizeStartH + (e.touches[0].clientY - htResizeStartY)));
    htPreviewEl.style.width  = newW + 'px';
    htPreviewEl.style.height = newH + 'px';
    htPanelEl.style.width = (newW + 32) + 'px';
}, {passive:false});
window.addEventListener('touchend', () => { htResizing = false; });

// ── Public toggles ────────────────────────────────────────────────────────────
window.toggleHandTracking = async () => htEnabled ? stopHandTracking() : await startHandTracking();
window.toggleHtSmoothing  = () => {
    htSmoothing = !htSmoothing;
    document.getElementById('ht-smooth-btn')?.classList.toggle('active', htSmoothing);
};
window.toggleFaceBlur = () => {
    htFaceBlur = !htFaceBlur;
    document.getElementById('ht-blur-btn')?.classList.toggle('active', htFaceBlur);
    if (!htFaceBlur) latestFaceBbox = null;
};

// ── Start / stop ──────────────────────────────────────────────────────────────
async function startHandTracking() {
    const btn = document.getElementById('ht-toggle-btn');
    if (btn) { btn.textContent = '… Loading'; btn.disabled = true; }
    if (htStatusEl) htStatusEl.textContent = 'LOADING…';

    try {
        if (!window.Hands) throw new Error('MediaPipe Hands not loaded');

        // Hands
        mpHands = new window.Hands({
            locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
        });
        mpHands.setOptions({ maxNumHands:1, modelComplexity:1, minDetectionConfidence:0.7, minTrackingConfidence:0.6 });
        mpHands.onResults(onHandResults);

        // Face Detection (lightweight, short-range model = faster)
        if (window.FaceDetection) {
            mpFace = new window.FaceDetection({
                locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${f}`
            });
            mpFace.setOptions({ model:'short', minDetectionConfidence:0.5 });
            mpFace.onResults(onFaceResults);
        }

        if (!window.Camera) throw new Error('MediaPipe Camera utils not loaded');

        htMpCamera = new window.Camera(htVideoEl, {
            onFrame: async () => {
                // Keep canvas resolution in sync with video
                if (htCanvasEl && htVideoEl.videoWidth) {
                    htCanvasEl.width  = htVideoEl.videoWidth;
                    htCanvasEl.height = htVideoEl.videoHeight;
                }
                await mpHands.send({ image: htVideoEl });
                if (mpFace && htFaceBlur) await mpFace.send({ image: htVideoEl });
            },
            width: 640, height: 360
        });
        await htMpCamera.start();

        htEnabled = true;
        if (btn) { btn.textContent = '◎ Disable'; btn.disabled = false; btn.classList.add('active'); }
        if (htStatusEl) htStatusEl.textContent = 'DETECTING…';
    } catch (err) {
        console.error('Hand tracking failed:', err);
        if (btn)      { btn.textContent = '◎ Enable'; btn.disabled = false; }
        if (htStatusEl) htStatusEl.textContent = 'ERROR';
        htEnabled = false;
    }
}

function stopHandTracking() {
    if (htMpCamera) { try { htMpCamera.stop(); } catch(e){} htMpCamera = null; }
    if (mpHands)    { try { mpHands.close();   } catch(e){} mpHands    = null; }
    if (mpFace)     { try { mpFace.close();    } catch(e){} mpFace     = null; }
    htEnabled = false; latestFaceBbox = null;
    const btn = document.getElementById('ht-toggle-btn');
    if (btn) { btn.textContent = '◎ Enable'; btn.classList.remove('active'); }
    if (htStatusEl) htStatusEl.textContent = 'CAMERA OFF';
    if (htCtx && htCanvasEl) htCtx.clearRect(0, 0, htCanvasEl.width, htCanvasEl.height);
}

// ── Face detection callback ───────────────────────────────────────────────────
function onFaceResults(results) {
    if (!results.detections || results.detections.length === 0) {
        latestFaceBbox = null; return;
    }
    // Use first detected face
    const box = results.detections[0].boundingBox;
    // box has xCenter, yCenter, width, height all normalised 0..1
    latestFaceBbox = {
        x: box.xCenter - box.width  / 2,
        y: box.yCenter - box.height / 2,
        w: box.width,
        h: box.height,
    };
}

// ── Draw face blur on canvas ──────────────────────────────────────────────────
// We draw the blurred patch by:
// 1. Saving canvas state
// 2. Applying ctx.filter = 'blur(Npx)'
// 3. Drawing a scaled copy of the video frame clipped to the face bbox
//    (we draw the full video frame but clip the context to the bbox rect first)
// 4. Restoring state
// Because the video is CSS-mirrored, the face bbox x must also be mirrored.
function drawFaceBlur(W, H) {
    if (!latestFaceBbox || !htFaceBlur) return;
    const { x, y, w, h } = latestFaceBbox;
    // Mirror the X to match the CSS-flipped video
    const mx = 1 - x - w;
    const px = mx * W, py = y * H, pw = w * W, ph = h * H;

    // Add generous padding so hair/chin are covered
    const pad = Math.max(pw, ph) * 0.18;
    const bx = Math.max(0, px - pad), by = Math.max(0, py - pad);
    const bw = Math.min(W - bx, pw + pad * 2), bh = Math.min(H - by, ph + pad * 2);

    htCtx.save();
    // Clip to face region
    htCtx.beginPath();
    htCtx.rect(bx, by, bw, bh);
    htCtx.clip();
    // Apply strong blur then draw the (mirrored) video frame into the clipped area
    htCtx.filter = 'blur(18px)';
    htCtx.translate(W, 0);
    htCtx.scale(-1, 1);             // mirror to match CSS-flipped video
    htCtx.drawImage(htVideoEl, 0, 0, W, H);
    htCtx.restore();                // also resets filter and transform

    // Optional: subtle dark overlay so it reads as censored, not glitchy
    htCtx.save();
    htCtx.beginPath();
    htCtx.rect(bx, by, bw, bh);
    htCtx.clip();
    htCtx.fillStyle = 'rgba(0,0,0,0.25)';
    htCtx.fillRect(bx, by, bw, bh);
    htCtx.restore();
}

// ── Hand landmark helpers ─────────────────────────────────────────────────────
function vec2(lm, i) { return { x: lm[i].x, y: lm[i].y }; }
function angle2D(a, b, c) {
    const ab={x:a.x-b.x,y:a.y-b.y}, cb={x:c.x-b.x,y:c.y-b.y};
    const dot=ab.x*cb.x+ab.y*cb.y;
    const mag=Math.sqrt((ab.x**2+ab.y**2)*(cb.x**2+cb.y**2));
    return mag>0?Math.acos(THREE.MathUtils.clamp(dot/mag,-1,1)):0;
}
function palmCenter(lm) {
    const pts=[0,5,9,13,17].map(i=>lm[i]);
    return {x:pts.reduce((s,p)=>s+p.x,0)/pts.length, y:pts.reduce((s,p)=>s+p.y,0)/pts.length};
}

// ── Hand results callback ─────────────────────────────────────────────────────
function onHandResults(results) {
    if (!htCtx || !htCanvasEl) return;
    const W = htCanvasEl.width, H = htCanvasEl.height;

    htCtx.clearRect(0, 0, W, H);

    // Always draw face blur first (below skeleton)
    if (htFaceBlur && latestFaceBbox) drawFaceBlur(W, H);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        if (htStatusEl) htStatusEl.textContent = 'NO HAND';
        return;
    }
    if (htStatusEl) htStatusEl.textContent = 'TRACKING';

    const lm = results.multiHandLandmarks[0];

    // ── Draw skeleton ────────────────────────────────────────────────────────
    // lm[i].x is 0=left edge of RAW camera frame, 1=right edge.
    // We draw at (1 - lm.x) * W so the skeleton matches the CSS-mirrored video.
    const lx = i => (1 - lm[i].x) * W;   // mirrored X
    const ly = i => lm[i].y * H;           // Y unchanged

    const connections=[
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [0,9],[9,10],[10,11],[11,12],
        [0,13],[13,14],[14,15],[15,16],
        [0,17],[17,18],[18,19],[19,20],
        [5,9],[9,13],[13,17],
    ];
    htCtx.strokeStyle='rgba(255,102,0,0.75)';
    htCtx.lineWidth=1.5;
    connections.forEach(([a,b])=>{
        htCtx.beginPath();
        htCtx.moveTo(lx(a),ly(a));
        htCtx.lineTo(lx(b),ly(b));
        htCtx.stroke();
    });
    lm.forEach((_,i)=>{
        htCtx.beginPath();
        htCtx.arc(lx(i),ly(i),i===0?4:2.5,0,Math.PI*2);
        htCtx.fillStyle=i===0?'#ff6600':'rgba(255,136,51,0.85)';
        htCtx.fill();
    });

    // ── Compute joint targets ────────────────────────────────────────────────
    const palm = palmCenter(lm);

    // Turntable: palm X in RAW (un-mirrored) space.
    // lm.x=0 = left in raw = right in mirrored view = robot turns right
    // We want hand moving RIGHT in the mirrored view → turntable turns right.
    // In raw coords, right-of-frame = high lm.x, so we use lm.x directly
    // (no flip) so the physical motion "hand right → arm right" holds true
    // even though the video is visually mirrored.
    const rawTurntable = THREE.MathUtils.lerp(joints[0].min, joints[0].max, palm.x);

    // Upper-arm: palm Y (0=top, 1=bottom). Hand high → arm up
    const rawUpperArm = THREE.MathUtils.lerp(joints[1].max, joints[1].min, palm.y);

    // Fore-arm: wrist→middle-mcp tilt angle
    const wristVec = { x: lm[9].x - lm[0].x, y: lm[9].y - lm[0].y };
    const wristAngle = Math.atan2(wristVec.y, wristVec.x);
    const normWrist = (wristAngle + Math.PI) / (2 * Math.PI);
    const rawForeArm = THREE.MathUtils.lerp(joints[2].min, joints[2].max, normWrist);

    // Wrist joint: index finger curl at PIP joint
    const curlAngle = angle2D(vec2(lm,5), vec2(lm,6), vec2(lm,7));
    const normCurl = 1 - THREE.MathUtils.clamp((curlAngle - Math.PI/3) / (Math.PI * 0.6), 0, 1);
    const rawWrist = THREE.MathUtils.lerp(joints[3].min, joints[3].max, normCurl);

    const targets = [rawTurntable, rawUpperArm, rawForeArm, rawWrist];

    // ── Lerp & apply ─────────────────────────────────────────────────────────
    joints.forEach((j, i) => {
        htSmoothed[i] += (targets[i] - htSmoothed[i]) * (htSmoothing ? HT_LERP : 1);
        j.pivot.rotation[j.axis] = THREE.MathUtils.clamp(htSmoothed[i], j.min, j.max);
    });

    updateJointUI();
    sendJointAnglesToArduino();
}

// ─── Fullscreen ───────────────────────────────────────────────────────────────
window.toggleFullscreen=()=>{
    if(!document.fullscreenElement)document.getElementById('arm-container').requestFullscreen();
    else document.exitFullscreen();
};
document.addEventListener('fullscreenchange',()=>{
    const btn=document.getElementById('fullscreen-btn');
    if(btn)btn.textContent=document.fullscreenElement?'⊠':'⊡';
});

// ─── UI helpers ──────────────────────────────────────────────────────────────
function showLabel(text){const el=document.getElementById('joint-label');if(el){el.textContent='⬡ '+text.toUpperCase();el.style.opacity='1';}}
function hideLabel(){const el=document.getElementById('joint-label');if(el)el.style.opacity='0';}
function updateJointUI(){
    joints.forEach(j=>{const el=document.getElementById('jv-'+j.label);if(el)el.textContent=(j.pivot.rotation[j.axis]*180/Math.PI).toFixed(1)+'°';});
}
function setControllerStatus(type,connected,label=''){
    const el=document.getElementById(`ctrl-${type}`);if(!el)return;
    el.classList.toggle('connected',connected);
    const lbl=el.querySelector('.ctrl-label');if(lbl)lbl.textContent=connected?label.substring(0,28):(type==='xbox'?'No controller':'Not connected');
}
function updateControllerUI(){
    const el=document.getElementById('ctrl-joint-name');if(el)el.textContent=joints[activeJointIndex].label.toUpperCase();
    joints.forEach((j,i)=>{const row=document.getElementById('row-'+j.label);if(row)row.classList.toggle('active-joint',i===activeJointIndex);});
}

// ─── Render loop ─────────────────────────────────────────────────────────────
loadAnimSlots();

(function animate(){
    requestAnimationFrame(animate);
    pollGamepad(); tickPlayback(); updateCamera();
    renderer.render(scene, camera);
})();

window.addEventListener('resize',()=>{
    renderer.setSize(window.innerWidth,window.innerHeight);
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
});