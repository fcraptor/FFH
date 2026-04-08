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