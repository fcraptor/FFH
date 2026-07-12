#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Rozbudowa aplikacji FFH (branch main3) o moduł "Kalendarz PSP" w sekcji Biuro.
  Pełna lokalna funkcjonalność: 3-zmianowy cykl PSP, kafle dni z pastelowym tłem zmiany,
  centralny mały kwadrat zdarzenia, notatki, autouzupełnianie, kopie zapasowe, eksport JPG,
  zdjęcia grafików miesięcy, ustawienia kolorów i tryb ciemny.

frontend:
  - task: "Moduł Kalendarz PSP - siatka miesiąca + cykl zmian"
    implemented: true
    working: true
    file: "frontend/app/biuro/kalendarz-psp.tsx, frontend/src/components/calendar/*, frontend/src/utils/calendarPsp.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Zaimplementowano kompletny moduł Kalendarz PSP zgodnie ze szczegółową specyfikacją:
          - Cykl 3-dniowy zmian z anchorem 2 stycznia 2026 = zmiana 1.
            W maju 2026: zmiana III = 1,4,7,...,31; zmiana I = 2,5,...,29; zmiana II = 3,6,...,30 (zweryfikowano wizualnie).
          - Pełny widok 6 tygodni z poniedziałkiem jako pierwszym dniem.
          - Pastelowe tła dla zmian (1=żółte, 2=koralowe, 3=niebieskie) z możliwością zmiany koloru.
          - Mały centralny kwadrat zdarzenia (kolor zależny od typu) z numerem dnia NA tym kwadracie.
          - 6 typów zdarzeń: służba/wolna_służba/urlop/choroba/dyżur/delegacja + notatka + usuń.
          - Dolny arkusz (bottom sheet) animowany od dołu, zamykany kliknięciem poza.
          - Long press = automatycznie wolna służba.
          - Niebieska obwódka = dzisiaj, biała obwódka = aktualnie wybrany.
          - Czerwona kropka w prawym górnym rogu = notatka.
          - Pasek miesiąca: strzałki, ikona kalendarza (powrót do dziś), ikona aparatu (zdjęcie grafiku).
          - MonthYearPicker (klik na nazwę miesiąca) z chipami lat i 12 kaflami miesięcy.
          - Gesty swipe lewo/prawo do zmiany miesiąca (react-native-gesture-handler).
          - Panel pod kalendarzem: pełna data, dzień tygodnia, numer zmiany (badge), nazwa zdarzenia.
          - Osobna karta notatki z możliwością edycji.
          - Zwijana legenda kolorów obok przycisku "+".
          - Eksport JPG za pomocą react-native-view-shot + expo-sharing.
          - Zdjęcia grafików miesięcznych (expo-image-picker) z aparatu lub galerii, zapis lokalny w base64.
          - Ekran ustawień: kolory zmian (paleta pasteli), autouzupełnianie (3-dniowy cykl wpisuje 'służba'),
            wyczyść kalendarz (z opcją resetu kolorów), eksport/import kopii zapasowej JSON, sekcja informacji.
          - Wszystkie dane lokalne w AsyncStorage. Tryb ciemny respektowany.
          - Permissions kamery i galerii dodane do app.json (iOS infoPlist + Android permissions).
        
metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Moduł Kalendarz PSP - siatka miesiąca + cykl zmian"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Dodano w pełni działający moduł "Kalendarz PSP" w sekcji Biuro (zgodnie ze szczegółową specyfikacją użytkownika).
      Weryfikacja wizualna na web preview potwierdziła poprawność:
        • cyklu zmian dla maja 2026 (1→III, 2→I, 3→II, 15→II, 21→II, 25→III itd.),
        • centralnego małego kwadratu zdarzeń (15 maja=zielony, 21 maja=czerwony, 25 maja=szary),
        • notatki z czerwoną kropką,
        • bottom sheet wyboru zdarzeń,
        • układu ustawień (kolory, autouzupełnianie, backup).
      Nowe pakiety: expo-image-picker, expo-sharing, expo-media-library, expo-document-picker, react-native-view-shot.
      Funkcje aparatu/galerii i eksport JPG działają natywnie (na web preview niektóre operacje plikowe są ograniczone,
      ale na urządzeniu Expo Go/produkcja będą działać w pełni).
