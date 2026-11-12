/**
 * game.js - 10ラウンド広告バツ早押し RTA コアエンジン (効果音・ランキング強化版)
 */

class AdCloseGame {
    constructor() {
        // 状態管理
        this.state = 'idle'; // 'idle', 'countdown', 'running', 'penalty', 'cleared'
        this.currentRound = 1;
        this.maxRounds = 10;
        this.adsMaster = [];
        this.startTime = 0;
        this.elapsedTime = 0;
        this.timerInterval = null;
        
        // RTA スプリット管理
        this.roundStartTime = 0;
        this.splits = [];
        this.currentRoundMisses = 0;
        this.totalMisses = 0;
        this.penaltyCount = 0;

        // PB と ベストセグメント
        this.personalBest = null;
        this.bestSegments = {};

        // ランキングフィルター状態
        this.currentLeaderboardFilter = 'overall';
        this.lastSavedRunId = null;

        // DOM要素
        this.dom = {};
        this.activeGimmickCleanup = null;
    }

    async init() {
        await window.gameDB.init();
        this.adsMaster = await window.gameDB.getAdsMaster();
        this.personalBest = await window.gameDB.getPersonalBest();
        this.bestSegments = await window.gameDB.getBestSegments();

        this.cacheDom();
        this.bindEvents();
        this.updateLeaderboardUI();
        this.updateStatsUI();
        this.renderSplitsListInitial();
    }

    cacheDom() {
        this.dom = {
            mainTimer: document.getElementById('main-timer'),
            roundTimer: document.getElementById('round-timer'),
            roundIndicator: document.getElementById('round-indicator'),
            splitsList: document.getElementById('splits-list'),
            adArea: document.getElementById('ad-area'),
            adPlaceholder: document.getElementById('ad-placeholder'),
            btnStartRta: document.getElementById('btn-start-rta'),
            btnResetRta: document.getElementById('btn-reset-rta'),
            penaltyOverlay: document.getElementById('penalty-overlay'),
            penaltyCount: document.getElementById('penalty-count'),
            resultModal: document.getElementById('result-modal'),
            resultTime: document.getElementById('result-time'),
            resultMisses: document.getElementById('result-misses'),
            resultRank: document.getElementById('result-rank'),
            resultSplitsTable: document.getElementById('result-splits-table'),
            playerNameInput: document.getElementById('player-name-input'),
            btnSaveRecord: document.getElementById('btn-save-record'),
            btnPlayAgain: document.getElementById('btn-play-again'),
            leaderboardBody: document.getElementById('leaderboard-body'),
            leaderboardFilterBtns: document.querySelectorAll('.filter-pill'),
            statsContainer: document.getElementById('stats-container'),
            tabButtons: document.querySelectorAll('.tab-btn'),
            tabPanels: document.querySelectorAll('.tab-panel'),
            btnClearDB: document.getElementById('btn-clear-db'),
            btnToggleSound: document.getElementById('btn-toggle-sound')
        };
    }

    bindEvents() {
        this.dom.btnStartRta.addEventListener('click', () => {
            window.soundSystem?.init();
            this.startRta();
        });
        this.dom.btnResetRta.addEventListener('click', () => this.resetGame());
        this.dom.btnSaveRecord.addEventListener('click', () => this.saveRunRecord());
        this.dom.btnPlayAgain.addEventListener('click', () => {
            this.dom.resultModal.classList.add('hidden');
            this.startRta();
        });

        // サウンドON/OFF切り替え
        if (this.dom.btnToggleSound) {
            this.dom.btnToggleSound.addEventListener('click', () => {
                const muted = window.soundSystem.toggleMute();
                this.dom.btnToggleSound.innerHTML = muted ? '🔇 サウンドOFF' : '🔊 サウンドON';
                this.dom.btnToggleSound.classList.toggle('muted', muted);
            });
        }

        // ランキングフィルター切り替え
        this.dom.leaderboardFilterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.leaderboardFilterBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentLeaderboardFilter = e.target.dataset.filter;
                this.updateLeaderboardUI();
            });
        });

        // タブ切り替え
        this.dom.tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                this.dom.tabButtons.forEach(b => b.classList.remove('active'));
                this.dom.tabPanels.forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(`tab-${targetTab}`).classList.add('active');
                if (targetTab === 'leaderboard') this.updateLeaderboardUI();
                if (targetTab === 'stats') this.updateStatsUI();
            });
        });

        if (this.dom.btnClearDB) {
            this.dom.btnClearDB.addEventListener('click', async () => {
                if (confirm('すべてのプレイログ・ランキング記録をリセットしますか？')) {
                    await window.gameDB.clearAllData();
                    this.personalBest = null;
                    this.bestSegments = {};
                    this.lastSavedRunId = null;
                    this.updateLeaderboardUI();
                    this.updateStatsUI();
                    this.renderSplitsListInitial();
                    alert('データベースを初期化しました。');
                }
            });
        }
    }

    // 初期スプリット表の描画（LiveSplit風UI）
    renderSplitsListInitial() {
        this.dom.splitsList.innerHTML = '';
        this.adsMaster.forEach(ad => {
            const pbSplit = this.personalBest?.splits?.find(s => s.round === ad.round);
            const pbTimeText = pbSplit ? this.formatTime(pbSplit.timeMs) : '-:--.--';

            const row = document.createElement('div');
            row.className = 'split-row';
            row.id = `split-row-${ad.round}`;
            row.innerHTML = `
                <div class="split-name">
                    <span class="split-num">R${ad.round}</span>
                    <span class="split-title">${ad.title}</span>
                </div>
                <div class="split-diff" id="split-diff-${ad.round}"></div>
                <div class="split-time" id="split-time-${ad.round}">${pbTimeText}</div>
            `;
            this.dom.splitsList.appendChild(row);
        });
    }

    // RTA 開始
    async startRta() {
        if (this.state === 'running') return;
        this.resetGame();

        // 3... 2... 1... GO! カウントダウン
        this.state = 'countdown';
        this.dom.btnStartRta.disabled = true;
        
        window.soundSystem?.playCountdown(false);
        this.dom.adPlaceholder.innerHTML = `<div class="countdown-text">READY...</div>`;
        await this.sleep(600);

        window.soundSystem?.playCountdown(true);
        this.dom.adPlaceholder.innerHTML = `<div class="countdown-text highlight">START!</div>`;
        await this.sleep(400);

        this.state = 'running';
        this.currentRound = 1;
        this.splits = [];
        this.totalMisses = 0;
        this.currentRoundMisses = 0;
        this.startTime = performance.now();
        this.roundStartTime = this.startTime;

        // タイマーループ開始
        this.startTimerLoop();

        // 第1ラウンド広告を出現
        this.loadRound(this.currentRound);
    }

    startTimerLoop() {
        const update = () => {
            if (this.state !== 'running' && this.state !== 'penalty') return;
            const now = performance.now();
            this.elapsedTime = now - this.startTime;
            this.dom.mainTimer.textContent = this.formatTime(this.elapsedTime);

            const roundElapsed = now - this.roundStartTime;
            this.dom.roundTimer.textContent = `区間: ${this.formatTime(roundElapsed)}`;

            this.timerAnimationFrame = requestAnimationFrame(update);
        };
        this.timerAnimationFrame = requestAnimationFrame(update);
    }

    // ラウンドのロード＆広告ギミック構築
    loadRound(roundNum) {
        if (roundNum > this.maxRounds) {
            this.finishRta();
            return;
        }

        this.currentRound = roundNum;
        this.currentRoundMisses = 0;
        this.roundStartTime = performance.now();
        this.dom.roundIndicator.textContent = `ROUND ${roundNum} / ${this.maxRounds}`;

        // スプリット行のアクティブ強調
        document.querySelectorAll('.split-row').forEach(r => r.classList.remove('active-round'));
        const activeRow = document.getElementById(`split-row-${roundNum}`);
        if (activeRow) activeRow.classList.add('active-round');

        // クリーンアップ
        if (this.activeGimmickCleanup) {
            this.activeGimmickCleanup();
            this.activeGimmickCleanup = null;
        }

        const adData = this.adsMaster.find(a => a.round === roundNum);
        this.renderAdBanner(adData);
    }

    // 広告バナーのレンダリング
    renderAdBanner(adData) {
        this.dom.adArea.innerHTML = '';

        const banner = document.createElement('div');
        banner.className = `ad-banner gimmick-${adData.gimmickType}`;
        banner.id = 'current-ad-banner';

        // バナー全体の誤クリック（ストア誘導トラップ）
        banner.addEventListener('click', (e) => {
            if (!e.target.closest('.close-btn-real') && !e.target.closest('.close-btn-fake') && !e.target.closest('.secondary-close-btn')) {
                this.triggerPenalty('広告本体をクリックしてしまった！');
            }
        });

        // 本物の×ボタン
        const realCloseBtn = document.createElement('button');
        realCloseBtn.className = 'close-btn-real';
        realCloseBtn.setAttribute('title', '広告を閉じる');
        realCloseBtn.innerHTML = '&times;';
        realCloseBtn.style.width = `${adData.closeBtnSize}px`;
        realCloseBtn.style.height = `${adData.closeBtnSize}px`;
        realCloseBtn.style.fontSize = `${adData.closeBtnSize}px`;

        // ×クリック時の成功ハンドラ
        realCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleSuccessClose();
        });

        // ギミックごとの個別構築
        this.setupGimmick(adData, banner, realCloseBtn);

        this.dom.adArea.appendChild(banner);
    }

    // ギミック別の個別ロジック
    setupGimmick(adData, banner, realCloseBtn) {
        const adHtml = `
            <div class="ad-inner-content">
                <div class="ad-tag-badge">${adData.category}</div>
                <h3 class="ad-headline">${adData.title}</h3>
                <p class="ad-copy">${adData.adCopy}</p>
                <div class="ad-cta-button">今すぐ無料で試す &gt;</div>
            </div>
        `;
        banner.innerHTML = adHtml;

        switch (adData.gimmickType) {
            case 'tiny': // R1: 基本の極小×（右上）
                realCloseBtn.style.top = '6px';
                realCloseBtn.style.right = '6px';
                banner.appendChild(realCloseBtn);
                break;

            case 'fake': // R2: 偽の巨大×が中央右、本物は左上
                const fakeBtnR2 = document.createElement('div');
                fakeBtnR2.className = 'close-btn-fake fake-large';
                fakeBtnR2.innerHTML = '&times;';
                fakeBtnR2.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.triggerPenalty('ダミーの×を押してしまった！');
                });
                banner.appendChild(fakeBtnR2);

                realCloseBtn.style.top = '6px';
                realCloseBtn.style.left = '6px';
                banner.appendChild(realCloseBtn);
                break;

            case 'camouflage': // R3: 保護色
                banner.classList.add('bg-monochrome');
                realCloseBtn.classList.add('camouflage-btn');
                realCloseBtn.style.top = '4px';
                realCloseBtn.style.right = '4px';
                banner.appendChild(realCloseBtn);
                break;

            case 'countdown': // R4: カウントダウン3秒
                const countdownBox = document.createElement('div');
                countdownBox.className = 'countdown-badge';
                let remaining = 3;
                countdownBox.textContent = `広告スキップまで ${remaining}秒`;
                banner.appendChild(countdownBox);

                const countTimer = setInterval(() => {
                    remaining--;
                    if (remaining > 0) {
                        countdownBox.textContent = `広告スキップまで ${remaining}秒`;
                    } else {
                        clearInterval(countTimer);
                        countdownBox.remove();
                        realCloseBtn.style.top = '8px';
                        realCloseBtn.style.right = '8px';
                        banner.appendChild(realCloseBtn);
                    }
                }, 900);

                this.activeGimmickCleanup = () => clearInterval(countTimer);
                break;

            case 'running': // R5: カーソルが近づくと逃げる
                realCloseBtn.style.top = '10px';
                realCloseBtn.style.right = '10px';
                realCloseBtn.classList.add('running-btn');
                let runawayCount = 0;

                const onMouseEnter = () => {
                    if (runawayCount < 2) {
                        runawayCount++;
                        window.soundSystem?.playRunaway();
                        const randomTop = Math.floor(Math.random() * 70) + 10;
                        const randomLeft = Math.floor(Math.random() * 70) + 10;
                        realCloseBtn.style.top = `${randomTop}%`;
                        realCloseBtn.style.left = `${randomLeft}%`;
                        realCloseBtn.style.right = 'auto';
                    }
                };
                realCloseBtn.addEventListener('mouseenter', onMouseEnter);
                banner.appendChild(realCloseBtn);

                this.activeGimmickCleanup = () => {
                    realCloseBtn.removeEventListener('mouseenter', onMouseEnter);
                };
                break;

            case 'tiny_overflow': // R6: 枠の外側にはみ出した7px極小×
                realCloseBtn.style.top = '-8px';
                realCloseBtn.style.right = '-8px';
                realCloseBtn.classList.add('overflow-btn');
                banner.appendChild(realCloseBtn);
                break;

            case 'double_confirm': // R7: ×を押すと「本当に閉じますか？」ポップアップ
                realCloseBtn.style.top = '6px';
                realCloseBtn.style.right = '6px';
                
                const firstClick = (e) => {
                    e.stopPropagation();
                    window.soundSystem?.playCloseSuccess();
                    realCloseBtn.removeEventListener('click', firstClick);
                    this.showConfirmDialog(banner);
                };
                realCloseBtn.addEventListener('click', firstClick);
                banner.appendChild(realCloseBtn);
                break;

            case 'multi_fake': // R8: 偽物が3箇所、本物は右上のiマークの隣
                const fakePositions = [
                    { top: '6px', left: '6px' },
                    { bottom: '8px', right: '8px' },
                    { bottom: '8px', left: '8px' }
                ];
                fakePositions.forEach(pos => {
                    const fb = document.createElement('div');
                    fb.className = 'close-btn-fake';
                    fb.innerHTML = '&times;';
                    Object.assign(fb.style, pos);
                    fb.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.triggerPenalty('ダミー×をクリック！');
                    });
                    banner.appendChild(fb);
                });

                const infoIcon = document.createElement('span');
                infoIcon.className = 'info-icon';
                infoIcon.textContent = 'ⓘ';
                infoIcon.style.top = '6px';
                infoIcon.style.right = '6px';
                banner.appendChild(infoIcon);

                realCloseBtn.style.top = '6px';
                realCloseBtn.style.right = '24px';
                banner.appendChild(realCloseBtn);
                break;

            case 'rotating': // R9: 回転＆伸縮アニメーション
                realCloseBtn.style.top = '10px';
                realCloseBtn.style.right = '10px';
                realCloseBtn.classList.add('rotating-btn');
                banner.appendChild(realCloseBtn);
                break;

            case 'boss_combo': // R10: 1.5秒待機後に半透明出現＋1度逃げる
                const bossNotice = document.createElement('div');
                bossNotice.className = 'boss-notice';
                bossNotice.textContent = '読み込み中...';
                banner.appendChild(bossNotice);

                const bossTimer = setTimeout(() => {
                    bossNotice.remove();
                    realCloseBtn.style.top = '12px';
                    realCloseBtn.style.right = '12px';
                    realCloseBtn.classList.add('boss-btn');
                    let bossRan = false;
                    realCloseBtn.addEventListener('mouseenter', () => {
                        if (!bossRan) {
                            bossRan = true;
                            window.soundSystem?.playRunaway();
                            realCloseBtn.style.top = '85%';
                            realCloseBtn.style.right = '85%';
                        }
                    });
                    banner.appendChild(realCloseBtn);
                }, 1500);

                this.activeGimmickCleanup = () => clearTimeout(bossTimer);
                break;
        }
    }

    // R7用 二重確認ダイアログ
    showConfirmDialog(banner) {
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <div class="confirm-content">
                <h4>本当にこのお得な情報を閉じますか？</h4>
                <p>今すぐ登録すると特典が受け取れます！</p>
                <div class="confirm-buttons">
                    <button class="btn-continue-trap">アプリを続ける (推奨)</button>
                    <a href="javascript:void(0)" class="secondary-close-btn">閉じる</a>
                </div>
            </div>
        `;

        dialog.querySelector('.btn-continue-trap').addEventListener('click', (e) => {
            e.stopPropagation();
            this.triggerPenalty('「アプリを続ける」を押してしまった！');
        });

        dialog.querySelector('.secondary-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleSuccessClose();
        });

        banner.appendChild(dialog);
    }

    // 誤タップ時のペナルティ処理（効果音 ＋ +3.00秒加算）
    triggerPenalty(reason) {
        if (this.state === 'penalty') return;
        this.state = 'penalty';
        this.currentRoundMisses++;
        this.totalMisses++;
        this.penaltyCount++;

        // ペナルティ効果音
        window.soundSystem?.playMissPenalty();

        // タイム加算（3000ms）
        this.startTime -= 3000;
        this.elapsedTime = performance.now() - this.startTime;
        this.dom.mainTimer.textContent = this.formatTime(this.elapsedTime);

        // オーバーレイ演出
        this.dom.penaltyCount.textContent = `MISCLICK! +3.00s PENALTY (${reason})`;
        this.dom.penaltyOverlay.classList.remove('hidden');

        // 画面シェイク
        document.body.classList.add('screen-shake');
        setTimeout(() => document.body.classList.remove('screen-shake'), 400);

        setTimeout(() => {
            this.dom.penaltyOverlay.classList.add('hidden');
            if (this.state === 'penalty') {
                this.state = 'running';
            }
        }, 1200);
    }

    // ×ボタンのクリック成功ハンドラ
    handleSuccessClose() {
        if (this.state !== 'running' && this.state !== 'penalty') return;

        const now = performance.now();
        const splitTimeMs = Math.round(now - this.roundStartTime);

        // ゴールドスプリット判定
        const bestSeg = this.bestSegments[this.currentRound];
        const isGold = (bestSeg === null || splitTimeMs < bestSeg);

        if (isGold) {
            window.soundSystem?.playGoldSplit();
        } else {
            window.soundSystem?.playCloseSuccess();
        }

        // スプリット記録
        this.splits.push({
            round: this.currentRound,
            timeMs: splitTimeMs,
            misses: this.currentRoundMisses,
            gimmickType: this.adsMaster.find(a => a.round === this.currentRound)?.gimmickType
        });

        // スプリットUIの更新
        this.updateSplitRowUI(this.currentRound, splitTimeMs, isGold);

        // 次のラウンドへ
        this.currentRound++;
        if (this.currentRound <= this.maxRounds) {
            this.loadRound(this.currentRound);
        } else {
            this.finishRta();
        }
    }

    // スプリット行の更新
    updateSplitRowUI(round, roundTimeMs, isGold) {
        const timeEl = document.getElementById(`split-time-${round}`);
        const diffEl = document.getElementById(`split-diff-${round}`);
        const rowEl = document.getElementById(`split-row-${round}`);

        if (timeEl) timeEl.textContent = this.formatTime(roundTimeMs);

        // PB との比較
        const pbSplit = this.personalBest?.splits?.find(s => s.round === round);
        if (pbSplit && diffEl) {
            const diffMs = roundTimeMs - pbSplit.timeMs;
            const diffSec = (diffMs / 1000).toFixed(2);
            if (diffMs <= 0) {
                diffEl.textContent = `${diffSec}s`;
                diffEl.className = 'split-diff faster'; // 緑色
            } else {
                diffEl.textContent = `+${diffSec}s`;
                diffEl.className = 'split-diff slower'; // 赤色
            }
        }

        if (isGold) {
            rowEl?.classList.add('gold-split');
        }
    }

    // RTA完走
    finishRta() {
        this.state = 'cleared';
        cancelAnimationFrame(this.timerAnimationFrame);

        window.soundSystem?.playVictory();

        const totalTimeMs = Math.round(this.elapsedTime);
        const rank = this.calculateRank(totalTimeMs);

        // リザルトモーダル表示
        this.dom.resultTime.textContent = this.formatTime(totalTimeMs);
        this.dom.resultMisses.textContent = `${this.totalMisses} 回 (計 +${(this.totalMisses * 3.0).toFixed(1)}s 加算)`;
        this.dom.resultRank.textContent = rank.grade;
        this.dom.resultRank.className = `rank-badge rank-${rank.grade.toLowerCase()}`;

        // ラップ一覧表生成
        this.dom.resultSplitsTable.innerHTML = '';
        this.splits.forEach(s => {
            const tr = document.createElement('tr');
            const ad = this.adsMaster.find(a => a.round === s.round);
            tr.innerHTML = `
                <td>R${s.round}</td>
                <td>${ad ? ad.title : ''}</td>
                <td>${this.formatTime(s.timeMs)}</td>
                <td>${s.misses > 0 ? `+${s.misses}` : '0'}</td>
            `;
            this.dom.resultSplitsTable.appendChild(tr);
        });

        this.dom.resultModal.classList.remove('hidden');
        this.dom.btnStartRta.disabled = false;
    }

    calculateRank(totalTimeMs) {
        const sec = totalTimeMs / 1000;
        if (sec < 13.0) return { grade: 'S', title: '神速の広告ブロッカー' };
        if (sec < 20.0) return { grade: 'A', title: '手練れネットサーファー' };
        if (sec < 30.0) return { grade: 'B', title: '一般市民' };
        if (sec < 45.0) return { grade: 'C', title: '広告のいいカモ' };
        return { grade: 'F', title: '養分マスター' };
    }

    // 結果をDBに保存
    async saveRunRecord() {
        const playerName = this.dom.playerNameInput.value.trim() || '名無しの走者';
        const totalTimeMs = Math.round(this.elapsedTime);
        const rank = this.calculateRank(totalTimeMs).grade;

        const newRunId = await window.gameDB.saveRun({
            playerName,
            totalTimeMs,
            totalMisses: this.totalMisses,
            rank,
            splits: this.splits
        });

        this.lastSavedRunId = newRunId;
        alert('データベースに記録を保存しました！');
        this.dom.btnSaveRecord.disabled = true;

        // PBやランキング再取得
        this.personalBest = await window.gameDB.getPersonalBest();
        this.bestSegments = await window.gameDB.getBestSegments();
        this.updateLeaderboardUI();
        this.updateStatsUI();
    }

    // リーダーボードUI更新（フィルター機能＆ハイライト）
    async updateLeaderboardUI() {
        const runs = await window.gameDB.getLeaderboard(this.currentLeaderboardFilter, 20);
        this.dom.leaderboardBody.innerHTML = '';

        if (runs.length === 0) {
            this.dom.leaderboardBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#888;">記録がありません。RTAに挑戦しよう！</td></tr>`;
            return;
        }

        runs.forEach((run, idx) => {
            const tr = document.createElement('tr');
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
            const isHighlight = run.id === this.lastSavedRunId;

            if (isHighlight) tr.classList.add('highlight-row');

            tr.innerHTML = `
                <td>${medal}</td>
                <td><strong>${this.escapeHtml(run.player_name)}</strong></td>
                <td><span class="rank-tag rank-${run.rank.toLowerCase()}">${run.rank}</span></td>
                <td class="time-col">${this.formatTime(run.total_time_ms)}</td>
                <td>${run.total_misses || 0}</td>
            `;
            this.dom.leaderboardBody.appendChild(tr);
        });
    }

    // 統計・分析UI更新
    async updateStatsUI() {
        const stats = await window.gameDB.getStatistics();
        const bestSegments = await window.gameDB.getBestSegments();

        let theoryBestMs = 0;
        for (let r = 1; r <= 10; r++) {
            if (bestSegments[r]) theoryBestMs += bestSegments[r];
        }

        let html = `
            <div class="stats-cards-grid">
                <div class="stat-card">
                    <div class="stat-label">総挑戦回数</div>
                    <div class="stat-val">${stats.totalRuns} 回</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">自己ベスト (PB)</div>
                    <div class="stat-val highlight">${stats.bestTimeMs ? this.formatTime(stats.bestTimeMs) : '-:--.--'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">理論値 (最速区間合計)</div>
                    <div class="stat-val gold">${theoryBestMs > 0 ? this.formatTime(theoryBestMs) : '-:--.--'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">平均クリアタイム</div>
                    <div class="stat-val">${stats.avgTotalTimeMs > 0 ? this.formatTime(stats.avgTotalTimeMs) : '-:--.--'}</div>
                </div>
            </div>

            <h4 style="margin-top:16px; margin-bottom:8px; font-size:0.85rem;">ラウンド別ミス率・平均タイム (DB 集計)</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Round</th>
                        <th>ギミック名</th>
                        <th>平均タイム</th>
                        <th>平均ミス</th>
                        <th>危険度</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (let r = 1; r <= 10; r++) {
            const ad = this.adsMaster.find(a => a.round === r);
            const rs = stats.roundStats[r];
            const avgMiss = rs ? parseFloat(rs.avgMisses) : 0;
            const dangerTag = avgMiss > 0.8 ? '<span class="danger-high">高危険</span>' : avgMiss > 0.3 ? '<span class="danger-mid">注意</span>' : '<span class="danger-low">安全</span>';

            html += `
                <tr>
                    <td>R${r}</td>
                    <td>${ad ? ad.title : ''}</td>
                    <td>${rs && rs.avgTimeMs > 0 ? this.formatTime(rs.avgTimeMs) : '-'}</td>
                    <td>${rs ? rs.avgMisses : '0'}</td>
                    <td>${dangerTag}</td>
                </tr>
            `;
        }

        html += `</tbody></table>`;
        this.dom.statsContainer.innerHTML = html;
    }

    resetGame() {
        if (this.activeGimmickCleanup) {
            this.activeGimmickCleanup();
            this.activeGimmickCleanup = null;
        }
        cancelAnimationFrame(this.timerAnimationFrame);
        this.state = 'idle';
        this.elapsedTime = 0;
        this.currentRound = 1;
        this.splits = [];
        this.dom.mainTimer.textContent = '00:00.000';
        this.dom.roundTimer.textContent = '区間: 00:00.000';
        this.dom.roundIndicator.textContent = 'ROUND 1 / 10';
        this.dom.btnStartRta.disabled = false;
        this.dom.btnSaveRecord.disabled = false;
        this.dom.penaltyOverlay.classList.add('hidden');
        this.dom.adArea.innerHTML = `
            <div id="ad-placeholder" class="ad-placeholder">
                <div class="start-hint">「RTA スタート！」を押すと計測が始まります</div>
            </div>
        `;
        this.cacheDom();
        this.renderSplitsListInitial();
    }

    formatTime(ms) {
        if (isNaN(ms) || ms < 0) return '00:00.000';
        const totalSec = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSec / 60);
        const seconds = totalSec % 60;
        const milliseconds = Math.floor(ms % 1000);

        const mStr = String(minutes).padStart(2, '0');
        const sStr = String(seconds).padStart(2, '0');
        const msStr = String(milliseconds).padStart(3, '0');
        return `${mStr}:${sStr}.${msStr}`;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new AdCloseGame();
    window.game.init();
});
