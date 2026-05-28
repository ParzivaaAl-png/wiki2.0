import { fetchArticle, fetchCategories } from '../../../../lib/api';
import EditorClient from '../editor-client';
import { notFound } from 'next/navigation';

export const revalidate = 0;

interface EditArticlePageProps {
  params: {
    id: string;
  };
}

export default async function EditArticlePage({ params }: EditArticlePageProps) {
  try {
    const [article, categories] = await Promise.all([
      fetchArticle(params.id),
      fetchCategories(),
    ]);

    return <EditorClient article={article} categories={categories} />;
  } catch (error) {
    console.error(`Failed to load article ID "${params.id}" for editor:`, error);
    notFound();
  }
}
