import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const INF_PERSISTENT_STATE = {
    grids: {
        front: Array(8).fill().map(() => Array(8).fill(false)),
        left: Array(8).fill().map(() => Array(8).fill(false)),
        top: Array(8).fill().map(() => Array(8).fill(false))
    },
    hasGenerated: false,
    currentAlgo: 'max'
};

export class InferenceMode {
    constructor() {
        this.container = document.getElementById('canvas-container');
        if (!this.container) return;

        this.isRunning = true;
        this.grids = INF_PERSISTENT_STATE.grids;
        this.currentAlgo = INF_PERSISTENT_STATE.currentAlgo;
        
        // 🌟 用于记录用户手绘的原始快照
        this.userInputSnapshot = null; 

        this.cubes = [];
        this.walls = []; // 🌟 用于存储投影墙
        this.mainGroup = new THREE.Group();
        
        this.initThree();
        this.initCanvasInteractions();
        this.bindActionButtons();

        setTimeout(() => {
            if (INF_PERSISTENT_STATE.hasGenerated) {
                this.solve();
            }
            this.animate();
        }, 50);
    }

    // 🌟 创建动态投影墙
    createDynamicWalls() {
        this.clearWalls();
        const wallSize = 80; 
        const wallGeometry = new THREE.PlaneGeometry(wallSize, wallSize);
        
        const wallConfigs = [
            { id: 'front', position: [0, 40, -40.1], rotation: [0, 0, 0], color: 0x00a8ff },
            { id: 'left',  position: [40.1, 40, 0],  rotation: [0, -Math.PI / 2, 0], color: 0xff1e3c }, 
            { id: 'top',   position: [0, -0.1, 0],   rotation: [-Math.PI / 2, 0, 0], color: 0xffe600 }
        ];

        wallConfigs.forEach(config => {
            const canvas = document.getElementById(`inf-canvas-${config.id}`);
            if (!canvas) return;
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            const wall = new THREE.Mesh(wallGeometry, material);
            wall.position.set(config.position[0], config.position[1], config.position[2]);
            wall.rotation.set(config.rotation[0], config.rotation[1], config.rotation[2]);
            
            const edges = new THREE.LineSegments(
                new THREE.EdgesGeometry(wallGeometry),
                new THREE.LineBasicMaterial({ color: config.color, linewidth: 2 })
            );
            wall.add(edges);
            this.mainGroup.add(wall);
            this.walls.push(wall);
        });
    }

    clearWalls() {
        this.walls.forEach(wall => {
            if (wall.material.map) wall.material.map.dispose();
            wall.material.dispose();
            wall.geometry.dispose();
            this.mainGroup.remove(wall);
        });
        this.walls = [];
    }

    dispose() {
        this.isRunning = false;
        this.clear3D();
        this.clearWalls();

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.container.contains(this.renderer.domElement)) {
                this.container.removeChild(this.renderer.domElement);
            }
        }

        if (this.controls) this.controls.dispose();

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.mainGroup = null;
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xfdfbf7);
        this.scene.add(this.mainGroup);

        this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 2000);
        this.camera.position.set(120, 120, 120); 

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = false; 
        
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: null, 
            RIGHT: THREE.MOUSE.ROTATE
        };

        let isPanning = false;
        const lastMouse = new THREE.Vector2();

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 1) { 
                isPanning = true;
                lastMouse.set(e.clientX, e.clientY);
                e.preventDefault();
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            
            const dx = e.clientX - lastMouse.x;
            const dy = e.clientY - lastMouse.y;

            const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
            const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
            
            const factor = 0.5;
            const move = right.multiplyScalar(-dx * factor).add(up.multiplyScalar(dy * factor));
            
            this.camera.position.add(move);
            
            lastMouse.set(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => { isPanning = false; });

        // 🌟 提升光照强度，调高亮度
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 150, 50);
        this.scene.add(dirLight);

        // 🌟 提亮积木面颜色：红、黄、蓝
        this.cubeMaterials = [
            new THREE.MeshLambertMaterial({ color: 0xff1e3c }), // 右
            new THREE.MeshLambertMaterial({ color: 0xff1e3c }), // 左
            new THREE.MeshLambertMaterial({ color: 0xffe600 }), // 上
            new THREE.MeshLambertMaterial({ color: 0xffe600 }), // 下
            new THREE.MeshLambertMaterial({ color: 0x00a8ff }), // 前
            new THREE.MeshLambertMaterial({ color: 0x00a8ff })  // 后
        ];
    }

    initCanvasInteractions() {
        ['front', 'left', 'top'].forEach(view => {
            const canvas = document.getElementById(`inf-canvas-${view}`);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            canvas.width = 400; 
            canvas.height = 400;

            const render = () => {
                const step = canvas.width / 8; 
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // 🌟 同步提亮 2D 颜色
                ctx.fillStyle = { front: '#00a8ff', left: '#ff1e3c', top: '#ffe600' }[view];
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        if (this.grids[view][r][c]) {
                            ctx.fillRect(c * step + 0.5, r * step + 0.5, step - 1, step - 1);
                        }
                    }
                }

                ctx.strokeStyle = "#999999"; 
                ctx.lineWidth = 2; 
                ctx.beginPath();
                for (let i = 0; i <= 8; i++) {
                    const p = i * step;
                    ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height);
                    ctx.moveTo(0, p); ctx.lineTo(canvas.width, p);
                }
                ctx.stroke();

                ctx.strokeStyle = "#333333";
                ctx.lineWidth = 4;
                ctx.strokeRect(0, 0, canvas.width, canvas.height);
            };

            canvas.onclick = (e) => {
                if (!this.isRunning) return;
                // 🌟 重要：手动点击意味着形状改变，清空快照
                this.userInputSnapshot = null; 
                const rect = canvas.getBoundingClientRect();
                const c = Math.floor((e.clientX - rect.left) / (rect.width / 8));
                const r = Math.floor((e.clientY - rect.top) / (rect.height / 8));
                
                if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                    this.grids[view][r][c] = !this.grids[view][r][c];
                    render();
                }
            };

            render();
            canvas._refresh = render;
        });
    }

    bindActionButtons() {
        const btnMax = document.getElementById('btn-inf-gen-max');
        const btnMin = document.getElementById('btn-inf-gen-min');
        const btnClear = document.getElementById('inf-clear-all');
        if (btnMax) btnMax.onclick = () => { 
            this.currentAlgo = 'max'; 
            INF_PERSISTENT_STATE.currentAlgo = 'max';
            this.solve(); 
        };
        if (btnMin) btnMin.onclick = () => { 
            this.currentAlgo = 'min'; 
            INF_PERSISTENT_STATE.currentAlgo = 'min';
            this.solve(); 
        };
        if (btnClear) btnClear.onclick = () => this.clearAll();
    }

    addLabeledAxes() {
        const axesGroup = new THREE.Group();
        axesGroup.name = "inferenceAxes";
        const size = 60; 
        const axesData = [
            { dir: [1, 0, 0], color: 0xff1e3c, label: '右' },
            { dir: [-1, 0, 0], color: 0xff1e3c, label: '左' },
            { dir: [0, 1, 0], color: 0xffe600, label: '上' },
            { dir: [0, -1, 0], color: 0xffe600, label: '下' },
            { dir: [0, 0, 1], color: 0x00a8ff, label: '前' },
            { dir: [0, 0, -1], color: 0x00a8ff, label: '后' }
        ];

        axesData.forEach(data => {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(data.dir[0], data.dir[1], data.dir[2]).multiplyScalar(size)
            ]);
            
            const line = new THREE.LineSegments(geometry, new THREE.LineDashedMaterial({ 
                color: data.color, 
                transparent: true, 
                opacity: 0.25,
                dashSize: 3,
                gapSize: 3,
                scale: 1 
            }));
            line.computeLineDistances(); 
            axesGroup.add(line);

            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.font = 'Bold 40px Arial';
            ctx.fillStyle = 'rgba(' + (data.color >> 16 & 255) + ',' + (data.color >> 8 & 255) + ',' + (data.color & 255) + ', 0.3)';
            ctx.textAlign = 'center';
            ctx.fillText(data.label, 32, 45);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(data.dir[0], data.dir[1], data.dir[2]).multiplyScalar(size + 8);
            sprite.scale.set(15, 15, 1);
            axesGroup.add(sprite);
        });
        this.mainGroup.add(axesGroup);
    }

    solve() {
       if (!this.isRunning) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (this.renderer && this.camera) {
            this.renderer.setSize(width, height);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }

        // 🌟 1. 拍照存证：记录原始样子，严禁后续判定被补全后的点干扰
        if (!this.userInputSnapshot) {
            this.userInputSnapshot = JSON.parse(JSON.stringify(this.grids));
        }

        // 🌟 识别缺失视口逻辑：只有原本空白的才允许程序补全
        const isMissing = {
            front: !this.userInputSnapshot.front.some(row => row.some(cell => cell)),
            left: !this.userInputSnapshot.left.some(row => row.some(cell => cell)),
            top: !this.userInputSnapshot.top.some(row => row.some(cell => cell))
        };

        const getCompactProfile = (grid, viewName, isTop = false) => {
            let fC = -1, lC = -1, fR = -1, lR = -1;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (grid[r][c]) {
                        if (fC === -1 || c < fC) fC = c; if (lC === -1 || c > lC) lC = c;
                        if (fR === -1 || r < fR) fR = r; if (lR === -1 || r > lR) lR = r;
                    }
                }
            }
            if (fC === -1) return null;
            if (isTop) {
                const matrix = [];
                for (let r = fR; r <= lR; r++) matrix.push(grid[r].slice(fC, lC + 1));
                return { matrix, width: lC - fC + 1, depth: lR - fR + 1, fC, fR };
            } else {
                const heights = [];
                for (let c = fC; c <= lC; c++) {
                    let cnt = 0;
                    for (let r = 0; r < 8; r++) { if (grid[r][c]) cnt++; }
                    heights.push(cnt);
                }
                return { heights, length: heights.length, maxHeight: Math.max(...heights), fC, fR };
            }
        };

        // 🌟 判定逻辑始终指向 SnapShot 快照，确保提取逻辑未变
        const pF = getCompactProfile(this.userInputSnapshot.front, "正");
        const pL = getCompactProfile(this.userInputSnapshot.left, "左");
        const pT = getCompactProfile(this.userInputSnapshot.top, "俯", true);

        if (pF && pL && pF.maxHeight !== pL.maxHeight) {
            alert(`🪄 魔法失效提示：正视图最高 ${pF.maxHeight} 层，左视图最高 ${pL.maxHeight} 层。高度未对齐！`);
            return;
        }
        if (pF && pT && pF.length !== pT.width) {
            alert(`🪄 魔法失效提示：正视图宽 ${pF.length}，俯视图宽 ${pT.width}。宽度不对号！`);
            return;
        }
        if (pL && pT && pL.length !== pT.depth) {
            alert(`🪄 魔法失效提示：左视图深 ${pL.length}，俯视图深 ${pT.depth}。深度不一致！`);
            return;
        }

        try {
            this.clear3D();
            this.clearWalls(); 

            const w = pF ? pF.length : (pT ? pT.width : 0);
            const d = pL ? pL.length : (pT ? pT.depth : 0);
            const resGrid = Array.from({ length: d }, () => Array(w).fill(0));

            const fH = pF ? [...pF.heights] : null;
            const lH = pL ? [...pL.heights] : null;

            if (this.currentAlgo === "min") {
                if (fH && lH) {
                    for (let x = 0; x < w; x++) {
                        for (let z = 0; z < d; z++) {
                            if (fH[x] > 0 && fH[x] === lH[z]) {
                                if (!pT || pT.matrix[z][x]) {
                                    resGrid[z][x] = fH[x];
                                    fH[x] = 0; lH[z] = 0; break;
                                }
                            }
                        }
                    }
                }
                if (lH) {
                    for (let z = 0; z < d; z++) {
                        if (lH[z] === 0) continue;
                        let placed = false;
                        for (let x = 0; x < w; x++) {
                            if (pT && !pT.matrix[z][x]) continue; 
                            if (fH && fH[x] > 0) {
                                resGrid[z][x] = Math.max(fH[x], lH[z]);
                                fH[x] = 0; lH[z] = 0; placed = true; break;
                            }
                        }
                        if (!placed) {
                            for (let x = 0; x < w; x++) {
                                if (!pT || pT.matrix[z][x]) {
                                    resGrid[z][x] = lH[z];
                                    lH[z] = 0; break;
                                }
                            }
                        }
                    }
                }
                if (fH) {
                    for (let x = 0; x < w; x++) {
                        if (fH[x] === 0) continue;
                        for (let z = 0; z < d; z++) {
                            if (!pT || pT.matrix[z][x]) {
                                resGrid[z][x] = fH[x];
                                fH[x] = 0; break;
                            }
                        }
                    }
                }
                if (pT) {
                    for (let z = 0; z < d; z++) {
                        for (let x = 0; x < w; x++) {
                            if (pT.matrix[z][x] && resGrid[z][x] === 0) resGrid[z][x] = 1;
                        }
                    }
                }
            } else {
                for (let z = 0; z < d; z++) {
                    for (let x = 0; x < w; x++) {
                        if (pT && !pT.matrix[z][x]) continue;
                        const hF = fH ? (pF.heights[x] || 0) : 8;
                        const hL = lH ? (pL.heights[z] || 0) : 8;
                        resGrid[z][x] = Math.min(hF, hL);
                    }
                }
            }

            let total = 0;
            const tempPositions = []; 

            for (let z = 0; z < d; z++) {
                for (let x = 0; x < w; x++) {
                    for (let y = 0; y < resGrid[z][x]; y++) {
                        this.addCube(x, y, z); 
                        total++;
                        // 🌟 记录物理位置映射坐标，高度 y 映射到行索引 (7 - y)
                        tempPositions.push({ x: x, y: 7 - y, z: z });
                    }
                }
            }

            // 🌟 2. 根据 3D 结果同步补全缺失视口：严禁修改用户手绘部分
            ['front', 'left', 'top'].forEach(view => {
                // 先根据快照恢复原貌，确保不叠加
                this.grids[view] = JSON.parse(JSON.stringify(this.userInputSnapshot[view]));
                
                // 只有完全缺失的视口才执行自动投影补全
                if (isMissing[view] && tempPositions.length > 0) {
                    const grid = this.grids[view];
                    let offsetC = 0, offsetR = 0;

                    // 计算积木在投影面上的最小逻辑边界
                    const minC = Math.min(...tempPositions.map(p => (view === 'front' ? p.x : (view === 'left' ? p.z : p.x))));
                    const minR = Math.min(...tempPositions.map(p => (view === 'top' ? p.z : p.y)));

                    // 执行交叉参考补全对齐逻辑
                    if (view === 'front') {
                        offsetC = pT ? pT.fC : 0; 
                        offsetR = pL ? pL.fR : 0; 
                    } else if (view === 'left') {
                        offsetR = pF ? pF.fR : 0; 
                        offsetC = pT ? pT.fR : 0; 
                    } else if (view === 'top') {
                        offsetC = pF ? pF.fC : 0; 
                        offsetR = pL ? pL.fC : 0; 
                    }

                    tempPositions.forEach(pos => {
                        const currentC = (view === 'front' ? pos.x : (view === 'left' ? pos.z : pos.x));
                        const currentR = (view === 'top' ? pos.z : pos.y);
                        const c = currentC - minC + offsetC;
                        const r = currentR - minR + offsetR;
                        if (r >= 0 && r < 8 && c >= 0 && c < 8) grid[r][c] = true;
                    });
                }
                
                const canvas = document.getElementById(`inf-canvas-${view}`);
                if (canvas && canvas._refresh) canvas._refresh();
            });
            
            // 🌟 3. 同步创建 3D 投影墙（抓取最新的补全 Canvas 画面）
            this.createDynamicWalls();

            if (total > 0) {
                this.addLabeledAxes();
                const box = new THREE.Box3().setFromObject(this.mainGroup);
                const center = new THREE.Vector3();
                box.getCenter(center); 
                this.mainGroup.children.forEach(child => {
                    if(child.name !== "inferenceAxes") {
                        // 🌟 仅保留 Y 轴对齐偏移，严禁改变 X 和 Z，确保与视口点对点
                        child.position.y += 0; 
                    }
                });
                this.controls.target.set(0, 40, 0);
                this.controls.update();
            }

            const countEl = document.getElementById("inf-v3-count");
            if (countEl) countEl.textContent = total;
            INF_PERSISTENT_STATE.hasGenerated = true;
        } catch (e) { console.error(e); }
    }

    // 🌟 物理注入实心黑色边缘线条逻辑
    addCube(x, y, z) {
        if (!this.scene) return;
        const boxSize = 9.8; // 积木实体略微缩小
        const geo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const mesh = new THREE.Mesh(geo, this.cubeMaterials);
        
        // 🌟 向上抬高起始：y * 10 + 30，实现飞在空中
        const posX = x * 10;
        const posY = y * 10 + 30;
        const posZ = z * 10;
        mesh.position.set(posX, posY, posZ);

        // 🌟 提取几何体边缘并使用纯黑色 LineSegments 叠加
        const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(10, 10, 10));
        const lineMat = new THREE.LineBasicMaterial({ 
            color: 0x000000, 
            linewidth: 2,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });
        const edges = new THREE.LineSegments(edgeGeo, lineMat);
        edges.position.set(posX, posY, posZ);

        this.mainGroup.add(mesh); 
        this.mainGroup.add(edges); // 直接添加线条到组
        this.cubes.push(mesh);
    }

    clear3D() {
        const toRemove = [];
        this.mainGroup.children.forEach(child => {
            // 物理移除轴、线条Segments
            if (child.name === "inferenceAxes" || child.isLineSegments) toRemove.push(child);
        });
        toRemove.forEach(obj => {
            obj.traverse(sub => {
                if (sub.geometry) sub.geometry.dispose();
                if (sub.material) {
                    if (Array.isArray(sub.material)) sub.material.forEach(m => m.dispose());
                    else sub.material.dispose();
                }
            });
            this.mainGroup.remove(obj);
        });
        this.cubes.forEach(c => {
            if (c.geometry) c.geometry.dispose();
            this.mainGroup.remove(c); 
        });
        this.cubes = [];
        this.mainGroup.position.set(0, 0, 0);
    }

    clearAll() {
        INF_PERSISTENT_STATE.hasGenerated = false;
        this.userInputSnapshot = null; // 重置快照
        ['front', 'left', 'top'].forEach(view => {
            this.grids[view] = Array(8).fill().map(() => Array(8).fill(false));
            const canvas = document.getElementById(`inf-canvas-${view}`);
            if (canvas && canvas._refresh) canvas._refresh();
        });
        this.clear3D();
        this.clearWalls(); 
        this.mainGroup.position.set(0, 0, 0);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        const countEl = document.getElementById('inf-v3-count');
        if (countEl) countEl.textContent = '0';
    }

    animate() {
        if (!this.isRunning) return; 
        requestAnimationFrame(() => this.animate());
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}