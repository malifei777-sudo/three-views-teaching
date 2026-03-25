import { BuildMode } from './buildMode.js';
import { ChallengeMode } from './challengeMode.js';
import { InferenceMode } from './inferenceMode.js';

class AppController {
    constructor() {
        this.currentInstance = null;
        this.init();
    }

    init() {
        // 确保顶部导航按钮永远可以点击
        const btnBuild = document.getElementById('btn-mode-build');
        const btnChallenge = document.getElementById('btn-mode-challenge');
        const btnInference = document.getElementById('btn-mode-inference');

        if (btnBuild) btnBuild.onclick = () => this.switchMode('build');
        if (btnChallenge) btnChallenge.onclick = () => this.switchMode('challenge');
        if (btnInference) btnInference.onclick = () => this.switchMode('inference');
        
        // 默认初始化
        this.switchMode('build');
    }

    /**
     * 模式切换核心枢纽
     */
    switchMode(mode) {
        console.log(`切换到模式: ${mode}`);

        // 1. 彻底销毁当前实例
        if (this.currentInstance) {
            if (typeof this.currentInstance.dispose === 'function') {
                this.currentInstance.dispose();
            }
            this.currentInstance = null;
        }

        const wrapper = document.getElementById('main-wrapper');
        const uiPanel = document.getElementById('ui-panel');
        const sidebarV3 = document.getElementById('inference-sidebar-v3');
        const bottomPanel = document.getElementById('bottom-panel');
        const uiBuild = document.getElementById('ui-build-group');
        const uiChallenge = document.getElementById('ui-challenge-group');
        const infoBtn = document.getElementById('info-btn'); 

        // 2. 核心：重置所有 CSS 布局类名（同步 Body 和 Wrapper）
        wrapper.classList.remove('challenge-layout', 'inference-layout');
        document.body.classList.remove('mode-build', 'challenge-layout', 'inference-layout');

        // 3. 物理重置所有面板显示状态
        if (uiPanel) uiPanel.style.display = 'none';
        if (sidebarV3) sidebarV3.style.display = 'none';
        if (uiBuild) uiBuild.style.display = 'none';
        if (uiChallenge) uiChallenge.style.display = 'none';
        if (bottomPanel) bottomPanel.style.display = 'none';
        if (infoBtn) infoBtn.style.display = 'none'; // 🌟 默认隐藏公共说明按钮

        // 4. 根据目标模式进行定向激活与布局拓宽
        switch (mode) {
            case 'build':
                // 🌟 建模模式：左侧保持常规宽度 220px
                wrapper.style.gridTemplateColumns = "220px 1fr";
                document.body.classList.add('mode-build'); // 🌟 确保 CSS 联动
                uiPanel.style.display = 'block';
                uiBuild.style.display = 'block';
                bottomPanel.style.display = 'flex';
                if (infoBtn) infoBtn.style.display = 'block'; // 🌟 建模模式显示说明
                this.currentInstance = new BuildMode();
                break;

            case 'challenge':
                // 🌟 标数模式核心修改：拓宽左侧区域至 320px，确保 20px 的格子与标签不拥挤
                wrapper.style.gridTemplateColumns = "320px 1fr";
                wrapper.classList.add('challenge-layout');
                document.body.classList.add('challenge-layout'); // 🌟 确保 CSS 联动
                uiPanel.style.display = 'block';
                uiChallenge.style.display = 'block';
                bottomPanel.style.display = 'flex';
                // 🌟 标数模式下，infoBtn 保持隐藏（由专属按钮替代）
                this.currentInstance = new ChallengeMode();
                break;

            case 'inference':
                // 推理模式：保持宽屏
                wrapper.style.gridTemplateColumns = "420px 1fr";
                wrapper.classList.add('inference-layout');
                document.body.classList.add('inference-layout');
                sidebarV3.style.display = 'flex';
                bottomPanel.style.display = 'none';
                this.currentInstance = new InferenceMode();
                break;
        }

        // 5. 更新按钮高亮样式
        this.updateButtons(mode);
    }

    updateButtons(mode) {
        const idMap = {
            build: 'btn-mode-build',
            challenge: 'btn-mode-challenge',
            inference: 'btn-mode-inference'
        };
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(idMap[mode]);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

// 确保 DOM 加载后运行
window.addEventListener('DOMContentLoaded', () => new AppController());