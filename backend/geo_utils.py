"""
geo_utils.py
Географические утилиты, правила районирования и валидация координат для SofDom (Томск).

Приоритет: точность и происхождение геолокации.
Исключает назначение фиктивных координат центра, синтетический jitter на hash(id),
и ошибочное присвоение районов Томска объектам за пределами города (например, Колпашево).
"""

import math
import re
from typing import Optional, Tuple


# --- Документированные географические границы ---

# Диагностический конверт (bounding envelope) Томска и прилегающей агломерации
# (включая Северск, Зональную Станцию, Кисловку, Тимирязевское, Богашёво, Левобережный).
# Источник и назначение:
#   Используется исключительно как первичный диагностический фильтр согласованности,
#   чтобы отличать объекты Томской агломерации (радиус ~20-25 км от центра)
#   от удалённых населённых пунктов Томской области (Колпашево ~300 км, Асино ~100 км,
#   Стрежевой ~900 км, Белый Яр ~300 км и др.).
# Пограничные случаи:
#   Не является официальным муниципальным полигоном границы города.
#   Объекты вне конверта не считаются находящимися в черте Томска,
#   но могут иметь точные координаты в своём населённом пункте.
TOMSK_AGGLOMERATION_ENVELOPE = {
    "min_lat": 56.30,
    "max_lat": 56.70,
    "min_lng": 84.60,
    "max_lng": 85.40,
}

# Фиктивная точка центра Томска, ранее назначавшаяся сборщиком всем объявлениям
TOMSK_CENTER_PLACEHOLDER_LAT = 56.4977
TOMSK_CENTER_PLACEHOLDER_LNG = 84.9744

# Населённые пункты Томской области вне Томска (встречаются в выборках региона 4620 Циан)
KNOWN_NON_TOMSK_SETTLEMENTS = {
    "колпашев": "Колпашево",
    "тогур": "Тогур",
    "северск": "Северск",
    "асин": "Асино",
    "стрежев": "Стрежевой",
    "белый яр": "Белый Яр",
    "мельников": "Мельниково",
    "кожевников": "Кожевниково",
    "кривошеин": "Кривошеино",
    "молчанов": "Молчаново",
    "парабел": "Парабель",
    "каргасок": "Каргасок",
    "александровск": "Александровское",
    "тегульдет": "Тегульдет",
    "бакчар": "Бакчар",
    "подгорн": "Подгорное",
    "самусь": "Самусь",
}

# Официальные внутригородские районы Томска
TOMSK_CITY_DISTRICTS = {
    "Кировский район",
    "Советский район",
    "Ленинский район",
    "Октябрьский район",
}

# Правила сопоставления адреса с районами Томска и центроиды районов
TOMSK_DISTRICT_RULES = [
    ("Кировский район", 56.460, 84.970, [
        "усов", "киров", "красноармейск", "мокрушин", "елизаров", "нахимов", "котовск",
        "учебн", "вершинин", "дзержинск", "студенческ", "южн", "буревестник", "тимаков",
        "тгу", "тпу", "сибгму", "лагерный", "южная", "кировский"
    ]),
    ("Советский район", 56.478, 84.985, [
        "фрунзе", "комсомольск", "сибирск", "алтайск", "нечевск", "никитин", "шевченко",
        "герцен", "кулагин", "тверск", "гогол", "крылов", "чкалов", "советский"
    ]),
    ("Ленинский район", 56.515, 84.960, [
        "мир", "79 гвардейск", "каштак", "войков", "говоров", "смирнов", "березов",
        "пролетарск", "большая подгорн", "черемошник", "интернационалист", "карла маркс",
        "5-й арми", "ленинский"
    ]),
    ("Октябрьский район", 56.508, 85.030, [
        "иркутск", "лазо", "герасименко", "солнечн", "зеленые горк", "зелёные горк",
        "беринг", "клюев", "архитектор", "пушкин", "мичурин", "энтузиаст", "бауман",
        "черноморск", "октябрьский"
    ]),
    ("Пригород", 56.425, 85.015, [
        "зональн", "южные ворот", "кисловк", "левобережн", "тимирязев", "северск"
    ])
]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Вычисляет расстояние между двумя географическими координатами в километрах."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return round(2 * R * math.asin(math.sqrt(a)), 2)


def is_center_placeholder(lat: Optional[float], lng: Optional[float]) -> bool:
    """Проверяет, являются ли координаты синтетической заглушкой центра Томска."""
    if lat is None or lng is None:
        return False
    try:
        return (abs(float(lat) - TOMSK_CENTER_PLACEHOLDER_LAT) < 0.001 and
                abs(float(lng) - TOMSK_CENTER_PLACEHOLDER_LNG) < 0.001)
    except (ValueError, TypeError):
        return False


def is_in_tomsk_envelope(lat: Optional[float], lng: Optional[float]) -> bool:
    """Проверяет, попадают ли координаты в широкий диагностический конверт агломерации Томска."""
    if lat is None or lng is None:
        return False
    try:
        f_lat = float(lat)
        f_lng = float(lng)
        env = TOMSK_AGGLOMERATION_ENVELOPE
        return (env["min_lat"] <= f_lat <= env["max_lat"] and
                env["min_lng"] <= f_lng <= env["max_lng"])
    except (ValueError, TypeError):
        return False


def detect_city(
    address: Optional[str],
    raw_city: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None
) -> str:
    """
    Определяет реальный населённый пункт объявления по адресу, сырому городу и координатам.
    Предотвращает запись 'Томск' для объектов из других городов области (Колпашево, Северск и т.д.).
    """
    addr_clean = (address or "").lower()

    # 1. Проверка по ключевым словам других населённых пунктов области
    for pattern, city_name in KNOWN_NON_TOMSK_SETTLEMENTS.items():
        if pattern in addr_clean:
            return city_name

    # 2. Если адрес прямо содержит 'Северск'
    if "северск" in addr_clean:
        return "Северск"

    # 3. Если координаты заведомо далеко за пределами Томска (например, Колпашево ~58.3°)
    if lat is not None and lng is not None:
        try:
            f_lat = float(lat)
            f_lng = float(lng)
            if f_lat > 57.5 and f_lng < 84.0:
                # Север/северо-запад области (Колпашевский, Парабельский районы)
                if "колпашев" in addr_clean or "нефтеразведчик" in addr_clean:
                    return "Колпашево"
        except (ValueError, TypeError):
            pass

    # 4. Если указан raw_city и он не является дефолтным Томском
    if raw_city and raw_city.strip() and raw_city.strip() != "Томск":
        return raw_city.strip()

    return "Томск"


def detect_tomsk_district(
    address: Optional[str],
    title: Optional[str] = "",
    city: str = "Томск",
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    current_district: Optional[str] = None
) -> Optional[str]:
    """
    Определяет район Томска по правилам ключевых слов адреса.

    Критически важные гарантии:
    1. Не назначает районы Томска объектам вне Томска (Колпашево, Асино и др.).
    2. НИКОГДА не назначает 'Советский район' в качестве безусловного fallback.
       Если район определить невозможно — возвращается None.
    """
    # Если город не Томск и не Пригород — район Томска недопустим
    if city and city not in ("Томск", "Пригород"):
        return None

    # Если координаты заданы и лежат далеко вне Томска — район Томска недопустим
    if lat is not None and lng is not None and not is_in_tomsk_envelope(lat, lng):
        return None

    text_lower = f"{address or ''} {title or ''}".lower()

    # Сопоставление по правилам
    for d_name, _, _, keywords in TOMSK_DISTRICT_RULES:
        if any(kw in text_lower for kw in keywords):
            return d_name

    # Если уже был район из достоверного источника и он совпадает с районами Томска
    if current_district and current_district in TOMSK_CITY_DISTRICTS:
        # Проверяем, не был ли это ошибочный fallback 'Советский район' без оснований
        if current_district == "Советский район":
            # Проверяем, есть ли хотя бы косвенные признаки
            soviet_kws = ["фрунзе", "комсомольск", "сибирск", "алтайск", "нечевск",
                          "никитин", "шевченко", "герцен", "кулагин", "тверск",
                          "гогол", "крылов", "чкалов", "советский"]
            if any(kw in text_lower for kw in soviet_kws):
                return current_district
            # Иначе это был фиктивный fallback — очищаем
            return None
        return current_district

    return None


def calc_radius_bbox(
    center_lat: float,
    center_lng: float,
    radius_km: float
) -> Tuple[float, float, float, float]:
    """
    Вычисляет грубый ограничивающий прямоугольник (bounding box) для круга radius_km вокруг центра.
    Используется для быстрой предварительной фильтрации в SQL перед точным расчётом haversine.
    Возвращает (min_lat, max_lat, min_lng, max_lng).
    """
    # 1 градус широты ~ 111.0 км на Земле. С запасом 5% на пограничные эффекты.
    delta_lat = (radius_km / 111.0) * 1.05

    # 1 градус долготы на широте phi ~ 111.0 * cos(phi) км.
    cos_lat = max(0.01, math.cos(math.radians(center_lat)))
    delta_lng = (radius_km / (111.0 * cos_lat)) * 1.05

    min_lat = round(max(-90.0, center_lat - delta_lat), 6)
    max_lat = round(min(90.0, center_lat + delta_lat), 6)
    min_lng = round(max(-180.0, center_lng - delta_lng), 6)
    max_lng = round(min(180.0, center_lng + delta_lng), 6)

    return min_lat, max_lat, min_lng, max_lng


def classify_coordinates(
    lat: Optional[float],
    lng: Optional[float],
    city: str = "Томск",
    source: str = "none",
    accuracy: Optional[str] = None
) -> Tuple[Optional[float], Optional[float], str]:
    """
    Классифицирует координаты и определяет уровень их точности (provenance):
      - 'exact': числовые координаты получены от источников с подтверждённой точностью
        до адреса/дома (источники: 'verified', 'test_verified').
      - 'unknown': валидные числовые координаты получены от источника (Циан), но точный уровень
        привязки (до дома vs до улицы/района) не подтверждён провайдером в открытых метаданных.
        Сохраняются для отображения на карте с предупреждающей меткой '?', но исключаются
        из строгого поиска по радиусу во избежание ложной точности.
      - 'approximate': центроид района или населённого пункта (поддерживается на уровне
        модели данных/API/UI, но текущие продакшен-сборщики его НЕ генерируют);
      - 'none': координаты отсутствуют, невалидны, являются заглушкой центра или
        получены из источников, не передающих координаты (Авито, БезПосредников).

    Возвращает (clean_lat, clean_lng, precision).
    """
    if lat is None or lng is None:
        return None, None, "none"

    try:
        f_lat = float(lat)
        f_lng = float(lng)
    except (ValueError, TypeError):
        return None, None, "none"

    # Нулевые координаты
    if abs(f_lat) < 1e-6 and abs(f_lng) < 1e-6:
        return None, None, "none"

    # Невалидные географические диапазоны или нечисловые значения
    if not (math.isfinite(f_lat) and math.isfinite(f_lng)):
        return None, None, "none"
    if not (-90.0 <= f_lat <= 90.0 and -180.0 <= f_lng <= 180.0):
        return None, None, "none"

    # Синтетическая точка центра Томска (56.4977, 84.9744)
    if is_center_placeholder(f_lat, f_lng):
        return None, None, "none"

    # Источники Авито и БезПосредников в текущих сборщиках не предоставляют проверенные
    # координаты объектов (ранее им присваивался центр Томска или синтетический jitter).
    # Без подтверждённой внешней provenance их координаты считаются недостоверными ('none').
    if source in ("avito", "bezposrednikov", "legacy"):
        return None, None, "none"

    # Проверенные модерацией или тестами источники с подтверждённой точностью до дома
    if source in ("verified", "test_verified"):
        if city == "Томск" and not is_in_tomsk_envelope(f_lat, f_lng):
            return None, None, "none"
        return round(f_lat, 6), round(f_lng, 6), "exact"

    # Источник Циан: в публичных поисковых выдачах Циан координаты присутствуют,
    # но признак гарантированной точности до дома (а не улицы/района) провайдером
    # в текущем открытом API не подтверждён фикстурами.
    # Поэтому координаты Циан сохраняются для отображения на карте, но строго
    # маркируются как 'unknown' (с бейджем '?' на клиенте) и не допускаются
    # в строгий поиск по радиусу во избежание ложной точности.
    if source == "cian" or source.startswith("cian"):
        if city == "Томск" and not is_in_tomsk_envelope(f_lat, f_lng):
            return None, None, "none"
        return round(f_lat, 6), round(f_lng, 6), "unknown"

    if source in ("approximate", "district_centroid"):
        return round(f_lat, 6), round(f_lng, 6), "approximate"

    # Для неизвестных или не проверенных источников числовая валидность не даёт права заявлять exact
    return None, None, "none"
