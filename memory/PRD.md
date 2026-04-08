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
- 2026-04-08: Zsynchronizowano frontend FFH do aktywnego `/app/frontend` z zachowaniem chronionych plików `.env` i `metro.config.js`, doinstalowano brakujące zależności i potwierdzono działanie App Preview pod adresem `https://dev-github-app.preview.emergentagent.com`.
- 2026-04-08: Usunięto katalog `/app/FFH`, aby uniknąć pracy na dwóch kopiach projektu. Od tego momentu jedynym aktywnym frontendem roboczym jest `/app/frontend`.
- 2026-04-08: Wdrożono globalne zarządzanie motywem zgodne z ustawieniem telefonu (`useColorScheme`) z zachowaniem ręcznego przełącznika Jasny/Ciemny w `Ustawienia > Wygląd`. Ekran `zarzadzanie-powietrzem` został przepięty z własnej stałej ciemnej palety na wspólny motyw aplikacji.
- 2026-04-08: Dopracowano UI modułu `zarzadzanie-powietrzem` — strzałka powrotu trafiła do lewego górnego rogu, przyciski strzałki i kosza zyskały czytelne obramowanie w jasnym motywie, a przycisk `Butla 6,8` otrzymał obramowanie spójne z selektorem ciśnienia.
- 2026-04-08: Zwężono zegary w module `zarzadzanie-powietrzem`, umieszczając je kompaktowo między strzałką powrotu i koszem.
- 2026-04-08: W `szybki pomocnik` dodano przechodzenie między kartami gestem przesunięcia palcem po ekranie.
- 2026-04-08: W `Ustawienia > Dane` dodano akcję `Pobierz dane`, która przygotowuje materiały modułu Akcja (`szybki pomocnik` + `procedury`) do działania offline; na platformach natywnych pobiera obrazy i PDF-y do pamięci urządzenia, a na web preview bezpiecznie pomija pobieranie plików lokalnych.

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