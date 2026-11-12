/**
 * db.js - IndexedDB を用いた RTA 記録・広告マスタ管理モジュール
 */
const DB_NAME = 'AdCloseRtaDB';
const DB_VERSION = 2; // バージョンアップ（初期ライバルシード対応）

class GameDB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. 広告マスタテーブル
                if (!db.objectStoreNames.contains('ads_master')) {
                    const adsStore = db.createObjectStore('ads_master', { keyPath: 'round' });
                    adsStore.createIndex('gimmick_type', 'gimmick_type', { unique: false });
                }

                // 2. RTA通し記録テーブル
                if (!db.objectStoreNames.contains('runs')) {
                    const runsStore = db.createObjectStore('runs', { keyPath: 'id', autoIncrement: true });
                    runsStore.createIndex('total_time_ms', 'total_time_ms', { unique: false });
                    runsStore.createIndex('player_name', 'player_name', { unique: false });
                    runsStore.createIndex('created_at', 'created_at', { unique: false });
                    runsStore.createIndex('total_misses', 'total_misses', { unique: false });
                }

                // 3. ラウンド別スプリット詳細ログテーブル (分析用)
                if (!db.objectStoreNames.contains('splits')) {
                    const splitsStore = db.createObjectStore('splits', { keyPath: 'id', autoIncrement: true });
                    splitsStore.createIndex('run_id', 'run_id', { unique: false });
                    splitsStore.createIndex('round', 'round', { unique: false });
                    splitsStore.createIndex('time_ms', 'time_ms', { unique: false });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this.seedAdsMaster();
                await this.seedRivalRunners();
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB open error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // 広告マスタデータの初期登録
    async seedAdsMaster() {
        const adsData = [
            {
                round: 1,
                title: "バッテリー警告",
                adCopy: "【警告】あなたのスマホのバッテリーが急速に劣化しています！今すぐ修復を！",
                category: "警告系",
                gimmickType: "tiny",
                gimmickDesc: "基本形：右上にある極小×ボタン（12px）",
                closeBtnSize: 12,
                baseTimeLimit: 5.0
            },
            {
                round: 2,
                title: "怪しい放置系RPG",
                adCopy: "今なら無料1000連ガチャ！Lv9999魔剣士になって美少女たちを救え！",
                category: "ソシャゲ系",
                gimmickType: "fake",
                gimmickDesc: "罠：画像の中に大きな偽の×マーク！本物は左上に隠れている",
                closeBtnSize: 14,
                baseTimeLimit: 5.0
            },
            {
                round: 3,
                title: "泥沼コミック広告",
                adCopy: "「お前のような無能は追放だ…」数年後、最強になって見返した結果ｗｗｗ",
                category: "漫画系",
                gimmickType: "camouflage",
                gimmickDesc: "保護色：漫画の黒枠・白枠と同化して極めて薄いコントラストの×",
                closeBtnSize: 12,
                baseTimeLimit: 5.0
            },
            {
                round: 4,
                title: "ピン抜きゲームの罠",
                adCopy: "ピンを抜いて溶岩からプリンセスを救え！知能指数150以上限定！",
                category: "プレイアブル系",
                gimmickType: "countdown",
                gimmickDesc: "カウントダウン：画面を触ると即ストア！カウント3秒終了まで×が出ない",
                closeBtnSize: 14,
                baseTimeLimit: 6.0
            },
            {
                round: 5,
                title: "スマホ容量クリーン",
                adCopy: "ストレージ容量が98%使用されています！今すぐ不要ファイルを削除！",
                category: "システム系",
                gimmickType: "running",
                gimmickDesc: "逃亡：マウスカーソルを近づけるとシュッと対角線へ逃げる！",
                closeBtnSize: 14,
                baseTimeLimit: 5.0
            },
            {
                round: 6,
                title: "飲むだけ簡単サプリ",
                adCopy: "【医師も仰天】寝る前に飲むだけで！？リピート率驚異の99.8％！",
                category: "健康・美容系",
                gimmickType: "tiny_overflow",
                gimmickDesc: "はみ出し極小：わずか7pxの極小×が広告枠の外側に半分はみ出している",
                closeBtnSize: 7,
                baseTimeLimit: 5.0
            },
            {
                round: 7,
                title: "ご近所マッチング",
                adCopy: "近くに住むあなたに興味がある人がメッセージを送っています！",
                category: "マッチング系",
                gimmickType: "double_confirm",
                gimmickDesc: "二段階確認：×を押すと「本当に閉じますか？」。巨大な[続ける]と極小の[閉じる]",
                closeBtnSize: 12,
                baseTimeLimit: 6.0
            },
            {
                round: 8,
                title: "ウイルス39個検出！",
                adCopy: "危険！トロイの木馬が検出されました。今すぐアプリで削除してください！",
                category: "警告系",
                gimmickType: "multi_fake",
                gimmickDesc: "ダミー大量：四隅に偽×が合計3個。本物はインフォアイコンの隣",
                closeBtnSize: 11,
                baseTimeLimit: 6.0
            },
            {
                round: 9,
                title: "超絶クソエイムガチャ",
                adCopy: "超激レアUR排出率99%！タップして無料スピンを回そう！",
                category: "カジノ系",
                gimmickType: "rotating",
                gimmickDesc: "回転振動：×ボタンが不規則に回転・伸縮しながら動いてエイムを狂わせる",
                closeBtnSize: 12,
                baseTimeLimit: 6.0
            },
            {
                round: 10,
                title: "元本保証・月利50%の投資術",
                adCopy: "【最終試練】AI自動売買で何もしなくても毎月100万円！？秘密を公開！",
                category: "怪しい投資系",
                gimmickType: "boss_combo",
                gimmickDesc: "複合BOSS：1.5秒待機後に半透明の極小×が出現＋1度だけカーソルから逃げる！",
                closeBtnSize: 9,
                baseTimeLimit: 7.0
            }
        ];

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['ads_master'], 'readwrite');
            const store = tx.objectStore('ads_master');
            for (const ad of adsData) {
                store.put(ad);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // 初期ライバル走者（CPUレコード）のシード投入
    async seedRivalRunners() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['runs', 'splits'], 'readwrite');
            const runsStore = tx.objectStore('runs');
            const countReq = runsStore.count();

            countReq.onsuccess = () => {
                if (countReq.result > 0) {
                    resolve(); // すでにデータがある場合はスキップ
                    return;
                }

                const rivals = [
                    {
                        name: "神速のAdBlocker",
                        totalMs: 11240,
                        misses: 0,
                        rank: "S",
                        baseSplit: 1120
                    },
                    {
                        name: "動体視力MAX",
                        totalMs: 15480,
                        misses: 0,
                        rank: "A",
                        baseSplit: 1540
                    },
                    {
                        name: "プロ広告消し職人",
                        totalMs: 18920,
                        misses: 1,
                        rank: "A",
                        baseSplit: 1590
                    },
                    {
                        name: "騙されやすい一般人",
                        totalMs: 27500,
                        misses: 3,
                        rank: "B",
                        baseSplit: 1850
                    },
                    {
                        name: "養分マスター",
                        totalMs: 44200,
                        misses: 6,
                        rank: "C",
                        baseSplit: 2620
                    }
                ];

                const splitsStore = tx.objectStore('splits');
                rivals.forEach((rival, idx) => {
                    const runRecord = {
                        player_name: rival.name,
                        total_time_ms: rival.totalMs,
                        total_misses: rival.misses,
                        rank: rival.rank,
                        created_at: new Date(Date.now() - (idx + 1) * 3600000 * 24).toISOString(),
                        splits: []
                    };

                    const runReq = runsStore.add(runRecord);
                    runReq.onsuccess = (e) => {
                        const runId = e.target.result;
                        for (let r = 1; r <= 10; r++) {
                            const roundTime = Math.round(rival.baseSplit * (0.8 + Math.random() * 0.4));
                            splitsStore.add({
                                run_id: runId,
                                round: r,
                                time_ms: roundTime,
                                misses: (r === 2 && rival.misses > 0) ? 1 : 0,
                                gimmick_type: "seeded",
                                created_at: runRecord.created_at
                            });
                        }
                    };
                });

                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            };
        });
    }

    // 全マスタデータ取得
    async getAdsMaster() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['ads_master'], 'readonly');
            const store = tx.objectStore('ads_master');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result.sort((a, b) => a.round - b.round));
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // RTA結果の保存（トランザクションでrunsとsplitsを同時保存）
    async saveRun({ playerName, totalTimeMs, totalMisses, rank, splits }) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['runs', 'splits'], 'readwrite');
            const runsStore = tx.objectStore('runs');
            const splitsStore = tx.objectStore('splits');

            const runRecord = {
                player_name: playerName || '名無しの走者',
                total_time_ms: totalTimeMs,
                total_misses: totalMisses,
                rank: rank,
                created_at: new Date().toISOString(),
                splits: splits
            };

            const runReq = runsStore.add(runRecord);

            runReq.onsuccess = (e) => {
                const runId = e.target.result;
                for (const split of splits) {
                    splitsStore.add({
                        run_id: runId,
                        round: split.round,
                        time_ms: split.timeMs,
                        misses: split.misses,
                        gimmick_type: split.gimmickType,
                        created_at: new Date().toISOString()
                    });
                }
            };

            tx.oncomplete = () => resolve(runReq.result);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // ランキング（リーダーボード）取得（フィルター機能付き）
    async getLeaderboard(filter = 'overall', limit = 20) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['runs'], 'readonly');
            const store = tx.objectStore('runs');
            const results = [];

            if (filter === 'recent') {
                // 最新順
                const index = store.index('created_at');
                const cursorReq = index.openCursor(null, 'prev');
                cursorReq.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor && results.length < limit) {
                        results.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                cursorReq.onerror = (e) => reject(e.target.error);
            } else {
                // 最速タイム順
                const index = store.index('total_time_ms');
                const cursorReq = index.openCursor();
                cursorReq.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor && results.length < limit) {
                        const run = cursor.value;
                        if (filter === 'no_miss') {
                            if (run.total_misses === 0) {
                                results.push(run);
                            }
                        } else {
                            results.push(run);
                        }
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                cursorReq.onerror = (e) => reject(e.target.error);
            }
        });
    }

    // 自己ベスト（Personal Best: PB）取得
    async getPersonalBest(playerName = null) {
        const board = await this.getLeaderboard('overall', 100);
        if (playerName) {
            return board.find(r => r.player_name === playerName) || null;
        }
        return board.length > 0 ? board[0] : null;
    }

    // 各ラウンドの過去最速タイム（理論値・ゴールドスプリット）を集計
    async getBestSegments() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['splits'], 'readonly');
            const store = tx.objectStore('splits');
            const req = store.getAll();

            req.onsuccess = () => {
                const allSplits = req.result;
                const bestSegments = {};
                for (let r = 1; r <= 10; r++) {
                    bestSegments[r] = null;
                }

                for (const s of allSplits) {
                    const r = s.round;
                    if (bestSegments[r] === null || s.time_ms < bestSegments[r]) {
                        bestSegments[r] = s.time_ms;
                    }
                }
                resolve(bestSegments);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // 統計データ（ダッシュボード用）
    async getStatistics() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['runs', 'splits'], 'readonly');
            const runsStore = tx.objectStore('runs');
            const splitsStore = tx.objectStore('splits');

            const stats = {
                totalRuns: 0,
                avgTotalTimeMs: 0,
                bestTimeMs: null,
                totalMissesAcrossAll: 0,
                roundStats: {}
            };

            for (let r = 1; r <= 10; r++) {
                stats.roundStats[r] = {
                    round: r,
                    totalMisses: 0,
                    totalTimeMs: 0,
                    count: 0,
                    avgTimeMs: 0,
                    avgMisses: 0
                };
            }

            const runsReq = runsStore.getAll();
            runsReq.onsuccess = () => {
                const runs = runsReq.result;
                stats.totalRuns = runs.length;
                if (runs.length > 0) {
                    const sumTime = runs.reduce((acc, cur) => acc + cur.total_time_ms, 0);
                    stats.avgTotalTimeMs = Math.round(sumTime / runs.length);
                    stats.bestTimeMs = Math.min(...runs.map(r => r.total_time_ms));
                    stats.totalMissesAcrossAll = runs.reduce((acc, cur) => acc + (cur.total_misses || 0), 0);
                }

                const splitsReq = splitsStore.getAll();
                splitsReq.onsuccess = () => {
                    const splits = splitsReq.result;
                    for (const s of splits) {
                        const r = s.round;
                        if (stats.roundStats[r]) {
                            stats.roundStats[r].count += 1;
                            stats.roundStats[r].totalTimeMs += s.time_ms;
                            stats.roundStats[r].totalMisses += s.misses || 0;
                        }
                    }

                    for (let r = 1; r <= 10; r++) {
                        const rs = stats.roundStats[r];
                        if (rs.count > 0) {
                            rs.avgTimeMs = Math.round(rs.totalTimeMs / rs.count);
                            rs.avgMisses = (rs.totalMisses / rs.count).toFixed(2);
                        }
                    }

                    resolve(stats);
                };
            };

            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // 全データリセット
    async clearAllData() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['runs', 'splits'], 'readwrite');
            tx.objectStore('runs').clear();
            tx.objectStore('splits').clear();
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }
}

// グローバルインスタンス
window.gameDB = new GameDB();
