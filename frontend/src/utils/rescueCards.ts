const CHAT_GPT_BASE_URL = 'https://chatgpt.com/?q=';
const CHAT_GPT_SUFFIX = '&hints=search';
const RESCUE_CODE_BASE_URL = 'https://rescue.euroncap.com/#/search';
const KARTY_RATOWNICZE_BASE_URL = 'https://www.kartyratownicze.pl/wyszukaj-za-darmo/';

const RESCUE_CODE_SUPPORTS_QUERY_PARAM = false;
const KARTY_RATOWNICZE_SUPPORTS_QUERY_PARAM = false;

export const buildChatGptPrompt = (vehicleQuery: string): string => (
  `Znajdź kartę ratowniczą PDF dla pojazdu: ${vehicleQuery}. ` +
  'Szukaj na stronach producentów, importerów lub w serwisach z kartami ratowniczymi.'
);

export const buildChatGptUrl = (vehicleQuery: string): string => {
  const prompt = buildChatGptPrompt(vehicleQuery.trim());
  return `${CHAT_GPT_BASE_URL}${encodeURIComponent(prompt)}${CHAT_GPT_SUFFIX}`;
};

export const buildRescueCodeUrl = (vehicleQuery: string): string => {
  const trimmed = vehicleQuery.trim();
  if (!trimmed || !RESCUE_CODE_SUPPORTS_QUERY_PARAM) {
    return RESCUE_CODE_BASE_URL;
  }

  return `${RESCUE_CODE_BASE_URL}?query=${encodeURIComponent(trimmed)}`;
};

export const buildKartyRatowniczeUrl = (registration: string): string => {
  const trimmed = registration.trim();
  if (!trimmed || !KARTY_RATOWNICZE_SUPPORTS_QUERY_PARAM) {
    return KARTY_RATOWNICZE_BASE_URL;
  }

  return `${KARTY_RATOWNICZE_BASE_URL}?rejestracja=${encodeURIComponent(trimmed)}`;
};

export const buildRescueCodeInjectionScript = (vehicleQuery: string): string => {
  const query = JSON.stringify(vehicleQuery.trim());

  return `
    (function() {
      const query = ${query};
      if (!query) return true;
      let hasPostedStatus = false;

      const postStatus = (status) => {
        if (hasPostedStatus) return;
        hasPostedStatus = true;
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'prefill-status', target: 'rescue-code', status }));
        }
      };

      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const fillSearch = () => {
        const input = [
          ...document.querySelectorAll('input[type="search"], input[type="text"], input[placeholder*="Vehicle"], input[placeholder*="model"], input[placeholder*="Model"]'),
        ].find(isVisible);

        if (!input) return false;

        input.focus();
        input.value = query;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));

        const searchButton = [
          ...document.querySelectorAll('button, [role="button"], a'),
        ].find((element) => isVisible(element) && /search/i.test((element.textContent || '').trim()));

        if (searchButton && typeof searchButton.click === 'function') {
          searchButton.click();
        }

        postStatus('success');
        return true;
      };

      let attempts = 0;
      const maxAttempts = 24;
      const timer = setInterval(() => {
        attempts += 1;
        if (fillSearch() || attempts >= maxAttempts) {
          clearInterval(timer);
          if (attempts >= maxAttempts) {
            postStatus('failed');
          }
        }
      }, 700);

      return true;
    })();
    true;
  `;
};

export const buildKartyRatowniczeInjectionScript = (registration: string): string => {
  const query = JSON.stringify(registration.trim());

  return `
    (function() {
      const registration = ${query};
      if (!registration) return true;
      let hasPostedStatus = false;

      const postStatus = (status) => {
        if (hasPostedStatus) return;
        hasPostedStatus = true;
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'prefill-status', target: 'karty-ratownicze', status }));
        }
      };

      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const fillSearch = () => {
        const input = [
          ...document.querySelectorAll('input[type="text"], input[placeholder*="Numer rejestracyjny"], input[placeholder*="rejestracyjny"], input[placeholder*="rejestracja"]'),
        ].find(isVisible);

        if (!input) return false;

        input.focus();
        input.value = registration;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        const form = input.closest('form');
        const searchButton = [
          ...document.querySelectorAll('button, input[type="submit"], [role="button"]'),
        ].find((element) => isVisible(element) && /szukaj/i.test((element.textContent || element.value || '').trim()));

        if (searchButton && typeof searchButton.click === 'function') {
          searchButton.click();
        } else if (form && typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else if (form && typeof form.submit === 'function') {
          form.submit();
        }

        postStatus('success');
        return true;
      };

      let attempts = 0;
      const maxAttempts = 20;
      const timer = setInterval(() => {
        attempts += 1;
        if (fillSearch() || attempts >= maxAttempts) {
          clearInterval(timer);
          if (attempts >= maxAttempts) {
            postStatus('failed');
          }
        }
      }, 500);

      return true;
    })();
    true;
  `;
};