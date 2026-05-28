import { fetchCategory, fetchArticles } from '../../../lib/api';
import CategoryClient from './page-client';
import { notFound } from 'next/navigation';

export const revalidate = 0;

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: CategoryPageProps) {
  try {
    const category = await fetchCategory(params.slug);
    return {
      title: `${category.name} Articles — Wiki 2.0`,
      description: category.description || `Browse articles about ${category.name} on Wiki 2.0.`,
    };
  } catch (error) {
    return {
      title: 'Category Not Found — Wiki 2.0',
    };
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  try {
    const [category, articles] = await Promise.all([
      fetchCategory(params.slug),
      fetchArticles({ category: params.slug }),
    ]);

    return <CategoryClient category={category} articles={articles} />;
  } catch (error) {
    console.error(`Failed to load category "${params.slug}":`, error);
    notFound();
  }
}
