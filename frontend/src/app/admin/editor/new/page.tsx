import { fetchCategories } from '../../../../lib/api';
import EditorClient from '../editor-client';

export const revalidate = 0;

export default async function NewArticlePage() {
  let categories = [];
  try {
    categories = await fetchCategories();
  } catch (error) {
    console.error('Failed to load categories for editor:', error);
  }

  return <EditorClient categories={categories} />;
}
