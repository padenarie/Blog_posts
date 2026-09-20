import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';

export function readingTime(body) {
  const words = body.trim().split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(words.length / 200));
}

export async function loadPosts(postsDir) {
  let files = [];
  try {
    files = await readdir(postsDir);
  } catch {
    return [];
  }
  const posts = [];
  for (const file of files.filter((f) => f.endsWith('.md')).sort()) {
    const raw = await readFile(join(postsDir, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const slug = basename(file, '.md');
    posts.push({
      slug,
      title: data.title ?? slug,
      date: data.date ?? '',
      description: data.description ?? '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      hero: data.hero === true,
      cover: data.cover ?? '',
      body,
      readingTime: readingTime(body),
    });
  }
  return posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
