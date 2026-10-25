import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
// Use the installed Astro Icon utilities; builds never fetch icon data.
const { getIconData } = createRequire(require.resolve("astro-icon"))("@iconify/utils");

export function generateRuntimeIcons() {
    const known = new Map();
    const sources = [];
    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const name = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!["content", "assets", "i18n"].includes(entry.name)) walk(name);
            } else if (/\.(astro|svelte|[cm]?js|ts)$/.test(name)) sources.push(name);
        }
    };
    walk(path.join(root, "src"));
    sources.push(path.join(root, "twilight.config.yaml"));
    const supplemental = JSON.parse(fs.readFileSync(path.join(root, "src/assets/icons/eos-loading.json"), "utf8"));
    const readSet = prefix => {
        if (known.has(prefix)) return known.get(prefix);
        let data;
        try { data = { ...require(`@iconify-json/${prefix}/icons.json`), info: require(`@iconify-json/${prefix}/info.json`) }; }
        catch { if (prefix === supplemental.prefix) data = supplemental; }
        known.set(prefix, data);
        return data;
    };
    const selected = new Map();
    for (const file of sources) {
        const text = fs.readFileSync(file, "utf8");
        for (const [, prefix, name] of text.matchAll(/\b([a-z][a-z0-9-]+):([a-z0-9][a-z0-9-]*)\b/g)) {
            const set = readSet(prefix);
            if (!set) continue; // CSS variants and event names are not icon sets.
            const data = getIconData(set, name);
            if (!data) throw new Error(`Unknown local icon ${prefix}:${name} in ${path.relative(root, file)}`);
            if (!selected.has(prefix)) selected.set(prefix, { prefix, icons: {}, info: set.info });
            selected.get(prefix).icons[name] = data;
        }
    }
    const collections = [...selected.values()].sort((a, b) => a.prefix.localeCompare(b.prefix));
    for (const collection of collections) collection.icons = Object.fromEntries(Object.entries(collection.icons).sort(([a], [b]) => a.localeCompare(b)));
    const target = path.join(root, "src/assets/icons/runtime-icons.json");
    const json = JSON.stringify(collections) + "\n";
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== json) fs.writeFileSync(target, json);
    return collections;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) generateRuntimeIcons();
