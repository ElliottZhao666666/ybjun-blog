import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { getCategoryPathLabel } from './utils/category';
import { parseTags } from './utils/tag';

// Helper for handling dates that might be empty strings from JSON
const dateSchema = z.preprocess((arg) => {
	if (typeof arg === "string" && arg.trim() === "") return undefined;
	return arg;
}, z.coerce.date());
const optionalDateSchema = z.preprocess((arg) => {
	if (typeof arg === "string" && arg.trim() === "") return undefined;
	return arg;
}, z.coerce.date().optional());

const postsCollection = defineCollection({
	loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		published: dateSchema,
		updated: optionalDateSchema,
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		cover: z.string().optional().default(""),
		tags: z.union([z.array(z.string()), z.string()]).optional().default([]).transform(parseTags),
		category: z.union([z.string(), z.array(z.string())]).optional().nullable().default("").transform(value => getCategoryPathLabel(value) || ''),
		lang: z.string().optional().default(""),
		pinned: z.boolean().optional().default(false),
		author: z.string().optional().default(""),
		sourceLink: z.string().optional().default(""),
		comment: z.boolean().optional().default(true),
		copyProtection: z.object({
			blockSelection: z.boolean().optional().default(false),
			blockClipboard: z.boolean().optional().default(false),
			blockContextMenu: z.boolean().optional().default(false),
			blockDevTools: z.boolean().optional().default(false),
		}).optional(),
		licenseName: z.string().optional().default(""),
		licenseUrl: z.string().optional().default(""),

		/* Page encryption fields */
		encrypted: z.boolean().optional().default(false),
		password: z.string().optional().default(""),

		/* Custom routeName */
		routeName: z.string().optional(),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});

const specCollection = defineCollection({
	loader: glob({ pattern: "[^_]*.{md,mdx}", base: "./src/content" }),
	schema: z.object({}),
});
export const collections = {
	posts: postsCollection,
	spec: specCollection,
};
