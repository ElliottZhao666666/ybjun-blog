import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

export type OgData = { title: string; description?: string; author?: string; published?: Date | null };
export type OgOptions = { siteTitle: string; siteURL: string; author: string; hue: number; avatar?: string; icon?: string };
let fontData: Buffer;
const imageCache = new Map<string, Promise<string>>();

async function localImage(src: string | undefined): Promise<string> {
    if (!src || /^https?:/.test(src)) return '';
    if (imageCache.has(src)) return imageCache.get(src)!;
    const promise = (async () => {
        try {
            const base = path.resolve('public');
            const file = path.resolve(base, src.replace(/^\/+/, '').split('?')[0]);
            if (!file.startsWith(base + path.sep)) return '';
            let buffer = fs.readFileSync(file);
            if (file.toLowerCase().endsWith('.ico')) {
                const count = buffer.readUInt16LE(4);
                for (let i = count - 1; i >= 0; i--) {
                    const entry = 6 + i * 16;
                    const size = buffer.readUInt32LE(entry + 8), offset = buffer.readUInt32LE(entry + 12);
                    const image = buffer.subarray(offset, offset + size);
                    if (image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) { buffer = image; break; }
                }
            }
            const png = await sharp(buffer).resize(128,128,{fit:'cover'}).png().toBuffer();
            return 'data:image/png;base64,' + png.toString('base64');
        } catch { return ''; }
    })();
    imageCache.set(src,promise);
    return promise;
}

export async function renderOgImage(data: OgData, options: OgOptions): Promise<Buffer> {
    fontData ||= fs.readFileSync(path.resolve('src/assets/og/LXGWWenKaiScreen.ttf'));
    const ogFontFamily = 'LXGW WenKai Screen';
    const avatar = await localImage(options.avatar);
    const icon = await localImage(options.icon);
    const fallback = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="24" fill="#48a882"/><path d="M32 92V36l32 38 32-38v56" fill="none" stroke="white" stroke-width="10"/></svg>').toString('base64');
    const avatarBase64 = avatar || icon || fallback;
    const iconBase64 = icon || avatar || fallback;
	const hue = options.hue;
	const primaryColor = `hsl(${hue}, 90%, 65%)`;
	const textColor = "hsl(0, 0%, 95%)";

	const subtleTextColor = `hsl(${hue}, 10%, 75%)`;
	const backgroundColor = `hsl(${hue}, 15%, 12%)`;

	const pubDate = data.published ? data.published.toLocaleDateString("zh-CN", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}) : new URL(options.siteURL).hostname;

	const description = data.description;

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
									children: options.siteTitle,
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
												children: data.title,
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
												children: data.author || options.author,
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
		fonts: [{ name: ogFontFamily, data: fontData, weight: 400, style: "normal" }],
	});

	const png = await sharp(Buffer.from(svg)).png().toBuffer();

	return png;
}
