import * as React from 'react';
import { 
  Plus, Edit, Trash2, Pin, Eye, EyeOff, Calendar, 
  Upload, X, FileText, Loader2, Sparkles, Search, MessageSquare, Video
} from 'lucide-react';
import { 
  fetchNews, createNews, updateNews, deleteNews, 
  uploadImage, uploadNewsAttachment, News 
} from '../lib/api';
import WYSIWYGEditor from './wysiwyg-editor';

export function NewsAdmin() {
  const [newsList, setNewsList] = React.useState<News[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedNews, setSelectedNews] = React.useState<News | null>(null);
  
  // Form State
  const [isEditing, setIsEditing] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [content, setContent] = React.useState('');
  const [videoUrl, setVideoUrl] = React.useState('');
  const [isPublished, setIsPublished] = React.useState(true);
  const [isPinned, setIsPinned] = React.useState(false);
  const [publishedAt, setPublishedAt] = React.useState('');
  const [tagsInput, setTagsInput] = React.useState('');
  const [galleryImages, setGalleryImages] = React.useState<string[]>([]);
  const [attachments, setAttachments] = React.useState<{ file_url: string; file_name: string; file_size: number }[]>([]);
  
  // Loading indicators for media
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [isUploadingFile, setIsUploadingFile] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const loadNews = async () => {
    setIsLoading(true);
    try {
      const list = await fetchNews();
      setNewsList(list);
    } catch (e) {
      alert('Ошибка при загрузке списка новостей');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadNews();
  }, []);

  const handleEditClick = (news: News) => {
    setSelectedNews(news);
    setTitle(news.title);
    setDescription(news.description);
    setContent(news.content);
    setVideoUrl(news.video_url || '');
    setIsPublished(news.is_published);
    setIsPinned(news.is_pinned);
    
    // Format published_at to YYYY-MM-DDTHH:MM for datetime-local input
    if (news.published_at) {
      const d = new Date(news.published_at);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      setPublishedAt(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setPublishedAt('');
    }
    
    setTagsInput(news.tags.join(', '));
    setGalleryImages(news.images || []);
    setAttachments(news.attachments || []);
    setIsEditing(true);
  };

  const handleCreateClick = () => {
    setSelectedNews(null);
    setTitle('');
    setDescription('');
    setContent('<p></p>');
    setVideoUrl('');
    setIsPublished(true);
    setIsPinned(false);
    
    // Set current time for publishedAt
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    setPublishedAt(`${year}-${month}-${day}T${hours}:${minutes}`);
    
    setTagsInput('');
    setGalleryImages([]);
    setAttachments([]);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedNews(null);
  };

  // Upload gallery image
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const res = await uploadImage(file);
      setGalleryImages(prev => [...prev, res.url]);
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки картинки');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeGalleryImage = (idxToRemove: number) => {
    setGalleryImages(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Upload attachment file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const res = await uploadNewsAttachment(file);
      setAttachments(prev => [...prev, {
        file_url: res.file_url,
        file_name: res.file_name,
        file_size: res.file_size
      }]);
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки файла');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const removeAttachment = (idxToRemove: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Заголовок обязателен');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const payload = {
      title,
      description,
      content,
      video_url: videoUrl.trim() || null,
      is_published: isPublished,
      is_pinned: isPinned,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      bump_to_top: !!selectedNews && isPublished && (!publishedAt || new Date(publishedAt).getTime() <= Date.now()),
      tags,
      images: galleryImages,
      attachments
    };

    try {
      if (selectedNews) {
        await updateNews(selectedNews.id, payload);
      } else {
        await createNews(payload);
      }
      setIsEditing(false);
      setSelectedNews(null);
      loadNews();
    } catch (err: any) {
      alert(err.message || 'Ошибка при сохранении новости');
    }
  };

  // Delete Handler
  const handleDelete = async (id: number) => {
    if (!window.confirm('Вы действительно хотите удалить эту новость?')) return;

    try {
      await deleteNews(id);
      loadNews();
    } catch (err: any) {
      alert(err.message || 'Ошибка при удалении новости');
    }
  };

  // Toggle quick values directly
  const handleQuickTogglePublish = async (news: News) => {
    try {
      await updateNews(news.id, {
        title: news.title,
        description: news.description,
        content: news.content,
        video_url: news.video_url || null,
        is_published: !news.is_published,
        is_pinned: news.is_pinned,
        published_at: news.published_at,
        bump_to_top: false,
        tags: news.tags,
        images: news.images,
        attachments: news.attachments
      });
      loadNews();
    } catch (err) {
      alert('Не удалось изменить статус публикации');
    }
  };

  const handleQuickTogglePin = async (news: News) => {
    try {
      await updateNews(news.id, {
        title: news.title,
        description: news.description,
        content: news.content,
        video_url: news.video_url || null,
        is_published: news.is_published,
        is_pinned: !news.is_pinned,
        published_at: news.published_at,
        bump_to_top: false,
        tags: news.tags,
        images: news.images,
        attachments: news.attachments
      });
      loadNews();
    } catch (err) {
      alert('Не удалось изменить закрепление новости');
    }
  };

  // Filtered list
  const filteredNews = newsList.filter(n =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200/50 dark:border-neutral-900 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            Управление новостями
          </h2>
          <p className="text-xs text-neutral-400 mt-1">Публикуйте обновления, прикрепляйте файлы и фотографии, закрепляйте важные новости для сотрудников.</p>
        </div>

        {!isEditing && (
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Создать новость
          </button>
        )}
      </div>

      {/* ADMIN WORKSPACE PANEL */}
      {isEditing ? (
        
        /* EDITOR FORM PANEL */
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-950 border border-neutral-200/50 dark:border-neutral-900 rounded-xl p-5 sm:p-6 space-y-6 shadow-sm">
          
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200/50 dark:border-neutral-900">
            <span className="text-sm font-bold text-neutral-700 dark:text-neutral-350">
              {selectedNews ? 'Редактирование новости' : 'Новое объявление'}
            </span>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded-lg transition-colors border border-neutral-200/50 dark:border-neutral-800"
            >
              Отмена
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Col: Main details */}
            <div className="md:col-span-2 space-y-4">
              
              {/* Title input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Заголовок новости</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Введите броский заголовок..."
                  className="w-full bg-transparent border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              {/* Summary Description input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Краткое описание (для превью)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Краткий анонс новости для списка уведомлений..."
                  rows={2}
                  className="w-full bg-transparent border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              {/* Rich Text Editor */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Форматированное содержимое (Notion Editor)</label>
                <WYSIWYGEditor
                  content={content}
                  onChange={setContent}
                  articleId={selectedNews?.id || 'news_editor'}
                />
              </div>

            </div>

            {/* Right Col: Parameters and uploads */}
            <div className="space-y-6 bg-neutral-50/40 dark:bg-neutral-900/10 p-4 border border-neutral-200/50 dark:border-neutral-900 rounded-xl h-fit">
              
              {/* Scheduling and settings */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-300 uppercase tracking-wider border-b border-neutral-200/50 dark:border-neutral-800 pb-1.5">Настройки</h4>
                
                {/* Publish Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-450 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                    Дата публикации
                  </label>
                  <input
                    type="datetime-local"
                    value={publishedAt}
                    onChange={(e) => setPublishedAt(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white outline-none"
                  />
                </div>

                {/* Flags Checkbox */}
                <div className="flex flex-col gap-2.5 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-neutral-350 dark:border-neutral-800 dark:bg-neutral-900"
                    />
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">Опубликовать сразу</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-neutral-350 dark:border-neutral-800 dark:bg-neutral-900"
                    />
                    <span className="text-xs text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                      <Pin className="w-3.5 h-3.5 text-amber-500 fill-current" />
                      Закрепить новость сверху
                    </span>
                  </label>
                </div>

                {/* Tags */}
                <div className="space-y-1 pt-1">
                  <label className="text-[10px] font-bold text-neutral-450 dark:text-neutral-400 uppercase tracking-wider">Теги (через запятую)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="обновления, тарифы, поддержка"
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-lg px-2.5 py-1.5 text-xs text-neutral-950 dark:text-white outline-none"
                  />
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[10px] font-bold text-neutral-450 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    <Video className="w-3.5 h-3.5 text-neutral-400" />
                    Ссылка на видео
                  </label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="YouTube, Vimeo, Rutube или прямая ссылка mp4/webm"
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-lg px-2.5 py-1.5 text-xs text-neutral-950 dark:text-white outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    Видео будет воспроизводиться внутри новости, без перехода на другой сайт.
                  </p>
                </div>
              </div>

              {/* Gallery Images Zone */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-300 uppercase tracking-wider border-b border-neutral-200/50 dark:border-neutral-800 pb-1.5">Галерея фотографий</h4>
                
                {/* Upload Trigger */}
                <label className="flex flex-col items-center justify-center border border-dashed border-neutral-250 dark:border-neutral-800 rounded-lg p-4 bg-white dark:bg-neutral-950 cursor-pointer hover:border-indigo-500 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-all select-none">
                  {isUploadingImage ? (
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-neutral-400" />
                  )}
                  <span className="text-[10px] font-medium text-neutral-500 mt-1">Добавить фото в галерею</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isUploadingImage}
                  />
                </label>

                {/* Image Previews */}
                {galleryImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {galleryImages.map((img, idx) => (
                      <div key={`img-prev-${idx}`} className="relative aspect-square rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-900 group">
                        <img src={img} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(idx)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attachments Zone */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-300 uppercase tracking-wider border-b border-neutral-200/50 dark:border-neutral-800 pb-1.5">Файлы-вложения</h4>
                
                {/* Upload Trigger */}
                <label className="flex flex-col items-center justify-center border border-dashed border-neutral-250 dark:border-neutral-800 rounded-lg p-4 bg-white dark:bg-neutral-950 cursor-pointer hover:border-indigo-500 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-all select-none">
                  {isUploadingFile ? (
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-neutral-400" />
                  )}
                  <span className="text-[10px] font-medium text-neutral-500 mt-1">Прикрепить файл (PDF, ZIP, DOCX...)</span>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploadingFile}
                  />
                </label>

                {/* Attachments List */}
                {attachments.length > 0 && (
                  <div className="space-y-1.5">
                    {attachments.map((att, idx) => (
                      <div 
                        key={`att-prev-${idx}`}
                        className="flex items-center justify-between p-2 border border-neutral-200/55 dark:border-neutral-900 rounded-lg bg-white dark:bg-neutral-950 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate font-medium text-neutral-800 dark:text-neutral-300" title={att.file_name}>
                            {att.file_name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="p-1 text-neutral-400 hover:text-red-500 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SAVE ACTION BAR */}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/10 transition-all"
              >
                {selectedNews ? 'Сохранить и поднять вверх' : 'Сохранить и опубликовать'}
              </button>

            </div>

          </div>

        </form>
      ) : (
        
        /* NEWS LIST TABLE PANEL */
        <div className="bg-white dark:bg-neutral-950 border border-neutral-200/50 dark:border-neutral-900 rounded-xl overflow-hidden shadow-sm">
          
          {/* Search bar inside list */}
          <div className="p-4 border-b border-neutral-200/50 dark:border-neutral-900 flex items-center gap-3">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по новостям в базе..."
              className="flex-1 bg-transparent text-sm outline-none text-neutral-900 dark:text-white placeholder-neutral-400"
            />
          </div>

          {isLoading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-neutral-400">Загрузка новостей...</span>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Sparkles className="w-8 h-8 text-neutral-350" />
              <span className="text-xs font-medium">Список новостей пуст</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/50 dark:bg-neutral-900/40 border-b border-neutral-200/50 dark:border-neutral-900 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    <th className="px-5 py-3">Закреп</th>
                    <th className="px-5 py-3">Новость</th>
                    <th className="px-5 py-3">Теги</th>
                    <th className="px-5 py-3">Дата публикации</th>
                    <th className="px-5 py-3">Статус</th>
                    <th className="px-5 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-900 text-sm">
                  {filteredNews.map((news) => {
                    const isScheduled = new Date(news.published_at) > new Date();
                    return (
                      <tr key={news.id} className="hover:bg-neutral-50/40 dark:hover:bg-neutral-900/20 transition-colors">
                        
                        {/* Pin status icon trigger */}
                        <td className="px-5 py-3">
                          <button
                            onClick={() => handleQuickTogglePin(news)}
                            className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors ${news.is_pinned ? 'text-amber-500' : 'text-neutral-300 dark:text-neutral-700'}`}
                            title={news.is_pinned ? 'Открепить новость' : 'Закрепить новость'}
                          >
                            <Pin className={`w-4 h-4 ${news.is_pinned ? 'fill-current' : ''}`} />
                          </button>
                        </td>

                        {/* News title & details */}
                        <td className="px-5 py-3 max-w-[280px]">
                          <div className="font-bold text-neutral-900 dark:text-white truncate">{news.title}</div>
                          {news.description && (
                            <div className="text-xs text-neutral-450 dark:text-neutral-500 truncate mt-0.5">{news.description}</div>
                          )}
                          {news.video_url && (
                            <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                              <Video className="w-3 h-3" />
                              Видео
                            </div>
                          )}
                        </td>

                        {/* Tags list */}
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {news.tags.length === 0 ? (
                              <span className="text-xs text-neutral-400">-</span>
                            ) : (
                              news.tags.map(t => (
                                <span key={t} className="bg-neutral-100 dark:bg-neutral-900 text-neutral-500 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                  {t}
                                </span>
                              ))
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                          {new Date(news.published_at).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>

                        {/* Status badges */}
                        <td className="px-5 py-3">
                          <button
                            onClick={() => handleQuickTogglePublish(news)}
                            className="text-left outline-none"
                            title="Нажмите для переключения"
                          >
                            {!news.is_published ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                <EyeOff className="w-3 h-3" />
                                Скрыто
                              </span>
                            ) : isScheduled ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                <Calendar className="w-3 h-3" />
                                Запланировано
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                <Eye className="w-3 h-3" />
                                Активна
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditClick(news)}
                              className="p-1.5 rounded hover:bg-neutral-150 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                              title="Редактировать новость"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(news.id)}
                              className="p-1.5 rounded hover:bg-red-500/10 text-neutral-400 hover:text-red-500 transition-colors"
                              title="Удалить новость"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
