/* global gsap */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * 🌟 外部持久化存储：确保数据在实例销毁后依然保留
 * 放在类定义之外，存储 10x10 的数值矩阵
 */
const CHALLENGE_PERSISTENT_STATE = {
    gridData: Array(10).fill().map(() => Array(10).fill(0))
};

export class ChallengeMode {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.uiGroup = document.getElementById('ui-challenge-group');
        this.gridPanel = document.getElementById('grid-control-panel');
        
        // 🌟 核心：引用持久化数据，实现跨模式数据保留
        this.gridData = CHALLENGE_PERSISTENT_STATE.gridData;
        
        this.cubes = []; 
        this.isRunning = true;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.canvases = {
            front: document.getElementById('canvas-front'),
            left: document.getElementById('canvas-left'),
            top: document.getElementById('canvas-top')
        };

        this.initScene();
        this.initLights();
        this.initControls();
        this.setupLayout();
        this.initGridUI();
        this.initSpaceLabels(); 
        
        // 🌟 绑定 3D 区域交互
        this.setup3DInteraction(); 
        
        setTimeout(() => {
            if (this.renderer && this.container) {
                this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            }
            this.refreshAll();
        }, 100);

        this.animate();
    }

    // --- 🌟 3D 区域交互：右键点击积木直接扣减高度 ---
    setup3DInteraction() {
        const dom = this.renderer.domElement;
        
        // 禁用画布原生右键菜单
        dom.oncontextmenu = (e) => e.preventDefault();

        // 使用 pointerdown 捕获右键
        dom.addEventListener('pointerdown', (e) => {
            if (e.button !== 2) return; 

            const rect = dom.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            
            const intersects = this.raycaster.intersectObjects(this.cubes, true);

            if (intersects.length > 0) {
                let targetObj = intersects[0].object;
                
                // 向上回溯查找带有坐标数据的父级 Mesh
                while (targetObj && targetObj.userData.gridR === undefined && targetObj.parent) {
                    targetObj = targetObj.parent;
                }

                if (targetObj && targetObj.userData.gridR !== undefined) {
                    const r = targetObj.userData.gridR;
                    const c = targetObj.userData.gridC;
                    
                    if (this.gridData[r][c] > 0) {
                        this.gridData[r][c]--;
                        this.refreshAll(); 
                        this.initGridUI(); 
                    }
                }
            }
        }, true);
    }

    // --- 🌟 3D 积木生成：通过 EdgesGeometry 重构纯黑实心边缘 ---
    sync3D() {
        if (!this.scene) return;
        this.cubes.forEach(c => this.scene.remove(c));
        this.cubes = [];
        let total = 0;

        // 复用边缘几何体以优化性能
        const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(10, 10, 10));

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                const h = this.gridData[r][c];
                total += h;
                for (let i = 0; i < h; i++) {
                    const cube = new THREE.Mesh(
                        new THREE.BoxGeometry(9.8, 9.8, 9.8),
                        [
                            new THREE.MeshLambertMaterial({color: 0xff1e3c}), // 右面 (亮红)
                            new THREE.MeshLambertMaterial({color: 0xff1e3c}), // 左面
                            new THREE.MeshLambertMaterial({color: 0xffe600}), // 上面 (亮黄)
                            new THREE.MeshLambertMaterial({color: 0xffe600}), // 下面
                            new THREE.MeshLambertMaterial({color: 0x00a8ff}), // 前面 (亮蓝)
                            new THREE.MeshLambertMaterial({color: 0x00a8ff})  // 后面
                        ]
                    );
                    cube.position.set((c - 5 + 0.5) * 10, i * 10 + 5, (r - 5 + 0.5) * 10);
                    cube.userData = { gridR: r, gridC: c };
                    
                    // 🌟 重点修改：参照 Build 模式，叠加纯黑、实心边缘
                    // 物理学习 Build 模式逻辑：THREE.EdgesGeometry提取边缘 -> THREE.LineSegments叠加 -> 纯黑LineBasicMaterial
                    // 取消透明度和低不透明度，确保线条清晰、强烈。
                    const edges = new THREE.LineSegments(
                        edgeGeo,
                        new THREE.LineBasicMaterial({ 
                            color: 0x000000, // 纯黑
                            linewidth: 2,     // 稍微加粗，使其更明显
                            transparent: false // 关闭透明
                        })
                    );
                    cube.add(edges);
                    
                    this.scene.add(cube);
                    this.cubes.push(cube);
                }
            }
        }
        const count = document.getElementById('cube-count');
        if (count) count.textContent = total;
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: null
        };
    }

    setupLayout() {
        this.uiGroup.style.display = 'flex';
        this.uiGroup.style.flexDirection = 'column';
        this.uiGroup.style.alignItems = 'center';
        this.uiGroup.style.height = '100%';
        this.uiGroup.style.width = '100%';
        this.uiGroup.style.padding = '1vh 0';
        this.uiGroup.style.boxSizing = 'border-box';

        if (!document.getElementById('challenge-stats-header')) {
            const stats = document.createElement('div');
            stats.id = 'challenge-stats-header';
            stats.style.cssText = `background:#2d3436; color:white; padding:10px; border-radius:8px; margin-bottom:1vh; display:flex; justify-content:space-between; align-items:center; width: 90%; box-sizing: border-box; flex-shrink:0;`;
            stats.innerHTML = `<span>积木总数</span><span id="cube-count" style="color:#ffe600; font-size:24px; font-weight:900;">0</span>`;
            this.uiGroup.prepend(stats);
        }

        const infoBtn = document.getElementById('info-btn-challenge');
        if (infoBtn) {
            infoBtn.onclick = () => {
                const modal = document.getElementById('instruction-modal');
                const modalContent = modal.querySelector('.modal-content');
modalContent.innerHTML = `
                    <div style="text-align:center; padding:10px;">
                        <h2 style="color:#0277BD; margin:0 0 20px 0; font-size:22px;">🔢 平面标数法操作指南</h2>
                        <div style="display:grid; grid-template-columns:1fr; gap:12px; text-align:left; color:#5D4037;">
                            <div style="background:#E8F5E9; padding:15px; border-radius:12px; border-left:6px solid #4CAF50; display:flex; align-items:center; gap:12px;">
                                <div style="font-size:24px;">➕</div>
                                <div><strong style="font-size:16px;">生成方块</strong><br><span style="font-size:13px;">点击左侧网格<b>左键</b>增加积木高度。</span></div>
                            </div>
                            <div style="background:#FFF3E0; padding:15px; border-radius:12px; border-left:6px solid #FF9800; display:flex; align-items:center; gap:12px;">
                                <div style="font-size:24px;">➖</div>
                                <div><strong style="font-size:16px;">网格减少</strong><br><span style="font-size:13px;">点击左侧网格<b>右键</b>减少积木高度。</span></div>
                            </div>
                            <div style="background:#FFEBEE; padding:15px; border-radius:12px; border-left:6px solid #F44336; display:flex; align-items:center; gap:12px;">
                                <div style="font-size:24px;">🗑️</div>
                                <div><strong style="font-size:16px;">3D 删除</strong><br><span style="font-size:13px;">在 3D 区域<b>右键点击</b>积木直接扣减。</span></div>
                            </div>
                            <div style="background:#F3E5F5; padding:15px; border-radius:12px; border-left:6px solid #9C27B0; display:flex; align-items:center; gap:12px;">
                                <div style="font-size:24px;">🔄</div>
                                <div><strong style="font-size:16px;">快速清理</strong><br><span style="font-size:13px;">点击下方的<b>清空所有标数</b>按钮，快速重置场景。</span></div>
                            </div>
                        </div>
                        <button id="close-modal-inner" style="margin-top:20px; width:100%; padding:12px; background:#0277BD; color:white; border:none; border-radius:25px; font-weight:bold; cursor:pointer; box-shadow:0 4px 0 #01579B; font-size:15px;">我知道了</button>
                    </div>
                `;
                modal.style.display = 'flex';
                document.getElementById('close-modal-inner').onclick = () => { modal.style.display = 'none'; };
            };
        }

        const cellSize = '2.2vh'; 
        const sideSize = '3.5vh'; 
        const mainSize = '23vh';  

        let gridWrapper = document.getElementById('grid-wrapper-container');
        if (!gridWrapper) {
            gridWrapper = document.createElement('div');
            gridWrapper.id = 'grid-wrapper-container';
            gridWrapper.style.cssText = `display: grid; grid-template-areas: ". top ." "left main right" ". bottom ."; grid-template-columns: ${sideSize} ${mainSize} ${sideSize}; grid-template-rows: ${sideSize} ${mainSize} ${sideSize}; align-items: center; justify-items: center; justify-content: center; background: #f1f2f6; padding: 1vh; border-radius: 12px; margin: auto 0; flex-shrink:0; width: fit-content; box-sizing: border-box;`;
            
            const createLab = (txt, area, color) => {
                const d = document.createElement('div'); d.textContent = txt;
                d.style.cssText = `grid-area: ${area}; font-size: 1.4vh; font-weight: bold; color:${color}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;`;
                return d;
            };
            
            gridWrapper.appendChild(createLab('后', 'top', '#636e72')); 
            gridWrapper.appendChild(createLab('前', 'bottom', '#00a8ff'));
            const l = createLab('左', 'left', '#ff1e3c'); l.style.writingMode = 'vertical-lr';
            const r = createLab('右', 'right', '#2d3436'); r.style.writingMode = 'vertical-lr';
            gridWrapper.appendChild(l); gridWrapper.appendChild(r);
            
            this.gridPanel.style.gridArea = 'main'; 
            this.gridPanel.style.display = 'grid';
            this.gridPanel.style.gridTemplateColumns = `repeat(10, ${cellSize})`;
            this.gridPanel.style.gridTemplateRows = `repeat(10, ${cellSize})`;
            this.gridPanel.style.gap = '1px'; 
            this.gridPanel.style.background = '#ccc'; 
            this.gridPanel.style.width = mainSize; 
            this.gridPanel.style.height = mainSize;
            
            gridWrapper.appendChild(this.gridPanel); 
            this.uiGroup.insertBefore(gridWrapper, document.getElementById('clear-grid-btn-challenge'));
        }

        const clearBtn = document.getElementById('clear-grid-btn-challenge');
        if (clearBtn) {
            clearBtn.onclick = () => this.actionClear();
        }
    }

    drawProjections() {
        const colors = { front: '#00a8ff', left: '#ff1e3c', top: '#ffe600', grid: '#333333' };
        const fM = Array(10).fill(0), lM = Array(10).fill(0), tB = Array(10).fill().map(() => Array(10).fill(false));
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                const h = this.gridData[r][c];
                if (h > 0) { fM[c] = Math.max(fM[c], h); lM[r] = Math.max(lM[r], h); tB[r][c] = true; }
            }
        }
        Object.keys(this.canvases).forEach(key => {
            const canvas = this.canvases[key];
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height, size = W / 10; 
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = colors[key];
            if (key === 'front') fM.forEach((h, c) => { for (let i = 0; i < h; i++) ctx.fillRect(c * size, (9 - i) * size, size, size); });
            else if (key === 'left') lM.forEach((h, r) => { for (let i = 0; i < h; i++) ctx.fillRect(r * size, (9 - i) * size, size, size); });
            else if (key === 'top') { for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (tB[r][c]) ctx.fillRect(c * size, r * size, size, size); }
            ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.beginPath();
            for (let i = 0; i <= 10; i++) { const p = i * size; ctx.moveTo(p, 0); ctx.lineTo(p, H); ctx.moveTo(0, p); ctx.lineTo(W, p); }
            ctx.stroke();
        });
    }

    initGridUI() { 
        this.gridPanel.innerHTML = ''; 
        const colors = ["#ffffff", "#e3f2fd", "#bbdefb", "#90caf9", "#64b5f6", "#42a5f5", "#2196f3", "#1e88e5", "#1976d2", "#1565c0"]; 
        for (let r = 0; r < 10; r++) { 
            for (let c = 0; c < 10; c++) { 
                const cell = document.createElement('div'); 
                cell.className = 'grid-cell'; 
                cell.textContent = this.gridData[r][c] || ''; 
                cell.style.backgroundColor = colors[this.gridData[r][c]]; 
                cell.onclick = () => { this.gridData[r][c] = Math.min(9, this.gridData[r][c] + 1); this.refreshAll(); this.initGridUI(); }; 
                cell.oncontextmenu = (e) => { e.preventDefault(); this.gridData[r][c] = Math.max(0, this.gridData[r][c] - 1); this.refreshAll(); this.initGridUI(); }; 
                this.gridPanel.appendChild(cell); 
            } 
        } 
    }

    initScene() { 
        this.scene = new THREE.Scene(); 
        this.scene.background = new THREE.Color(0xffffff); 
        this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 10000); 
        this.camera.position.set(130, 130, 130); 
        this.renderer = new THREE.WebGLRenderer({ antialias: true }); 
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight); 
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement); 
        const grid = new THREE.GridHelper(100, 10, 0x333333, 0xbdc3c7); 
        grid.position.y = 0.1; 
        this.scene.add(grid); 
    }

    initSpaceLabels() { 
        const createLabel = (text, pos, color) => { 
            const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128; 
            const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.font = 'Bold 80px "Microsoft YaHei"'; 
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 64); 
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) })); 
            sprite.position.copy(pos); sprite.scale.set(30, 15, 1); this.scene.add(sprite); 
        }; 
        createLabel('前', new THREE.Vector3(0, 5, 75), '#00a8ff'); 
        createLabel('后', new THREE.Vector3(0, 5, -75), '#636e72'); 
        createLabel('左', new THREE.Vector3(-75, 5, 0), '#ff1e3c'); 
        createLabel('右', new THREE.Vector3(75, 5, 0), '#2d3436'); 
        createLabel('上', new THREE.Vector3(0, 110, 0), '#ffe600'); 
    }

    initLights() { 
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.0)); 
        const dir = new THREE.DirectionalLight(0xffffff, 0.8); 
        dir.position.set(50, 150, 50); 
        this.scene.add(dir); 
    }

    animate() { 
        if (!this.isRunning) return; 
        requestAnimationFrame(() => this.animate()); 
        if(this.controls) this.controls.update(); 
        this.renderer.render(this.scene, this.camera); 
    }
    
    actionClear() { 
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                this.gridData[r][c] = 0;
            }
        }
        this.initGridUI(); 
        this.refreshAll(); 
    }
    
    refreshAll() { this.sync3D(); this.drawProjections(); }

    dispose() { 
        this.isRunning = false; 
        if (this.renderer) { 
            this.renderer.dispose(); 
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.remove(); 
            }
        } 
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach(m => m && m.dispose());
                }
            });
            this.scene.clear();
        }
    }
}