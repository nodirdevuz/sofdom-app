import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Offer, FilterState, LayoutMode } from './types';
import { OFFERS, VIPS } from './data/offers';
import { Header } from './components/Header';
import { Lang } from './lib/i18n';
import { TabsAndChips } from './components/TabsAndChips';
import { VipSection } from './components/VipSection';
import { Toolbar } from './components/Toolbar';
import { ListingCard } from './components/ListingCard';
import { DetailPage } from './components/DetailPage';
import { LightboxModal } from './components/LightboxModal';
import { ProfileModal } from './components/ProfileModal';
import { FiltersModal } from './components/FiltersModal';
import { FiltersPage } from './components/FiltersPage';
import { MobileBottomNav } from './components/MobileBottomNav';
import { YandexMap } from './components/YandexMap';
import { useSwipeBack } from './hooks/useSwipeBack';
import { telemetry } from './lib/telemetry';

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return 'Недавно';
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return 'Недавно';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${Math.max(diffMins, 10)} мин назад`;
    }
    if (diffHours < 12 && d.getDate() === now.getDate()) {
      return `${diffHours} ч назад`;
    }
    if (d.getDate() === now.getDate()) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `Сегодня в ${hh}:${mm}`;
    }
    if (diffDays === 1 || d.getDate() === now.getDate() - 1) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `Вчера в ${hh}:${mm}`;
    }
    if (diffDays < 7) {
      return `${diffDays} дн. назад`;
    }
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  } catch (e) {
    return 'Недавно';
  }
}

export const App: React.FC = () => {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('sofdom_lang');
      if (saved === 'ru' || saved === 'uz' || saved === 'en') return saved;
    } catch {}
    return 'ru';
  });

  const handleLangChange = (newLang: Lang) => {
    setLang(newLang);
    try {
      localStorage.setItem('sofdom_lang', newLang);
    } catch {}
  };

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [offersList, setOffersList] = useState<Offer[]>(OFFERS);
  const [filter, setFilter] = useState<FilterState>({
    dealType: 'all' as any,
    rooms: null,
    ownerOnly: false,
    noDeposit: false,
    sortBy: 'new'
  });
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('list');
  const [isMapVisible, setIsMapVisible] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'main' | 'map' | 'filters'>('main');
  const [visibleCount, setVisibleCount] = useState<number>(36);
  const [rentedOfferIds, setRentedOfferIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('sofdom_rented_offers_v1');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const toggleRentedStatus = (offerId: string) => {
    setRentedOfferIds((prev) => {
      const isAlready = prev.includes(offerId);
      const next = isAlready ? prev.filter((id) => id !== offerId) : [...prev, offerId];
      try {
        localStorage.setItem('sofdom_rented_offers_v1', JSON.stringify(next));
      } catch (e) {}
      telemetry.track(isAlready ? 'listing_view' : 'photo_swipe', 4, {
        offerId,
        action: isAlready ? 'restored_to_search' : 'marked_rented_unpublish'
      });
      return next;
    });
  };

  const resetFilter = () => {
    setFilter({
      dealType: 'all',
      rooms: null,
      selectedRooms: [],
      ownerOnly: false,
      noDeposit: false,
      sortBy: 'new',
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      districts: [],
      notFirstFloor: false,
      hasRenovation: false
    });
  };

  const [lightbox, setLightbox] = useState<{
    isOpen: boolean;
    photos: string[];
    currentIdx: number;
    offerId?: string;
    offerTitle?: string;
  }>({
    isOpen: false,
    photos: [],
    currentIdx: 0,
    offerId: '',
    offerTitle: ''
  });

  // Fetch live Tomsk apartments from backend API
  useEffect(() => {
    fetch('/api/apartments?city=Томск&limit=500')
      .then((res) => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data) => {
        if (data && data.apartments && data.apartments.length > 0) {
          const mapped: Offer[] = data.apartments.map((a: any, i: number) => {
            const photos = a.photos && a.photos.length > 0 ? a.photos : [
              'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80'
            ];
            const pPhone = a.phone || a.phone_display || `+7 (952) 880-${1000 + i}`;
            return {
              id: a.id,
              title: a.title,
              raw_title: a.title,
              price_display: `${a.price.toLocaleString('ru-RU')} ₽`,
              price_unit: '/ месяц',
              price_val: a.price,
              deal_type: 'Длительная аренда',
              rooms: a.rooms || '1-комн',
              area: a.area || 36,
              living_area: Math.round((a.area || 36) * 0.6),
              kitchen_area: 10,
              floor: a.floor || 3,
              total_floors: a.total_floors || 9,
              floor_str: `${a.floor || 3}/${a.total_floors || 9} эт.`,
              renovation: 'Евроремонт',
              deposit: a.deposit > 0 ? `Залог ${a.deposit.toLocaleString('ru-RU')} ₽` : 'Без залога',
              address: a.address || 'Томск',
              metro_name: a.district || 'Советский район',
              metro_walk: '5 мин',
              desc_short: a.description ? (a.description.slice(0, 140) + '...') : 'Квартира в аренду от собственника',
              full_desc: a.description || 'Сдается напрямую от собственника. Вся мебель и техника в наличии.',
              photos: photos,
              photos_count: photos.length,
              owner_name: a.owner_name || 'Собственник',
              phone: pPhone,
              is_owner: true,
              is_new: true,
              is_top: a.is_secret_early_access === 1,
              time_ago: formatTimeAgo(a.created_at),
              lat: a.lat || 56.4977,
              lng: a.lng || 84.9744
            };
          });
          setOffersList(mapped);
        }
      })
      .catch((err) => {
        console.info('Backend API fetch fallback, using cached Tomsk dataset:', err);
      });
  }, []);

  // Sync theme attribute with DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Handle URL hash navigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#offer-')) {
        const id = hash.replace('#offer-', '');
        setSelectedOfferId(id);
      } else if (hash === '#map') {
        setMobileTab('map');
        setIsMapVisible(true);
        setSelectedOfferId(null);
      } else {
        setSelectedOfferId(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('popstate', handleHash);
    };
  }, []);

  // Native iOS Left-to-Right Swipe to Go Back
  useSwipeBack({
    onBack: () => {
      if (lightbox.isOpen) {
        closeLightbox();
      } else if (isFiltersOpen) {
        setIsFiltersOpen(false);
      } else if (isProfileOpen) {
        setIsProfileOpen(false);
      } else if (selectedOfferId) {
        backToFeed();
      } else if (mobileTab === 'map') {
        setMobileTab('main');
      }
    },
    enabled: !!(lightbox.isOpen || isFiltersOpen || isProfileOpen || selectedOfferId || mobileTab === 'map'),
  });

  const selectedOffer = useMemo(() => {
    if (!selectedOfferId) return null;
    const found = offersList.find((o) => o.id === selectedOfferId);
    if (found) return found;

    return {
      id: selectedOfferId,
      title: 'Квартира в аренду от собственника',
      price_display: '22 000 ₽',
      price_unit: '/ месяц',
      price_val: 22000,
      deal_type: 'Длительная аренда',
      rooms: '1-комн',
      area: 36,
      floor_str: '3/9 эт.',
      renovation: 'Евроремонт',
      deposit: 'Без залога',
      address: 'Томск, ул. Алтайская, 76/2',
      metro_name: 'Советский район',
      metro_walk: '5 мин',
      desc_short: 'Уютная квартира от собственника без комиссий.',
      full_desc: 'Сдается напрямую от собственника. Вся необходимая мебель и техника в наличии. Чистый подъезд, тихий двор.',
      photos: [
        'https://tsk.s.bsps.ru/images/sobipro/galleries/ec/196162/3dbeb0.jpg',
        'https://tsk.s.bsps.ru/images/sobipro/galleries/a8/196225/417ba2.jpg'
      ],
      photos_count: 2,
      owner_name: 'Собственник',
      phone: '+7 (952) 880-12-34',
      is_owner: true,
      time_ago: 'Только что',
      lat: 56.4852,
      lng: 84.9921
    } as Offer;
  }, [selectedOfferId]);

  // Filtered & sorted offers
  const filteredOffers = useMemo(() => {
    return offersList.filter((o) => {
      // Exclude rented or archived listings from search catalog
      if (rentedOfferIds.includes(o.id) || o.status === 'rented' || o.status === 'archived') {
        return false;
      }
      if (filter.dealType && (filter.dealType as string) !== 'all') {
        const isDaily = filter.dealType === 'Посуточная';
        const target = isDaily ? 'Посуточная' : 'Длительная аренда';
        if (o.deal_type !== target) return false;
      }
      if (filter.selectedRooms && filter.selectedRooms.length > 0) {
        const rStr = String(o.rooms).toLowerCase();
        const matchesAny = filter.selectedRooms.some((rCode) => {
          if (rCode === '0') return rStr.includes('студ') || rStr === '0';
          if (rCode === '1') return rStr.startsWith('1');
          if (rCode === '2') return rStr.startsWith('2');
          if (rCode === '3+') return rStr.startsWith('3') || rStr.startsWith('4') || rStr.startsWith('5');
          return false;
        });
        if (!matchesAny) return false;
      } else if (filter.rooms !== null) {
        const rStr = String(o.rooms).toLowerCase();
        if (filter.rooms === '0') {
          if (!rStr.includes('студ') && rStr !== '0') return false;
        } else if (filter.rooms === '1') {
          if (!rStr.startsWith('1')) return false;
        } else if (filter.rooms === '2') {
          if (!rStr.startsWith('2')) return false;
        } else if (filter.rooms === '3+') {
          if (!rStr.startsWith('3') && !rStr.startsWith('4') && !rStr.startsWith('5')) return false;
        }
      }
      if (filter.ownerOnly && !o.is_owner) return false;
      if (filter.noDeposit && !o.deposit.toLowerCase().includes('без залога')) return false;

      // Price range filters
      if (filter.minPrice && o.price_val < filter.minPrice) return false;
      if (filter.maxPrice && o.price_val > filter.maxPrice) return false;

      // Area range filters
      const numArea = typeof o.area === 'number' ? o.area : parseFloat(String(o.area));
      if (filter.minArea && numArea && numArea < filter.minArea) return false;
      if (filter.maxArea && numArea && numArea > filter.maxArea) return false;

      // District filters
      if (filter.districts && filter.districts.length > 0) {
        const matchesDistrict = filter.districts.some((d) => {
          const dClean = d.replace(' район', '').toLowerCase();
          return o.address.toLowerCase().includes(dClean) || o.title.toLowerCase().includes(dClean);
        });
        if (!matchesDistrict) return false;
      }

      // Feature toggles
      if (filter.notFirstFloor) {
        const floorNum = typeof o.floor === 'number' ? o.floor : parseInt(String(o.floor_str).split('/')[0], 10);
        if (floorNum === 1) return false;
      }
      if (filter.hasRenovation) {
        const reno = (o.renovation || '').toLowerCase();
        if (!reno.includes('евро') && !reno.includes('дизайн') && !reno.includes('капитальн')) return false;
      }

      return true;
    }).sort((a, b) => {
      if (filter.sortBy === 'price_asc') return a.price_val - b.price_val;
      if (filter.sortBy === 'price_desc') return b.price_val - a.price_val;
      return 0;
    });
  }, [filter, offersList]);

  // Similar offers for Detail Page (closest to current apartment parameters & price)
  const similarOffers = useMemo(() => {
    if (!selectedOffer) return [];
    return offersList
      .filter((o) => o.id !== selectedOffer.id)
      .sort((a, b) => {
        const aSameRooms = a.rooms === selectedOffer.rooms ? 1 : 0;
        const bSameRooms = b.rooms === selectedOffer.rooms ? 1 : 0;
        if (aSameRooms !== bSameRooms) return bSameRooms - aSameRooms;
        const aDiff = Math.abs(a.price_val - selectedOffer.price_val);
        const bDiff = Math.abs(b.price_val - selectedOffer.price_val);
        return aDiff - bDiff;
      })
      .slice(0, 6);
  }, [selectedOffer, offersList]);

  // Infinite Scroll Observer: auto-loads next batch when scrolling near bottom
  const observerTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => (prev < filteredOffers.length ? prev + 36 : prev));
        }
      },
      { rootMargin: '500px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredOffers.length]);

  useEffect(() => {
    if (offersList.length > 0 && filteredOffers.length === 0) {
      telemetry.trackFriction('zero_search_results', 'FilterFeed', { filter });
    }
  }, [filteredOffers.length]);

  const savedFeedScrollY = useRef(0);

  const openDetail = (id: string) => {
    savedFeedScrollY.current = window.scrollY;
    setSelectedOfferId(id);
    window.location.hash = 'offer-' + id;
  };

  const backToFeed = () => {
    setSelectedOfferId(null);
    if (window.location.hash) {
      history.replaceState('', document.title, window.location.pathname + window.location.search);
    }
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedFeedScrollY.current, behavior: 'instant' });
    });
  };

  const openLightbox = (startIdx: number, photos?: string[], offerId?: string, offerTitle?: string) => {
    const list = photos || (selectedOffer ? selectedOffer.photos : []);
    const id = offerId || (selectedOffer ? selectedOffer.id : 'SD-1001');
    const title = offerTitle || (selectedOffer ? selectedOffer.title : 'Квартира в аренду');
    setLightbox({
      isOpen: true,
      photos: list,
      currentIdx: startIdx,
      offerId: id,
      offerTitle: title
    });
  };

  const closeLightbox = () => {
    setLightbox((prev) => ({ ...prev, isOpen: false }));
  };

  const handleMobileNav = (tab: 'main' | 'map' | 'filters') => {
    setMobileTab(tab);
    if (tab === 'main') {
      backToFeed();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'map') {
      setSelectedOfferId(null);
    } else if (tab === 'filters') {
      setSelectedOfferId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <Header
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onOpenProfile={() => setIsProfileOpen(true)}
        onBackToFeed={backToFeed}
        lang={lang}
        onChangeLang={handleLangChange}
      />

      {/* MOBILE FULLSCREEN MAP VIEW (Preserved in DOM to prevent reload/re-initialization flashes) */}
      <div
        className="mobile-fullscreen-map-page"
        style={{
          display: mobileTab === 'map' && !selectedOfferId ? 'block' : 'none',
          visibility: mobileTab === 'map' && !selectedOfferId ? 'visible' : 'hidden',
          pointerEvents: mobileTab === 'map' && !selectedOfferId ? 'auto' : 'none'
        }}
      >
        <YandexMap
          onSelectApartment={openDetail}
          showDistrictChips={true}
          onClose={() => setMobileTab('main')}
          lang={lang}
          isActive={mobileTab === 'map' && !selectedOfferId}
        />
      </div>

      {/* DETAIL PAGE VIEW */}
      {selectedOffer && (
        <DetailPage
          offer={selectedOffer}
          isRented={rentedOfferIds.includes(selectedOffer.id) || selectedOffer.status === 'rented'}
          onToggleRented={toggleRentedStatus}
          onBackToFeed={backToFeed}
          onOpenLightbox={(idx) => openLightbox(idx, selectedOffer.photos)}
          similarOffers={similarOffers}
          onSelectOffer={openDetail}
        />
      )}

      {/* FULL-PAGE FILTERS VIEW (Mobile tab: filters) */}
      {mobileTab === 'filters' && !selectedOfferId && (
        <FiltersPage
          filter={filter}
          onChangeFilter={(newFilter) => setFilter((prev) => ({ ...prev, ...newFilter }))}
          totalResultsCount={filteredOffers.length}
          onReset={resetFilter}
          onApply={() => {
            setMobileTab('main');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          lang={lang}
        />
      )}

      {/* FEED VIEW (Always preserved to prevent white flashes and preserve scroll position) */}
      <div id="feedView" style={{ display: selectedOffer || (mobileTab !== 'main' && !selectedOfferId) ? 'none' : 'block' }}>
          <TabsAndChips
            filter={filter}
            onChangeFilter={(newFilter) => setFilter((prev) => ({ ...prev, ...newFilter }))}
            lang={lang}
          />

          <VipSection vips={VIPS} onSelectVip={openDetail} />

          <main className="main-section">
            <Toolbar
              count={filteredOffers.length}
              layoutMode={layoutMode}
              onSetLayoutMode={setLayoutMode}
              sortBy={filter.sortBy}
              onSetSortBy={(sortBy) => setFilter((prev) => ({ ...prev, sortBy }))}
              isMapVisible={isMapVisible}
              onToggleMap={() => setIsMapVisible(!isMapVisible)}
            />

            <div className={`content-layout ${isMapVisible ? 'with-map' : ''}`}>
              <div className={`cards-container ${layoutMode === 'list' ? 'mode-list' : 'mode-grid'}`}>
                {filteredOffers.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Ничего не найдено</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Попробуйте выбрать другой тип аренды или сбросить фильтры</p>
                  </div>
                ) : (
                  <>
                    {filteredOffers.slice(0, visibleCount).map((offer) => (
                      <ListingCard
                        key={offer.id}
                        offer={offer}
                        layoutMode={layoutMode}
                        onOpenDetail={openDetail}
                      />
                    ))}
                    {/* Infinite Scroll Sentinel */}
                    <div
                      ref={observerTargetRef}
                      className="infinite-scroll-sentinel"
                      style={{ gridColumn: '1 / -1', height: '24px', margin: '4px 0' }}
                    />

                    {visibleCount < filteredOffers.length && (
                      <div className="load-more-wrap" style={{ gridColumn: '1 / -1', textAlign: 'center', margin: '14px 0 28px' }}>
                        <button
                          className="joymee-btn-view-profile clickable"
                          onClick={() => setVisibleCount((prev) => prev + 36)}
                          style={{ padding: '12px 32px', fontSize: '13px', fontWeight: 700, borderRadius: '24px', margin: '0 auto', display: 'inline-block' }}
                        >
                          Показать ещё (осталось {filteredOffers.length - visibleCount})
                        </button>
                      </div>
                    )}
                    {visibleCount >= filteredOffers.length && filteredOffers.length > 0 && (
                      <div className="feed-end-message" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '16px 0 32px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                        ✓ Вы посмотрели все предложения
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* DESKTOP SIDEBAR MAP */}
              <div className="map-sidebar-container" style={{ display: isMapVisible ? 'block' : 'none' }}>
                {isMapVisible && (
                  <YandexMap
                    onSelectApartment={openDetail}
                    showDistrictChips={true}
                    onClose={() => setIsMapVisible(false)}
                    lang={lang}
                  />
                )}
              </div>
            </div>
          </main>
        </div>

      {/* FULLSCREEN LIGHTBOX */}
      <LightboxModal
        isOpen={lightbox.isOpen}
        photos={lightbox.photos}
        currentIdx={lightbox.currentIdx}
        offerId={lightbox.offerId}
        offerTitle={lightbox.offerTitle}
        onClose={closeLightbox}
        onSelectIdx={(idx) => setLightbox((prev) => ({ ...prev, currentIdx: idx }))}
        onPrev={() =>
          setLightbox((prev) => ({
            ...prev,
            currentIdx: (prev.currentIdx - 1 + prev.photos.length) % prev.photos.length
          }))
        }
        onNext={() =>
          setLightbox((prev) => ({
            ...prev,
            currentIdx: (prev.currentIdx + 1) % prev.photos.length
          }))
        }
      />

      {/* PROFILE BOTTOM SHEET */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onOpenAdmin={() => window.open('./admin/', '_blank')}
      />

      {/* FILTERS MODAL */}
      <FiltersModal
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filter={filter}
        onChangeFilter={(newFilter) => setFilter((prev) => ({ ...prev, ...newFilter }))}
        totalResultsCount={filteredOffers.length}
        onReset={resetFilter}
        lang={lang}
      />

      {/* MOBILE BOTTOM NAVIGATION (Hidden on DetailPage so Avito Sticky Dock takes over seamlessly) */}
      {!selectedOffer && (
        <MobileBottomNav
          activeTab={mobileTab}
          onSelectTab={handleMobileNav}
          onOpenProfile={() => setIsProfileOpen(true)}
          lang={lang}
        />
      )}
    </>
  );
};

export default App;
