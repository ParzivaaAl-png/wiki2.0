import { fetchArticle, fetchCategories, fetchArticles } from '../../../lib/api';
import ArticleReader from './page-client';
import { notFound } from 'next/navigation';

export const revalidate = 0;

interface ArticlePageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: ArticlePageProps) {
  try {
    const article = await fetchArticle(params.slug);
    return {
      title: `${article.title} — Wiki 2.0`,
      description: article.summary || `Read about ${article.title} on Wiki 2.0.`,
    };
  } catch (error) {
    return {
      title: 'Article Not Found — Wiki 2.0',
    };
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  try {
    const [article, categories, allArticles] = await Promise.all([
      fetchArticle(params.slug),
      fetchCategories(),
      fetchArticles(),
    ]);

    return (
      <ArticleReader 
        article={article} 
        categories={categories} 
        allArticles={allArticles} 
      />
    );
  } catch (error) {
    console.error(`Failed to load article "${params.slug}":`, error);
    notFound();
  }
}
