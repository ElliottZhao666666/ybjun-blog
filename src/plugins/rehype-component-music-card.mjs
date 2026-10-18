// Adapted from Twilight MusicCardComponent; runtime is managed per page.
/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * Creates a Music Card component.
 *
 * @param {Object} properties - The properties of the component.
 * @param {string} properties.title - The title of the music.
 * @param {string} properties.artist - The artist of the music.
 * @param {string} properties.audio - The audio source URL.
 * @param {string} properties.cover - The cover image URL.
 * @param {string} properties.lrc - The lyrics URL.
 * @param {string} properties.meting - The Meting API URL (optional).
 * @param {import('mdast').RootContent[]} children - The children elements (lyrics text).
 * @returns {import('mdast').Parent} The created Music Card component.
 */
export function MusicCardComponent(properties, children) {
    // Helper to resolve paths
    const resolvePath = (path) => {
        if (!path) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        if (path.startsWith("/")) return path;
        if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return "";
        return "/" + path;
    };

    const title = properties.title || (properties.meting ? "正在加载…" : "未命名歌曲");
    const artist = properties.artist || (properties.meting ? "正在加载…" : "未知歌手");
    const audioSrc = resolvePath(properties.audio);
    const coverSrc = resolvePath(properties.cover);
    const lrcSrc = resolvePath(properties.lrc);
    const metingUrl = properties.meting || "";

    // Extract inline lyrics if present in children
    const extractNodeText = (node) => {
        if (!node) return "";
        if (typeof node.value === "string") return node.value;
        if (Array.isArray(node.children)) {
            return node.children.map(extractNodeText).join("");
        }
        return "";
    };

    const inlineLyrics = (Array.isArray(children) ? children : [])
        .map(extractNodeText)
        .join("\n")
        .trim();

    const cardUuid = `SC${Math.random().toString(36).slice(-6)}`;

    // Create the HTML structure
    const nCover = h("div", {
        class: "music-cover",
        style: coverSrc ? `background-image: url(${JSON.stringify(coverSrc)});` : undefined
    });

    const nTitle = h("div", { class: "music-title" }, title);
    const nArtist = h("div", { class: "music-artist" }, artist);
    const nHeader = h("div", { class: "music-header" }, [nTitle, nArtist]);

    // Use grid layout for overlapping lyrics to support the transition effect
    const nLyric = h("div", { class: "music-lyric", id: `${cardUuid}-lyric`, style: "display: grid; place-items: center;" }, [
        h("div", { class: "lyric-exit", style: "grid-area: 1/1; opacity: 0; pointer-events: none;" }, ""),
        h("div", { class: "lyric-current", style: "grid-area: 1/1;" }, "暂无歌词")
    ]);

    const nPlayBtn = h("button", { class: "play-btn", id: `${cardUuid}-play`, "aria-label": "播放 / 暂停" }, [
        // Play Icon (SVG)
        h("svg", { viewBox: "0 0 24 24", class: "play-icon" }, [
            h("path", { d: "M8 5v14l11-7z" })
        ]),
        // Pause Icon (SVG)
        h("svg", { viewBox: "0 0 24 24", class: "pause-icon", style: "display: none;" }, [
            h("path", { d: "M6 19h4V5H6v14zm8-14v14h4V5h-4z" })
        ])
    ]);

    const nProgressBar = h("div", { class: "progress-bar", id: `${cardUuid}-progress-bar` });
    const nProgressContainer = h("div", { class: "progress-container", id: `${cardUuid}-progress-container` }, [nProgressBar]);

    const nTimeDisplay = h("div", { class: "time-display", id: `${cardUuid}-time` }, "0:00 / 0:00");

    const nControls = h("div", { class: "music-controls" }, [
        nPlayBtn,
        nProgressContainer,
        nTimeDisplay
    ]);

    const nInfo = h("div", { class: "music-info" }, [
        nHeader,
        nLyric,
        nControls
    ]);

    const nAudio = h("audio", {
        id: `${cardUuid}-audio`,
        src: audioSrc,
        preload: "none"
    });

    nProgressContainer.properties.role = "slider";
    nProgressContainer.properties.tabIndex = 0;
    nProgressContainer.properties["aria-label"] = "播放进度";
    nProgressContainer.properties["aria-valuemin"] = 0;
    nProgressContainer.properties["aria-valuemax"] = 100;
    nProgressContainer.properties["aria-valuenow"] = 0;
    return h("div", {
        class: "card-music",
        id: `${cardUuid}-card`,
        "data-music": JSON.stringify({ title, artist, audio: audioSrc, cover: coverSrc, lrc: lrcSrc, meting: metingUrl, inlineLyrics }),
    }, [nCover, nInfo, nAudio]);
}
