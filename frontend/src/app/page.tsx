import { fetchCategories, fetchArticles } from '../lib/api';
import HomeClient from './page-client';

export const revalidate = 0; // Disable caching to fetch live entries

export default async function Home() {
  let categories = [];
  let recentArticles = [];

  try {
    const [cats, arts] = await Promise.all([
      fetchCategories(),
      fetchArticles(),
    ]);
    categories = cats;
    recentArticles = arts.slice(0, 3);
  } catch (error) {
    console.error('Failed to load page data from backend server:', error);
  }

  return <HomeClient categories={categories} recentArticles={recentArticles} />;
}
