/* global gsap */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * 🌟 外部持久化存储
 */
const BUILD_PERSISTENT_STATE = {
    cubePositions: [] 
};

export class BuildMode {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.cubes = [];
        this.axesGroup = null;
        this.isRunning = true;
        this.mouseDownPos = new THREE.Vector2();
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        
        this.ctxs = {
            front: document.getElementById('canvas-front').getContext('2d'),
            left: document.getElementById('canvas-left').getContext('2d'),
            top: document.getElementById('canvas-top').getContext('2d')
        };

        this.initScene();
        this.initLights();
        this.initBasePlane();
        this.initControls();
        this.initGhostCube();
        this.bindButtons();
        this.setupEvents(); 
        this.injectInstructionContent();

        // 🌟 核心修改：初始化时立即绘制常驻空网格
        this.drawEmptyGrids();

        this.restoreFromPersistentState();

        this.animate();

        // 🌟 整合修改：监听窗口缩放，确保拖动 Electron 窗口时文字标注层实时重算位置
        this._onResizeHandler = () => this.onWindowResize();
        window.addEventListener('resize', this._onResizeHandler);

        // 🌟 整合修改：增加微小延迟执行 resize，确保 Electron 启动后文字层和 3D 层对齐
        setTimeout(() => this.onWindowResize(), 100);
    }

    // 🌟 修改点：将网格线颜色改为更明显的深色/黑色
    drawEmptyGrids() {
        ['front', 'left', 'top'].forEach(type => {
            const canvas = document.getElementById(`canvas-${type}`);
            const ctx = this.ctxs[type];
            if (!canvas || !ctx) return;
            canvas.width = 180;
            canvas.height = 180;
            ctx.clearRect(0, 0, 180, 180);
            ctx.beginPath();
            ctx.strokeStyle = "#333333"; // 修改为明显的深灰色
            ctx.lineWidth = 1;
            for (let i = 0; i <= 12; i++) {
                let p = i * 15;
                ctx.moveTo(p, 0); ctx.lineTo(p, 180);
                ctx.moveTo(0, p); ctx.lineTo(180, p);
            }
            ctx.stroke();
        });
    }

    restoreFromPersistentState() {
        if (BUILD_PERSISTENT_STATE.cubePositions.length > 0) {
            BUILD_PERSISTENT_STATE.cubePositions.forEach(pos => {
                this.createCubeAt(pos, false); 
            });
            this.switchView('reset');
        }
    }

    injectInstructionContent() {
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
            modalContent.innerHTML = `
    <div style="text-align:center; padding:10px;">
        <h2 style="color:#2E7D32; margin:0 0 20px 0; font-size:22px;">📖 建模绘制模式指南</h2>
        <div style="display:grid; grid-template-columns:1fr; gap:12px; text-align:left; color:#5D4037;">
            
            <div style="background:#E8F5E9; padding:12px; border-radius:12px; border-left:6px solid #4CAF50; display:flex; align-items:center; gap:12px;">
                <div style="font-size:24px;">🧱</div>
                <div>
                    <strong style="font-size:16px;">添加积木</strong><br>
                    <span style="font-size:13px;">在 3D 场景内<b>点击左键</b>，在预览框位置生成积木。</span>
                </div>
            </div>

            <div style="background:#FFEBEE; padding:12px; border-radius:12px; border-left:6px solid #F44336; display:flex; align-items:center; gap:12px;">
                <div style="font-size:24px;">❌</div>
                <div>
                    <strong style="font-size:16px;">删除积木</strong><br>
                    <span style="font-size:13px;">鼠标<b>右键点击</b>目标积木，即可将其移除。</span>
                </div>
            </div>

            <div style="background:#E1F5FE; padding:12px; border-radius:12px; border-left:6px solid #03A9F4; display:flex; align-items:center; gap:12px;">
                <div style="font-size:24px;">🕹️</div>
                <div>
                    <strong style="font-size:16px;">旋转与平移</strong><br>
                    <span style="font-size:13px;"><b>左键长按拖拽</b>旋转视角；<b>中键(滚轮)按住</b>平移画面。</span>
                </div>
            </div>

            <div style="background:#F3E5F5; padding:12px; border-radius:12px; border-left:6px solid #9C27B0; display:flex; align-items:center; gap:12px;">
                <div style="font-size:24px;">🔍</div>
                <div>
                    <strong style="font-size:16px;">缩放视图</strong><br>
                    <span style="font-size:13px;">前后<b>滚动鼠标滚轮</b>，可以放大或缩小观察视图。</span>
                </div>
            </div>

            <div style="background:#FFF3E0; padding:12px; border-radius:12px; border-left:6px solid #FF9800; display:flex; align-items:center; gap:12px;">
                <div style="font-size:24px;">⚡</div>
                <div>
                    <strong style="font-size:16px;">快速生成</strong><br>
                    <span style="font-size:13px;">输入框输入 <code>长*宽*高</code> (如3*2*2)，点击按钮一键建模。</span>
                </div>
            </div>

        </div>
        <button id="close-modal" style="margin-top:20px; width:100%; padding:12px; background:#2E7D32; color:white; border:none; border-radius:25px; font-weight:bold; cursor:pointer; box-shadow:0 4px 0 #1B5E20; font-size:15px;">我知道了</button>
    </div>
`;
            const closeBtn = document.getElementById('close-modal');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    document.getElementById('instruction-modal').style.display = 'none';
                };
            }
        }
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: null
        };
    }

    updateFocusCenter() {
        if (this.cubes.length === 0 || !this.controls) {
            gsap.to(this.controls.target, { x: 0, y: 0, z: 0, duration: 0.5 });
            return;
        }
        const box = new THREE.Box3();
        this.cubes.forEach(c => box.expandByObject(c));
        const center = new THREE.Vector3();
        box.getCenter(center);

        gsap.to(this.controls.target, {
            x: center.x,
            y: center.y,
            z: center.z,
            duration: 0.5,
            onUpdate: () => this.controls && this.controls.update()
        });
    }

    initScene() { 
        this.scene = new THREE.Scene(); 
        this.scene.background = new THREE.Color(0xfdfbf7); 
        this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 10000); 
        this.camera.position.set(60, 50, 70); 
        this.renderer = new THREE.WebGLRenderer({ antialias: true }); 
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight); 
        this.renderer.setPixelRatio(window.devicePixelRatio); 
        this.container.appendChild(this.renderer.domElement); 
        this.labelRenderer = new CSS2DRenderer(); 
        this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight); 
        
        // 🌟 整合修改：强制文字容器层绝对定位并锁定 top/left，防止窗口缩放时产生位移偏差
        this.labelRenderer.domElement.style.position = 'absolute'; 
        this.labelRenderer.domElement.style.top = '0px'; 
        this.labelRenderer.domElement.style.left = '0px'; 
        this.labelRenderer.domElement.style.pointerEvents = 'none'; 
        this.container.appendChild(this.labelRenderer.domElement); 
    }

    initLights() { 
        // 🌟 提升环境光强度到 1.0，消除背光面的暗淡感
        const amb = new THREE.AmbientLight(0xffffff, 1.0); 
        this.scene.add(amb); 
        // 提升直射光强度
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.6); 
        dirLight.position.set(100, 200, 100); 
        this.scene.add(dirLight); 
    }

    initBasePlane() { 
        const geometry = new THREE.PlaneGeometry(2000, 2000); 
        const material = new THREE.MeshBasicMaterial({ visible: false }); 
        this.basePlane = new THREE.Mesh(geometry, material); 
        this.basePlane.rotation.x = -Math.PI / 2; 
        this.basePlane.name = "BASE_PLANE"; 
        this.scene.add(this.basePlane); 
    }

    initGhostCube() { 
        const geo = new THREE.BoxGeometry(10, 10, 10); 
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }); 
        this.ghostCube = new THREE.Mesh(geo, mat); 
        this.ghostCube.position.y = 5; 
        this.ghostCube.visible = false; 
        this.scene.add(this.ghostCube); 
    }

    bindButtons() { 
        const infoBtn = document.getElementById('info-btn-build'); 
        const modal = document.getElementById('instruction-modal'); 
        if (infoBtn && modal) { 
            infoBtn.onclick = () => { this.injectInstructionContent(); modal.style.display = 'flex'; }; 
        } 
        document.getElementById('clear-btn-build').onclick = () => this.resetSystem(); 
        document.getElementById('quick-gen-btn').onclick = () => this.handleQuickGen(); 
        document.getElementById('reset-view-btn-build').onclick = () => this.switchView('reset'); 
        document.querySelectorAll('.view-btn').forEach(btn => { 
            btn.onclick = (e) => {
                const type = e.target.getAttribute('data-view');
                this.switchView(type);
                // 🌟 核心修改：点击按钮时才触发该视口的 2D 投影绘制
                this.updateAdaptiveProjection(type);
            }; 
        }); 
    }

    setupEvents() { 
        // 🌟 引用固定化：确保 dispose 时能物理移除
        this._onMouseMove = (e) => { 
            if (!this.isRunning) return;
            const rect = this.container.getBoundingClientRect(); 
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; 
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1; 
            this.raycaster.setFromCamera(this.mouse, this.camera); 
            const intersects = this.raycaster.intersectObjects([...this.cubes, this.basePlane]); 
            
            if (intersects.length > 0 && e.buttons === 0) { 
                const intersect = intersects[0]; 
                this.ghostCube.visible = true; 
                
                // 🌟 防御性判断：解决 Cannot read properties of null (reading 'normal')
                if (intersect && intersect.object.name === "BASE_PLANE") { 
                    this.ghostCube.position.set(Math.round(intersect.point.x / 10) * 10, 5, Math.round(intersect.point.z / 10) * 10); 
                } else if (intersect && intersect.face) { 
                    this.ghostCube.position.copy(intersect.object.position).add(intersect.face.normal.clone().multiplyScalar(10)); 
                } 
            } else { 
                this.ghostCube.visible = false; 
            } 
        }; 

        this._onMouseDown = (e) => {
            if (!this.isRunning) return;
            this.mouseDownPos.set(e.clientX, e.clientY);
        };

        this._onMouseUp = (e) => { 
            if (!this.isRunning || e.target.closest('#ui-panel')) return; 
            const moveDist = Math.sqrt(Math.pow(e.clientX - this.mouseDownPos.x, 2) + Math.pow(e.clientY - this.mouseDownPos.y, 2)); 
            if (moveDist < 3) { 
                if (e.button === 0 && this.ghostCube.visible) { 
                    this.createCubeAt(this.ghostCube.position.clone()); 
                } else if (e.button === 2) { 
                    this.removeCube(); 
                } 
            } 
        }; 

        this.container.addEventListener('mousemove', this._onMouseMove); 
        this.container.addEventListener('mousedown', this._onMouseDown); 
        this.container.addEventListener('mouseup', this._onMouseUp); 
        this.container.addEventListener('contextmenu', (e) => e.preventDefault()); 
    }

    createCubeAt(pos, syncToPersistent = true) { 
        if (this.cubes.some(c => c.position.distanceTo(pos) < 1)) return; 
        const geo = new THREE.BoxGeometry(10, 10, 10); 
        // 🌟 颜色升级：大幅度提高 Hex 颜色的亮度，使其更加鲜艳
        const cube = new THREE.Mesh(geo, [
            new THREE.MeshLambertMaterial({ color: 0xff1e3c }), // 极鲜红 (正/后)
            new THREE.MeshLambertMaterial({ color: 0xff1e3c }), 
            new THREE.MeshLambertMaterial({ color: 0xffe600 }), // 亮明黄 (上/下)
            new THREE.MeshLambertMaterial({ color: 0xffe600 }), 
            new THREE.MeshLambertMaterial({ color: 0x00a8ff }), // 鲜亮蓝 (侧面)
            new THREE.MeshLambertMaterial({ color: 0x00a8ff })
        ]); 
        cube.position.copy(pos); 
        // 轮廓线保持纯黑，衬托亮度
        cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000 }))); 
        this.scene.add(cube); 
        this.cubes.push(cube); 

        if (syncToPersistent) {
            BUILD_PERSISTENT_STATE.cubePositions.push(pos.clone());
        }

        if (this.cubes.length === 1) this.initAxes(pos); 
        this.updateAxesScale(); 
        this.updateFocusCenter();
    }

    removeCube() { 
        this.raycaster.setFromCamera(this.mouse, this.camera); 
        const intersects = this.raycaster.intersectObjects(this.cubes); 
        if (intersects.length > 0) { 
            const obj = intersects[0].object; 
            const posToRemove = obj.position.clone();

            this.scene.remove(obj); 
            this.cubes = this.cubes.filter(c => c !== obj); 
            
            BUILD_PERSISTENT_STATE.cubePositions = BUILD_PERSISTENT_STATE.cubePositions.filter(
                p => p.distanceTo(posToRemove) > 0.1
            );

            if (this.cubes.length === 0) {
                this.resetSystem(); 
            } else {
                this.updateAxesScale(); 
                this.updateFocusCenter();
            }
        } 
    }

    resetSystem() { 
        this.cubes.forEach(c => this.scene.remove(c)); 
        this.cubes = []; 
        BUILD_PERSISTENT_STATE.cubePositions = []; 

        // 🌟 修改：重置时清空色块，但重绘明显的背景网格
        this.drawEmptyGrids();

        if (this.axesGroup) { 
            this.axesGroup.traverse((obj) => { 
                if (obj instanceof CSS2DObject) obj.element.remove(); 
            }); 
            this.scene.remove(this.axesGroup); 
            this.axesGroup = null; 
        } 
        this.switchView('reset'); 
    }

    switchView(type) { 
        const center = new THREE.Vector3(0, 0, 0); 
        if (this.cubes.length > 0) { 
            const box = new THREE.Box3(); 
            this.cubes.forEach(c => box.expandByObject(c)); 
            box.getCenter(center); 
        } 
        if (type === 'reset') { 
            gsap.to(this.camera.position, { x: 60, y: 50, z: 70, duration: 0.8 }); 
            gsap.to(this.controls.target, { x: center.x, y: center.y, z: center.z, duration: 0.8 }); 
            this.controls.enableDamping = true;
            this.controls.enableRotate = true; 
            gsap.to(this.camera, { fov: 45, duration: 0.8, onUpdate: () => this.camera.updateProjectionMatrix() }); 
        } else { 
            this.controls.enableRotate = false; 
            let tP = new THREE.Vector3(); 
            if (type === 'front') tP.set(center.x, center.y, center.z + 500); 
            else if (type === 'left') tP.set(center.x - 500, center.y, center.z); 
            else if (type === 'top') tP.set(center.x, center.y + 500, center.z); 
            gsap.to(this.camera, { fov: 5, duration: 0.8, onUpdate: () => this.camera.updateProjectionMatrix() }); 
            gsap.to(this.camera.position, { x: tP.x, y: tP.y, z: tP.z, duration: 0.8 }); 
            gsap.to(this.controls.target, { x: center.x, y: center.y, z: center.z, duration: 0.8 }); 
        } 
    }

    initAxes(centerPos) { 
        if (this.axesGroup) return; 
        this.axesGroup = new THREE.Group(); 
        this.axesGroup.position.copy(centerPos); 
        const axesData = [
            { axis: 'x', dir: new THREE.Vector3(1,0,0), color: 0xff4757, labels: ['右','左'] }, 
            { axis: 'y', dir: new THREE.Vector3(0,1,0), color: 0x2ed573, labels: ['上','下'] }, 
            { axis: 'z', dir: new THREE.Vector3(0,0,1), color: 0x1e90ff, labels: ['前','后'] }
        ]; 
        axesData.forEach(d => { 
            const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: d.color, dashSize: 3, gapSize: 2, transparent: true, opacity: 0.3 })); 
            line.userData = { dir: d.dir }; 
            this.axesGroup.add(line); 
            [1, -1].forEach((s, i) => { 
                const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 8), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.3 })); 
                cone.userData = { side: s, dir: d.dir, isCone: true }; 
                this.axesGroup.add(cone); 
                const div = document.createElement('div'); 
                div.className = 'axis-label'; 
                div.textContent = d.labels[i]; 
                div.style.color = d.axis === 'x' ? '#ff6b81' : (d.axis === 'y' ? '#2ed573' : '#1e90ff'); 
                const lab = new CSS2DObject(div); 
                lab.userData = { side: s, dir: d.dir, isLabel: true }; 
                
                // 🌟 整合修改：标注文字中心点对齐，确保旋转/拉伸时位置不漂移
                lab.center.set(0.5, 0.5); 
                
                this.axesGroup.add(lab); 
            }); 
        }); 
        this.scene.add(this.axesGroup); 
        this.updateAxesScale(); 
    }

    updateAxesScale() { 
        if (!this.axesGroup || this.cubes.length === 0) return; 
        const box = new THREE.Box3(); 
        this.cubes.forEach(c => box.expandByObject(c)); 
        const s = new THREE.Vector3(); 
        box.getSize(s); 
        const len = Math.max(80, Math.max(s.x, s.y, s.z) + 40); 
        this.axesGroup.children.forEach(o => { 
            const { side, dir, isCone, isLabel } = o.userData; 
            if (o instanceof THREE.Line) { 
                o.geometry.setFromPoints([dir.clone().multiplyScalar(-len), dir.clone().multiplyScalar(len)]); 
                o.computeLineDistances(); 
            } else if (isCone) o.position.copy(dir.clone().multiplyScalar(side * len)); 
            else if (isLabel) o.position.copy(dir.clone().multiplyScalar(side * (len + 8))); 
        }); 
    }

    refreshAllViews() {
        ['front', 'left', 'top'].forEach(type => this.updateAdaptiveProjection(type));
    }

    // 🌟 修改点：在此处也将网格线颜色改为明显的深灰色/黑色
    updateAdaptiveProjection(type) { 
        const canvas = document.getElementById(`canvas-${type}`);
        const ctx = this.ctxs[type]; 
        
        canvas.width = 180;
        canvas.height = 180;
        
        ctx.clearRect(0, 0, 180, 180); 
        
        const gC = 12; 
        const cS = 15; 
        
        ctx.beginPath(); 
        ctx.strokeStyle = "#333333"; // 修改为明显的深灰色
        ctx.lineWidth = 1; 
        for(let i = 0; i <= gC; i++) { 
            let p = i * cS; 
            ctx.moveTo(p, 0); ctx.lineTo(p, 180); 
            ctx.moveTo(0, p); ctx.lineTo(180, p); 
        } 
        ctx.stroke(); 

        if (this.cubes.length === 0) return; 

        // 🌟 2D 投影颜色同步提高亮度
        ctx.fillStyle = { front: "#00a8ff", left: "#ff1e3c", top: "#ffe600" }[type]; 
        ctx.strokeStyle = "#000000"; // 投影方块的轮廓线也改为纯黑
        ctx.lineWidth = 2;

        const drawn = new Set();

        this.cubes.forEach(cube => {
            const x = cube.position.x;
            const y = cube.position.y;
            const z = cube.position.z;

            let col, row;

            if (type === 'front') {
                col = Math.floor(x / 10 + 6); 
                row = 11 - Math.floor((y - 5) / 10); 
            } else if (type === 'left') {
                col = Math.floor(z / 10 + 6); 
                row = 11 - Math.floor((y - 5) / 10);
            } else if (type === 'top') {
                col = Math.floor(x / 10 + 6); 
                row = Math.floor(z / 10 + 6);
            }

            const key = `${col}-${row}`;
            if (!drawn.has(key) && col >= 0 && col < 12 && row >= 0 && row < 12) {
                ctx.fillRect(col * cS + 1, row * cS + 1, cS - 2, cS - 2);
                ctx.strokeRect(col * cS + 1, row * cS + 1, cS - 2, cS - 2);
                drawn.add(key);
            }
        }); 
    }

    handleQuickGen() { 
        const iS = document.getElementById('size-input').value; 
        const p = iS.split('*').map(n => parseInt(n.trim())); 
        if (p.length === 3 && !p.some(isNaN)) { 
            if (p[0] > 12 || p[1] > 12 || p[2] > 12) { alert("数量限12以内"); return; } 
            this.resetSystem(); 
            for (let x = 0; x < p[0]; x++) for (let z = 0; z < p[1]; z++) for (let y = 0; y < p[2]; y++) 
                this.createCubeAt(new THREE.Vector3((x - p[0] / 2 + 0.5) * 10, y * 10 + 5, (z - p[1] / 2 + 0.5) * 10)); 
            this.switchView('reset'); 
        } 
    }

    animate() { 
        if (!this.isRunning) return; 
        requestAnimationFrame(() => this.animate()); 
        if (this.controls) this.controls.update(); 
        
        // 🌟 整合修改：同步标注缩放比例，让文字标注随视口同步放大缩小
        if (this.axesGroup && this.camera) {
            const dist = this.camera.position.distanceTo(this.axesGroup.position);
            const relativeScale = 100 / dist; 
            this.axesGroup.children.forEach(obj => {
                if (obj.userData.isLabel) {
                    const finalScale = Math.max(0.5, Math.min(relativeScale, 3.0));
                    obj.scale.set(finalScale, finalScale, finalScale);
                }
            });
        }

        this.renderer.render(this.scene, this.camera); 
        if (this.labelRenderer) this.labelRenderer.render(this.scene, this.camera); 
    }

    onWindowResize() { 
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight; 
        this.camera.updateProjectionMatrix(); 
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight); 
        if (this.labelRenderer) this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    dispose() { 
        this.isRunning = false; 
        // 🌟 整合修改：销毁时移除窗口监听
        window.removeEventListener('resize', this._onResizeHandler);

        if (this._onMouseMove) this.container.removeEventListener('mousemove', this._onMouseMove); 
        if (this._onMouseDown) this.container.removeEventListener('mousedown', this._onMouseDown); 
        if (this._onMouseUp) this.container.removeEventListener('mouseup', this._onMouseUp); 
        gsap.killTweensOf(this.camera.position);
        if (this.controls) gsap.killTweensOf(this.controls.target);
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach(m => m.dispose());
                }
            });
            this.scene.clear();
        }
        if (this.renderer) { 
            this.renderer.setAnimationLoop(null);
            this.renderer.dispose(); 
            this.renderer.forceContextLoss(); 
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.remove(); 
            }
            this.renderer = null;
        } 
        if (this.labelRenderer) {
            if (this.labelRenderer.domElement && this.labelRenderer.domElement.parentNode) {
                this.labelRenderer.domElement.remove();
            }
            this.labelRenderer = null;
        }
    }
}