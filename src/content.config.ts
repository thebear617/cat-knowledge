import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

const science = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/science' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    category: z.string(),
    subcategory: z.string(),
    draft: z.boolean().default(false),
    updated: z.coerce.date(),
    slug: z.string(),
  }),
});

export const collections = { science };
