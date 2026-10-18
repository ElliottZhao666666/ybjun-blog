import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryPathParts } from './category';

export function pathsEqual(path1: string, path2: string) {
	const normalizedPath1 = path1.replace(/^\/|\/$/g, "").toLowerCase();
	const normalizedPath2 = path2.replace(/^\/|\/$/g, "").toLowerCase();
	return normalizedPath1 === normalizedPath2;
}

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}

export function removeFileExtension(id: string) {
	if (!id) return "";
	return id.replace(/\.(md|mdx|markdown)$/i, "");
}

export function getPostUrlBySlug(slug: string) {
	if (!slug) return "#";
	return url(`/posts/${slug}/`);
}

export function getPostUrl(post: any) {
	if (!post) return "#";
	const slug =
		post.slug || post.data?.routeName || removeFileExtension(post.id);
	return getPostUrlBySlug(slug);
}

export function getTagUrl(tag: string) {
	if (!tag) return url("/archive/");
	return url(`/archive/tag/${tag}/`);
}

export function getCategoryUrl(category?: string | string[] | null) {
	const parts = getCategoryPathParts(category);
	if (!parts) return url('/archive/category/uncategorized/');
	return url(`/archive/category/${parts.map(encodeURIComponent).join('/')}/`);
}

export function getDir(path: string) {
	const name = path.split("/").pop();
	return name ? path.slice(0, -name.length) : path;
}

// 🟢 核心修复 1: 修复图片路径多一层 src/ 的问题
export function getFileDirFromPath(path: string) {
	// ImageWrapper 组件会自动补全 src/，所以这里必须把开头的 src/ 去掉
	// 否则就会变成 src/src/content/... 导致找不到图片
	const newPath = path.replace(/^src\//, "");

	const name = newPath.split("/").pop();
	return name ? newPath.slice(0, -name.length) : newPath;
}

// 🟢 核心修复 2: 防止 undefined 报错，并支持外部链接
export const url = (path: string) => {
	// 1. 判空
	if (!path) return "";

	// 2. 特殊协议直接返回
	if (
		path.startsWith("http") ||
		path.startsWith("//") ||
		path.startsWith("javascript:") ||
		path.startsWith("mailto:") ||
		path.startsWith("#")
	) {
		return path;
	}

	// 3. 正常拼接 Base URL
	if (!path.startsWith("/")) {
		path = "/" + path;
	}
	return (
		(import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL) + path
	).replace(/\/+/g, "/");
};
