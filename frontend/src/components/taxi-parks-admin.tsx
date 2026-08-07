import * as React from 'react';
import { 
  Building2, Plus, Edit, Trash2, Eye, EyeOff, Upload, ArrowUp, ArrowDown, Search, X, Check, Save 
} from 'lucide-react';
import { 
  fetchTaxiParks, createTaxiPark, updateTaxiPark, deleteTaxiPark, 
  reorderTaxiParks, uploadTaxiParkLogo, getApiAssetUrl, TaxiPark 
} from '../lib/api';

export function TaxiParksAdmin() {
  const [taxiParks, setTaxiParks] = React.useState<TaxiPark[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingPark, setEditingPark] = React.useState<TaxiPark | null>(null);

  // Form state
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [logoUrl, setLogoUrl] = React.useState('');
  const [shortDesc, setShortDesc] = React.useState('');
  const [fullDesc, setFullDesc] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [additionalPhones, setAdditionalPhones] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [workingHours, setWorkingHours] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [additionalInfo, setAdditionalInfo] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const loadParks = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTaxiParks(false);
      setTaxiParks(data);
    } catch (err) {
      console.error('Failed to load taxi parks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadParks();
  }, []);

  const resetForm = () => {
    setEditingPark(null);
    setName('');
    setSlug('');
    setLogoUrl('');
    setShortDesc('');
    setFullDesc('');
    setPhone('');
    setAdditionalPhones('');
    setAddress('');
    setWorkingHours('');
    setWebsite('');
    setAdditionalInfo('');
    setIsActive(true);
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (park: TaxiPark) => {
    setEditingPark(park);
    setName(park.name);
    setSlug(park.slug);
    setLogoUrl(park.logo_url || '');
    setShortDesc(park.short_description || '');
    setFullDesc(park.full_description || '');
    setPhone(park.phone || '');
    setAdditionalPhones(park.additional_phones || '');
    setAddress(park.address || '');
    setWorkingHours(park.working_hours || '');
    setWebsite(park.website || '');
    setAdditionalInfo(park.additional_info || '');
    setIsActive(park.is_active);
    setFormError(null);
    setIsModalOpen(true);
  };

  const generateSlug = (val: string) => {
    return val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9а-яё\s-]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!editingPark) {
      setSlug(generateSlug(val));
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadTaxiParkLogo(file);
      setLogoUrl(res.url);
    } catch (err: any) {
      alert('Ошибка загрузки логотипа: ' + (err.message || 'Ошибка'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !slug.trim()) {
      setFormError('Название и Slug обязательны.');
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        logo_url: logoUrl || null,
        short_description: shortDesc.trim() || null,
        full_description: fullDesc.trim() || null,
        phone: phone.trim() || null,
        additional_phones: additionalPhones.trim() || null,
        address: address.trim() || null,
        working_hours: workingHours.trim() || null,
        website: website.trim() || null,
        additional_info: additionalInfo.trim() || null,
        is_active: isActive,
      };

      if (editingPark) {
        await updateTaxiPark(editingPark.id, payload);
      } else {
        await createTaxiPark(payload);
      }

      setIsModalOpen(false);
      resetForm();
      await loadParks();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка при сохранении таксопарка.');
    }
  };

  const handleToggleActive = async (park: TaxiPark) => {
    try {
      await updateTaxiPark(park.id, { is_active: !park.is_active });
      setTaxiParks(prev => prev.map(p => p.id === park.id ? { ...p, is_active: !p.is_active } : p));
    } catch (err: any) {
      alert('Ошибка изменения активности: ' + err.message);
    }
  };

  const handleDelete = async (park: TaxiPark) => {
    if (!window.confirm(`Вы уверены, что хотите удалить таксопарк "${park.name}"?`)) return;
    try {
      await deleteTaxiPark(park.id);
      setTaxiParks(prev => prev.filter(p => p.id !== park.id));
    } catch (err: any) {
      alert('Ошибка при удалении: ' + err.message);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= taxiParks.length) return;

    const updated = [...taxiParks];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    const reordered = updated.map((p, idx) => ({ ...p, position: idx + 1 }));
    setTaxiParks(reordered);

    try {
      await reorderTaxiParks(reordered.map(p => ({ id: p.id, position: p.position })));
    } catch (err) {
      console.error('Failed to save reordered position:', err);
    }
  };

  const filteredParks = React.useMemo(() => {
    if (!searchQuery.trim()) return taxiParks;
    const q = searchQuery.toLowerCase();
    return taxiParks.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      (p.short_description || '').toLowerCase().includes(q)
    );
  }, [taxiParks, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-foreground">Управление Таксопарками</h3>
            <p className="text-xs text-muted-foreground">Всего таксопарков: {taxiParks.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск таксопарков..."
              className="w-full pl-8 pr-3 py-1.5 bg-muted text-xs border border-border rounded-lg text-foreground outline-none"
            />
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Добавить парк
          </button>
        </div>
      </div>

      {/* Parks Table */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">Загрузка таксопарков...</div>
      ) : filteredParks.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground border border-border rounded-2xl bg-card">
          Таксопарки не найдены
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3 w-12 text-center">Порядок</th>
                  <th className="p-3">Таксопарк</th>
                  <th className="p-3">Slug</th>
                  <th className="p-3">Телефон</th>
                  <th className="p-3">Адрес</th>
                  <th className="p-3 text-center">Статус</th>
                  <th className="p-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredParks.map((park, idx) => (
                  <tr key={park.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, 'up')}
                          className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          disabled={idx === filteredParks.length - 1}
                          onClick={() => handleMove(idx, 'down')}
                          className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {park.logo_url ? (
                          <img
                            src={getApiAssetUrl(park.logo_url)}
                            alt={park.name}
                            className="w-8 h-8 rounded-lg object-cover border border-border bg-muted shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0">
                            {park.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <a
                            href={`/taxi-parks/${park.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-foreground hover:text-indigo-500 transition-colors"
                          >
                            {park.name}
                          </a>
                          {park.short_description && (
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{park.short_description}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-3 font-mono text-[10px] text-muted-foreground">{park.slug}</td>
                    <td className="p-3 text-muted-foreground">{park.phone || '—'}</td>
                    <td className="p-3 text-muted-foreground max-w-xs truncate">{park.address || '—'}</td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleActive(park)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                          park.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                        }`}
                      >
                        {park.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {park.is_active ? 'Активен' : 'Скрыт'}
                      </button>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(park)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-indigo-500 cursor-pointer"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(park)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 cursor-pointer"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 space-y-5 my-8 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                {editingPark ? 'Редактировать таксопарк' : 'Добавить новый таксопарк'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-foreground mb-1">Название *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={handleNameChange}
                    placeholder="Например: iTaxi"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Slug (URL) *</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="itaxi"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none font-mono"
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block font-bold text-foreground mb-1">Логотип</label>
                <div className="flex items-center gap-3">
                  {logoUrl && (
                    <img
                      src={getApiAssetUrl(logoUrl)}
                      alt="Logo preview"
                      className="w-12 h-12 rounded-xl object-cover border border-border bg-muted shrink-0"
                    />
                  )}
                  <label className="px-3 py-2 bg-muted hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-border rounded-xl text-xs font-semibold text-foreground cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {isUploading ? 'Загрузка...' : 'Загрузить файл'}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="text-red-500 text-xs hover:underline"
                    >
                      Удалить лого
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Краткое описание</label>
                <input
                  type="text"
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                  placeholder="Краткое описание для карточки..."
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Полное описание</label>
                <textarea
                  rows={3}
                  value={fullDesc}
                  onChange={(e) => setFullDesc(e.target.value)}
                  placeholder="Подробная информация о парке..."
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-foreground mb-1">Основной телефон</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (700) 000-00-00"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Режим работы</label>
                  <input
                    type="text"
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                    placeholder="Пн-Пт 09:00 - 18:00"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-foreground mb-1">Дополнительные телефоны</label>
                  <textarea
                    rows={2}
                    value={additionalPhones}
                    onChange={(e) => setAdditionalPhones(e.target.value)}
                    placeholder="Каждый телефон с новой строки..."
                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Адрес</label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Город, улица, дом..."
                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Веб-сайт / ссылка</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.kz"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Дополнительная информация</label>
                <textarea
                  rows={2}
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Условия подключения, комиссия и т.д."
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-foreground outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active_checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                />
                <label htmlFor="is_active_checkbox" className="font-bold text-foreground cursor-pointer">
                  Таксопарк активен (отображается пользователям)
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
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
