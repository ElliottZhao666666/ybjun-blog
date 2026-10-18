import { initMusicCards, cleanupMusicCards } from './music-card.js';

let protectionCleanup;

export function refreshArticleEnhancements() {
    protectionCleanup?.();
    initMusicCards();
    const controller = new AbortController();
    const options = { capture: true, signal: controller.signal };
    protectionCleanup = () => controller.abort();
    const body = document.querySelector('.custom-md[data-copy-protection]');
    const flags = body ? JSON.parse(body.dataset.copyProtection) : {};
    const editable = target => target instanceof Element && target.closest('input,textarea,select,[contenteditable="true"]');
    const inBody = event => body && (body.contains(event.target) || body.contains(window.getSelection()?.anchorNode));
    const stop = event => { event.preventDefault(); event.stopImmediatePropagation(); };
    for (const type of ['copy', 'cut', 'paste']) {
        document.addEventListener(type, event => {
            if (flags.blockClipboard && !editable(event.target) && inBody(event)) stop(event);
        }, options);
    }
    document.addEventListener('contextmenu', event => {
        if (flags.blockContextMenu && !editable(event.target) && body?.contains(event.target)) stop(event);
    }, options);
    document.addEventListener('keydown', event => {
        if (flags.blockDevTools && !editable(event.target) && (event.key === 'F12' ||
            ((event.ctrlKey || event.metaKey) && ['u', 's', 'i', 'j', 'c'].includes(event.key.toLowerCase()) &&
                (['u', 's'].includes(event.key.toLowerCase()) || event.shiftKey)))) stop(event);
        const spoiler = event.target.closest?.('spoiler');
        if (spoiler && ['Enter', ' '].includes(event.key)) { event.preventDefault(); toggleSpoiler(spoiler); }
    }, options);
    document.addEventListener('click', event => {
        if (flags.blockClipboard && body?.contains(event.target) && event.target.closest?.('.copy-btn,.copy button')) { stop(event); return; }
        const spoiler = event.target.closest?.('spoiler');
        if (spoiler && !event.target.closest('a,button')) toggleSpoiler(spoiler);
    }, options);
    for (const spoiler of document.querySelectorAll('.custom-md spoiler')) {
        spoiler.tabIndex = 0;
        spoiler.setAttribute('role', 'button');
        spoiler.setAttribute('aria-label', '显示或隐藏剧透内容');
        spoiler.setAttribute('aria-expanded', spoiler.dataset.revealed === 'true' ? 'true' : 'false');
    }
}

function toggleSpoiler(spoiler) {
    const reveal = spoiler.dataset.revealed !== 'true';
    spoiler.dataset.revealed = String(reveal);
    spoiler.setAttribute('aria-expanded', String(reveal));
}

export function setupArticleEnhancements() {
    if (window.__articleEnhancementsInstalled) { refreshArticleEnhancements(); return; }
    window.__articleEnhancementsInstalled = true;
    const cleanup = () => { protectionCleanup?.(); cleanupMusicCards(); };
    const installed = new WeakSet();
    const setupSwup = () => {
        const swup = window.swup;
        if (!swup?.hooks || installed.has(swup)) return;
        installed.add(swup);
        swup.hooks.on('content:replace', cleanup, { before: true });
        swup.hooks.on('page:view', refreshArticleEnhancements);
    };
    setupSwup();
    document.addEventListener('swup:enable', setupSwup);
    document.addEventListener('astro:after-swap', refreshArticleEnhancements);
    window.addEventListener('content-decrypted', refreshArticleEnhancements);
    window.addEventListener('pagehide', cleanup);
    window.addEventListener('pageshow', refreshArticleEnhancements);
    refreshArticleEnhancements();
}
