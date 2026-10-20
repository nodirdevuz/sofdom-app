import json, os

json_path = '/Users/macbookairm5/Desktop/Проекты/Снайпер/realty/cian_owners_sample.json'
with open(json_path, 'r', encoding='utf-8') as f:
    offers = json.load(f)

html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Joymee Sniper — Аренда без риелторов (0% комиссии)</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', -apple-system, sans-serif; }}
    body {{ background-color: #f8fafc; color: #0f172a; }}
    
    header {{ background: #ffffff; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; z-index: 1000; padding: 12px 24px; }}
    .header-inner {{ max-width: 1440px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; }}
    .logo {{ display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 22px; color: #0f172a; text-decoration: none; }}
    .logo-badge {{ background: #facc15; color: #000; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; }}
    .search-box {{ flex: 1; max-width: 550px; position: relative; }}
    .search-input {{ width: 100%; padding: 11px 16px 11px 42px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; outline: none; background: #f8fafc; }}
    .search-icon {{ position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; }}
    .header-actions {{ display: flex; align-items: center; gap: 14px; }}
    .btn-tariffs {{ background: #facc15; color: #111; font-weight: 700; padding: 10px 18px; border-radius: 10px; border: none; cursor: pointer; font-size: 14px; transition: 0.2s; }}
    .btn-tariffs:hover {{ background: #eab308; }}

    .filter-bar {{ background: #fff; border-bottom: 1px solid #e2e8f0; padding: 10px 24px; }}
    .filter-inner {{ max-width: 1440px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }}
    .tabs-group {{ display: flex; background: #f1f5f9; padding: 4px; border-radius: 10px; }}
    .tab-btn {{ padding: 6px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; background: transparent; color: #475569; }}
    .tab-btn.active {{ background: #facc15; color: #111; }}
    .chips-group {{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }}
    .chip {{ padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; }}
    .chip.active-owner {{ background: #ecfdf5; border-color: #10b981; color: #047857; }}
    
    .main-container {{ max-width: 1440px; margin: 20px auto; padding: 0 24px; display: grid; grid-template-columns: 1fr 480px; gap: 24px; }}
    @media (max-width: 1100px) {{ .main-container {{ grid-template-columns: 1fr; }} }}

    .feed-header {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }}
    .feed-title {{ font-size: 22px; font-weight: 800; }}
    .feed-count {{ color: #64748b; font-size: 14px; font-weight: 500; margin-top: 4px; }}
    .cards-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }}

    .offer-card {{ background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; transition: all 0.2s; display: flex; flex-direction: column; cursor: pointer; }}
    .offer-card:hover {{ transform: translateY(-3px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); border-color: #cbd5e1; }}
    .offer-card.highlighted {{ border-color: #f59e0b; box-shadow: 0 0 0 3px #fef3c7; }}
    
    .card-photo-box {{ position: relative; height: 180px; background: #e2e8f0; }}
    .card-photo {{ width: 100%; height: 100%; object-fit: cover; }}
    .badge-owner {{ position: absolute; top: 10px; left: 10px; background: #10b981; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }}
    .badge-saving {{ position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.8); color: #facc15; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; }}
    
    .card-body {{ padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }}
    .card-price {{ font-size: 20px; font-weight: 800; color: #0f172a; }}
    .card-terms {{ font-size: 12px; color: #64748b; display: flex; gap: 10px; }}
    .fee-zero {{ color: #10b981; font-weight: 700; }}
    .card-title {{ font-size: 14px; font-weight: 600; line-height: 1.3; color: #1e293b; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }}
    .card-address {{ font-size: 12px; color: #64748b; line-height: 1.4; }}
    .card-footer {{ margin-top: auto; padding-top: 10px; border-top: 1px solid #f1f5f9; }}
    .btn-phone {{ background: #2563eb; color: #fff; border: none; padding: 9px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: 0.2s; width: 100%; }}
    .btn-phone:hover {{ background: #1d4ed8; }}

    .map-sidebar {{ position: sticky; top: 135px; height: calc(100vh - 160px); border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }}
    #map {{ width: 100%; height: 100%; }}

    .price-pin {{ background: #ffffff; border: 2px solid #0f172a; border-radius: 20px; padding: 3px 8px; font-size: 11px; font-weight: 800; color: #0f172a; white-space: nowrap; box-shadow: 0 3px 6px rgba(0,0,0,0.15); cursor: pointer; }}
    .price-pin:hover, .price-pin.active {{ background: #0f172a; color: #ffffff; transform: scale(1.1); }}

    .modal-overlay {{ position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: none; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }}
    .modal-overlay.active {{ display: flex; }}
    .modal-box {{ background: #ffffff; border-radius: 20px; max-width: 650px; width: 90%; padding: 28px; position: relative; }}
    .close-btn {{ position: absolute; right: 20px; top: 20px; font-size: 24px; border: none; background: transparent; cursor: pointer; color: #94a3b8; }}
    .tariffs-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 20px; }}
    .tariff-card {{ border: 2px solid #e2e8f0; border-radius: 14px; padding: 16px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; }}
    .tariff-card.featured {{ border-color: #facc15; background: #fefce8; }}
    .tariff-name {{ font-size: 14px; font-weight: 700; margin-bottom: 6px; }}
    .tariff-price {{ font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }}
    .tariff-period {{ font-size: 12px; color: #64748b; margin-bottom: 12px; }}
    .tariff-btn {{ background: #0f172a; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; width: 100%; }}
    .tariff-card.featured .tariff-btn {{ background: #facc15; color: #000; }}
  </style>
</head>
<body>

  <header>
    <div class="header-inner">
      <a href="#" class="logo">
        <span>Joymee Sniper</span>
        <span class="logo-badge">БЕЗ РИЕЛТОРОВ</span>
      </a>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" value="Москва (Только собственники)" placeholder="Поиск по адресу, метро...">
      </div>
      <div class="header-actions">
        <button class="btn-tariffs" onclick="openModal()">🔥 Доступ к прямым контактам</button>
      </div>
    </div>
  </header>

  <div class="filter-bar">
    <div class="filter-inner">
      <div class="tabs-group">
        <button class="tab-btn active">Аренда</button>
        <button class="tab-btn">Продажа</button>
        <button class="tab-btn">Посуточная</button>
      </div>
      <div class="chips-group">
        <div class="chip active-owner">✓ Собственник (0% комиссии)</div>
        <div class="chip">Квартира целиком</div>
        <div class="chip">До 80 000 ₽</div>
        <div class="chip">1-2 комнаты</div>
        <div class="chip">Свежие за 24ч</div>
      </div>
    </div>
  </div>

  <div class="main-container">
    <div class="feed-column">
      <div class="feed-header">
        <div>
          <h1 class="feed-title">Аренда напрямую от собственников</h1>
          <p class="feed-count">Найдено объявлений: {len(offers)} • Комиссия риелторам: 0 ₽</p>
        </div>
      </div>

      <div class="cards-grid" id="cards-container"></div>
    </div>

    <div class="map-sidebar">
      <div id="map"></div>
    </div>
  </div>

  <div class="modal-overlay" id="tariffs-modal" onclick="closeModal(event)">
    <div class="modal-box" onclick="event.stopPropagation()">
      <button class="close-btn" onclick="closeModal()">×</button>
      <h2 style="font-size: 22px; font-weight: 800; text-align: center;">Не платите агентствам 100% комиссии!</h2>
      <p style="font-size: 14px; color: #64748b; text-align: center; margin-top: 6px;">
        Арендатор обычной квартиры отдаёт риелтору от 40 000 до 80 000 ₽ просто за 10 минут показа.
        Откройте прямой телефон собственника без посредников.
      </p>

      <div class="tariffs-grid">
        <div class="tariff-card">
          <div>
            <div class="tariff-name">Тест-Драйв</div>
            <div class="tariff-price">490 ₽</div>
            <div class="tariff-period">на 3 дня</div>
            <p style="font-size: 12px; color: #475569; margin-bottom: 12px; text-align: left; line-height: 1.6;">
              ✓ Полные прямые номера<br>
              ✓ До 20 контактов в день<br>
              ✓ Защита от спама риелторов
            </p>
          </div>
          <button class="tariff-btn" onclick="alert('Выбран пакет: Тест-Драйв')">Подключить</button>
        </div>

        <div class="tariff-card featured">
          <div>
            <div style="background: #fef08a; color: #854d0e; font-size: 10px; font-weight: 800; border-radius: 4px; padding: 2px 6px; display: inline-block; margin-bottom: 6px;">ХИТ ПРОДАЖ</div>
            <div class="tariff-name">Снайпер 24/7</div>
            <div class="tariff-price">990 ₽</div>
            <div class="tariff-period">на 14 дней</div>
            <p style="font-size: 12px; color: #475569; margin-bottom: 12px; text-align: left; line-height: 1.6;">
              ✓ Безлимит номеров<br>
              ✓ ⚡ Мгновенные пуши в Telegram за 2 сек<br>
              ✓ Звонок раньше риелторов<br>
              ✓ Экономия от 40 000 ₽
            </p>
          </div>
          <button class="tariff-btn" onclick="alert('Выбран пакет: Снайпер 24/7')">Подключить</button>
        </div>

        <div class="tariff-card">
          <div>
            <div class="tariff-name">Семейный Pro</div>
            <div class="tariff-price">1 490 ₽</div>
            <div class="tariff-period">на 30 дней</div>
            <p style="font-size: 12px; color: #475569; margin-bottom: 12px; text-align: left; line-height: 1.6;">
              ✓ Безлимит на месяц<br>
              ✓ До 3 устройств в семье<br>
              ✓ Проверка Росреестра (ЕГРН)<br>
              ✓ Шаблон договора юриста
            </p>
          </div>
          <button class="tariff-btn" onclick="alert('Выбран пакет: Семейный Pro')">Подключить</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const offers = {json.dumps(offers, ensure_ascii=False)};

    const container = document.getElementById('cards-container');
    offers.forEach(o => {{
      const photoUrl = (o.photos && o.photos.length > 0) ? o.photos[0] : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80';
      const saving = o.price ? Number(o.price).toLocaleString('ru-RU') : '40 000';
      
      const card = document.createElement('div');
      card.className = 'offer-card';
      card.id = 'card-' + o.id;
      card.innerHTML = `
        <div class="card-photo-box">
          <img src="${{photoUrl}}" class="card-photo" loading="lazy" alt="Квартира">
          <span class="badge-owner">✓ Собственник</span>
          <span class="badge-saving">Экономия ${{saving}} ₽</span>
        </div>
        <div class="card-body">
          <div class="card-price">${{Number(o.price).toLocaleString('ru-RU')}} ₽ <span style="font-size: 13px; font-weight: 500; color: #64748b;">/ мес.</span></div>
          <div class="card-terms">
            <span class="fee-zero">Комиссия 0%</span>
            <span>Залог: ${{o.deposit ? Number(o.deposit).toLocaleString('ru-RU') + ' ₽' : 'Без залога'}}</span>
          </div>
          <div class="card-title">${{o.title}}</div>
          <div class="card-address">📍 ${{o.address || 'Москва'}}</div>
          <div class="card-footer">
            <button class="btn-phone" onclick="revealPhone(event, '${{o.id}}', '${{o.phone}}')">
              📞 Показать прямой номер
            </button>
          </div>
        </div>
      `;
      container.appendChild(card);
    }});

    const map = L.map('map').setView([55.751244, 37.618423], 11);
    L.tileLayer('https://{{s}}.basemaps.cartocdn.com/rastertiles/voyager/{{z}}/{{x}}/{{y}}{{r}}.png', {{
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }}).addTo(map);

    const markers = {{}};
    const bounds = [];

    offers.forEach(o => {{
      if (o.lat && o.lng) {{
        bounds.push([o.lat, o.lng]);
        const priceLabel = Math.round(o.price / 1000) + ' тыс.';
        
        const customIcon = L.divIcon({{
          className: 'price-pin-wrapper',
          html: `<div class="price-pin" id="pin-${{o.id}}">${{priceLabel}}</div>`,
          iconSize: [60, 24],
          iconAnchor: [30, 12]
        }});

        const marker = L.marker([o.lat, o.lng], {{ icon: customIcon }}).addTo(map);
        markers[o.id] = marker;

        marker.on('click', () => {{
          highlightCard(o.id);
        }});
      }}
    }});

    if (bounds.length > 0) {{
      map.fitBounds(bounds, {{ padding: [30, 30] }});
    }}

    function highlightCard(id) {{
      document.querySelectorAll('.offer-card').forEach(c => c.classList.remove('highlighted'));
      document.querySelectorAll('.price-pin').forEach(p => p.classList.remove('active'));

      const card = document.getElementById('card-' + id);
      const pin = document.getElementById('pin-' + id);

      if (card) {{
        card.classList.add('highlighted');
        card.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
      }}
      if (pin) pin.classList.add('active');
    }}

    function revealPhone(event, id, rawPhone) {{
      event.stopPropagation();
      openModal();
    }}

    function openModal() {{
      document.getElementById('tariffs-modal').classList.add('active');
    }}

    function closeModal() {{
      document.getElementById('tariffs-modal').classList.remove('active');
    }}
  </script>
</body>
</html>
"""

out_file = '/Users/macbookairm5/Desktop/Проекты/Снайпер/realty/realty_aggregator_demo.html'
with open(out_file, 'w', encoding='utf-8') as f:
    f.write(html)

print('Successfully created', out_file)
