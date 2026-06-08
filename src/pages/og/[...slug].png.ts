import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";
import * as fs from "node:fs";
import * as path from "node:path";
import { defaultFavicons } from "@constants/icon";
import type { APIContext, GetStaticPaths } from "astro";
import satori from "satori";
import sharp from "sharp";
import { profileConfig, siteConfig } from "@/config";

type Weight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type FontStyle = "normal" | "italic";
interface FontOptions {
	data: Buffer | ArrayBuffer;
	name: string;
	weight?: Weight;
	style?: FontStyle;
	lang?: string;
}
export const prerender = true;

interface LoadedFonts {
	fonts: FontOptions[];
	family: string;
}

export const getStaticPaths: GetStaticPaths = async () => {
	if (!siteConfig.generateOgImages) {
		return [];
	}

	const allPosts = await getCollection("posts");
	const publishedPosts = allPosts.filter((post) => !post.data.draft);

	return publishedPosts.map((post) => ({
		params: { slug: post.id },
		props: { post },
	});
};

let fontCache: LoadedFonts | null = null;

function resolvePublicPath(publicUrl: string) {
	const cleanUrl = publicUrl.split("?")[0].replace(/^\/+/, "");
	return path.resolve("public", cleanUrl);
}

function getConfiguredFont() {
	const fontConfig = siteConfig.font || {};
	const fonts = Object.values(fontConfig);
	return fonts.find((font) => font?.src && font?.family) || null;
}

function loadConfiguredLocalFonts(): LoadedFonts {
	if (fontCache) {
		return fontCache;
	}

	const configuredFont = getConfiguredFont();
	const fallbackFamily =
		'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

	if (!configuredFont) {
		fontCache = { fonts: [], family: fallbackFamily };
		return fontCache;
	}

	const configuredFamily = configuredFont.family;
	const finalFamily = `"${configuredFamily}", ${fallbackFamily}`;

	try {
		if (!configuredFont.src.toLowerCase().split("?")[0].endsWith(".css")) {
			fontCache = {
				fonts: [
					{
						name: configuredFamily,
						data: fs.readFileSync(resolvePublicPath(configuredFont.src)),
						weight: 400,
						style: "normal",
					},
				],
				family: finalFamily,
			};
			return fontCache;
		}

		const cssPath = resolvePublicPath(configuredFont.src);
		const cssText = fs.readFileSync(cssPath, "utf-8");
		const cssDir = path.dirname(cssPath);
		const loadedFonts: FontOptions[] = [];
		const fontFaceBlockPattern = /@font-face\s*{([\s\S]*?)}/g;

		for (const match of cssText.matchAll(fontFaceBlockPattern)) {
			const block = match[1];
			const familyMatch = block.match(/font-family\s*:\s*["']?([^;"']+)["']?\s*;/i);
			const urlMatch = block.match(/url\(["']?([^"')]+)["']?\)/i);
			if (!urlMatch) continue;

			const family = familyMatch?.[1]?.trim() || configuredFamily;
			if (family !== configuredFamily) continue;

			const fontUrl = urlMatch[1];
			if (/^https?:\/\//i.test(fontUrl) || fontUrl.startsWith("//")) continue;

			const weightMatch = block.match(/font-weight\s*:\s*(\d+)/i);
			const styleMatch = block.match(/font-style\s*:\s*(normal|italic)/i);
			const fontPath = path.resolve(cssDir, fontUrl.split("?")[0]);
			if (!fs.existsSync(fontPath)) continue;

			loadedFonts.push({
				name: configuredFamily,
				data: fs.readFileSync(fontPath),
				weight: Number(weightMatch?.[1] || 400) as Weight,
				style: (styleMatch?.[1] || "normal") as FontStyle,
			});
		}

		fontCache = { fonts: loadedFonts, family: finalFamily };
		return fontCache;
	} catch (err) {
		console.warn("Error loading local fonts:", err);
		fontCache = { fonts: [], family: finalFamily };
		return fontCache;
	}
}

export async function GET({
	props,
}: APIContext<{ post: CollectionEntry<"posts"> }>) {
	const { post } = props;

	// Try to load the configured local font files for OG rendering.
	const { fonts, family: ogFontFamily } = loadConfiguredLocalFonts();

	// Avatar + icon: still read from disk (small assets)
	const avatarPath = `./public${profileConfig.avatar}`;
	const avatarBuffer = fs.readFileSync(avatarPath);
	const avatarBase64 = `data:image/png;base64,${avatarBuffer.toString("base64")}`;

	let iconPath = `./public${defaultFavicons[0].src}`;
	if (siteConfig.favicon.length > 0) {
		iconPath = `./public${siteConfig.favicon[0].src}`;
	}
	const iconBuffer = fs.readFileSync(iconPath);
	const iconBase64 = `data:image/png;base64,${iconBuffer.toString("base64")}`;

	const hue = siteConfig.themeColor.hue;
	const primaryColor = `hsl(${hue}, 90%, 65%)`;
	const textColor = "hsl(0, 0%, 95%)";

	const subtleTextColor = `hsl(${hue}, 10%, 75%)`;
	const backgroundColor = `hsl(${hue}, 15%, 12%)`;

	const pubDate = post.data.published.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	const description = post.data.description;

	const template = {
		type: "div",
		props: {
			style: {
				height: "100%",
				width: "100%",
				display: "flex",
				flexDirection: "column",
				backgroundColor: backgroundColor,
				fontFamily: ogFontFamily,
				padding: "60px",
			},
			children: [
				{
					type: "div",
					props: {
						style: {
							width: "100%",
							display: "flex",
							alignItems: "center",
							gap: "20px",
						},
						children: [
							{
								type: "img",
								props: {
									src: iconBase64,
									width: 48,
									height: 48,
									style: { borderRadius: "10px" },
								},
							},
							{
								type: "div",
								props: {
									style: {
										fontSize: "36px",
										fontWeight: 600,
										color: subtleTextColor,
									},
									children: siteConfig.title,
								},
							},
						],
					},
				},

				{
					type: "div",
					props: {
						style: {
							display: "flex",
							flexDirection: "column",
							justifyContent: "center",
							flexGrow: 1,
							gap: "20px",
						},
						children: [
							{
								type: "div",
								props: {
									style: {
										display: "flex",
										alignItems: "flex-start",
									},
									children: [
										{
											type: "div",
											props: {
												style: {
													width: "10px",
													height: "68px",
													backgroundColor: primaryColor,
													borderRadius: "6px",
													marginTop: "14px",
												},
											},
										},
										{
											type: "div",
											props: {
												style: {
													fontSize: "72px",
													fontWeight: 700,
													lineHeight: 1.2,
													color: textColor,
													marginLeft: "25px",
													display: "-webkit-box",
													overflow: "hidden",
													textOverflow: "ellipsis",
													lineClamp: 3,
													WebkitLineClamp: 3,
													WebkitBoxOrient: "vertical",
												},
												children: post.data.title,
											},
										},
									],
								},
							},
							description && {
								type: "div",
								props: {
									style: {
										fontSize: "32px",
										lineHeight: 1.5,
										color: subtleTextColor,
										paddingLeft: "35px",
										display: "-webkit-box",
										overflow: "hidden",
										textOverflow: "ellipsis",
										lineClamp: 2,
										WebkitLineClamp: 2,
										WebkitBoxOrient: "vertical",
									},
									children: description,
								},
							},
						],
					},
				},
				{
					type: "div",
					props: {
						style: {
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							width: "100%",
						},
						children: [
							{
								type: "div",
								props: {
									style: {
										display: "flex",
										alignItems: "center",
										gap: "20px",
									},
									children: [
										{
											type: "img",
											props: {
												src: avatarBase64,
												width: 60,
												height: 60,
												style: { borderRadius: "50%" },
											},
										},
										{
											type: "div",
											props: {
												style: {
													fontSize: "28px",
													fontWeight: 600,
													color: textColor,
												},
												children: profileConfig.name,
											},
										},
									],
								},
							},
							{
								type: "div",
								props: {
									style: { fontSize: "28px", color: subtleTextColor },
									children: pubDate,
								},
							},
						],
					},
				},
			],
		},
	};

	const svg = await satori(template, {
		width: 1200,
		height: 630,
		fonts,
	});

	const png = await sharp(Buffer.from(svg)).png().toBuffer();

	return new Response(new Uint8Array(png), {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
