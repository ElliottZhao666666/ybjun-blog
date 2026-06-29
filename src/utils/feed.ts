import { removeFileExtension } from "@utils/url";

const POST_IMAGE_CDN_ROOT =
	"https://cdn.jsdelivr.net/gh/ElliottZhao666666/ybjun-blog@main/src/content/posts";

function getPostSlug(post: any): string {
	return post?.slug || post?.data?.routeName || removeFileExtension(post?.id ?? "");
}

function isAbsoluteHttpUrl(src: string): boolean {
	return /^https?:\/\//i.test(src);
}

function getImageFilename(src: string): string {
	const [pathname, suffix = ""] = src.match(/^([^?#]*)(.*)$/)?.slice(1) ?? [src, ""];
	const filename = pathname.split(/[\\/]/).pop() || pathname.replace(/^\.+\//, "");
	return `${filename}${suffix}`;
}

export function rewriteFeedImageSrcToCdn(src: string, post: any): string {
	if (!src || isAbsoluteHttpUrl(src) || src.startsWith("/")) return src;

	const slug = getPostSlug(post);
	const filename = getImageFilename(src);
	if (!slug || !filename) return src;

	return `${POST_IMAGE_CDN_ROOT}/${slug}/${filename}`;
}