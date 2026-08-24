import { siteConfig } from "@/config";

const AUTO_COLOR_KEY = "autoColor";
const AUTO_HUE_CACHE_KEY = "autoHueCache";
const AUTO_HUE_URL = "https://api.bingpics.ybjun.com/image/latest/color/hsl/b";

type AutoHueCache = { date: string; hue: number };

function todayKey(): string {
	const now = new Date();
	return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

function parseHue(value: unknown): number | null {
	if (typeof value === "string" && value.trim() !== "") {
		try {
			return parseHue(JSON.parse(value));
		} catch {
			// Continue with a plain numeric string.
		}
	}
	const hue = typeof value === "number" ? value : Number(value);
	return Number.isFinite(hue) && hue >= 0 && hue <= 360 ? Math.round(hue) : null;
}

export function isAutoColorAvailable(): boolean {
	return siteConfig.wallpaper.isdailywall === true;
}

function readAutoHueCache(): AutoHueCache | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const parsed = JSON.parse(localStorage.getItem(AUTO_HUE_CACHE_KEY) || "null") as Partial<AutoHueCache> | null;
		const hue = parseHue(parsed?.hue);
		return parsed?.date && hue !== null ? { date: parsed.date, hue } : null;
	} catch {
		return null;
	}
}

function writeAutoHueCache(hue: number): void {
	localStorage.setItem(AUTO_HUE_CACHE_KEY, JSON.stringify({ date: todayKey(), hue }));
}

export function isAutoColorEnabled(): boolean {
	if (!isAutoColorAvailable()) {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(AUTO_COLOR_KEY, "false");
		}
		return false;
	}
	if (typeof localStorage === "undefined") return siteConfig.themeColor.auto === true;
	const stored = localStorage.getItem(AUTO_COLOR_KEY);
	if (stored === null) {
		const enabled = siteConfig.themeColor.auto === true;
		localStorage.setItem(AUTO_COLOR_KEY, String(enabled));
		return enabled;
	}
	return stored === "true";
}

export function setAutoColor(enabled: boolean): void {
	if (typeof localStorage !== "undefined") {
		localStorage.setItem(AUTO_COLOR_KEY, String(isAutoColorAvailable() && enabled));
	}
}

function applyHue(hue: number): void {
	if (typeof document === "undefined") return;
	document.documentElement.style.setProperty("--hue", String(hue));
}

// Function to set hue
export function setHue(hue: number): void {
	if (typeof localStorage !== "undefined") {
		localStorage.setItem("hue", String(hue));
	}
	applyHue(hue);
}

// Function to get default hue from config-carrier dataset
export function getDefaultHue(): number {
	const fallback = siteConfig.themeColor.hue.toString();
	if (typeof document !== "undefined") {
		const configCarrier = document.getElementById("config-carrier");
		return Number.parseInt(configCarrier?.dataset.hue || fallback);
	}
	return Number.parseInt(fallback);
}

// Function to get hue from local storage or default
export function getHue(): number {
	if (typeof localStorage !== "undefined") {
		if (isAutoColorEnabled()) {
			const cache = readAutoHueCache();
			if (cache?.date === todayKey()) return cache.hue;
		}
		const stored = localStorage.getItem("hue");
		return stored ? Number.parseInt(stored) : getDefaultHue();
	}
	return getDefaultHue();
}

// Function to initialize hue from local storage or default
export function initHue(): void {
	const auto = isAutoColorEnabled();
	const cache = readAutoHueCache();
	const fallback = cache?.hue ?? getDefaultHue();
	applyHue(auto ? fallback : getHue());
	if (auto && cache?.date !== todayKey()) {
		void refreshAutoHue();
	}
}

export async function refreshAutoHue(): Promise<number | null> {
	if (!isAutoColorAvailable() || !isAutoColorEnabled()) {
		setAutoColor(false);
		return null;
	}
	try {
		const response = await fetch(AUTO_HUE_URL, { cache: "no-store" });
		if (!response.ok) throw new Error(`Hue request failed: ${response.status}`);
		const hue = parseHue(await response.text());
		if (hue === null) throw new Error("Invalid hue response");
		writeAutoHueCache(hue);
		applyHue(hue);
		return hue;
	} catch {
		setAutoColor(false);
		const hue = getHue();
		applyHue(hue);
		return null;
	}
}

export function getAutoHueFallback(): number {
	return readAutoHueCache()?.hue ?? getDefaultHue();
}

export function getTodayAutoHue(): number | null {
	if (!isAutoColorEnabled()) return null;
	const cache = readAutoHueCache();
	return cache?.date === todayKey() ? cache.hue : null;
}
