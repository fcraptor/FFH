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