-- Drop existing tables if they exist (for clean runs)
DROP TABLE IF EXISTS article_tags CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Create Categories Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50) NOT NULL, -- Lucide icon name, e.g. "code", "database", "terminal"
    description TEXT,
    position INT DEFAULT 0
);

-- Create Articles Table
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    summary TEXT,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    published BOOLEAN DEFAULT TRUE,
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Article Tags Table
CREATE TABLE article_tags (
    article_id INT REFERENCES articles(id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (article_id, tag_name)
);

-- Seed Categories
INSERT INTO categories (name, slug, icon, description, position) VALUES
('Frontend Development', 'frontend', 'layout', 'Learn about modern frontend technologies including Next.js, React, and CSS styling.', 1),
('Backend & Databases', 'backend', 'server', 'Explore Node.js, Express, PostgreSQL, Prisma, and robust backend architectures.', 2),
('Search Engines', 'search-engines', 'search', 'Master full-text search, autocompletion, fuzzy matching, and indexing using Elasticsearch.', 3),
('DevOps & Infrastructure', 'devops', 'cpu', 'Understand containerization, CI/CD pipelines, Docker, Kubernetes, and cloud deployment.', 4);

-- Seed Articles
-- Article 1: Next.js Guide
INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
('Introduction to Next.js App Router', 'introduction-to-nextjs-app-router', 
'# Getting Started with Next.js App Router

Next.js is a powerful React framework that enables server-side rendering (SSR), static site generation (SSG), and incremental static regeneration (ISR) out of the box. With the introduction of the **App Router** in version 13, Next.js changed how layouts and routing are built.

## Key Features

1. **React Server Components (RSC):** By default, components in the App Router are Server Components. They render on the server, resulting in smaller client-side bundles and faster load times.
2. **Nested Layouts:** You can define reusable layouts for specific sub-routes, maintaining state across navigations.
3. **Data Fetching:** Simplified fetching using standard `async/await` directly inside server components.

```tsx
// Example of a Server Component
import React from ''react'';

interface ArticleProps {
  params: { slug: string };
}

export default async function Page({ params }: ArticleProps) {
  const res = await fetch(`https://api.example.com/articles/${params.slug}`);
  const data = await res.json();

  return (
    <article className="prose dark:prose-invert">
      <h1>{data.title}</h1>
      <p>{data.body}</p>
    </article>
  );
}
```

## Performance Benefits
* **Static Export:** Pre-renders routes to static HTML/CSS/JS.
* **Streaming:** Next.js can stream HTML chunks to the browser, allowing heavy parts of the page to load progressively with Suspense.
* **Image Optimization:** The `<Image />` component automatically resizes and formats images in modern webp/avif formats.

Try integrating Next.js with your search endpoints to build highly performant, SEO-friendly applications.',
'Learn how Next.js App Router, React Server Components (RSCs), and modern data fetching techniques enable fast, SEO-friendly web development.',
1, TRUE, 125);

-- Article 2: Elasticsearch Full-Text Search
INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
('Mastering Elasticsearch Full-Text Search', 'mastering-elasticsearch-full-text-search',
'# Understanding Elasticsearch

Elasticsearch is a distributed, RESTful search and analytics engine capable of addressing a growing number of use cases. It centrally stores your data for lightning-fast search, fine-tuned relevancy, and powerful analytics.

## Core Concepts

* **Index:** A collection of documents that have somewhat similar characteristics (similar to a database table).
* **Document:** A basic unit of information that can be indexed, represented in JSON (similar to a row).
* **Fields:** Key-value pairs inside a document (similar to columns).

## Building a Typo-Tolerant Search

Elasticsearch uses *fuzziness* based on the Levenshtein distance algorithm to find terms that are similar to the search query. This is incredibly useful for correcting user typos.

```json
POST /articles/_search
{
  "query": {
    "match": {
      "title": {
        "query": "ntext.js",
        "fuzziness": "AUTO",
        "operator": "and"
      }
    }
  }
}
```

## Advanced Highlighting

Elasticsearch allows highlighting matching words in search results. The API wraps search matches with HTML tags like `<em>` or custom class tags to highlight matching text in the user interface.

```json
{
  "query": {
    "multi_match": {
      "query": "Next.js",
      "fields": ["title", "content"]
    }
  },
  "highlight": {
    "fields": {
      "content": {},
      "title": {}
    }
  }
}
```

By configuring Elasticsearch correctly, you can achieve Google-like real-time searching on your documentation platform.',
'An in-depth guide to Elasticsearch indexing, mapping, fuzzy search queries, autocomplete suggestions, and search result highlighting.',
3, TRUE, 240);

-- Article 3: Docker & Compose Setup
INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
('Docker and Docker Compose for Microservices', 'docker-and-docker-compose-for-microservices',
'# Containers and Microservices with Docker

Docker simplifies application deployment by packaging an application and its dependencies into a single container. Docker Compose goes a step further, enabling you to run multi-container applications with a single command: `docker-compose up`.

## Designing a Dockerfile for Node.js

A standard production Dockerfile uses multi-stage builds to keep the final image size minimal and secure.

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Run
FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm ci --only=production
USER node
EXPOSE 5000
CMD ["node", "dist/app.js"]
```

## Managing Container Networks

Docker Compose creates a single default network for your app. Each container joins the default network and is both reachable by other containers on the network, and discoverable by them at a hostname identical to the container name.

For instance, our Express backend can connect to PostgreSQL using `host=postgres` and Elasticsearch using `host=elasticsearch` because they are declared in the same `docker-compose.yml` file.

```yaml
services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
```

Using Docker ensures consistent development, testing, and production environments without "it works on my machine" syndrome.',
'How to build lightweight Dockerfiles and orchestrate multi-container apps like Node, Postgres, and Elasticsearch with Docker Compose.',
4, TRUE, 89);

-- Article 4: Framer Motion Guide
INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
('Creating Smooth Animations with Framer Motion', 'creating-smooth-animations-with-framer-motion',
'# Modern Web Animations with Framer Motion

Framer Motion is a production-ready motion library for React. It powers animations in premium interfaces like Linear and Apple, allowing developers to create highly interactive experiences with minimal code.

## The `motion` Component

To animate any HTML element in React, replace it with its corresponding `motion` component, like `motion.div` or `motion.button`.

```tsx
import { motion } from ''framer-motion'';

export const HoverButton = () => (
  <motion.button
    whileHover={{ scale: 1.05, boxShadow: "0px 10px 20px rgba(0,0,0,0.1)" }}
    whileTap={{ scale: 0.95 }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
  >
    Click Me
  </motion.button>
);
```

## Layout Animations

Framer Motion can animate layout changes (like elements changing size, ordering in a list, or moving grids) automatically. Just add the `layout` prop.

```tsx
<motion.div layout className="card">
  <h3>Dynamic Card</h3>
</motion.div>
```

Combined with Tailwind CSS, Framer Motion makes it extremely simple to implement smooth slide-ins, fade-outs, and layout shifts that feel premium and organic.',
'A tutorial on React animation using Framer Motion: implementing hover micro-interactions, layout transitions, and page fade-ins.',
1, TRUE, 153);

-- Seed Article Tags
INSERT INTO article_tags (article_id, tag_name) VALUES
(1, 'React'),
(1, 'Next.js'),
(1, 'TypeScript'),
(2, 'Elasticsearch'),
(2, 'Search'),
(2, 'NoSQL'),
(3, 'Docker'),
(3, 'DevOps'),
(3, 'Infrastructure'),
(4, 'React'),
(4, 'Framer Motion'),
(4, 'UI/UX');
