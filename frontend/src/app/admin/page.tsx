import { fetchArticles, fetchCategories } from '../../lib/api';
import AdminClient from './admin-client';

export const revalidate = 0; // live view

export default async function AdminPage() {
  let articles = [];
  let categories = [];

  try {
    const [arts, cats] = await Promise.all([
      fetchArticles({ all: true }), // fetches all articles, including drafts
      fetchCategories(),
    ]);
    articles = arts;
    categories = cats;
  } catch (error) {
    console.error('Failed to load admin dashboard catalog:', error);
  }

  return <AdminClient initialArticles={articles} categories={categories} />;
}
