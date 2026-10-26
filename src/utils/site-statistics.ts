import { get, writable } from "svelte/store";

const API_BASE = "https://commentblog.ybjun.com";
const CACHE_KEY = "ybjun:site-statistics:v1";
const REQUEST_TIMEOUT = 8000;

type StatisticsState = { pv: number | null; uv: number | null; failed: boolean };
export const siteStatistics = writable<StatisticsState>({ pv: null, uv: null, failed: false });

let started = false;
let currentPage = "";
let reading: Promise<void> | undefined;
let readController: AbortController | undefined;
let readVersion = 0;

function restoreCache() {
    try {
        const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
        if (cached && Number.isFinite(cached.pv) && Number.isFinite(cached.uv)) {
            siteStatistics.set({ pv: cached.pv, uv: cached.uv, failed: false });
        }
    } catch { /* Storage may be unavailable. */ }
}

function refreshStatistics(force = false): Promise<void> {
    if (reading && !force) return reading;
    readController?.abort();
    const controller = new AbortController();
    readController = controller;
    const version = ++readVersion;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    reading = (async () => {
        try {
            const response = await fetch(`${API_BASE}/site/stats`, { signal: controller.signal });
            if (!response.ok) throw new Error(`Statistics HTTP ${response.status}`);
            const data = await response.json();
            const pv = Number(data.site_pv);
            const uv = Number(data.site_uv);
            if (!Number.isFinite(pv) || !Number.isFinite(uv)) throw new Error("Invalid statistics");
            if (version !== readVersion) return;
            siteStatistics.set({ pv, uv, failed: false });
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ pv, uv })); } catch { /* Optional cache. */ }
        } catch (error) {
            if (version === readVersion) {
                siteStatistics.update(value => ({ ...value, failed: true }));
                console.warn("统计数据读取失败", error);
            }
        } finally {
            clearTimeout(timeout);
            if (version === readVersion) {
                reading = undefined;
                readController = undefined;
            }
        }
    })();
    return reading;
}

async function recordPageView() {
    const page = `${location.pathname}${location.search}`;
    // The initial module and Astro's page-load event can describe the same view.
    // Resizing or mounting another sidebar is never a new page view.
    if (page === currentPage) return;
    currentPage = page;
    if (get(siteStatistics).pv === null) void refreshStatistics();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
        const response = await fetch(`${API_BASE}/site/visit`, { method: "POST", signal: controller.signal });
        if (!response.ok) throw new Error(`Visit HTTP ${response.status}`);
        // Read after the successful write; replace an older pending preview read.
        await refreshStatistics(true);
    } catch (error) {
        // A timed-out POST may already have been counted. Never retry it blindly.
        console.warn("访问上报失败", error);
    } finally {
        clearTimeout(timeout);
    }
}

export function startSiteStatistics() {
    if (started || typeof window === "undefined") return;
    started = true;
    restoreCache();
    document.addEventListener("astro:page-load", () => { void recordPageView(); });
    void recordPageView();
}
