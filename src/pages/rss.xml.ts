import type { RSSFeedItem } from "@astrojs/rss";
import rss from "@astrojs/rss";
import { getSortedPosts } from "@utils/content";
import { rewriteFeedImageSrcToCdn } from "@utils/feed";
import { getPostUrl } from "@utils/url";
import type { APIContext } from "astro";
import MarkdownIt from "markdown-it";
import { parse as htmlParser } from "node-html-parser";
import sanitizeHtml from "sanitize-html";
import { siteConfig } from "@/config";

const markdownParser = new MarkdownIt();

export async function GET(context: APIContext) {
	if (!context.site) {
		throw Error("site not set");
	}

	// Use the same ordering as site listing (pinned first, then by published desc)
	const posts = (await getSortedPosts()).filter((post) => !post.data.encrypted);
	const feed: RSSFeedItem[] = [];

	for (const post of posts) {
		// convert markdown to html string, ensure post.body is a string
		const body = markdownParser.render(String(post.body ?? ""));
		// convert html string to DOM-like structure
		const html = htmlParser.parse(body);
		// hold all img tags in variable images
		const images = html.querySelectorAll("img");
		// process each image tag to correct src paths
		for (const img of images) {
			const src = img.getAttribute("src");
			if (!src) continue;
			const rewrittenSrc = rewriteFeedImageSrcToCdn(src, post);
			if (rewrittenSrc !== src) {
				img.setAttribute("src", rewrittenSrc);
			} else if (src.startsWith("/")) {
				// images starting with `/` are in public dir
				img.setAttribute("src", new URL(src, context.site).href);
			}
		}

		feed.push({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.published,
			link: getPostUrl(post),
			// sanitize the new html string with corrected image paths
			content: sanitizeHtml(html.toString(), {
				allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
			}),
		});
	}

	return rss({
		title: siteConfig.title,
		description: siteConfig.subtitle || "No description",
		site: context.site,
		items: feed,
		customData: `<language>${siteConfig.lang}</language>`,
	});
}
