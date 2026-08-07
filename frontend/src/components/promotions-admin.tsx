import * as React from 'react';
import { 
  Gift, Plus, Edit, Trash2, Eye, EyeOff, Upload, Search, X, Check, Save, Calendar, CheckSquare, Square 
} from 'lucide-react';
import { 
  fetchPromotions, createPromotion, updatePromotion, deletePromotion, 
  uploadPromotionBanner, fetchTaxiParks, getApiAssetUrl, Promotion, TaxiPark 
} from '../lib/api';

export function PromotionsAdmin() {
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [taxiParks, setTaxiParks] = React.useState<TaxiPark[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingPromo, setEditingPromo] = React.useState<Promotion | null>(null);

  // Form state
  const [title, setTitle] = React.useState('');
  const [shortDesc, setShortDesc] = React.useState('');
  const [fullDesc, setFullDesc] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [externalLink, setExternalLink] = React.useState('');
  const [buttonText, setButtonText] = React.useState('Подробнее');
  const [isActive, setIsActive] = React.useState(true);
  const [selectedParkIds, setSelectedParkIds] = React.useState<number[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [promosData, parksData] = await Promise.all([
        fetchPromotions(undefined, false),
        fetchTaxiParks(false),
      ]);
      setPromotions(promosData);
      setTaxiParks(parksData);
    } catch (err) {
      console.error('Failed to load promotions or taxi parks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setEditingPromo(null);
    setTitle('');
    setShortDesc('');
    setFullDesc('');
    setImageUrl('');
    setStartDate('');
    setEndDate('');
    setExternalLink('');
    setButtonText('Подробнее');
    setIsActive(true);
    setSelectedParkIds([]);
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setTitle(promo.title);
    setShortDesc(promo.short_description || '');
    setFullDesc(promo.full_description || '');
    setImageUrl(promo.image_url || '');
    setStartDate(promo.start_date ? new Date(promo.start_date).toISOString().slice(0, 16) : '');
    setEndDate(promo.end_date ? new Date(promo.end_date).toISOString().slice(0, 16) : '');
    setExternalLink(promo.external_link || '');
    setButtonText(promo.button_text || 'Подробнее');
    setIsActive(promo.is_active);
    setSelectedParkIds(promo.taxi_park_ids || []);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadPromotionBanner(file);
      setImageUrl(res.url);
    } catch (err: any) {
      alert('Ошибка загрузки баннера: ' + (err.message || 'Ошибка'));
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSelectPark = (parkId: number) => {
    setSelectedParkIds(prev =>
      prev.includes(parkId) ? prev.filter(id => id !== parkId) : [...prev, parkId]
    );
  };

  const handleSelectAllParks = () => {
    if (selectedParkIds.length === taxiParks.length) {
      setSelectedParkIds([]);
    } else {
      setSelectedParkIds(taxiParks.map(p => p.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Название акции обязательно.');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        short_description: shortDesc.trim() || null,
        full_description: fullDesc.trim() || null,
        image_url: imageUrl || null,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        external_link: externalLink.trim() || null,
        button_text: buttonText.trim() || 'Подробнее',
        is_active: isActive,
        taxi_park_ids: selectedParkIds,
      };

      if (editingPromo) {
        await updatePromotion(editingPromo.id, payload);
      } else {
        await createPromotion(payload);
      }

      setIsModalOpen(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка при сохранении акции.');
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      await updatePromotion(promo.id, { is_active: !promo.is_active });
      setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, is_active: !p.is_active } : p));
    } catch (err: any) {
      alert('Ошибка изменения активности: ' + err.message);
    }
  };

  const handleDelete = async (promo: Promotion) => {
    if (!window.confirm(`Вы уверены, что хотите удалить акцию "${promo.title}"?`)) return;
    try {
      await deletePromotion(promo.id);
      setPromotions(prev => prev.filter(p => p.id !== promo.id));
    } catch (err: any) {
      alert('Ошибка при удалении: ' + err.message);
    }
  };

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const filteredPromos = React.useMemo(() => {
    if (!searchQuery.trim()) return promotions;
    const q = searchQuery.toLowerCase();
    return promotions.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.short_description || '').toLowerCase().includes(q)
    );
  }, [promotions, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-foreground">Управление Акциями</h3>
            <p className="text-xs text-muted-foreground">Всего акций: {promotions.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск акций..."
              className="w-full pl-8 pr-3 py-1.5 bg-muted text-xs border border-border rounded-lg text-foreground outline-none"
            />
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Добавить акцию
          </button>
        </div>
      </div>

      {/* Promotions List */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">Загрузка акций...</div>
      ) : filteredPromos.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground border border-border rounded-2xl bg-card">
          Акции не найдены
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPromos.map((promo) => (
            <div
              key={promo.id}
              className="p-5 rounded-2xl border border-border bg-card space-y-4 flex flex-col justify-between"
            >
              {promo.image_url && (
                <img
                  src={getApiAssetUrl(promo.image_url)}
                  alt={promo.title}
                  className="w-full h-36 object-cover rounded-xl border border-border bg-muted"
                />
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-500" />
                    {formatDate(promo.start_date)} — {formatDate(promo.end_date)}
                  </span>
                  <button
                    onClick={() => handleToggleActive(promo)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                      promo.is_active
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                    }`}
                  >
                    {promo.is_active ? 'Активна' : 'Отключена'}
                  </button>
                </div>

                <h4 className="font-extrabold text-base text-foreground">{promo.title}</h4>
                {promo.short_description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{promo.short_description}</p>
                )}
              </div>

              {/* Linked Taxi Parks Badges */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Таксопарки ({promo.taxi_parks?.length || 0}):</div>
                <div className="flex flex-wrap gap-1">
                  {promo.taxi_parks && promo.taxi_parks.length > 0 ? (
                    promo.taxi_parks.map(tp => (
                      <span key={tp.id} className="px-2 py-0.5 rounded bg-muted text-[10px] font-semibold text-foreground border border-border">
                        {tp.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">Не привязана ни к одному парку</span>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Кнопка: "{promo.button_text || 'Подробнее'}"</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(promo)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-500 cursor-pointer"
                    title="Редактировать"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(promo)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 cursor-pointer"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 space-y-5 my-8 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-500" />
                {editingPromo ? 'Редактировать акцию' : 'Добавить новую акцию'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Название акции *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Скидка 50% на обслуживание"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                />
              </div>

              {/* Banner Upload */}
              <div>
                <label className="block font-bold text-foreground mb-1">Изображение / Баннер</label>
                <div className="flex items-center gap-3">
                  {imageUrl && (
                    <img
                      src={getApiAssetUrl(imageUrl)}
                      alt="Banner preview"
                      className="w-20 h-12 rounded-xl object-cover border border-border bg-muted shrink-0"
                    />
                  )}
                  <label className="px-3 py-2 bg-muted hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-border rounded-xl text-xs font-semibold text-foreground cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {isUploading ? 'Загрузка...' : 'Загрузить баннер'}
                    <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-red-500 text-xs hover:underline"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Короткое описание</label>
                <input
                  type="text"
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                  placeholder="Короткий анонс акции..."
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Полное описание</label>
                <textarea
                  rows={3}
                  value={fullDesc}
                  onChange={(e) => setFullDesc(e.target.value)}
                  placeholder="Условия акции, порядок получения и детали..."
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-foreground mb-1">Дата начала</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Дата окончания</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-foreground mb-1">Внешняя ссылка (опционально)</label>
                  <input
                    type="text"
                    value={externalLink}
                    onChange={(e) => setExternalLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Текст кнопки</label>
                  <input
                    type="text"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    placeholder="Подробнее"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                  />
                </div>
              </div>

              {/* Many-to-Many Taxi Parks Selection */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground">
                    Применимо к таксопаркам ({selectedParkIds.length} из {taxiParks.length}) *
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllParks}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    {selectedParkIds.length === taxiParks.length ? 'Снять все' : 'Выбрать все'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-muted/40 rounded-xl border border-border">
                  {taxiParks.map((park) => {
                    const isSelected = selectedParkIds.includes(park.id);
                    return (
                      <div
                        key={park.id}
                        onClick={() => toggleSelectPark(park.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold'
                            : 'bg-card border-border hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 shrink-0 text-amber-500" />
                        ) : (
                          <Square className="w-4 h-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{park.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="promo_active_checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                />
                <label htmlFor="promo_active_checkbox" className="font-bold text-foreground cursor-pointer">
                  Акция активна
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
