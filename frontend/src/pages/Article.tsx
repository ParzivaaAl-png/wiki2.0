import * as React from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  ChevronRight, 
  Tag, 
  Calendar, 
  Edit3, 
  ChevronDown,
  ArrowLeft,
  Star,
  History,
  X,
  ShieldAlert,
  Loader2,
  Plus,
  FileText,
  ExternalLink,
  CornerDownRight,
  Search,
  Building2,
  Briefcase,
  Check,
  Clock3,
  ShieldCheck
} from 'lucide-react';
import { 
  fetchArticle, 
  Article as ArticleType,
  addFavoriteArticle,
  removeFavoriteArticle,
  fetchFavoriteArticles,
  fetchArticleVersions,
  ArticleVersion,
  restoreArticleVersion,
  fetchArticles,
  fetchArticleLinks,
  fetchArticleBacklinks,
  createArticleLink,
  deleteArticleLink,
  ArticleLink,
  fetchNavigationTree,
  Space,
  Section,
  fetchArticleMandatoryAcknowledgement,
  markMandatoryAcknowledgementOpened,
  markMandatoryAcknowledgementReadComplete,
  confirmMandatoryAcknowledgement,
  ArticleMandatoryAcknowledgementState
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { AnimatePresence, motion } from 'framer-motion';
import TariffsClassifier from '../components/tariffs-classifier';
import TariffDetails from '../components/tariff-details';
import GuestAccessTimer from '../components/guest-access-timer';

const getTariffKeyFromSlug = (slug: string): string | null => {
  switch (slug) {
    case 'auto-list-эконом': return 'econom';
    case 'auto-list-межгород': return 'intercity';
    case 'auto-list-комфорт': return 'comfort';
    case 'auto-list-комфорт-plus': return 'comfort_plus';
    case 'auto-list-электро': return 'electro';
    case 'auto-list-бизнес': return 'business';
    case 'auto-list-ultima-тариф-premier': return 'ultima';
    default: return null;
  }
};

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [article, setArticle] = React.useState<ArticleType | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { user, isAdmin, isEditor, isStaff } = useAuth();
  const [isFavorited, setIsFavorited] = React.useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = React.useState(false);
  const [isChangesModalOpen, setIsChangesModalOpen] = React.useState(false);
  const [versionsLog, setVersionsLog] = React.useState<ArticleVersion[]>([]);
  const [isChangesLoading, setIsChangesLoading] = React.useState(false);
  const [selectedVersion, setSelectedVersion] = React.useState<ArticleVersion | null>(null);
  const [versionViewMode, setVersionViewMode] = React.useState<'preview' | 'compare'>('compare');
  const [compareTargetId, setCompareTargetId] = React.useState<'current' | number>('current');
  const [isRestoring, setIsRestoring] = React.useState(false);

  // Link state
  const [links, setLinks] = React.useState<ArticleLink[]>([]);
  const [backlinks, setBacklinks] = React.useState<ArticleLink[]>([]);
  const [isLinksLoading, setIsLinksLoading] = React.useState(false);
  const [allArticles, setAllArticles] = React.useState<ArticleType[]>([]);
  const [navigationTree, setNavigationTree] = React.useState<Space[]>([]);
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = React.useState(false);
  const [selectedLinkArticleIds, setSelectedLinkArticleIds] = React.useState<number[]>([]);
  const [linkSearchQuery, setLinkSearchQuery] = React.useState('');
  const [linkSpaceFilter, setLinkSpaceFilter] = React.useState('all');
  const [linkSectionFilter, setLinkSectionFilter] = React.useState('all');
  const [linkText, setLinkText] = React.useState('');
  const [isCreatingLink, setIsCreatingLink] = React.useState(false);
  const [mandatoryAckState, setMandatoryAckState] = React.useState<ArticleMandatoryAcknowledgementState | null>(null);
  const [hasReachedArticleEnd, setHasReachedArticleEnd] = React.useState(false);
  const [isConfirmingAck, setIsConfirmingAck] = React.useState(false);
  const [requiredCollapsibleCount, setRequiredCollapsibleCount] = React.useState(0);
  const [openedRequiredCollapsibles, setOpenedRequiredCollapsibles] = React.useState<Set<string>>(new Set());

  // Fetch article links when article is loaded
  React.useEffect(() => {
    async function loadLinks() {
      if (!article) return;
      setIsLinksLoading(true);
      try {
        const [data, backlinkData] = await Promise.all([
          fetchArticleLinks(article.id),
          fetchArticleBacklinks(article.id),
        ]);
        setLinks(data);
        setBacklinks(backlinkData);
      } catch (err) {
        console.error('Failed to fetch article links:', err);
      } finally {
        setIsLinksLoading(false);
      }
    }
    loadLinks();
  }, [article]);

  // Load all articles for dropdown selection when modal opens
  React.useEffect(() => {
    if (!isAddLinkModalOpen) return;
    async function loadAllArticles() {
      try {
        const [data, tree] = await Promise.all([
          fetchArticles({ all: true }),
          fetchNavigationTree(),
        ]);
        // Filter out current article
        setAllArticles(data.filter(a => a.id !== article?.id));
        setNavigationTree(tree);
      } catch (err) {
        console.error('Failed to load articles list for linking:', err);
      }
    }
    loadAllArticles();
  }, [isAddLinkModalOpen, article?.id]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!article || selectedLinkArticleIds.length === 0) return;
    setIsCreatingLink(true);
    try {
      await Promise.all(
        selectedLinkArticleIds.map((selectedId) => createArticleLink(article.id, {
          target_article_id: selectedId,
          link_text: linkText.trim() || undefined
        }))
      );
      const data = await fetchArticleLinks(article.id);
      setLinks(data);
      setIsAddLinkModalOpen(false);
      setSelectedLinkArticleIds([]);
      setLinkSearchQuery('');
      setLinkSpaceFilter('all');
      setLinkSectionFilter('all');
      setLinkText('');
    } catch (err: any) {
      console.error('Failed to create article link:', err);
      alert('Ошибка при создании связи: ' + err.message);
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleDeleteLink = async (linkId: number) => {
    if (!article) return;
    if (!window.confirm('Вы уверены, что хотите удалить эту связь между статьями?')) return;
    try {
      await deleteArticleLink(article.id, linkId);
      setLinks(prev => prev.filter(l => l.id !== linkId));
    } catch (err: any) {
      console.error('Failed to delete article link:', err);
      alert('Ошибка при удалении связи: ' + err.message);
    }
  };

  const closeAddLinkModal = () => {
    setIsAddLinkModalOpen(false);
    setSelectedLinkArticleIds([]);
    setLinkSearchQuery('');
    setLinkSpaceFilter('all');
    setLinkSectionFilter('all');
    setLinkText('');
  };

  const sectionMeta = React.useMemo(() => {
    const byId = new Map<number, { section: Section; space: Space; path: string }>();
    const options: Array<{ id: number; spaceId: number; path: string }> = [];

    const walk = (space: Space, sections: Section[], parents: string[] = []) => {
      sections.forEach((section) => {
        const path = [...parents, section.name].join(' / ');
        byId.set(section.id, { section, space, path });
        options.push({ id: section.id, spaceId: space.id, path });
        if (section.subsections?.length) {
          walk(space, section.subsections, [...parents, section.name]);
        }
      });
    };

    navigationTree.forEach((space) => walk(space, space.sections || []));
    return { byId, options };
  }, [navigationTree]);

  const sectionFilterOptions = React.useMemo(() => (
    sectionMeta.options.filter((section) => (
      linkSpaceFilter === 'all' || section.spaceId === Number(linkSpaceFilter)
    ))
  ), [linkSpaceFilter, sectionMeta.options]);

  React.useEffect(() => {
    if (linkSectionFilter === 'all') return;
    const selected = sectionMeta.byId.get(Number(linkSectionFilter));
    if (linkSpaceFilter !== 'all' && selected?.space.id !== Number(linkSpaceFilter)) {
      setLinkSectionFilter('all');
    }
  }, [linkSectionFilter, linkSpaceFilter, sectionMeta.byId]);

  const getPrimarySectionPath = (articleItem: Pick<ArticleType, 'section_ids'>) => {
    const firstSectionId = articleItem.section_ids?.find((sectionId) => sectionMeta.byId.has(sectionId));
    return firstSectionId ? sectionMeta.byId.get(firstSectionId)?.path || 'Без раздела' : 'Без раздела';
  };

  const filteredLinkArticles = React.useMemo(() => {
    const query = linkSearchQuery.trim().toLowerCase();
    const linkedTargetIds = new Set(links.map((link) => Number(link.target_article_id)));

    return allArticles
      .filter((item) => !linkedTargetIds.has(item.id))
      .filter((item) => {
        const sectionIds = item.section_ids || [];
        if (linkSectionFilter !== 'all') return sectionIds.includes(Number(linkSectionFilter));
        if (linkSpaceFilter !== 'all') {
          return sectionIds.some((sectionId) => sectionMeta.byId.get(sectionId)?.space.id === Number(linkSpaceFilter));
        }
        return true;
      })
      .filter((item) => {
        if (!query) return true;
        const sectionText = (item.section_ids || [])
          .map((sectionId) => sectionMeta.byId.get(sectionId)?.path || '')
          .join(' ');
        return [
          item.title,
          item.summary || '',
          item.slug,
          item.author_name || '',
          ...(item.tags || []),
          sectionText,
        ].join(' ').toLowerCase().includes(query);
      });
  }, [allArticles, linkSearchQuery, linkSectionFilter, linkSpaceFilter, links, sectionMeta.byId]);

  const toggleSelectedLinkArticle = (articleId: number) => {
    setSelectedLinkArticleIds((prev) => (
      prev.includes(articleId)
        ? prev.filter((id) => id !== articleId)
        : [...prev, articleId]
    ));
  };

  const getCompactStatusBadge = (status?: string) => {
    switch (status) {
      case 'draft':
        return 'Черновик';
      case 'on_approval':
        return 'На согласовании';
      case 'requires_verification':
        return 'Требует проверки';
      case 'archived':
        return 'В архиве';
      case 'expired':
        return 'Истёк срок';
      case 'published':
      default:
        return 'Опубликована';
    }
  };

  const getCompactStatusClass = (status?: string) => {
    switch (status) {
      case 'draft':
        return 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300';
      case 'requires_verification':
        return 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300';
      case 'archived':
      case 'expired':
        return 'border-neutral-500/20 bg-neutral-500/10 text-neutral-500 dark:text-neutral-400';
      case 'on_approval':
        return 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300';
      case 'published':
      default:
        return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
    }
  };

  const formatCompactDate = (value?: string) => {
    if (!value) return 'Дата не указана';
    return new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getArticleTypeBadge = (type: string) => {
    switch (type) {
      case 'job_description':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20 shadow-sm">
            📋 Должностная инструкция
          </span>
        );
      case 'regulation':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-650 dark:text-purple-400 border border-purple-500/20 shadow-sm">
            📜 Регламент
          </span>
        );
      case 'instruction':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-sm">
            📖 Инструкция
          </span>
        );
      case 'tool_description':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
            🛠️ Описание инструмента
          </span>
        );
      case 'general':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20 shadow-sm">
            📝 Общая статья
          </span>
        );
    }
  };

  // Fetch article data on slug change
  React.useEffect(() => {
    async function loadArticleData() {
      if (!slug) return;
      setIsLoading(true);
      setError(null);
      try {
        const artData = await fetchArticle(slug);
        setArticle(artData);
      } catch (err: any) {
        console.error('Failed to load article:', err);
        setError(err.message || 'Произошла ошибка при загрузке статьи.');
      } finally {
        setIsLoading(false);
      }
    }
    loadArticleData();
  }, [slug]);

  // Check favorite status if authenticated
  React.useEffect(() => {
    async function checkFavoriteStatus() {
      if (!user || !article) return;
      try {
        const favorites = await fetchFavoriteArticles();
        const found = favorites.some(fav => fav.id === article.id);
        setIsFavorited(found);
      } catch (err) {
        console.error('Failed to load favorites:', err);
      }
    }
    checkFavoriteStatus();
  }, [user, article]);

  const handleToggleFavorite = async () => {
    if (!user || !article || isFavoriteLoading) return;
    setIsFavoriteLoading(true);
    try {
      if (isFavorited) {
        await removeFavoriteArticle(article.id);
        setIsFavorited(false);
      } else {
        await addFavoriteArticle(article.id);
        setIsFavorited(true);
      }
    } catch (err: any) {
      console.error('Failed to update favorite status:', err);
      alert('Ошибка при обновлении избранного: ' + err.message);
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  const handleOpenChangesModal = async () => {
    setIsChangesModalOpen(true);
    setIsChangesLoading(true);
    try {
      const versions = await fetchArticleVersions(article!.id);
      setVersionsLog(versions);
      setSelectedVersion(null);
      setCompareTargetId('current');
      setVersionViewMode('compare');
    } catch (err: any) {
      console.error('Failed to fetch article versions:', err);
    } finally {
      setIsChangesLoading(false);
    }
  };

  // Restore Modal State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = React.useState(false);
  const [restoreTargetVersion, setRestoreTargetVersion] = React.useState<ArticleVersion | null>(null);
  const [restorePublish, setRestorePublish] = React.useState(false);
  const [restoreCommentInput, setRestoreCommentInput] = React.useState('');
  const [restoreRequireReack, setRestoreRequireReack] = React.useState(false);

  const openRestoreModal = (version: ArticleVersion, publish: boolean) => {
    setRestoreTargetVersion(version);
    setRestorePublish(publish);
    setRestoreCommentInput(`Восстановлена из версии ${version.version_number}`);
    setRestoreRequireReack(false);
    setIsRestoreModalOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!article || !restoreTargetVersion || isRestoring) return;

    setIsRestoring(true);
    try {
      await restoreArticleVersion(article.id, restoreTargetVersion.id, {
        publish: restorePublish,
        comment: restoreCommentInput.trim() || `Восстановление из версии ${restoreTargetVersion.version_number}`,
        require_reacknowledgement: restoreRequireReack,
      });

      setIsRestoreModalOpen(false);
      setIsChangesModalOpen(false);
      setSelectedVersion(null);

      // Refresh versions log and current article
      const updatedVersions = await fetchArticleVersions(article.id);
      setVersionsLog(updatedVersions);

      const refreshedArticle = await fetchArticle(article.id);
      setArticle(refreshedArticle);

      alert(restorePublish ? 'Версия успешно восстановлена и опубликована.' : 'Версия успешно восстановлена в черновик.');
    } catch (err: any) {
      console.error('Failed to restore version:', err);
      alert('Ошибка при восстановлении версии: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // Effect to highlight, expand collapsibles, and scroll to text or anchor with retry
  React.useEffect(() => {
    if (!article || isLoading) return;

    const queryParams = new URLSearchParams(location.search);
    const highlight = queryParams.get('highlight');
    const hash = location.hash;

    if (!highlight && !hash) return;

    const runHighlight = () => {
      const articleContainer = document.querySelector('article') || document.querySelector('[data-article-content]') || document.querySelector('.prose-custom');
      if (!articleContainer) return false;

      let success = false;
      if (highlight) {
        success = highlightTextInDOM(articleContainer as HTMLElement, highlight);
      }

      if (hash) {
        const targetId = decodeURIComponent(hash.substring(1));
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          let parent = targetEl.parentElement;
          while (parent && parent !== articleContainer) {
            if (parent.tagName === 'DETAILS' || parent.hasAttribute('data-wiki-collapsible') || parent.classList.contains('wiki-collapsible-block')) {
              (parent as HTMLDetailsElement).open = true;
            }
            parent = parent.parentElement;
          }
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 300);
          success = true;
        }
      }

      return success;
    };

    // Try immediately, then at 150ms, 400ms, and 800ms to handle async DOM rendering
    runHighlight();
    const t1 = setTimeout(runHighlight, 100);
    const t2 = setTimeout(runHighlight, 300);
    const t3 = setTimeout(runHighlight, 600);
    const t4 = setTimeout(runHighlight, 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [article, isLoading, location.search, location.hash]);

  React.useEffect(() => {
    if (!article || !user) return;
    const articleId = article.id;
    let cancelled = false;

    async function loadMandatoryState() {
      try {
        const state = await fetchArticleMandatoryAcknowledgement(articleId);
        if (cancelled) return;
        setMandatoryAckState(state);
        if (state.required && !state.assignment?.first_viewed_at && !state.assignment?.acknowledged_at) {
          const opened = await markMandatoryAcknowledgementOpened(articleId);
          if (!cancelled) setMandatoryAckState(opened);
        }
      } catch (err) {
        console.error('Failed to load mandatory acknowledgement state:', err);
      }
    }

    loadMandatoryState();
    return () => {
      cancelled = true;
    };
  }, [article, user]);

  React.useEffect(() => {
    if (!article || !mandatoryAckState?.required || mandatoryAckState.assignment?.acknowledged_at) return;

    let sentReadComplete = !!mandatoryAckState.assignment?.read_completed_at;
    const onScroll = async () => {
      const scrollBottom = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      const reachedEnd = scrollBottom >= pageHeight - 80;
      if (!reachedEnd) return;

      setHasReachedArticleEnd(true);
      if (!sentReadComplete) {
        sentReadComplete = true;
        try {
          const updated = await markMandatoryAcknowledgementReadComplete(article.id);
          setMandatoryAckState(updated);
        } catch (err) {
          console.error('Failed to mark mandatory acknowledgement read complete:', err);
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [article, mandatoryAckState?.required, mandatoryAckState?.assignment?.acknowledged_at, mandatoryAckState?.assignment?.read_completed_at]);

  React.useEffect(() => {
    setHasReachedArticleEnd(false);
    setRequiredCollapsibleCount(0);
    setOpenedRequiredCollapsibles(new Set());
  }, [article?.id]);

  React.useEffect(() => {
    if (!article) return;

    let cleanupListeners: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      const root = document.querySelector(`[data-article-content="${article.id}"]`);
      if (!root) return;

      const blocks = Array.from(
        root.querySelectorAll<HTMLDetailsElement>('details[data-wiki-collapsible="true"]')
      );

      blocks.forEach((block, index) => {
        block.dataset.collapsibleRuntimeId = block.dataset.collapsibleRuntimeId || `${article.id}-${index}`;
      });

      const requiredBlocks = blocks.filter((block) => block.dataset.requiredForAck === 'true');
      const openedRequired = new Set(
        requiredBlocks
          .filter((block) => block.open)
          .map((block) => block.dataset.collapsibleRuntimeId || '')
          .filter(Boolean)
      );

      setRequiredCollapsibleCount(requiredBlocks.length);
      setOpenedRequiredCollapsibles(openedRequired);

      const onToggle = (event: Event) => {
        const current = event.currentTarget as HTMLDetailsElement;

        if (current.open && current.dataset.allowMultiple === 'false') {
          blocks.forEach((block) => {
            if (block !== current && block.dataset.allowMultiple === 'false') {
              block.open = false;
            }
          });
        }

        if (current.dataset.requiredForAck === 'true' && current.open) {
          const id = current.dataset.collapsibleRuntimeId;
          if (id) {
            setOpenedRequiredCollapsibles((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            });
          }
        }
      };

      blocks.forEach((block) => block.addEventListener('toggle', onToggle));

      cleanupListeners = () => {
        blocks.forEach((block) => block.removeEventListener('toggle', onToggle));
      };
    }, 0);

    return () => {
      window.clearTimeout(timer);
      cleanupListeners?.();
    };
  }, [article?.id, article?.content]);

  const handleConfirmMandatoryAcknowledgement = async () => {
    if (!article || isConfirmingAck) return;
    setIsConfirmingAck(true);
    try {
      const updated = await confirmMandatoryAcknowledgement(article.id, {
        opened_required_collapsibles_count: openedRequiredCollapsibles.size,
        required_collapsibles_count: requiredCollapsibleCount,
      });
      setMandatoryAckState(updated);
      alert('Ознакомление подтверждено.');
    } catch (err: any) {
      alert(err.message || 'Не удалось подтвердить ознакомление.');
    } finally {
      setIsConfirmingAck(false);
    }
  };

  // Parse Headings for Table of Contents
  const headings = React.useMemo(() => {
    if (!article) return [];
    
    const isHtml = /<[a-z][\s\S]*>/i.test(article.content);
    
    if (!isHtml) {
      const headingRegex = /^(#{2,3})\s+(.*)$/gm;
      const list: { level: number; text: string; id: string }[] = [];
      let match;
      const cleanContent = article.content.replace(/```[\s\S]*?```/g, '');
      
      while ((match = headingRegex.exec(cleanContent)) !== null) {
        const level = match[1].length;
        const text = match[2].replace(/\*|_|`/g, '').trim();
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9а-яё\s-]+/g, '')
          .replace(/\s+/g, '-')
          .replace(/(^-|-$)/g, '');
        list.push({ level, text, id });
      }
      return list;
    } else {
      const headingRegex = /<h([1-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
      const list: { level: number; text: string; id: string }[] = [];
      let match;
      
      while ((match = headingRegex.exec(article.content)) !== null) {
        const level = parseInt(match[1], 10);
        const attrs = match[2] || '';
        if (/data-toc-hidden=["']true["']/i.test(attrs)) {
          continue;
        }
        const rawText = match[3].replace(/<[^>]*>/g, '').trim();
        const tocMatch = /data-toc-title=["']([^"']+)["']/i.exec(attrs);
        const text = (tocMatch ? tocMatch[1].trim() : rawText) || rawText;

        const id = rawText
          .toLowerCase()
          .replace(/[^a-z0-9а-яё\s-]+/g, '')
          .replace(/\s+/g, '-')
          .replace(/(^-|-$)/g, '');
        list.push({ level, text, id });
      }
      return list;
    }
  }, [article]);

  // Process HTML content to inject anchors/IDs dynamically and pre-open matching details
  const processedContent = React.useMemo(() => {
    if (!article) return '';
    const isHtml = /<[a-z][\s\S]*>/i.test(article.content);
    if (!isHtml) return article.content;

    let html = article.content;

    // 1. If highlight query is present in URL, pre-open any <details> element whose HTML contains the term
    const queryParams = new URLSearchParams(location.search);
    const highlightParam = queryParams.get('highlight');
    if (highlightParam && highlightParam.trim().length > 0) {
      const cleanHl = highlightParam.trim().replace(/\u00a0/g, ' ');
      const stemHl = cleanHl.length > 4 ? cleanHl.substring(0, Math.min(cleanHl.length, 5)) : cleanHl;
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hlRegex = new RegExp(escapeRegExp(stemHl), 'i');

      html = html.replace(/<details\b([^>]*)>([\s\S]*?)<\/details>/gi, (match, attrs, innerContent) => {
        if (hlRegex.test(innerContent) || hlRegex.test(attrs)) {
          if (!/(^|\s)open(\s|=|>|$)/i.test(attrs)) {
            return `<details open="" ${attrs}>${innerContent}</details>`;
          }
        }
        return match;
      });
    }

    // 2. Add IDs to headings
    const headingRegex = /(<h([1-4]))([^>]*>)([\s\S]*?)(<\/h\2>)/gi;
    html = html.replace(headingRegex, (m, openTag, level, attrs, text, closeTag) => {
      if (attrs.includes('id=')) return m;
      
      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      const id = cleanText
        .toLowerCase()
        .replace(/[^a-z0-9а-яё\s-]+/g, '')
        .replace(/\s+/g, '-')
        .replace(/(^-|-$)/g, '');
        
      return `${openTag} id="${id}"${attrs}${text}${closeTag}`;
    });

    if (article.ip_restriction_enabled && article.ip_restriction_settings?.apply_to_attachments !== false) {
      html = html.replace(/(href|src)="(\/uploads\/[^"]+)"/gi, (match, attr, url) => {
        if (url.includes('articleId=')) return match;
        const separator = url.includes('?') ? '&' : '?';
        return `${attr}="${url}${separator}articleId=${article.id}"`;
      });
    }

    return html;
  }, [article, location.search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm animate-pulse shrink-0">
            📝 Черновик
          </span>
        );
      case 'on_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm shrink-0">
            ⏳ На согласовании
          </span>
        );
      case 'published':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm shrink-0">
            ✅ Опубликована
          </span>
        );
      case 'requires_verification':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm animate-pulse shrink-0">
            ⚠️ Требует проверки
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20 shadow-sm shrink-0">
            📦 В архиве
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-650 dark:text-purple-400 border border-purple-500/20 shadow-sm shrink-0">
            ⌛ Срок истек
          </span>
        );
      default:
        return null;
    }
  };

  const getMandatoryStatusLabel = (status?: string | null) => {
    switch (status) {
      case 'not_open': return 'Не открыта';
      case 'in_progress': return 'В процессе чтения';
      case 'read_completed': return 'Прочитана до конца';
      case 'acknowledged': return 'Ознакомлен';
      case 'overdue': return 'Просрочена';
      case 'requires_reacknowledgement': return 'Требует повторного ознакомления';
      default: return 'Назначено';
    }
  };

  const getVersionStatusLabel = (status?: string | null) => {
    switch (status) {
      case 'draft': return 'Черновик';
      case 'published': return 'Опубликована';
      case 'archived': return 'Архив';
      case 'on_approval': return 'На согласовании';
      case 'requires_verification': return 'Требует проверки';
      default: return status || 'Без статуса';
    }
  };

  const getVersionSourceLabel = (source?: string | null) => {
    switch (source) {
      case 'initial': return 'Стартовый снимок';
      case 'save': return 'Сохранение';
      case 'publish': return 'Публикация';
      case 'import_draft': return 'Импорт в черновик';
      case 'import_publish': return 'Импорт и публикация';
      case 'restore': return 'Восстановление';
      case 'sync': return 'Синхронизация';
      default: return source || 'Сохранение';
    }
  };

  const selectedCompareTarget = React.useMemo(() => {
    if (!selectedVersion) return null;
    if (compareTargetId === 'current') {
      return article
        ? { title: article.title, content: article.content, label: 'Текущая статья' }
        : null;
    }

    const target = versionsLog.find((version) => version.id === compareTargetId);
    return target
      ? {
          title: target.title,
          content: target.content,
          label: `Версия ${target.version_number}`,
        }
      : null;
  }, [article, compareTargetId, selectedVersion, versionsLog]);

  const allRequiredCollapsiblesOpened =
    requiredCollapsibleCount === 0 || openedRequiredCollapsibles.size >= requiredCollapsibleCount;
  const hasCompletedMandatoryReading =
    hasReachedArticleEnd || !!mandatoryAckState?.assignment?.read_completed_at;

  // Custom markdown headings & details handler
  const MarkdownComponents = {
    details: ({ node, children, open, ...props }: any) => {
      const queryParams = new URLSearchParams(location.search);
      const highlightParam = queryParams.get('highlight');
      let forceOpen = open;
      if (highlightParam && highlightParam.trim().length > 0) {
        const cleanHl = highlightParam.trim();
        const stemHl = cleanHl.length > 4 ? cleanHl.substring(0, 5) : cleanHl;
        const textContent = React.Children.toArray(children).join(' ');
        if (new RegExp(stemHl, 'i').test(textContent)) {
          forceOpen = true;
        }
      }
      return <details {...props} open={forceOpen}>{children}</details>;
    },
    h2: ({ node, children, ...props }: any) => {
      const text = React.Children.toArray(children).join('');
      const id = text.toLowerCase().replace(/[^a-z0-9а-яё\s-]+/g, '').replace(/\s+/g, '-').replace(/(^-|-$)/g, '');
      return <h2 id={id} className="text-2xl font-bold mt-8 mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-2" {...props}>{children}</h2>;
    },
    h3: ({ node, children, ...props }: any) => {
      const text = React.Children.toArray(children).join('');
      const id = text.toLowerCase().replace(/[^a-z0-9а-яё\s-]+/g, '').replace(/\s+/g, '-').replace(/(^-|-$)/g, '');
      return <h3 id={id} className="text-xl font-semibold mt-6 mb-3" {...props}>{children}</h3>;
    },
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 animate-pulse flex gap-8">
        <div className="flex-1 space-y-6">
          <div className="h-4 w-40 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-10 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-[300px] bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
        </div>
      </div>
    );
  }

  // Отображение заглушки при ограничении доступа по оргструктуре
  if (error && (error.includes('Доступ ограничен') || error.includes('403') || error.includes('Forbidden'))) {
    return (
      <div className="max-w-md mx-auto py-20 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>
        <h2 className="font-outfit text-xl font-bold text-neutral-900 dark:text-white">Доступ ограничен</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-3 leading-relaxed">
          У вас нет прав на просмотр этой статьи в соответствии с вашей должностью в организационной структуре компании.
        </p>
        <Link to="/" className="inline-flex items-center gap-1.5 mt-8 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all">
          <ArrowLeft className="w-3.5 h-3.5" /> Назад на главную
        </Link>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <h2 className="font-outfit text-xl font-bold">Статья не найдена</h2>
        <p className="text-sm text-neutral-400 mt-2">Запрошенная вами статья не существует или была удалена.</p>
        <Link to="/" className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-indigo-500 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Назад на главную
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 flex gap-8">
      
      {/* Content Area */}
      <div className="flex-1 min-w-0 py-4 sm:py-8">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-neutral-400 dark:text-neutral-550 mb-4 sm:mb-6 font-medium overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-indigo-500 transition-colors shrink-0">Главная</Link>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="text-neutral-600 dark:text-neutral-400 truncate max-w-[150px] sm:max-w-[200px]">{article.title}</span>
        </div>

        <article className="prose-custom">
          {/* Header section with badges and buttons */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6 border-b border-neutral-200/50 dark:border-border pb-6">
            <div className="w-full sm:w-auto flex-1 space-y-3">
              <div className="flex items-start gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
                  {article.title}
                </h1>
                
                {/* Favorite Star Button */}
                {user && (
                  <button
                    onClick={handleToggleFavorite}
                    disabled={isFavoriteLoading}
                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-border hover:bg-neutral-50 dark:hover:bg-card transition-colors shadow-sm cursor-pointer select-none text-neutral-400 dark:text-neutral-500 hover:text-amber-500 dark:hover:text-amber-400 shrink-0"
                    title={isFavorited ? "Удалить из избранного" : "Добавить в избранное"}
                  >
                    <Star
                      className={`w-5 h-5 transition-all ${
                        isFavorited
                          ? 'fill-amber-400 text-amber-400 scale-110'
                          : 'scale-100 hover:scale-110'
                      }`}
                    />
                  </button>
                )}
              </div>
              
              {/* Badges & Date Info */}
              <div className="flex flex-wrap items-center gap-3">
                {getStatusBadge(article.status || 'published')}
                {getArticleTypeBadge(article.article_type || 'general')}
                
                <span className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(article.updated_at).toLocaleDateString()}
                </span>
                
                {article.author_name && (
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                    Автор: <span className="font-semibold">{article.author_name}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <button
                onClick={handleOpenChangesModal}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-border text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-card transition-colors shrink-0 shadow-sm cursor-pointer"
                title="История изменений этой статьи"
              >
                <History className="w-3.5 h-3.5 text-indigo-500" />
                История изменений
              </button>

              {isStaff && (
                <Link
                  to={`/admin/editor/${article.id}`}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-border text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-card transition-colors shrink-0 shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                  Редактировать
                </Link>
              )}
            </div>
          </div>

          {article.guest_access && (
            <div className="mb-6">
              <GuestAccessTimer
                expiresAt={article.guest_access.expires_at}
                scope={article.guest_access.type}
              />
            </div>
          )}

          {mandatoryAckState?.required && mandatoryAckState.assignment && (
            <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5 shadow-premium dark:shadow-premium-dark">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                    <ShieldCheck className="h-5 w-5 text-amber-500" />
                    Требуется обязательное ознакомление
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border bg-card px-2 py-1 font-bold text-foreground">
                      {getMandatoryStatusLabel(mandatoryAckState.assignment.status)}
                    </span>
                    <span>
                      Срок: {mandatoryAckState.assignment.due_at ? new Date(mandatoryAckState.assignment.due_at).toLocaleDateString('ru-RU') : 'не указан'}
                    </span>
                    {mandatoryAckState.assignment.overdue_days > 0 && (
                      <span className="font-bold text-rose-600 dark:text-rose-300">
                        Просрочка: {mandatoryAckState.assignment.overdue_days} дн.
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Открытие статьи фиксируется как просмотр. Подтверждение станет доступно после прокрутки материала до конца
                    {requiredCollapsibleCount > 0
                      ? ` и открытия обязательных раскрывающихся блоков (${openedRequiredCollapsibles.size}/${requiredCollapsibleCount}).`
                      : '.'}
                  </p>
                </div>
                <button
                  onClick={handleConfirmMandatoryAcknowledgement}
                  disabled={
                    isConfirmingAck ||
                    !!mandatoryAckState.assignment.acknowledged_at ||
                    !hasCompletedMandatoryReading ||
                    !allRequiredCollapsiblesOpened
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                >
                  {mandatoryAckState.assignment.acknowledged_at ? (
                    <>
                      <Check className="h-4 w-4" />
                      Ознакомление подтверждено
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Подтверждаю ознакомление
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Process Governance Details (Owner & Approver) */}
          {(article.owner_name || article.approver_name) && (
            <div className="mb-6 p-5 rounded-2xl border border-teal-150 dark:border-border bg-teal-50/10 dark:bg-card/45 shadow-premium dark:shadow-premium-dark space-y-3">
              <div className="flex items-center gap-2 text-teal-650 dark:text-teal-400 font-bold text-xs uppercase tracking-wider">
                <span>🛡️ Владение и согласование процесса</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {article.owner_name && (
                  <div className="p-3 bg-white/60 dark:bg-background rounded-xl border border-neutral-200/50 dark:border-border">
                    <div className="text-neutral-450 dark:text-neutral-550 mb-1 font-medium">Владелец бизнес-процесса:</div>
                    <div className="font-semibold text-neutral-850 dark:text-neutral-205 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      {article.owner_name}
                    </div>
                  </div>
                )}
                {article.approver_name && (
                  <div className="p-3 bg-white/60 dark:bg-background rounded-xl border border-neutral-200/50 dark:border-border">
                    <div className="text-neutral-450 dark:text-neutral-550 mb-1 font-medium">Согласующий:</div>
                    <div className="font-semibold text-neutral-850 dark:text-neutral-205 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      {article.approver_name}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Latest change details */}
          {article.latest_change && (
            <div className="mb-6 p-5 rounded-2xl border border-indigo-100 dark:border-border bg-indigo-50/15 dark:bg-card/45 shadow-premium dark:shadow-premium-dark space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                <span>📢 Последнее обновление</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-900 pb-3">
                <div>
                  <span className="text-neutral-400">Когда:</span>{' '}
                  <span className="font-semibold text-neutral-850 dark:text-neutral-200">
                    Обновлено {formatRelativeTime(article.latest_change.changed_at)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400">Автор:</span>{' '}
                  <span className="font-semibold text-neutral-850 dark:text-neutral-200">
                    {article.latest_change.user_name || 'Система'} ({article.latest_change.user_role === 'Admin' ? 'Администратор' : article.latest_change.user_role === 'Editor' ? 'Редактор' : 'Пользователь'})
                  </span>
                </div>
              </div>

              <div className="text-xs space-y-1.5">
                <span className="font-bold text-neutral-700 dark:text-neutral-300">Описание изменений:</span>
                <div className="pl-3 border-l-2 border-indigo-400 dark:border-indigo-900 text-neutral-600 dark:text-neutral-400 space-y-1">
                  {article.latest_change.change_description.split('\n').map((line, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span className="text-indigo-400 select-none">•</span>
                      <span>{line.replace(/^[•\-\*\s]+/, '')}</span>
                    </div>
                  ))}
                </div>
                {article.latest_change.editor_comment && (
                  <div className="text-[11px] text-neutral-450 dark:text-muted-foreground italic pl-3 mt-1 font-light">
                    * Комментарий: "{article.latest_change.editor_comment}"
                  </div>
                )}
              </div>
            </div>
          )}

          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <Tag className="w-3.5 h-3.5 text-neutral-400" />
              {article.tags.map((tag) => (
                <span 
                  key={tag} 
                  className="text-xs px-2 py-0.5 rounded-md border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-card text-neutral-600 dark:text-neutral-400 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Mobile Table of Contents */}
          {headings.length > 0 && (
            <div className="block xl:hidden mb-6 border border-neutral-200 dark:border-border bg-neutral-50/50 dark:bg-card/40 rounded-xl p-4">
              <details className="group">
                <summary className="flex items-center justify-between text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer list-none select-none">
                  <span>Содержание статьи</span>
                  <ChevronDown className="w-4 h-4 text-neutral-400 group-open:rotate-180 transition-transform" />
                </summary>
                <nav className="mt-3 space-y-1">
                  {headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1 truncate"
                    >
                      {heading.text}
                    </a>
                  ))}
                </nav>
              </details>
            </div>
          )}

          {/* Article content renderer */}
          <style>{`
            .wiki-collapsible-block {
              margin: 1rem 0;
              border: 1px solid var(--border);
              border-radius: 0.875rem;
              background: var(--card);
              box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
            }
            .dark .wiki-collapsible-block {
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            }
            .wiki-collapsible-summary {
              display: flex;
              align-items: center;
              gap: 0.625rem;
              padding: 0.95rem 1rem;
              cursor: pointer;
              list-style: none;
              font-weight: 800;
              color: var(--foreground);
              background: var(--muted);
              user-select: none;
            }
            .wiki-collapsible-summary::-webkit-details-marker {
              display: none;
            }
            .wiki-collapsible-summary::before {
              content: '';
              width: 0.45rem;
              height: 0.45rem;
              border-right: 2px solid currentColor;
              border-bottom: 2px solid currentColor;
              transform: rotate(-45deg);
              transition: transform 160ms ease;
              opacity: 0.7;
            }
            .wiki-collapsible-block[open] > .wiki-collapsible-summary::before {
              transform: rotate(45deg);
            }
            .wiki-collapsible-content {
              padding: 1rem;
              border-top: 1px solid var(--border);
            }
            .wiki-collapsible-content > :first-child {
              margin-top: 0;
            }
            .wiki-collapsible-content > :last-child {
              margin-bottom: 0;
            }
          `}</style>
          {(() => {
            if (article.slug === 'auto-list') {
              return <TariffsClassifier />;
            }
            const tariffKey = getTariffKeyFromSlug(article.slug);
            if (tariffKey) {
              return <TariffDetails tariffKey={tariffKey} />;
            }
            
            const isHtml = /<[a-z][\s\S]*>/i.test(article.content);
            if (isHtml) {
              return (
                <div 
                  data-article-content={article.id}
                  dangerouslySetInnerHTML={{ __html: processedContent }} 
                  className="prose dark:prose-invert max-w-none prose-neutral dark:prose-neutral prose-headings:font-bold prose-h2:text-2xl prose-h2:border-b prose-h2:border-neutral-250/50 dark:prose-h2:border-neutral-800/50 prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-p:leading-relaxed prose-p:mb-4 prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-4 prose-table:w-full prose-table:border-collapse prose-table:my-4 prose-td:border prose-td:border-neutral-200/50 dark:prose-td:border-neutral-800/50 prose-td:p-2 prose-th:bg-neutral-100 dark:prose-th:bg-neutral-900 prose-th:p-2 prose-th:font-semibold" 
                />
              );
            }
            
            return (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                components={MarkdownComponents}
              >
                {article.content}
              </ReactMarkdown>
            );
          })()}
        </article>

        {/* Related Materials */}
        <div className="mt-10 pt-6 border-t border-neutral-200/60 dark:border-neutral-800/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2 font-outfit">
                <FileText className="w-4 h-4 text-indigo-500" />
                Связанные материалы
              </h3>
              <p className="text-xs text-neutral-450 dark:text-neutral-500 mt-1">
                Материалы, которые помогают раскрыть тему и перейти к смежным инструкциям.
              </p>
            </div>
            {isStaff && (
              <button
                onClick={() => setIsAddLinkModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/25 text-indigo-650 dark:text-indigo-400 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer shadow-sm select-none shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Добавить связь
              </button>
            )}
          </div>

          {isLinksLoading ? (
            <div className="flex items-center gap-2 text-xs text-neutral-400 rounded-xl border border-neutral-200/60 dark:border-neutral-850 bg-neutral-50/60 dark:bg-neutral-900/30 p-5">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Загрузка связей...
            </div>
          ) : links.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-indigo-300/70 dark:border-indigo-500/30 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] p-6 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="font-outfit text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Связанных материалов пока нет
              </h4>
              <p className="mx-auto mt-1 max-w-lg text-xs text-neutral-500 dark:text-neutral-400">
                Добавьте статьи, инструкции или регламенты, которые помогут лучше раскрыть тему.
              </p>
              {isStaff && (
                <button
                  onClick={() => setIsAddLinkModalOpen(true)}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Добавить связь
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="group relative overflow-hidden rounded-2xl border border-neutral-200/70 dark:border-neutral-850 bg-white dark:bg-neutral-950/50 hover:border-indigo-500/35 hover:shadow-premium dark:hover:shadow-premium-dark transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/15 bg-indigo-500/10 text-indigo-500 shrink-0">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/articles/${link.target_slug}`}
                            className="font-bold text-sm text-neutral-950 dark:text-neutral-100 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2"
                          >
                            {link.target_title}
                          </Link>
                          {isStaff && (
                            <button
                              onClick={() => handleDeleteLink(link.id)}
                              className="p-1.5 hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500 rounded-lg transition-all shrink-0 cursor-pointer"
                              title="Удалить связь"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                          {link.target_summary || link.link_text || 'Краткое описание пока не заполнено.'}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
                            <Briefcase className="w-3 h-3" />
                            {(link.target_section_paths || [])[0] || 'Без раздела'}
                          </span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${getCompactStatusClass(link.target_status)}`}>
                            {getCompactStatusBadge(link.target_status)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400">
                            <Clock3 className="w-3 h-3" />
                            {formatCompactDate(link.target_updated_at)}
                          </span>
                        </div>
                        {link.link_text && (
                          <div className="mt-3 rounded-lg border border-neutral-200/60 dark:border-neutral-850 bg-neutral-50/70 dark:bg-neutral-900/35 px-3 py-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                            {link.link_text}
                          </div>
                        )}
                        <Link
                          to={`/articles/${link.target_slug}`}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Открыть материал
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Backlinks */}
        <div className="mt-8 pt-6 border-t border-neutral-200/60 dark:border-neutral-800/60">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2 font-outfit">
              <CornerDownRight className="w-4 h-4 text-indigo-500" />
              Эта статья упоминается в
            </h3>
            <p className="text-xs text-neutral-450 dark:text-neutral-500 mt-1">
              Обратные ссылки строятся автоматически на основе связанных материалов.
            </p>
          </div>

          {isLinksLoading ? (
            <div className="flex items-center gap-2 text-xs text-neutral-400 rounded-xl border border-neutral-200/60 dark:border-neutral-850 bg-neutral-50/60 dark:bg-neutral-900/30 p-5">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Загрузка обратных ссылок...
            </div>
          ) : backlinks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/30 p-6 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                <CornerDownRight className="w-5 h-5" />
              </div>
              <h4 className="font-outfit text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Пока никто не ссылается на эту статью
              </h4>
              <p className="mx-auto mt-1 max-w-lg text-xs text-neutral-500 dark:text-neutral-400">
                Когда другая статья будет ссылаться на этот материал, она появится здесь автоматически.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backlinks.map((link) => (
                <Link
                  key={link.id}
                  to={`/articles/${link.source_slug}`}
                  className="group flex items-start gap-3 rounded-xl border border-neutral-200/70 dark:border-neutral-850 bg-white dark:bg-neutral-950/45 p-3 hover:border-indigo-500/35 hover:bg-neutral-50/60 dark:hover:bg-neutral-900/35 transition-all"
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-500 shrink-0">
                    <FileText className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {link.source_title}
                      </div>
                      <span className="text-[10px] text-neutral-400 shrink-0">
                        {formatCompactDate(link.source_updated_at)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
                        <Building2 className="w-3 h-3" />
                        {(link.source_section_paths || [])[0] || 'Без раздела'}
                      </span>
                      {link.link_text && (
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                          Используется как: {link.link_text}
                        </span>
                      )}
                    </div>
                    {link.source_summary && (
                      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                        {link.source_summary}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right ToC Sidebar */}
      {headings.length > 0 && (
        <aside className="hidden xl:block w-56 shrink-0 sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto py-8">
          <div className="border-l border-neutral-200 dark:border-neutral-800 pl-4 space-y-4">
            <h4 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              На этой странице
            </h4>
            <nav className="space-y-1">
              {headings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1 truncate"
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      )}

      {/* Version History Modal */}
      <AnimatePresence>
        {isChangesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsChangesModalOpen(false);
                setSelectedVersion(null);
              }}
              className="absolute inset-0 bg-neutral-950/60"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`relative w-full ${
                selectedVersion ? 'max-w-5xl' : 'max-w-2xl'
              } border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-xl shadow-premium dark:shadow-premium-dark flex flex-col max-h-[80vh] overflow-hidden transition-all duration-200`}
            >
              <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="font-outfit text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  {selectedVersion ? (
                    <button
                      onClick={() => setSelectedVersion(null)}
                      className="mr-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-950 dark:hover:text-white bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg transition-colors cursor-pointer select-none font-sans font-semibold"
                    >
                      ← Назад
                    </button>
                  ) : (
                    <History className="w-4.5 h-4.5 text-indigo-500" />
                  )}
                  {selectedVersion ? `Версия ${selectedVersion.version_number}` : 'История версий статьи'}
                </h3>
                <button
                  onClick={() => {
                    setIsChangesModalOpen(false);
                    setSelectedVersion(null);
                  }}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {isChangesLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-xs text-neutral-400">Загрузка истории версий...</span>
                  </div>
                ) : selectedVersion ? (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-3.5 bg-neutral-50/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between items-start gap-4 flex-wrap sm:flex-nowrap">
                        <div>
                          <div className="font-bold text-neutral-950 dark:text-white">
                            Автор: {selectedVersion.created_by_name || 'Система'}
                            {selectedVersion.created_by_role && ` (${selectedVersion.created_by_role})`}
                          </div>
                          <div className="text-neutral-400 text-[10px] mt-0.5">
                            Создана: {new Date(selectedVersion.created_at).toLocaleString('ru-RU')}
                          </div>
                        </div>

                        {isStaff && (
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              onClick={() => openRestoreModal(selectedVersion, false)}
                              disabled={isRestoring}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold shadow-md shadow-amber-600/15 transition-all cursor-pointer shrink-0"
                            >
                              {isRestoring ? 'Восстановление...' : 'Восстановить в черновик'}
                            </button>
                            <button
                              onClick={() => openRestoreModal(selectedVersion, true)}
                              disabled={isRestoring}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold shadow-md shadow-indigo-600/15 transition-all cursor-pointer shrink-0"
                            >
                              {isRestoring ? 'Восстановление...' : 'Восстановить и опубликовать'}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-neutral-200/50 dark:border-neutral-800/80 pt-3">
                        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2">
                          <div className="text-[10px] font-bold uppercase text-neutral-400">Статус</div>
                          <div className="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-100">{getVersionStatusLabel(selectedVersion.status)}</div>
                        </div>
                        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2">
                          <div className="text-[10px] font-bold uppercase text-neutral-400">Источник</div>
                          <div className="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-100">{getVersionSourceLabel(selectedVersion.source_type)}</div>
                        </div>
                        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2">
                          <div className="text-[10px] font-bold uppercase text-neutral-400">Основа</div>
                          <div className="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-100">
                            {selectedVersion.restored_from_version_number
                              ? `Восстановлена из версии ${selectedVersion.restored_from_version_number}`
                              : 'Обычная версия'}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-neutral-200/50 dark:border-neutral-800/80 pt-2 space-y-1">
                        <div>
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">Комментарий:</span>{' '}
                          {selectedVersion.change_comment || 'Комментарий не указан'}
                        </div>
                        {(selectedVersion.editor_comment || selectedVersion.restore_comment) && (
                          <div className="text-[11px] text-neutral-450 dark:text-neutral-550 italic pl-2 border-l-2 border-indigo-500/30">
                            {selectedVersion.editor_comment || selectedVersion.restore_comment}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setVersionViewMode('preview')}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                          versionViewMode === 'preview'
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                            : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                      >
                        Просмотр
                      </button>
                      <button
                        onClick={() => setVersionViewMode('compare')}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                          versionViewMode === 'compare'
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                            : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                      >
                        Сравнение
                      </button>
                      {versionViewMode === 'compare' && (
                        <select
                          value={String(compareTargetId)}
                          onChange={(e) => {
                            const value = e.target.value;
                            setCompareTargetId(value === 'current' ? 'current' : Number(value));
                          }}
                          className="ml-auto min-w-[190px] px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                          <option value="current">Сравнить с текущей статьёй</option>
                          {versionsLog
                            .filter((version) => version.id !== selectedVersion.id)
                            .map((version) => (
                              <option key={version.id} value={version.id}>
                                Сравнить с версией {version.version_number}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>

                    {versionViewMode === 'preview' ? (
                      <div className="border border-neutral-200 dark:border-neutral-850 rounded-xl overflow-hidden bg-white dark:bg-neutral-950">
                        <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-850 bg-neutral-100/50 dark:bg-neutral-900/50 text-[10px] font-bold uppercase text-neutral-400 tracking-wider">
                          Просмотр содержимого версии
                        </div>
                        <div className="max-h-[360px] overflow-y-auto p-4 prose-custom">
                          {/<[a-z][\s\S]*>/i.test(selectedVersion.content) ? (
                            <div dangerouslySetInnerHTML={{ __html: selectedVersion.content }} />
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                              {selectedVersion.content}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {selectedCompareTarget && selectedCompareTarget.title !== selectedVersion.title && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-amber-700 dark:text-amber-450">Разное название статьи:</div>
                            <div className="text-neutral-450 line-through">- {selectedCompareTarget.label}: {selectedCompareTarget.title}</div>
                            <div className="text-neutral-900 dark:text-white font-semibold">+ Версия {selectedVersion.version_number}: {selectedVersion.title}</div>
                          </div>
                        )}

                        <div className="border border-neutral-200 dark:border-neutral-850 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-950 flex flex-col shadow-inner">
                          <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-850 bg-neutral-100/50 dark:bg-neutral-900/50 text-[10px] font-bold uppercase text-neutral-400 tracking-wider">
                            Сравнение содержимого: {selectedCompareTarget?.label || 'Текущая статья'} → версия {selectedVersion.version_number}
                          </div>
                          <div className="overflow-y-auto max-h-[340px] divide-y divide-neutral-100/30 dark:divide-neutral-900/30">
                            {computeDiff(selectedCompareTarget?.content || '', selectedVersion.content || '').map((line, idx) => {
                              if (line.type === 'added') {
                                return (
                                  <div key={idx} className="px-3 py-1 bg-green-50/50 dark:bg-green-950/20 border-l-4 border-green-500 font-mono text-xs whitespace-pre-wrap text-green-955 dark:text-green-300">
                                    + {line.text}
                                  </div>
                                );
                              }
                              if (line.type === 'removed') {
                                return (
                                  <div key={idx} className="px-3 py-1 bg-red-50/50 dark:bg-red-950/20 border-l-4 border-red-500 font-mono text-xs whitespace-pre-wrap text-red-950 dark:text-red-350 line-through opacity-85">
                                    - {line.text}
                                  </div>
                                );
                              }
                              if (line.type === 'modified') {
                                return (
                                  <div key={idx} className="px-3 py-1.5 bg-amber-50/40 dark:bg-amber-950/15 border-l-4 border-amber-500 font-mono text-xs whitespace-pre-wrap text-neutral-900 dark:text-neutral-100 space-y-0.5">
                                    <div className="text-neutral-400 line-through opacity-70">- {line.oldText}</div>
                                    <div className="text-neutral-900 dark:text-white font-semibold">+ {line.text}</div>
                                  </div>
                                );
                              }
                              return (
                                <div key={idx} className="px-3 py-1 text-neutral-600 dark:text-neutral-450 font-mono text-xs whitespace-pre-wrap">
                                  &nbsp;&nbsp;{line.text}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : versionsLog.length === 0 ? (
                  <div className="text-center py-10 text-xs text-neutral-400 italic">
                    У этой статьи пока нет сохранённых версий.
                  </div>
                ) : (
                  <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-neutral-200/50 dark:before:bg-neutral-800/50">
                    {versionsLog.map((version) => (
                      <div key={version.id} className="relative pl-7 text-xs">
                        <div className="absolute left-[9px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-neutral-950" />
                        
                        <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-400 mb-1">
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            Версия {version.version_number} · {version.created_by_name || 'Система'}
                          </span>
                          <span>
                            {new Date(version.created_at).toLocaleString('ru-RU')}
                          </span>
                        </div>
                        
                        <div
                          onClick={() => {
                            setSelectedVersion(version);
                            setVersionViewMode('compare');
                            setCompareTargetId('current');
                          }}
                          className="bg-neutral-50 dark:bg-background/30 p-2.5 rounded-lg border border-neutral-200 dark:border-border space-y-1.5 hover:border-indigo-500 dark:hover:border-indigo-500 cursor-pointer transition-all hover:bg-neutral-100/50 dark:hover:bg-neutral-900/80"
                          title="Открыть версию"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-neutral-200 dark:border-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-600 dark:text-neutral-300">
                              {getVersionStatusLabel(version.status)}
                            </span>
                            <span className="inline-flex rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                              {getVersionSourceLabel(version.source_type)}
                            </span>
                            {version.restored_from_version_number && (
                              <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                Из версии {version.restored_from_version_number}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300 font-mono text-[10px]">КОММЕНТАРИЙ:</span>{' '}
                            {version.change_comment || version.editor_comment || 'Комментарий не указан'}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVersion(version);
                                setVersionViewMode('preview');
                                setCompareTargetId('current');
                              }}
                              className="px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-800 text-[10px] font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                            >
                              Просмотр
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVersion(version);
                                setVersionViewMode('compare');
                                setCompareTargetId('current');
                              }}
                              className="px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-800 text-[10px] font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                            >
                              Сравнить
                            </button>
                            {isStaff && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRestoreModal(version, false);
                                  }}
                                  className="px-2.5 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                                >
                                  В черновик
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRestoreModal(version, true);
                                  }}
                                  className="px-2.5 py-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"
                                >
                                  Опубликовать
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Restore Version Confirmation Modal */}
      <AnimatePresence>
        {isRestoreModalOpen && restoreTargetVersion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isRestoring && setIsRestoreModalOpen(false)}
              className="absolute inset-0 bg-neutral-950/60"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-xl shadow-premium dark:shadow-premium-dark flex flex-col overflow-hidden transition-all duration-200 z-10"
            >
              <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="font-outfit text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-500" />
                  Восстановление версии {restoreTargetVersion.version_number}
                </h3>
                <button
                  onClick={() => !isRestoring && setIsRestoreModalOpen(false)}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 space-y-1">
                  <div className="font-bold text-indigo-950 dark:text-indigo-200">
                    Режим восстановления: {restorePublish ? 'Восстановить и опубликовать' : 'Восстановить в черновик'}
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-350 text-[11px] leading-relaxed">
                    Старая версия не заменяется напрямую. Система создаст <strong>новую неизменяемую версию (Версия {(versionsLog[0]?.version_number || 0) + 1})</strong>, содержимое которой будет скопировано из версии {restoreTargetVersion.version_number}.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300">
                    Комментарий к изменению / восстановлению: <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={restoreCommentInput}
                    onChange={(e) => setRestoreCommentInput(e.target.value)}
                    placeholder="Укажите причину восстановления..."
                    className="w-full p-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs resize-none"
                  />
                </div>

                {(article?.mandatory_ack_enabled || restoreTargetVersion.mandatory_ack_enabled) && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={restoreRequireReack}
                        onChange={(e) => setRestoreRequireReack(e.target.checked)}
                        className="mt-0.5 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer shrink-0"
                      />
                      <div>
                        <span className="font-bold text-amber-900 dark:text-amber-200 block">
                          Требуется повторное ознакомление сотрудников с новой версией
                        </span>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 leading-normal">
                          Эта статья является обязательной. При включенном флаге сотрудникам будет повторно отправлено требование ознакомления с материалом.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                <button
                  type="button"
                  onClick={() => !isRestoring && setIsRestoreModalOpen(false)}
                  disabled={isRestoring}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isRestoring || !restoreCommentInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Восстановление...
                    </>
                  ) : (
                    'Подтвердить и восстановить'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Link Modal */}
      <AnimatePresence>
        {isAddLinkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeAddLinkModal}
              className="absolute inset-0 bg-neutral-950/60"
            />
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-3xl border border-neutral-200 dark:border-border bg-white dark:bg-card rounded-2xl shadow-premium dark:shadow-premium-dark flex flex-col overflow-hidden max-h-[85vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-border">
                <div>
                  <h3 className="font-outfit text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Добавить связанные материалы
                  </h3>
                  <p className="text-xs text-neutral-450 dark:text-neutral-500 mt-1">
                    Можно выбрать одну или несколько статей.
                  </p>
                </div>
                <button
                  onClick={closeAddLinkModal}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateLink} className="flex min-h-0 flex-1 flex-col">
                <div className="p-4 space-y-3 border-b border-neutral-100 dark:border-border">
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-background px-3 py-2 focus-within:border-indigo-500 transition-colors">
                    <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Поиск по названию, описанию, разделу..."
                      value={linkSearchQuery}
                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={linkSpaceFilter}
                      onChange={(e) => {
                        setLinkSpaceFilter(e.target.value);
                        setLinkSectionFilter('all');
                      }}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-background border border-neutral-200 dark:border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-neutral-800 dark:text-neutral-100"
                    >
                      <option value="all">Все отделы</option>
                      {navigationTree.map((space) => (
                        <option key={space.id} value={space.id}>{space.name}</option>
                      ))}
                    </select>
                    <select
                      value={linkSectionFilter}
                      onChange={(e) => setLinkSectionFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-background border border-neutral-200 dark:border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-neutral-800 dark:text-neutral-100"
                    >
                      <option value="all">Все должности / разделы</option>
                      {sectionFilterOptions.map((section) => (
                        <option key={section.id} value={section.id}>{section.path}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {filteredLinkArticles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-neutral-250 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/30 p-8 text-center">
                      <Search className="mx-auto h-7 w-7 text-neutral-400" />
                      <div className="mt-3 text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        Материалы не найдены
                      </div>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        Попробуйте изменить поиск или фильтр отдела.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {filteredLinkArticles.map((item) => {
                        const selected = selectedLinkArticleIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleSelectedLinkArticle(item.id)}
                            className={`group rounded-xl border p-3 text-left transition-all ${
                              selected
                                ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/10'
                                : 'border-neutral-200 dark:border-neutral-850 bg-white dark:bg-neutral-950/45 hover:border-indigo-400/60 hover:bg-neutral-50 dark:hover:bg-neutral-900/35'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 ${
                                selected
                                  ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-500'
                                  : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-500'
                              }`}>
                                {selected ? <Check className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100 line-clamp-2">
                                  {item.title}
                                </div>
                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                                  {item.summary || 'Краткое описание пока не заполнено.'}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
                                    <Briefcase className="w-3 h-3" />
                                    {getPrimarySectionPath(item)}
                                  </span>
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${getCompactStatusClass(item.status)}`}>
                                    {getCompactStatusBadge(item.status)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-3 border-t border-neutral-100 dark:border-border bg-neutral-50/60 dark:bg-neutral-950/30">
                  <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 dark:text-neutral-500">
                    Текст связи / Описание контекста (необязательно)
                  </label>
                  <input
                    type="text"
                    placeholder="Например: Ссылка на должностную инструкцию"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-background border border-neutral-200 dark:border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-neutral-800 dark:text-neutral-100"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Выбрано: {selectedLinkArticleIds.length}
                  </span>
                  <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAddLinkModal}
                    className="px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-background border border-neutral-200 dark:border-border text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingLink || selectedLinkArticleIds.length === 0}
                    className="inline-flex items-center gap-1 px-4 py-1.5 bg-indigo-650 hover:bg-indigo-750 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-650/15 transition-all cursor-pointer"
                  >
                    {isCreatingLink ? 'Сохранение...' : 'Добавить выбранные'}
                  </button>
                  </div>
                </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function forceOpenDetails(detailsEl: HTMLElement) {
  if (detailsEl instanceof HTMLDetailsElement || detailsEl.tagName === 'DETAILS') {
    (detailsEl as HTMLDetailsElement).open = true;
  }
  detailsEl.setAttribute('open', 'open');
  detailsEl.dataset.open = 'true';
  detailsEl.setAttribute('data-state', 'open');
  detailsEl.classList.add('open', 'is-open');

  const contentChild = detailsEl.querySelector('.wiki-collapsible-content, [data-wiki-collapsible-content]');
  if (contentChild) {
    (contentChild as HTMLElement).style.display = 'block';
    contentChild.removeAttribute('hidden');
    contentChild.classList.remove('hidden');
  }

  const summaryChild = detailsEl.querySelector('summary, .wiki-collapsible-summary');
  if (summaryChild) {
    summaryChild.setAttribute('aria-expanded', 'true');
  }
}

function highlightTextInDOM(container: HTMLElement, textToHighlight: string): boolean {
  if (!textToHighlight || textToHighlight.trim().length === 0) return false;

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const cleanText = textToHighlight.trim().replace(/\u00a0/g, ' ');
  // Use stem matching for words longer than 4 chars (e.g. "Департамент" -> "департ")
  const stem = cleanText.length > 4 ? cleanText.substring(0, Math.min(cleanText.length, 5)) : cleanText;
  
  const exactPattern = escapeRegExp(cleanText).replace(/\s+/g, '[\\s\\u00a0]+');
  const stemPattern = escapeRegExp(stem).replace(/\s+/g, '[\\s\\u00a0]+');

  const testRegex = new RegExp(stemPattern, 'i');
  const matchRegex = new RegExp(`(${exactPattern}|${stemPattern}[a-zA-Zа-яА-ЯёЁ0-9_-]*)`, 'gi');

  // 1. FIRST PASS: Instantly open any <details> / .wiki-collapsible-block whose textContent matches!
  const allDetails = container.querySelectorAll<HTMLDetailsElement>('details, .wiki-collapsible-block, [data-wiki-collapsible], [data-state]');
  let openedAny = false;
  allDetails.forEach((details) => {
    const textContent = (details.textContent || '').replace(/\u00a0/g, ' ');
    if (testRegex.test(textContent)) {
      forceOpenDetails(details);
      openedAny = true;
    }
  });

  // Clean up any previous search highlights
  container.querySelectorAll('mark.wiki-search-highlight').forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
  });

  // 2. SECOND PASS: Find text nodes and replace with <mark>
  const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const nodesToReplace: Text[] = [];

  let currentNode = walk.nextNode();
  while (currentNode) {
    const parent = currentNode.parentNode;
    if (
      currentNode.nodeValue && 
      testRegex.test(currentNode.nodeValue.replace(/\u00a0/g, ' ')) &&
      parent &&
      parent.nodeName !== 'SCRIPT' &&
      parent.nodeName !== 'STYLE' &&
      parent.nodeName !== 'MARK' &&
      parent.nodeName !== 'TEXTAREA'
    ) {
      nodesToReplace.push(currentNode as Text);
    }
    currentNode = walk.nextNode();
  }

  let firstMark: HTMLElement | null = null;

  nodesToReplace.forEach((node) => {
    // Re-verify all ancestor <details> / collapsible blocks so the highlighted text is fully visible
    let currentParent = node.parentElement;
    while (currentParent && currentParent !== container) {
      if (
        currentParent.tagName === 'DETAILS' || 
        currentParent.hasAttribute('data-wiki-collapsible') ||
        currentParent.classList.contains('wiki-collapsible-block')
      ) {
        forceOpenDetails(currentParent as HTMLElement);
        openedAny = true;
      }
      currentParent = currentParent.parentElement;
    }

    const parent = node.parentNode;
    if (!parent) return;

    const text = node.nodeValue || '';
    const fragments = document.createDocumentFragment();
    let lastIndex = 0;

    matchRegex.lastIndex = 0;

    text.replace(matchRegex, (match, p1, offset) => {
      if (offset > lastIndex) {
        fragments.appendChild(document.createTextNode(text.substring(lastIndex, offset)));
      }

      const mark = document.createElement('mark');
      mark.className = 'wiki-search-highlight bg-amber-300 dark:bg-amber-500/60 text-neutral-950 dark:text-white px-1.5 py-0.5 rounded font-bold shadow-md inline-block ring-2 ring-amber-400/50 animate-pulse';
      mark.textContent = match;
      fragments.appendChild(mark);

      if (!firstMark) {
        firstMark = mark;
      }

      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      fragments.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    try {
      parent.replaceChild(fragments, node);
    } catch (e) {
      console.warn('Failed to replace node for highlight:', e);
    }
  });

function scrollToElementCenter(el: HTMLElement) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.top === 0 && rect.height === 0) return;

  const absoluteTop = rect.top + window.scrollY;
  const viewportHeight = window.innerHeight;
  const targetY = Math.max(0, absoluteTop - viewportHeight / 3);

  window.scrollTo({
    top: targetY,
    behavior: 'smooth'
  });
}

  if (firstMark) {
    const markEl = firstMark as HTMLElement;
    const doScroll = () => scrollToElementCenter(markEl);
    doScroll();
    setTimeout(doScroll, 100);
    setTimeout(doScroll, 350);
    setTimeout(doScroll, 700);
    return true;
  }

  return openedAny;
}

interface DiffLine {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  text: string;
  oldText?: string;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];
  
  const dp: number[][] = Array(oldLines.length + 1)
    .fill(null)
    .map(() => Array(newLines.length + 1).fill(0));
    
  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  const rawDiff: { type: 'added' | 'removed' | 'unchanged'; text: string }[] = [];
  let i = oldLines.length;
  let j = newLines.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rawDiff.unshift({ type: 'unchanged', text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.unshift({ type: 'added', text: newLines[j - 1] });
      j--;
    } else {
      rawDiff.unshift({ type: 'removed', text: oldLines[i - 1] });
      i--;
    }
  }
  
  const processedDiff: DiffLine[] = [];
  for (let k = 0; k < rawDiff.length; k++) {
    const current = rawDiff[k];
    const next = rawDiff[k + 1];
    if (current.type === 'removed' && next && next.type === 'added') {
      processedDiff.push({
        type: 'modified',
        text: next.text,
        oldText: current.text
      });
      k++;
    } else {
      processedDiff.push({
        type: current.type as any,
        text: current.text
      });
    }
  }
  
  return processedDiff;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) {
    if (diffMins === 1) return '1 минуту назад';
    if (diffMins % 10 === 1 && diffMins !== 11) return `${diffMins} минуту назад`;
    if ([2, 3, 4].includes(diffMins % 10) && ![12, 13, 14].includes(diffMins)) return `${diffMins} минуты назад`;
    return `${diffMins} минут назад`;
  }
  if (diffHours < 24) {
    if (diffHours === 1) return '1 час назад';
    if (diffHours % 10 === 1 && diffHours !== 11) return `${diffHours} час назад`;
    if ([2, 3, 4].includes(diffHours % 10) && ![12, 13, 14].includes(diffHours)) return `${diffHours} часа назад`;
    return `${diffHours} часов назад`;
  }
  if (diffDays === 1) return 'вчера';
  if (diffDays === 2) return '2 дня назад';
  if (diffDays % 10 === 1 && diffDays !== 11) return `${diffDays} день назад`;
  if ([2, 3, 4].includes(diffDays % 10) && ![12, 13, 14].includes(diffDays)) return `${diffDays} дня назад`;
  return `${diffDays} дней назад`;
}
