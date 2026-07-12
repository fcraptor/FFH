# PRD

## Problem statement
- Użytkownik wskazał repozytorium GitHub aplikacji Expo/React Native „FireFighter Helper” i poprosił o diagnozę oraz naprawę problemu z kaflami OpenStreetMap w ekranie mapy.
- Objaw: serwer `tile.openstreetmap.org` zwraca błąd związany z brakiem nagłówka `Referer` albo blokuje pobieranie kafli.

## Architecture
- Frontend: Expo + React Native + Expo Router
- Mapa: `react-native-webview` + Leaflet osadzony jako HTML string
- Backend: FastAPI (poza zakresem tej poprawki)

## User personas
- Strażak korzystający z mobilnego narzędzia do wyznaczania stref zagrożenia w terenie.

## Core requirements
- Poprawne ładowanie mapy OSM w ekranie tworzenia strefy zagrożenia.
- Zachowanie kompatybilności z Androidem i WebView.
- Ustawienie poprawnej polityki `referrer` dla żądań kafli.

## Implemented with dates
- 2026-04-08: Sklonowano repozytorium `https://github.com/fcraptor/FFH` do `/app/FFH`.
- 2026-04-08: Zdiagnozowano ekran `frontend/app/strefa-zagrozenia.tsx` jako źródło problemu.
- 2026-04-08: Dodano `meta name="referrer"` w HTML Leaflet, ustawiono `referrerPolicy` w warstwie OSM, zmieniono URL kafli na `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, dodano `baseUrl` do `WebView`, a także `originWhitelist` i `mixedContentMode`.
- 2026-04-08: Wykonano test web preview na `http://127.0.0.1:3001/strefa-zagrozenia` — ekran ładuje się bez crasha, ale `react-native-webview` nie obsługuje platformy web, więc w tym trybie nie powstają requesty do OSM; potwierdzono to też raportem testowym `/app/test_reports/iteration_1.json`.
- 2026-04-08: Zsynchronizowano frontend FFH do aktywnego `/app/frontend` z zachowaniem chronionych plików `.env` i `metro.config.js`, doinstalowano brakujące zależności i potwierdzono działanie App Preview pod adresem `https://github-ffh-1.preview.emergentagent.com`.
- 2026-04-08: Usunięto katalog `/app/FFH`, aby uniknąć pracy na dwóch kopiach projektu. Od tego momentu jedynym aktywnym frontendem roboczym jest `/app/frontend`.
- 2026-04-08: Wdrożono globalne zarządzanie motywem zgodne z ustawieniem telefonu (`useColorScheme`) z zachowaniem ręcznego przełącznika Jasny/Ciemny w `Ustawienia > Wygląd`. Ekran `zarzadzanie-powietrzem` został przepięty z własnej stałej ciemnej palety na wspólny motyw aplikacji.
- 2026-04-08: Dopracowano UI modułu `zarzadzanie-powietrzem` — strzałka powrotu trafiła do lewego górnego rogu, przyciski strzałki i kosza zyskały czytelne obramowanie w jasnym motywie, a przycisk `Butla 6,8` otrzymał obramowanie spójne z selektorem ciśnienia.
- 2026-04-08: Zwężono zegary w module `zarzadzanie-powietrzem`, umieszczając je kompaktowo między strzałką powrotu i koszem.
- 2026-04-08: W `szybki pomocnik` dodano przechodzenie między kartami gestem przesunięcia palcem po ekranie.
- 2026-04-08: W `Ustawienia > Dane` dodano akcję `Pobierz dane`, która przygotowuje materiały modułu Akcja (`szybki pomocnik` + `procedury`) do działania offline; na platformach natywnych pobiera obrazy i PDF-y do pamięci urządzenia, a na web preview bezpiecznie pomija pobieranie plików lokalnych.
- 2026-04-08: Doprecyzowano UX `zarzadzanie-powietrzem` — strzałka została w lewym górnym rogu, kosz w prawym górnym rogu, a zegary wyśrodkowano między nimi.
- 2026-04-08: Rozszerzono gest przesuwania kart w `szybki pomocnik` tak, aby działał z pustego obszaru strony, nie tylko z obszaru obrazu/tekstu.
- 2026-04-08: Obrazy w `szybki pomocnik` są od razu renderowane na stronie na szerokość ekranu. Na natywnym runtime wspierają pinch/pan/reset, a na web preview pokazują bezpieczny fallback bez crasha.
- 2026-04-08: Przywrócono galeriowy model obrazów — na stronie obraz jest pokazywany bez dodatkowych podpowiedzi, a po tapnięciu otwiera się pełnoekranowy viewer z wygodnym zoomem. Usunięto też tekstową podpowiedź o przesuwaniu kart.
- 2026-04-08: Naprawiono ładowanie pojedynczych obrazów w `szybki pomocnik` — problemem była szerokość klikalnego kontenera obrazka; po poprawce pojedyncze karty obrazkowe znów renderują się poprawnie.
- 2026-04-08: Naprawiono wyświetlanie obrazów w `KPP` zarówno na liście kart, jak i w pełnym podglądzie modala. Zamiast zagnieżdżonego viewer’a w modalu KPP obraz jest renderowany bezpośrednio, dzięki czemu jest od razu widoczny.
- 2026-05-10: Dodano moduł `Karty ratownicze` zintegrowany z ekranem `Akcja` oraz routingiem `akcja/karty-ratownicze`, z trybami `Model` i `Rejestracja`, helperami URL, walidacją lokalną i clipboard dla ChatGPT.
- 2026-05-10: Ulepszono przekazywanie danych do `Rescue Code` i `kartyratownicze.pl` — na natywnym runtime przyciski otwierają ekran WebView z próbą automatycznego uzupełnienia formularzy przez injected JavaScript; jeśli automatyczne przekazanie się nie powiedzie, strona i tak się otwiera. Na web preview działa bezpieczny fallback do otwarcia strony zewnętrznej.
- 2026-05-10: Dodano fallback UX dla `Rescue Code` — jeśli auto‑uzupełnienie nie powiedzie się, użytkownik dostaje czytelny komunikat, że wartość została skopiowana do schowka i można ją wkleić ręcznie.
- 2026-05-10: Usunięto górne, systemowe nagłówki na ekranach, gdzie dublowały treść widoku (`Główna`, `Akcja`, `Biuro`, `Ulubione`, `Ustawienia`). Zachowano tylko nagłówki wewnętrzne tam, gdzie były częścią layoutu ekranu.
- 2026-05-10: Ujednolicono `SafeAreaView` na ekranach aplikacji, aby treść i karty zaczynały się poniżej systemowej belki statusu / powiadomień.
- 2026-05-10: Rozbudowano `Strefę zagrożenia` o zwijany panel parametrów oraz overlay danych o wietrze z Open-Meteo (kierunek + prędkość) zależny od lokalizacji użytkownika lub punktu wskazanego na mapie. Dodano debounce, 10-minutowy cache i obsługę błędów. Uchwyt panelu ma poprawiony touch target i `testID`.
- 2026-05-11: Dodano tryb „Hydranty" do istniejącego ekranu mapy. FAB w prawym dolnym rogu mapy (`testID="map-mode-toggle"`) przełącza między trybami `hazardZone` i `hydrants` bez utraty istniejącej logiki strefy. W trybie hydrantów: pobieranie z Overpass API (`emergency=fire_hydrant` + `amenity=fire_hydrant`) dla bieżącego bbox z debounce 900 ms, lokalne haversine, sort + 5 najbliższych w panelu „Zarządzanie hydrantami", aktywny hydrant podświetlany (niebieski), przerywana linia od punktu odniesienia (`#C8102E` dashed). Punkt odniesienia z GPS lub kliknięciem na mapie. Kafelek głównego ekranu zmieniony na „Mapa" / „Hydranty / Strefa zagrożenia". Helpery wydzielone do `src/utils/hydrants.ts`, panel do `src/components/HydrantManagementPanel.tsx`. Fix HTTP 406 z RN OkHttp: zmiana na POST z explicit Accept + retry po wszystkich 3 mirrorach Overpass niezależnie od kodu błędu. Pasek debug + przycisk „Pobierz teraz" w panelu dla diagnostyki.
- 2026-05-11 (UX revamp): Domyślny tryb mapy zmieniono na **hydranty** (częściej używany). Overlay wiatru jest teraz widoczny zawsze (niezależnie od trybu). Sekcja „Widok mapy" usunięta z panelu strefy zagrożenia — przeniesiona na **górę mapy** jako stały toggle `Domyślny/Satelitarny` (`testID="map-view-osm"` / `map-view-satellite`), widoczny w obu trybach. FAB przełącznika trybu przesunięty wyżej (bottom: 30) z mocniejszym cieniem dla lepszej widoczności nad panelem.
- 2026-05-15: FAB „Strefa" zmieniono na żółty (`#FFD600` z ikoną `warning`). Po przełączeniu w tryb strefy aplikacja automatycznie pobiera GPS i ustawia hazardMarker (analogicznie do referencePoint w trybie hydrantów). Overlay wiatru reaguje też na zmiany `referencePoint` w trybie hydrantów. Fixes na małe ekrany: toggle widoku mapy przeniesiony na top-LEFT, Leaflet zoom controls przesunięte na bottom-left, by uniknąć kolizji z overlay'em wiatru na top-right. Skompresowano elementy listy hydrantów (paddingVertical 8, marginBottom 6, ikona 30px).
- 2026-05-15 (native fix): Pusty panel hydrantów w Expo Go (działający w web preview) spowodowany był przez `flex: 1` na liście bez `flex: 1`/`height` na rodzicu (`controlPanelHydrantWrap` ma tylko `maxHeight`). W natywnym RN dziecko `flex: 1` w rodzicu bez znanej wysokości dostaje `height: 0`. Zamieniono `list: { flex: 1 }` na `list: { maxHeight: 290 }` i usunięto `flex: 1` z `container`. Dodano `flyTo` z animacją + fallback `setView` dla centrowania mapy po wyborze GPS (problem nie-centrowania po „Wskaż na mapie" → „Moja lokalizacja"). Dodano komunikaty błędów GPS w `exitHydrantMode` (zamiast cichego ignorowania).
- 2026-05-15 (lista hydrantów + UX): Klik hydrantu z listy NIE przenosi już widoku mapy na hydrant (`selectHydrant(hydrant, false)` — tylko popup + przerywana linia, mapa zostaje w wybranej przez użytkownika pozycji). Layout panelu hydrantów przerobiony: `controlPanelHydrantWrap` ma teraz explicit `height: SCREEN_HEIGHT * 0.58` (zamiast `maxHeight`), dzięki czemu `flex: 1` w komponencie panelu i liście działa poprawnie w natywnym RN. `mapContainerExpanded` zmniejszone do 0.32, `controlPanelExpanded` zwiększone do 0.62. Usunięto pasek debug i przycisk „Pobierz teraz" z panelu hydrantów (zbędne po stabilizacji Overpass) — to zwolniło ~50px miejsca dla listy. Lista hydrantów teraz `flex: 1`, mieści wszystkie 5 elementów bez ucięcia ostatniego.

## Prioritized backlog
### P0
- Zweryfikować na urządzeniu Android, że requesty do OSM zawierają prawidłowy `Referer`.

### P1
- Dodać prosty ekran diagnostyczny/logi WebView dla problemów sieciowych mapy.

### P2
- Rozważyć wydzielenie HTML mapy do generatora lub osobnego modułu dla łatwiejszego testowania.

## Next tasks list
- Uruchomić aplikację na Androidzie i sprawdzić requesty w `chrome://inspect`.
- Zweryfikować zachowanie mapy na Expo Web w DevTools → Network.
- Jeśli potrzebna będzie pełna walidacja natywna, wykonać test na fizycznym Androidzie lub emulatorze z aktywnym WebView.
- Dalszy rozwój prowadzić już wyłącznie w `/app/frontend`.
- Przed zapisem do GitHub ponownie sklonować repo i zsynchronizować do niego aktualny stan z `/app/frontend`.
- Rozważyć dodanie `testID` do kluczowych kontrolek, aby uprościć stabilne testy regresyjne.

## 2026-05 · Moduł „Kalendarz PSP" (Biuro)

Dodany pełny moduł grafiku służb PSP zgodnie ze szczegółową specyfikacją.

### Najważniejsze pliki
- **Ekran główny:** `frontend/app/biuro/kalendarz-psp.tsx`
- **Ustawienia:** `frontend/app/biuro/kalendarz-psp-ustawienia.tsx`
- **Kontekst danych:** `frontend/src/contexts/CalendarPspContext.tsx` (AsyncStorage)
- **Logika cyklu zmian/daty:** `frontend/src/utils/calendarPsp.ts`
- **Typy/kolory:** `frontend/src/types/calendarPsp.ts`
- **Komponenty:** `frontend/src/components/calendar/` (CalendarDayCell, CalendarGrid, EventBottomSheet, MonthYearPicker, CalendarLegend, NoteModal, MonthPhotoModal, ColorPickerModal, ExportableCalendar)
- **Integracja:** `frontend/app/biuro/index.tsx` (kafel), `frontend/app/biuro/_layout.tsx` (Stack.Screen), `frontend/app/_layout.tsx` (CalendarPspProvider + GestureHandlerRootView)

### Zapis danych (AsyncStorage)
- `firefighter_calendar_events` – mapa YYYY-MM-DD → typ zdarzenia
- `firefighter_calendar_notes` – mapa YYYY-MM-DD → notatka
- `firefighter_calendar_photos` – mapa YYYY-MM → base64
- `firefighter_calendar_shift_colors` – kolory 3 zmian
- `firefighter_calendar_autofill` – konfiguracja autouzupełniania

### Cykl zmian
Funkcja `getShiftForDate(date)` w `src/utils/calendarPsp.ts`. Anchor: **2 stycznia 2026 = zmiana 1**.
Weryfikacja maja 2026: ✓ III(1,4,7…31), ✓ I(2,5…29), ✓ II(3,6…30).

### Logika centralnego małego kwadratu zdarzenia
W `src/components/calendar/CalendarDayCell.tsx`. Renderowany TYLKO gdy `event && isCurrentMonth`,
zawiera w sobie numer dnia (`<Text>` wewnątrz `<View>`). Bez zdarzenia → tylko numer na pastelu.

### Eksport JPG i kopia zapasowa
- JPG: `react-native-view-shot` (captureRef na ukrytym widoku `ExportableCalendar`) + `expo-sharing`.
- Backup: serializacja JSON, zapis `expo-file-system` → udostępnianie `expo-sharing`.
- Import: `expo-document-picker` + readAsStringAsync + walidacja `version === 1`.

### Permissions
W `frontend/app.json` dodano iOS `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` i Android `CAMERA`, `READ_MEDIA_IMAGES`.

## 2026-06 · Moduł „Baza Wiedzy KG" (Biuro)

Dodany pełny moduł Baza Wiedzy KG ze scrapowaniem strony gov.pl/kgpsp, lokalnym cache i wyszukiwaniem.

### Funkcjonalności
- **Web Scraping:** Backend automatycznie scrapuje stronę https://www.gov.pl/web/kgpsp/baza-wiedzy i wszystkie podstrony (rekurencyjnie do 4 poziomów głębokości)
- **Budowanie drzewa:** Z płaskiej listy node'ów tworzony jest hierarchiczny widok drzewa (foldery/pliki/linki)
- **Offline-first:** Dane zapisywane w AsyncStorage, aplikacja działa bez internetu z ostatnią wersją cache
- **Wyszukiwanie:** Pełnotekstowe wyszukiwanie po tytułach i ścieżkach z rankingiem wyników
- **Otwieranie plików:** PDF, PPTX, DOC itp. otwierane przez expo-web-browser

### Najważniejsze pliki
- **Backend scraper:** `backend/routes/baza_wiedzy.py` (aiohttp + BeautifulSoup)
- **Ekran główny:** `frontend/app/biuro/baza-wiedzy.tsx`
- **Serwis sync:** `frontend/src/services/knowledgeSyncService.ts`
- **Serwis cache:** `frontend/src/services/knowledgeCacheService.ts`
- **Builder drzewa:** `frontend/src/services/knowledgeTreeBuilder.ts`
- **Typy:** `frontend/src/types/knowledge.ts`
- **Komponenty:** `frontend/src/components/knowledge/` (KnowledgeTreeNode, KnowledgeSearchResults)

### Zapis danych (AsyncStorage)
- `@knowledge_tree_v1` – drzewo z relacjami parent/children
- `@knowledge_items_index_v1` – indeks wyszukiwania (pliki + linki)
- `@knowledge_sync_meta` – metadata synchronizacji (czas, wersja, liczba elementów)

### Statystyki ze scrapowania
- 21 kategorii głównych
- ~82 folderów, ~687 plików, ~167 linków
- Łącznie ~936 elementów w drzewie

