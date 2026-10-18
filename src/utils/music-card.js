// Music card runtime adapted from Twilight. Data stays in HTML attributes, not JS strings.
const cards = new Map();

export function parseLrc(text = '') {
    const lines = [];
    for (const line of text.split(/\r?\n/)) {
        const content = line.replace(/\[[^\]]*\]/g, '').trim();
        for (const match of line.matchAll(/\[(\d+):(\d{1,2})(?:[.:](\d+))?\]/g)) {
            lines.push({ time: Number(match[1]) * 60 + Number(match[2]) + (match[3] ? Number('0.' + match[3]) : 0), text: content || '…' });
        }
    }
    return lines.sort((a, b) => a.time - b.time);
}

export function musicResource(value) {
    if (!value || typeof value !== 'string') return '';
    value = value.trim();
    if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
    return '/' + value;
}

export function initMusicCards(root = document) {
    for (const [card, cleanup] of cards) {
        if (!card.isConnected) { cleanup(); cards.delete(card); }
    }
    for (const card of root.querySelectorAll('.card-music[data-music]')) {
        if (cards.has(card)) continue;
        let data;
        try { data = JSON.parse(card.dataset.music); } catch { continue; }
        const audio = card.querySelector('audio');
        const button = card.querySelector('.play-btn');
        const progress = card.querySelector('.progress-container');
        const bar = card.querySelector('.progress-bar');
        const time = card.querySelector('.time-display');
        const lyric = card.querySelector('.lyric-current');
        if (!audio || !button || !progress || !lyric) continue;
        const controller = new AbortController();
        const signal = controller.signal;
        let lyrics = [], loadPromise, ready = false, wanted = false;
        const listen = (element, type, handler) => element.addEventListener(type, handler, { signal });
        const notice = text => { lyric.textContent = text; };
        async function request(url, type) {
            const deadline = new AbortController();
            const stop = () => deadline.abort();
            signal.addEventListener('abort', stop, { once: true });
            const timer = setTimeout(stop, 12000);
            try {
                const response = await fetch(url, { signal: deadline.signal });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return await response[type]();
            } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); }
        }
        async function loadLyrics() {
            try {
                let text = data.inlineLyrics || '';
                if (!text && data.lrc) {
                    text = /^\s*\[/.test(data.lrc) ? data.lrc : await request(musicResource(data.lrc), 'text');
                }
                if (signal.aborted) return;
                lyrics = parseLrc(text);
                notice(lyrics[0]?.text || '暂无歌词');
            } catch { if (!signal.aborted) notice('歌词暂时无法加载，不影响播放'); }
        }
        async function load() {
            if (ready) return;
            if (loadPromise) return loadPromise;
            loadPromise = (async () => {
                if (data.meting) {
                    const response = await request(musicResource(data.meting), 'json');
                    const song = Array.isArray(response) ? response[0] : response;
                    if (!song?.url) throw new Error('没有可播放的音源');
                    data = { ...data, audio: musicResource(song.url), title: song.title || song.name || data.title,
                        artist: song.author || song.artist || data.artist, cover: musicResource(song.pic || song.cover), lrc: song.lrc || '', inlineLyrics: '' };
                    card.querySelector('.music-title').textContent = data.title;
                    card.querySelector('.music-artist').textContent = data.artist;
                    card.querySelector('.music-cover').style.backgroundImage = data.cover ? `url(${JSON.stringify(data.cover)})` : '';
                }
                if (!data.audio || signal.aborted) throw new Error('音频地址为空');
                audio.src = musicResource(data.audio);
                ready = true;
                void loadLyrics();
            })().catch(error => {
                if (!signal.aborted) notice('音乐暂时无法加载，点击播放重试');
                throw error;
            }).finally(() => { loadPromise = undefined; });
            return loadPromise;
        }
        function updateButton() {
            const playing = !audio.paused;
            button.setAttribute('aria-label', playing ? '暂停' : '播放');
            button.setAttribute('aria-pressed', String(playing));
            button.querySelector('.play-icon').style.display = playing ? 'none' : '';
            button.querySelector('.pause-icon').style.display = playing ? '' : 'none';
        }
        listen(button, 'click', async () => {
            wanted = !wanted;
            if (!wanted) { audio.pause(); return; }
            button.setAttribute('aria-busy', 'true');
            try {
                await load();
                if (signal.aborted || !wanted) return;
                await audio.play();
            } catch { wanted = false; if (!signal.aborted) notice('暂时无法播放，请检查音源后重试'); }
            finally { button.removeAttribute('aria-busy'); updateButton(); }
        });
        listen(audio, 'play', () => {
            wanted = true;
            for (const other of document.querySelectorAll('audio')) if (other !== audio) other.pause();
            updateButton();
        });
        listen(audio, 'pause', () => { wanted = false; updateButton(); });
        listen(audio, 'error', () => { wanted = false; notice('音源暂时无法播放'); updateButton(); });
        listen(audio, 'ended', () => { wanted = false; updateButton(); });
        const format = n => Number.isFinite(n) ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` : '0:00';
        const updateProgress = () => {
            const percent = audio.duration > 0 ? Math.min(100, audio.currentTime / audio.duration * 100) : 0;
            bar.style.width = percent + '%';
            progress.setAttribute('aria-valuenow', String(Math.round(percent)));
            time.textContent = `${format(audio.currentTime)} / ${format(audio.duration)}`;
            let current;
            for (const line of lyrics) { if (line.time > audio.currentTime) break; current = line; }
            if (current && lyric.textContent !== current.text) {
                lyric.textContent = current.text;
                lyric.animate?.([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300 });
            }
        };
        listen(audio, 'timeupdate', updateProgress);
        listen(audio, 'loadedmetadata', updateProgress);
        listen(progress, 'click', event => {
            if (!Number.isFinite(audio.duration)) return;
            const bounds = progress.getBoundingClientRect();
            audio.currentTime = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * audio.duration;
        });
        listen(progress, 'keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !Number.isFinite(audio.duration)) return;
            event.preventDefault();
            audio.currentTime = event.key === 'Home' ? 0 : event.key === 'End' ? audio.duration :
                Math.max(0, Math.min(audio.duration, audio.currentTime + (event.key === 'ArrowLeft' ? -5 : 5)));
        });
        let observer;
        if (typeof IntersectionObserver !== 'undefined') {
            observer = new IntersectionObserver(entries => {
                if (!entries.some(entry => entry.isIntersecting)) return;
                observer.disconnect(); void load().catch(() => {});
            }, { rootMargin: '100px' });
            observer.observe(card);
        } else void load().catch(() => {});
        cards.set(card, () => { observer?.disconnect(); controller.abort(); audio.pause(); audio.removeAttribute('src'); audio.load(); });
    }
}

export function cleanupMusicCards(root) {
    for (const [card, cleanup] of cards) {
        if (root && !root.contains(card)) continue;
        cleanup(); cards.delete(card);
    }
}
