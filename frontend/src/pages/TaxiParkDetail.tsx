import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Building2, Phone, MapPin, Clock, Globe, Info, ArrowLeft, 
  Gift, Calendar, ExternalLink, ChevronRight, ShieldCheck 
} from 'lucide-react';
import { 
  fetchTaxiParkBySlug, fetchPromotions, getApiAssetUrl, 
  TaxiPark, Promotion 
} from '../lib/api';

export default function TaxiParkDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [park, setPark] = React.useState<TaxiPark | null>(null);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!slug) return;
    const loadParkData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const parkData = await fetchTaxiParkBySlug(slug);
        setPark(parkData);

        // Fetch active promotions linked to this taxi park
        const promoData = await fetchPromotions(parkData.id, true);
        setPromotions(promoData);
      } catch (err: any) {
        console.error('Failed to load taxi park:', err);
        setError(err.message || 'Таксопарк не найден');
      } finally {
        setIsLoading(false);
      }
    };

    loadParkData();
  }, [slug]);

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-card rounded-lg" />
        <div className="h-48 bg-card rounded-2xl border border-border" />
        <div className="h-32 bg-card rounded-2xl border border-border" />
      </div>
    );
  }

  if (error || !park) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <Building2 className="w-16 h-16 mx-auto text-neutral-300 dark:text-neutral-700" />
        <h2 className="text-xl font-bold text-foreground">Таксопарк не найден</h2>
        <p className="text-sm text-muted-foreground">{error || 'Запрошенный таксопарк не существует или был убран.'}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Back Button */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> На главную
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-2xl space-y-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {park.logo_url ? (
            <img
              src={getApiAssetUrl(park.logo_url)}
              alt={park.name}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-border bg-muted shrink-0 shadow-md"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-2xl shrink-0 shadow-md">
              {park.name.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                Официальный таксопарк
              </span>
            </div>
            <h1 className="font-outfit text-2xl sm:text-3xl font-extrabold text-foreground truncate">
              {park.name}
            </h1>
            {park.short_description && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-light">
                {park.short_description}
              </p>
            )}
          </div>
        </div>

        {/* Contact & Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
          {park.phone && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
              <Phone className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Телефон</div>
                <a href={`tel:${park.phone}`} className="text-xs font-bold text-foreground hover:text-indigo-500 transition-colors">
                  {park.phone}
                </a>
              </div>
            </div>
          )}

          {park.additional_phones && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
              <Phone className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Доп. телефоны</div>
                <div className="text-xs font-medium text-foreground whitespace-pre-line">
                  {park.additional_phones}
                </div>
              </div>
            </div>
          )}

          {park.address && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
              <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Адрес</div>
                <div className="text-xs font-medium text-foreground leading-snug">
                  {park.address}
                </div>
              </div>
            </div>
          )}

          {park.working_hours && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
              <Clock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Режим работы</div>
                <div className="text-xs font-medium text-foreground">
                  {park.working_hours}
                </div>
              </div>
            </div>
          )}

          {park.website && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/60 sm:col-span-2">
              <Globe className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Веб-сайт</div>
                <a
                  href={park.website.startsWith('http') ? park.website : `https://${park.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  {park.website} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Description & Additional Info */}
      {(park.full_description || park.additional_info) && (
        <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
          {park.full_description && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">О таксопарке</h3>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-light">
                {park.full_description}
              </div>
            </div>
          )}

          {park.additional_info && (
            <div className="pt-4 border-t border-border space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-500" /> Дополнительная информация
              </h3>
              <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {park.additional_info}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Promotions Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-amber-500" />
          <h2 className="font-outfit text-xl font-extrabold text-foreground">
            Актуальные акции
          </h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {promotions.length}
          </span>
        </div>

        {promotions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-border bg-card text-muted-foreground space-y-2">
            <Gift className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-700" />
            <p className="text-xs font-medium">Для этого таксопарка пока нет активных акций</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="group p-5 rounded-2xl border border-border bg-card hover:border-amber-500/30 hover:shadow-xl transition-all flex flex-col justify-between space-y-4"
              >
                {promo.image_url && (
                  <img
                    src={getApiAssetUrl(promo.image_url)}
                    alt={promo.title}
                    className="w-full h-40 object-cover rounded-xl border border-border bg-muted"
                  />
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    <Calendar className="w-3 h-3" />
                    {promo.start_date || promo.end_date ? (
                      <span>
                        Срок действия: {formatDate(promo.start_date)} — {formatDate(promo.end_date) || 'бессрочно'}
                      </span>
                    ) : (
                      <span>Бессрочная акция</span>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-foreground group-hover:text-amber-500 transition-colors">
                    {promo.title}
                  </h3>

                  {promo.short_description && (
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed font-light">
                      {promo.short_description}
                    </p>
                  )}
                </div>

                {promo.external_link ? (
                  <a
                    href={promo.external_link.startsWith('http') ? promo.external_link : `https://${promo.external_link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold text-center transition-all inline-flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {promo.button_text || 'Подробнее'} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : promo.full_description ? (
                  <details className="text-xs text-muted-foreground group-open:text-foreground">
                    <summary className="cursor-pointer py-1 text-amber-600 dark:text-amber-400 font-bold hover:underline">
                      {promo.button_text || 'Подробнее'} →
                    </summary>
                    <div className="pt-2 text-xs text-foreground leading-relaxed whitespace-pre-wrap border-t border-border mt-2">
                      {promo.full_description}
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
