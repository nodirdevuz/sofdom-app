"""
geo_utils.py
Географические утилиты, правила районирования и валидация координат для SofDom.

Приоритет: точность и происхождение геолокации.
Исключает назначение фиктивных координат центра, синтетический jitter на hash(id),
и ошибочное присвоение районов одного города объектам за пределами его границ.

Архитектура:
Поддержка профилей городов (CityProfile) через реестр (CityRegistry).
В текущей продуктовой фазе активен и валидирован профиль Томска (TOMSK_PROFILE).
Общая геологика (валидация координат, районирование, распознавание городов, радиусный поиск)
полностью отделена от специфичных городских справочников и конвертов, позволяя расширять
список городов через регистрацию профилей без модификации алгоритмического ядра.
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
class RegionalCoordinateHeuristic:
    """
    Эвристика выявления удалённого населённого пункта региона
    по географическим координатам и ключевым словам адреса.
    """
    settlement_name: str
    min_lat: float
    max_lng: float
    keywords: Tuple[str, ...]

    def matches(self, addr_lower: str, lat: float, lng: float) -> bool:
        if lat > self.min_lat and lng < self.max_lng:
            return any(kw in addr_lower for kw in self.keywords)
        return False


@dataclass
class CityProfile:
    """
    Профиль города: инкапсулирует границы, центроиды, заглушки центра,
    районы, правила районирования и распознавания населённых пунктов региона.
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
    regional_heuristics: List[RegionalCoordinateHeuristic] = field(default_factory=list)
    unverified_district_fallbacks: Dict[str, Tuple[str, ...]] = field(default_factory=dict)
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

    def detect_settlement(
        self,
        address: Optional[str],
        lat: Optional[float] = None,
        lng: Optional[float] = None
    ) -> Optional[str]:
        """
        Проверяет, относится ли адрес к другому населённому пункту региона
        по словарю региональных пунктов или координатным эвристикам профиля.
        Возвращает название населённого пункта (например, 'Колпашево', 'Северск') или None.
        """
        addr_clean = (address or "").lower()

        # 1. Поиск по ключевым словам населённых пунктов региона
        for pattern, settlement_name in self.non_city_settlements.items():
            if pattern in addr_clean:
                return settlement_name

        # 2. Поиск по координатным региональным эвристикам
        if lat is not None and lng is not None and self.regional_heuristics:
            try:
                f_lat = float(lat)
                f_lng = float(lng)
                for heuristic in self.regional_heuristics:
                    if heuristic.matches(addr_clean, f_lat, f_lng):
                        return heuristic.settlement_name
            except (ValueError, TypeError):
                pass

        return None

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
            # Если для района задана фильтрация ложного fallback — требуем ключевые слова
            if current_district in self.unverified_district_fallbacks:
                required_kws = self.unverified_district_fallbacks[current_district]
                if any(kw in text_lower for kw in required_kws):
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

TOMSK_REGIONAL_HEURISTICS: List[RegionalCoordinateHeuristic] = [
    RegionalCoordinateHeuristic(
        settlement_name="Колпашево",
        min_lat=57.5,
        max_lng=84.0,
        keywords=("колпашев", "нефтеразведчик")
    )
]

TOMSK_UNVERIFIED_DISTRICT_FALLBACKS: Dict[str, Tuple[str, ...]] = {
    "Советский район": (
        "фрунзе", "комсомольск", "сибирск", "алтайск", "нечевск",
        "никитин", "шевченко", "герцен", "кулагин", "тверск",
        "гогол", "крылов", "чкалов", "советский"
    )
}

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
    regional_heuristics=TOMSK_REGIONAL_HEURISTICS,
    unverified_district_fallbacks=TOMSK_UNVERIFIED_DISTRICT_FALLBACKS,
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
    city: Optional[str] = None
) -> bool:
    """
    Проверяет, являются ли координаты синтетической заглушкой центра.
    Если указан city: проверяет по placeholder_centers соответствующего профиля.
    Для неизвестного города заглушки других городов не применяются.
    Если city не указан: проверяет по заглушкам всех зарегистрированных профилей.
    """
    if lat is None or lng is None:
        return False
    if city:
        profile = get_city_profile(city)
        if profile:
            return profile.is_placeholder(lat, lng)
        return False

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
    Использует зарегистрированный CityProfile:
    - Если для города (raw_city или default_city) профиль найден, вызывается profile.detect_settlement(...).
    - Если профиль не найден (неизвестный/будущий город) — возвращается исходный город,
      без применения справочников Томской области или других чужих городов.
    """
    target_city = raw_city.strip() if (raw_city and raw_city.strip()) else default_city

    profile = get_city_profile(target_city)
    if profile is None:
        # Для неизвестного города чужие профили и региональные словари НЕ применяются
        return target_city

    settlement = profile.detect_settlement(address=address, lat=lat, lng=lng)
    if settlement:
        return settlement

    return profile.name


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
        if city:
            c_clean = city.strip()
            for p in CITY_REGISTRY.values():
                if c_clean in p.suburbs:
                    profile = p
                    break
        if profile is None:
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
        # Если профиль зарегистрирован — проверяем согласованность с конвертом города
        if profile is not None:
            if not profile.is_in_envelope(f_lat, f_lng):
                return None, None, "none"
        # Для неизвестного города координаты Циан не проверяются по конверту зарегистрированного города,
        # но строго остаются 'unknown' (отсутствие профиля не даёт exact)
        return round(f_lat, 6), round(f_lng, 6), "unknown"

    if source in ("approximate", "district_centroid"):
        return round(f_lat, 6), round(f_lng, 6), "approximate"

    return None, None, "none"
