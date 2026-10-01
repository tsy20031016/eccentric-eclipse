import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx}",
		base: "./src/content/posts",
	}),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		date: z.coerce.date(),
		category: z.string(),
	}),
});

const projects = defineCollection({
	loader: glob({
		pattern: "**/*.md",
		base: "./src/content/projects",
	}),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		status: z.string().default("active"),
		subtitle: z.string().default(""),
		order: z.number().int().min(0).default(100),
		section: z.enum(['foundation', 'access', 'decision', 'runtime', 'capabilities', 'quality', 'learning', 'governance', 'implementation']).default('foundation'),
	}),
});

export const collections = {
	posts,
	projects,
};
