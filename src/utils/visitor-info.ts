type VisitorInfo = { ip?: string; city?: string; isp?: string };
type NetworkResult = { data: VisitorInfo; elapsed: number };

let pending: Promise<NetworkResult> | undefined;
let cached: NetworkResult | undefined;
let cachedAt = 0;

export function getVisitorNetworkInfo(): Promise<NetworkResult> {
    if (cached && Date.now() - cachedAt < 60000) return Promise.resolve(cached);
    if (pending) return pending;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    pending = (async () => {
        try {
            const start = performance.now();
            const response = await fetch("https://infoblog.ybjun.com", { signal: controller.signal });
            const elapsed = Math.round(performance.now() - start);
            if (!response.ok) throw new Error(`Visitor info HTTP ${response.status}`);
            const data: VisitorInfo = await response.json();
            cached = { data, elapsed };
            cachedAt = Date.now();
            return cached;
        } finally {
            clearTimeout(timeout);
            pending = undefined;
        }
    })();
    return pending;
}
