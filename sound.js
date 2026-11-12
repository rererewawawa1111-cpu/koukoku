/**
 * sound.js - Web Audio API を用いた効果音シンセサイザーモジュール
 * 外部音声ファイル不要・完全オフライン・ゼロ遅延で再生可能
 */
class SoundSystem {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.masterVolume = 0.3;
    }

    init() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    // 1. カウントダウン音 (ピッ / ポーン)
    playCountdown(isFinal = false) {
        if (this.muted) return;
        this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        const freq = isFinal ? 880 : 440; // A5 (880Hz) or A4 (440Hz)
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        const duration = isFinal ? 0.35 : 0.15;
        gain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // 2. 広告を正しく閉じた時の爽快な音 (ピロリン！)
    playCloseSuccess() {
        if (this.muted) return;
        this.init();

        const t = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'triangle';
        osc2.type = 'sine';

        // 2和音のアルペジオ (E5 -> B5)
        osc1.frequency.setValueAtTime(659.25, t);
        osc1.frequency.setValueAtTime(987.77, t + 0.06);

        osc2.frequency.setValueAtTime(1318.5, t);
        osc2.frequency.setValueAtTime(1975.5, t + 0.06);

        gain.gain.setValueAtTime(this.masterVolume * 0.9, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.2);
        osc2.stop(t + 0.2);
    }

    // 3. ミス・誤クリック時のブブーッ！音（ペナルティ）
    playMissPenalty() {
        if (this.muted) return;
        this.init();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        // 不協和音の下がるトーン
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.linearRampToValueAtTime(90, t + 0.25);

        gain.gain.setValueAtTime(this.masterVolume * 1.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.3);
    }

    // 4. ×ボタンが逃げたときの「ピュッ！」という音
    playRunaway() {
        if (this.muted) return;
        this.init();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);

        gain.gain.setValueAtTime(this.masterVolume * 0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.08);
    }

    // 5. 区間ベスト更新（ゴールドスプリット）時のキラキラ音
    playGoldSplit() {
        if (this.muted) return;
        this.init();

        const t = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + idx * 0.04);
            gain.gain.setValueAtTime(this.masterVolume * 0.5, t + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.15);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t + idx * 0.04);
            osc.stop(t + idx * 0.04 + 0.15);
        });
    }

    // 6. RTA完走ファンファーレ (勝利音)
    playVictory() {
        if (this.muted) return;
        this.init();

        const t = this.ctx.currentTime;
        const notes = [
            { f: 523.25, d: 0.12, w: 0 },    // C5
            { f: 659.25, d: 0.12, w: 0.12 }, // E5
            { f: 783.99, d: 0.12, w: 0.24 }, // G5
            { f: 1046.5, d: 0.45, w: 0.36 }  // C6
        ];

        notes.forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.f, t + note.w);

            gain.gain.setValueAtTime(this.masterVolume * 1.0, t + note.w);
            gain.gain.exponentialRampToValueAtTime(0.001, t + note.w + note.d);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t + note.w);
            osc.stop(t + note.w + note.d);
        });
    }
}

window.soundSystem = new SoundSystem();
