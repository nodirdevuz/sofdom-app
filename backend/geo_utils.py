"""
geo_utils.py
Географические утилиты, правила районирования и валидация координат для SofDom.

Приоритет: точность и происхождение геолокации.
Исключает назначение фиктивных координат центра, синтетический jitter на hash(id),
и ошибочное присвоение районов одного города объектам за пределами его границ.

Архитектура:
Поддержка профилей городов (CityProfile) через реестр (CityRegistry).
В текущей продуктовой фазе активен и валидирован профиль Томска (TOMSK_PROFILE).
Общая геологика (валидация координат, районирование, радиусный поиск) отделена
от городских справочников и конвертов, позволяя расширять список городов через
регистрацию профилей без модификации алгоритмического ядра.
"""

import math
import re
from dataclasses import dataclass, field
from typing import Optional, Tuple, Dict, Set, List, Any, NamedTuple


# --- Модели конфигурации города (City Profile Architecture) ---

class DistrictRule(NamedTuple):
    """Правило сопоставления района: название, центроид (lat, lng), ключевые слова адреса."""
    name: str
    centroid_lat: float
    centroid_lng: float
    keywords: Tuple[str, ...]


@dataclass
class CityProfile:
    """
    Профиль города: инкапсулирует границы, центроиды, заглушки центра,
    районы и локальные правила районирования/распознавания населённых пунктов.
    """
    name: str
    aliases: Tuple[str, ...]
    envelope: Dict[str, float]
    center_lat: float
    center_lng: float
    placeholder_centers: Tuple[Tuple[float, float], ...]
    districts: Set[str]
    district_rules: List[DistrictRule]
    non_city_settlements: Dict[str, str] = field(default_factory=dict)
    suburbs: Tuple[str, ...] = ("Пригород",)

    def is_in_envelope(self, lat: Optional[float], lng: Optional[float]) -> bool:
        """Проверяет, попадают ли координаты в диагностический конверт агломерации города."""
        if lat is None or lng is None:
            return False
        try:
            f_lat = float(lat)
            f_lng = float(lng)
            return (self.envelope["min_lat"] <= f_lat <= self.envelope["max_lat"] and
                    self.envelope["min_lng"] <= f_lng <= self.envelope["max_lng"])
        except (ValueError, TypeError):
            return False

    def is_placeholder(self, lat: Optional[float], lng: Optional[float], tolerance: float = 0.001) -> bool:
        """Проверяет, являются ли координаты синтетической заглушкой центра города."""
        if lat is None or lng is None:
            return False
        try:
            f_lat = float(lat)
            f_lng = float(lng)
            for p_lat, p_lng in self.placeholder_centers:
                if abs(f_lat - p_lat) < tolerance and abs(f_lng - p_lng) < tolerance:
                    return True
            return False
        except (ValueError, TypeError):
            return False

    def detect_district(
        self,
        address: Optional[str],
        title: Optional[str] = "",
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        current_district: Optional[str] = None
    ) -> Optional[str]:
        """
        Определяет район города по правилам ключевых слов адреса.
        Если координаты заданы и лежат вне конверта города — район не присваивается.
        Никогда не назначает fallback-район без подтверждения ключевыми словами.
        """
        if lat is not None and lng is not None and not self.is_in_envelope(lat, lng):
            return None

        text_lower = f"{address or ''} {title or ''}".lower()

        # 1. Поиск по правилам ключевых слов района
        for rule in self.district_rules:
            if any(kw in text_lower for kw in rule.keywords):
                return rule.name

        # 2. Если уже был район из проверенного источника и он входит в официальные районы города
        if current_district and current_district in self.districts:
            # Для Томска: отсекаем исторический синтетический fallback 'Советский район' без оснований в тексте
            if current_district == "Советский район" and self.name == "Томск":
                soviet_kws = ["фрунзе", "комсомольск", "сибирск", "алтайск", "нечевск",
                              "никитин", "шевченко", "герцен", "кулагин", "тверск",
                              "гогол", "крылов", "чкалов", "советский"]
                if any(kw in text_lower for kw in soviet_kws):
                    return current_district
                return None
            return current_district

        return None


# --- Профиль Томска (Единственный активный город текущего этапа) ---

# Диагностический конверт (bounding envelope) Томска и прилегающей агломерации
# (включая Северск, Зональную Станцию, Кисловку, Тимирязевское, Богашёво, Левобережный).
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
TOMSK_DISTRICT_RULES: List[DistrictRule] = [
    DistrictRule("Кировский район", 56.460, 84.970, (
        "усов", "киров", "красноармейск", "мокрушин", "елизаров", "нахимов", "котовск",
        "учебн", "вершинин", "дзержинск", "студенческ", "южн", "буревестник", "тимаков",
        "тгу", "тпу", "сибгму", "лагерный", "южная", "кировский"
    )),
    DistrictRule("Советский район", 56.478, 84.985, (
        "фрунзе", "комсомольск", "сибирск", "алтайск", "нечевск", "никитин", "шевченко",
        "герцен", "кулагин", "тверск", "гогол", "крылов", "чкалов", "советский"
    )),
    DistrictRule("Ленинский район", 56.515, 84.960, (
        "мир", "79 гвардейск", "каштак", "войков", "говоров", "смирнов", "березов",
        "пролетарск", "большая подгорн", "черемошник", "интернационалист", "карла маркс",
        "5-й арми", "ленинский"
    )),
    DistrictRule("Октябрьский район", 56.508, 85.030, (
        "иркутск", "лазо", "герасименко", "солнечн", "зеленые горк", "зелёные горк",
        "беринг", "клюев", "архитектор", "пушкин", "мичурин", "энтузиаст", "бауман",
        "черноморск", "октябрьский"
    )),
    DistrictRule("Пригород", 56.425, 85.015, (
        "зональн", "южные ворот", "кисловк", "левобережн", "тимирязев", "северск"
    ))
]

TOMSK_PROFILE = CityProfile(
    name="Томск",
    aliases=("томск", "tomsk", "г. томск", "город томск", "г.томск"),
    envelope=TOMSK_AGGLOMERATION_ENVELOPE,
    center_lat=56.4977,
    center_lng=84.9744,
    placeholder_centers=((56.4977, 84.9744),),
    districts=TOMSK_CITY_DISTRICTS,
    district_rules=TOMSK_DISTRICT_RULES,
    non_city_settlements=KNOWN_NON_TOMSK_SETTLEMENTS,
    suburbs=("Пригород",)
)


# --- Реестр профилей городов (City Registry) ---

CITY_REGISTRY: Dict[str, CityProfile] = {}


def register_city_profile(profile: CityProfile) -> None:
    """Регистрирует профиль города в глобальном реестре."""
    CITY_REGISTRY[profile.name.lower()] = profile
    for alias in profile.aliases:
        CITY_REGISTRY[alias.lower()] = profile


def get_city_profile(city: Optional[str]) -> Optional[CityProfile]:
    """
    Возвращает профиль города по названию или псевдониму.
    Если город не зарегистрирован или None — возвращает None.
    """
    if not city:
        return None
    return CITY_REGISTRY.get(city.strip().lower())


def list_registered_cities() -> List[str]:
    """Возвращает отсортированный список официально зарегистрированных городов."""
    unique_names = {p.name for p in CITY_REGISTRY.values()}
    return sorted(unique_names)


# Регистрируем единственный активный профиль текущего этапа — Томск
register_city_profile(TOMSK_PROFILE)


# --- Общие географические алгоритмы и функции ---

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Вычисляет расстояние между двумя географическими координатами в километрах."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return round(2 * R * math.asin(math.sqrt(a)), 2)


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


def is_center_placeholder(
    lat: Optional[float],
    lng: Optional[float],
    city: Optional[str] = "Томск"
) -> bool:
    """
    Проверяет, являются ли координаты синтетической заглушкой центра.
    Если профиль города найден — проверяет по его placeholder_centers.
    Если профиль не найден или city не передан — проверяет по заглушкам всех
    зарегистрированных профилей (для безопасного отсева фиктивных точек).
    """
    if lat is None or lng is None:
        return False
    profile = get_city_profile(city) if city else None
    if profile:
        return profile.is_placeholder(lat, lng)
    seen = set()
    for p in CITY_REGISTRY.values():
        if p.name not in seen:
            seen.add(p.name)
            if p.is_placeholder(lat, lng):
                return True
    return False


def is_in_city_envelope(
    lat: Optional[float],
    lng: Optional[float],
    city: Optional[str] = "Томск"
) -> bool:
    """
    Проверяет, попадают ли координаты в диагностический конверт профиля города.
    Если для города нет зарегистрированного профиля — возвращает False
    (неизвестный город никогда ошибочно не проверяется по конверту Томска).
    """
    profile = get_city_profile(city)
    if profile is None:
        return False
    return profile.is_in_envelope(lat, lng)


def is_in_tomsk_envelope(lat: Optional[float], lng: Optional[float]) -> bool:
    """Обратная совместимость: проверяет попадание в конверт Томска."""
    return TOMSK_PROFILE.is_in_envelope(lat, lng)


def detect_city(
    address: Optional[str],
    raw_city: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    default_city: str = "Томск"
) -> str:
    """
    Определяет реальный населённый пункт объявления по адресу, сырому городу и координатам.
    Предотвращает запись 'Томск' для объектов из других городов области (Колпашево, Северск и т.д.).
    Если raw_city явно указан и не является дефолтным (например, другой город) — возвращает его.
    """
    addr_clean = (address or "").lower()

    # 1. Если указан raw_city и он не является дефолтным городом и не пустой
    if raw_city and raw_city.strip() and raw_city.strip() != default_city:
        return raw_city.strip()

    # 2. Проверка по населённым пунктам профиля по умолчанию (для Томска — населённые пункты Томской области)
    profile = get_city_profile(default_city)
    non_city = profile.non_city_settlements if profile else KNOWN_NON_TOMSK_SETTLEMENTS
    for pattern, city_name in non_city.items():
        if pattern in addr_clean:
            return city_name

    # 3. Если адрес прямо содержит 'Северск'
    if "северск" in addr_clean:
        return "Северск"

    # 4. Если координаты заведомо далеко за пределами Томска (например, Колпашево ~58.3°)
    if profile and profile.name == "Томск" and lat is not None and lng is not None:
        try:
            f_lat = float(lat)
            f_lng = float(lng)
            if f_lat > 57.5 and f_lng < 84.0:
                if "колпашев" in addr_clean or "нефтеразведчик" in addr_clean:
                    return "Колпашево"
        except (ValueError, TypeError):
            pass

    return default_city


def detect_district(
    address: Optional[str],
    title: Optional[str] = "",
    city: Optional[str] = "Томск",
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    current_district: Optional[str] = None
) -> Optional[str]:
    """
    Определяет район города по правилам зарегистрированного профиля города.
    Если город не зарегистрирован (или None) — возвращает None, исключая
    ошибочное присвоение районов Томска объектам из других/неизвестных городов.
    """
    profile = get_city_profile(city)
    if profile is None:
        # Для пригорода Томска пробуем профиль Томска
        if city and city in TOMSK_PROFILE.suburbs:
            profile = TOMSK_PROFILE
        else:
            return None

    return profile.detect_district(
        address=address,
        title=title,
        lat=lat,
        lng=lng,
        current_district=current_district
    )


def detect_tomsk_district(
    address: Optional[str],
    title: Optional[str] = "",
    city: str = "Томск",
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    current_district: Optional[str] = None
) -> Optional[str]:
    """Обратная совместимость: определяет район через detect_district."""
    return detect_district(
        address=address,
        title=title,
        city=city,
        lat=lat,
        lng=lng,
        current_district=current_district
    )


def classify_coordinates(
    lat: Optional[float],
    lng: Optional[float],
    city: Optional[str] = "Томск",
    source: str = "none",
    accuracy: Optional[str] = None
) -> Tuple[Optional[float], Optional[float], str]:
    """
    Классифицирует координаты и определяет уровень их точности (provenance):
      - 'exact': числовые координаты получены от источников с подтверждённой точностью
        до адреса/дома (источники: 'verified', 'test_verified') И подтверждены
        в рамках зарегистрированного профиля города (внутри диагностического конверта).
        Отсутствие профиля города НИКОГДА не даёт статус 'exact'.
      - 'unknown': валидные числовые координаты получены от источника (Циан), но точный уровень
        привязки (до дома vs до улицы/района) не подтверждён провайдером в открытых метаданных.
        Сохраняются для карты с меткой '?', но исключаются из строгого радиусного поиска.
        Для неизвестных городов не проверяются по конверту Томска, сохраняя статус 'unknown'.
      - 'approximate': центроид района или населённого пункта.
      - 'none': координаты отсутствуют, невалидны, являются заглушкой центра,
        получены из неподтверждённых источников (Авито, БезПосредников) или
        лежат вне конверта города.

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

    profile = get_city_profile(city)

    # Проверка на синтетическую заглушку центра города
    if is_center_placeholder(f_lat, f_lng, city=city):
        return None, None, "none"

    # Источники Авито и БезПосредников
    if source in ("avito", "bezposrednikov", "legacy"):
        return None, None, "none"

    # Проверенные модерацией или тестами источники с подтверждённой точностью до дома
    if source in ("verified", "test_verified"):
        # Без зарегистрированного профиля города невозможно валидировать границы;
        # отсутствие профиля города НИКОГДА не повышает статус до exact
        if profile is None:
            return None, None, "none"
        if not profile.is_in_envelope(f_lat, f_lng):
            return None, None, "none"
        return round(f_lat, 6), round(f_lng, 6), "exact"

    # Источник Циан: координаты сохраняются для карты с меткой '?',
    # но строго маркируются как 'unknown' и исключаются из строгого радиусного поиска
    if source == "cian" or source.startswith("cian"):
        # Если профиль зарегистрирован (Томск) — проверяем согласованность с конвертом города
        if profile is not None:
            if not profile.is_in_envelope(f_lat, f_lng):
                return None, None, "none"
        # Для неизвестного города координаты Циан не проверяются по конверту Томска,
        # но строго остаются 'unknown' (отсутствие профиля не даёт exact)
        return round(f_lat, 6), round(f_lng, 6), "unknown"

    if source in ("approximate", "district_centroid"):
        return round(f_lat, 6), round(f_lng, 6), "approximate"

    return None, None, "none"
