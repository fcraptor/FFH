import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { SzybkiPomocnikData, ContentItem, CategoryMetaData, SubItem, ImageItem, CalculatorConfigRecord, CalculatorFieldRecord, CalculatorResultRecord, AboutAppData } from '../types';
import { CalculatorTable, CalculatorTableRow, CalculatorTableMatrix, LookupContext } from '../types/calculator';

// Google Sheets configuration - direct access without backend
const GOOGLE_SHEET_ID = '1hy7Mfdwf8QxF59XT64eSp0EgctMTy7hO9oXoYUyRXZA';

const CACHE_KEYS = {
  SZYBKI_POMOCNIK: '@firefighter_szybki_pomocnik',
  PROCEDURY: '@firefighter_procedury',
  BIURO: '@firefighter_biuro',
  CALCULATORS: '@firefighter_calculators',
  CALCULATOR_FIELDS: '@firefighter_calculator_fields',
  CALCULATOR_RESULTS: '@firefighter_calculator_results',
  CALCULATOR_TABLES: '@firefighter_calculator_tables',
  CALCULATOR_TABLE_ROWS: '@firefighter_calculator_table_rows',
  CALCULATOR_TABLE_MATRIX: '@firefighter_calculator_table_matrix',
  ABOUT_APP: '@firefighter_about_app',
  CATEGORIES: '@firefighter_categories',
  LAST_SYNC: '@firefighter_last_sync',
  HAS_INITIAL_DATA: '@firefighter_has_initial_data',
};

const OFFLINE_ROOT = `${FileSystem.documentDirectory}firefighter-offline`;
const OFFLINE_IMAGES_DIR = `${OFFLINE_ROOT}/images`;
const OFFLINE_PDFS_DIR = `${OFFLINE_ROOT}/pdfs`;

// Helper function to get CSV URL for a sheet
const getSheetCsvUrl = (sheetName: string): string => {
  return `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
};

const extractDriveFileId = (url: string): string | null => {
  if (!url) return null;

  let match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match) return match[1];

  match = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (match) return match[1];

  match = url.match(/[?&]id=([^&]+)/);
  if (match) return match[1];

  return null;
};

const getDriveDownloadUrl = (url: string): string => {
  const fileId = extractDriveFileId(url);
  if (!fileId) return url;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const ensureOfflineDirectories = async (): Promise<void> => {
  const [imagesInfo, pdfsInfo] = await Promise.all([
    FileSystem.getInfoAsync(OFFLINE_IMAGES_DIR),
    FileSystem.getInfoAsync(OFFLINE_PDFS_DIR),
  ]);

  if (!imagesInfo.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_IMAGES_DIR, { intermediates: true });
  }

  if (!pdfsInfo.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_PDFS_DIR, { intermediates: true });
  }
};

const downloadFileIfNeeded = async (sourceUrl: string, directory: string, fallbackExtension: string): Promise<string> => {
  if (!sourceUrl || sourceUrl.startsWith('file://')) return sourceUrl;
  if (Platform.OS === 'web') return sourceUrl;

  await ensureOfflineDirectories();

  const cleanUrl = sourceUrl.split('?')[0];
  const extensionMatch = cleanUrl.match(/\.(jpg|jpeg|png|webp|pdf)$/i);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : fallbackExtension;
  const targetUri = `${directory}/${hashString(sourceUrl)}${extension}`;

  const fileInfo = await FileSystem.getInfoAsync(targetUri);
  if (fileInfo.exists) {
    return targetUri;
  }

  const downloadResult = await FileSystem.downloadAsync(sourceUrl, targetUri);
  return downloadResult.uri;
};

const localizeSubItems = async (items?: SubItem[]): Promise<{ items?: SubItem[]; imageCount: number; pdfCount: number }> => {
  if (!items || items.length === 0) {
    return { items, imageCount: 0, pdfCount: 0 };
  }

  let imageCount = 0;
  let pdfCount = 0;

  const localizedItems = await Promise.all(items.map(async (item) => {
    if (item.type === 'image' && item.url) {
      imageCount += 1;
      return {
        ...item,
        url: await downloadFileIfNeeded(getFullImageUrl(item.url), OFFLINE_IMAGES_DIR, '.jpg'),
      };
    }

    if (item.type === 'pdf_link' && item.url) {
      pdfCount += 1;
      return {
        ...item,
        url: await downloadFileIfNeeded(getDriveDownloadUrl(item.url), OFFLINE_PDFS_DIR, '.pdf'),
      };
    }

    return item;
  }));

  return { items: localizedItems, imageCount, pdfCount };
};

const localizeContentItem = async (content: ContentItem): Promise<{ content: ContentItem; imageCount: number; pdfCount: number }> => {
  let imageCount = 0;
  let pdfCount = 0;
  const subItemsResult = await localizeSubItems(content.sub_items);

  imageCount += subItemsResult.imageCount;
  pdfCount += subItemsResult.pdfCount;

  if (content.type === 'image') {
    imageCount += 1;
    return {
      content: {
        ...content,
        url: await downloadFileIfNeeded(getFullImageUrl(content.url), OFFLINE_IMAGES_DIR, '.jpg'),
        sub_items: subItemsResult.items,
      },
      imageCount,
      pdfCount,
    };
  }

  if (content.type === 'images') {
    const urls = await Promise.all(content.urls.map(async (imageItem) => {
      imageCount += 1;
      return {
        ...imageItem,
        url: await downloadFileIfNeeded(getFullImageUrl(imageItem.url), OFFLINE_IMAGES_DIR, '.jpg'),
      };
    }));

    return {
      content: {
        ...content,
        urls,
        sub_items: subItemsResult.items,
      },
      imageCount,
      pdfCount,
    };
  }

  if (content.type === 'mixed') {
    const items = await Promise.all(content.items.map(async (item) => {
      if (item.type === 'image' && item.url) {
        imageCount += 1;
        return {
          ...item,
          url: await downloadFileIfNeeded(getFullImageUrl(item.url), OFFLINE_IMAGES_DIR, '.jpg'),
        };
      }

      return item;
    }));

    return {
      content: {
        ...content,
        items,
        sub_items: subItemsResult.items,
      },
      imageCount,
      pdfCount,
    };
  }

  if (content.type === 'pdf_link') {
    pdfCount += 1;
    return {
      content: {
        ...content,
        url: await downloadFileIfNeeded(getDriveDownloadUrl(content.url), OFFLINE_PDFS_DIR, '.pdf'),
        sub_items: subItemsResult.items,
      },
      imageCount,
      pdfCount,
    };
  }

  return {
    content: {
      ...content,
      sub_items: subItemsResult.items,
    },
    imageCount,
    pdfCount,
  };
};

// Helper function to convert Google Drive links to direct image URLs
const convertGDriveUrl = (url: string): string => {
  if (!url) return '';
  
  // Extract file ID from various Google Drive URL formats
  let fileId: string | null = null;
  
  // Format: https://drive.google.com/file/d/FILE_ID/view?usp=...
  let match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match) {
    fileId = match[1];
  }
  
  // Format: https://drive.google.com/open?id=FILE_ID
  if (!fileId) {
    match = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
    if (match) {
      fileId = match[1];
    }
  }
  
  // Format: https://drive.google.com/uc?export=view&id=FILE_ID or id=FILE_ID
  if (!fileId) {
    match = url.match(/[?&]id=([^&]+)/);
    if (match) {
      fileId = match[1];
    }
  }
  
  if (fileId) {
    // Use Google Drive thumbnail/export URL - more reliable for mobile
    // The 's0' parameter means full size, no cropping
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=s1000`;
  }
  
  return url;
};

// Robust CSV parser that handles multiline quoted values
const parseCSV = (csvText: string): Record<string, string>[] => {
  const result: Record<string, string>[] = [];
  const rows: string[][] = [];
  
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  
  // Parse entire CSV character by character
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentCell += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of cell
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      // End of row
      if (char === '\r') i++; // Skip \n in \r\n
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else if (char === '\r' && !inQuotes) {
      // End of row (old Mac style)
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  
  // Don't forget last cell/row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }
  
  if (rows.length < 2) return [];
  
  const headers = rows[0];
  
  for (let i = 1; i < rows.length; i++) {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header.trim()] = rows[i][index] || '';
    });
    result.push(row);
  }
  
  return result;
};

// Parse szybki_pomocnik CSV data
const parseSzybkiPomocnikCSV = (csvText: string): SzybkiPomocnikData => {
  const rows = parseCSV(csvText);
  const result: SzybkiPomocnikData = {};
  const subItems: Record<string, Record<string, SubItem[]>> = {};
  
  for (const row of rows) {
    const kategoria = row['kategoria']?.trim() || '';
    const klucz = row['klucz']?.trim() || '';
    const typ = (row['typ']?.trim() || '').toLowerCase();
    const tresc = row['tresc']?.trim() || '';
    const etykieta = row['etykieta']?.trim() || '';
    const tytul = row['tytul']?.trim() || '';
    const ikona = row['ikona']?.trim() || '';
    
    if (!kategoria || !klucz || !typ) continue;
    
    // Normalize category key
    const kategoriaKey = kategoria
      .toLowerCase()
      .replace(/ł/g, 'l')
      .replace(/ą/g, 'a')
      .replace(/ę/g, 'e')
      .replace(/ó/g, 'o')
      .replace(/ś/g, 's')
      .replace(/ć/g, 'c')
      .replace(/ż/g, 'z')
      .replace(/ź/g, 'z')
      .replace(/ń/g, 'n')
      .replace(/ /g, '_');
    
    // Initialize category if needed
    if (!result[kategoriaKey]) {
      result[kategoriaKey] = {
        _meta: {
          title: kategoria,
          key: kategoriaKey,
          tabs: [],
          ikona: ikona || 'folder-outline', // Take icon from first row of category
        },
      };
    } else if (ikona && !result[kategoriaKey]._meta.ikona) {
      // If first row didn't have icon but this one does, use it
      result[kategoriaKey]._meta.ikona = ikona;
    }
    
    // Check if this is a sub-item (contains dot)
    if (klucz.includes('.')) {
      const [parentKey, subKey] = klucz.split('.', 2);
      
      if (!subItems[kategoriaKey]) {
        subItems[kategoriaKey] = {};
      }
      if (!subItems[kategoriaKey][parentKey]) {
        subItems[kategoriaKey][parentKey] = [];
      }
      
      const subContent: SubItem = {
        key: subKey,
        label: etykieta || subKey.toUpperCase().replace(/_/g, ' '),
        type: typ === 'image' ? 'image' : typ === 'pdf_link' || typ === 'pdf' ? 'pdf_link' : 'text',
      };
      
      if (typ === 'image') {
        subContent.url = convertGDriveUrl(tresc);
      } else if (typ === 'pdf_link' || typ === 'pdf') {
        let pdfUrl = tresc;
        const pdfMatch = tresc.match(/\/d\/([^/]+)\//);
        if (pdfMatch) {
          pdfUrl = `https://drive.google.com/file/d/${pdfMatch[1]}/preview`;
        }
        subContent.url = pdfUrl;
      } else {
        subContent.content = tresc;
      }
      
      subItems[kategoriaKey][parentKey].push(subContent);
      continue;
    }
    
    // Add tab to metadata
    const tabExists = result[kategoriaKey]._meta!.tabs.some(t => t.key === klucz);
    if (!tabExists) {
      result[kategoriaKey]._meta!.tabs.push({
        key: klucz,
        title: etykieta || klucz,
      });
    }
    
    // Create content item
    if (typ === 'image') {
      const imageUrl = convertGDriveUrl(tresc);
      
      // Check if key already exists (multiple items - need mixed content)
      if (result[kategoriaKey][klucz]) {
        const existing = result[kategoriaKey][klucz] as ContentItem;
        if (existing.type === 'image') {
          // Convert to images array
          (result[kategoriaKey][klucz] as any) = {
            type: 'images',
            urls: [
              { url: existing.url, title: (existing as any).title || '' },
              { url: imageUrl, title: tytul },
            ],
            sub_items: existing.sub_items,
          };
        } else if (existing.type === 'images') {
          (existing as any).urls.push({ url: imageUrl, title: tytul });
        } else if (existing.type === 'text') {
          // Text exists, now adding image - convert to mixed
          (result[kategoriaKey][klucz] as any) = {
            type: 'mixed',
            items: [
              { type: 'text', content: existing.content },
              { type: 'image', url: imageUrl, title: tytul },
            ],
          };
        } else if (existing.type === 'mixed') {
          // Already mixed, add image
          (existing as any).items.push({ type: 'image', url: imageUrl, title: tytul });
        }
      } else {
        result[kategoriaKey][klucz] = {
          type: 'image',
          url: imageUrl,
          title: tytul,
        } as ContentItem;
      }
    } else if (typ === 'pdf_link' || typ === 'pdf') {
      let pdfUrl = tresc;
      const pdfMatch = tresc.match(/\/d\/([^/]+)\//);
      if (pdfMatch) {
        pdfUrl = `https://drive.google.com/file/d/${pdfMatch[1]}/preview`;
      }
      result[kategoriaKey][klucz] = {
        type: 'pdf_link',
        url: pdfUrl,
      } as ContentItem;
    } else if (typ === 'kalkulator' || typ === 'calculator') {
      result[kategoriaKey][klucz] = {
        type: 'calculator',
        calculator_id: tresc,
      } as ContentItem;
    } else {
      // Text type - check if entry exists
      if (result[kategoriaKey][klucz]) {
        const existing = result[kategoriaKey][klucz] as ContentItem;
        if (existing.type === 'text') {
          // Append text
          (existing as any).content += '\n\n' + tresc;
        } else if (existing.type === 'image') {
          // Image exists, adding text - convert to mixed
          (result[kategoriaKey][klucz] as any) = {
            type: 'mixed',
            items: [
              { type: 'image', url: existing.url, title: (existing as any).title || '' },
              { type: 'text', content: tresc },
            ],
          };
        } else if (existing.type === 'mixed') {
          // Already mixed, add text
          (existing as any).items.push({ type: 'text', content: tresc });
        }
      } else {
        result[kategoriaKey][klucz] = {
          type: 'text',
          content: tresc,
        } as ContentItem;
      }
    }
  }
  
  // Merge sub-items into main items
  for (const kategoriaKey in subItems) {
    for (const parentKey in subItems[kategoriaKey]) {
      if (result[kategoriaKey] && result[kategoriaKey][parentKey]) {
        (result[kategoriaKey][parentKey] as any).sub_items = subItems[kategoriaKey][parentKey];
      }
    }
  }
  
  return result;
};

// Parse procedury CSV data
const parseProceduryCSV = (csvText: string): any[] => {
  const rows = parseCSV(csvText);
  return rows.map(row => {
    const pdfLink = row['pdf_link'] || '';
    // Convert Google Drive link to preview format
    let processedPdfLink = pdfLink;
    const pdfMatch = pdfLink.match(/\/d\/([^/]+)\//);
    if (pdfMatch) {
      processedPdfLink = `https://drive.google.com/file/d/${pdfMatch[1]}/preview`;
    }
    
    return {
      tytul: row['tytul'] || '',
      pdf_link: processedPdfLink,
      ikona: row['ikona']?.trim() || 'document-text', // Default icon
    };
  }).filter(item => item.tytul && item.pdf_link);
};

const parseCalculatorConfigCSV = (csvText: string): CalculatorConfigRecord[] => {
  const rows = parseCSV(csvText);

  return rows
    .filter((row) => row.calculator_id?.trim())
    .filter((row) => (row.status?.trim().toLowerCase() || 'active') !== 'hidden')
    .map((row) => ({ ...row })) as CalculatorConfigRecord[];
};

const parseCalculatorFieldsCSV = (csvText: string): CalculatorFieldRecord[] => {
  const rows = parseCSV(csvText);

  return rows
    .filter((row) => row.field_id?.trim() && row.calculator_id?.trim())
    .filter((row) => (row.status?.trim().toLowerCase() || 'active') !== 'hidden')
    .map((row) => ({ ...row })) as CalculatorFieldRecord[];
};

const parseCalculatorResultsCSV = (csvText: string): CalculatorResultRecord[] => {
  const rows = parseCSV(csvText);

  return rows
    .filter((row) => row.result_id?.trim() && row.calculator_id?.trim())
    .filter((row) => (row.status?.trim().toLowerCase() || 'active') !== 'hidden')
    .map((row) => ({ ...row })) as CalculatorResultRecord[];
};

// Parse About App CSV data (O_Aplikacji sheet)
const parseAboutAppCSV = (csvText: string): AboutAppData => {
  const rows = parseCSV(csvText);
  
  // Default values
  const result: AboutAppData = {
    tytul: 'FireFighter Helper',
    wersja: '1.0.0',
    opis: 'Podręcznik PSP/OSP dla strażaków',
    kontakt: '',
  };
  
  // The sheet should have columns: Tytuł, Wersja, Opis, Kontakt
  // Take the first row of data
  if (rows.length > 0) {
    const row = rows[0];
    // Try different column name variations (Polish characters)
    result.tytul = row['Tytuł'] || row['Tytul'] || row['tytul'] || result.tytul;
    result.wersja = row['Wersja'] || row['wersja'] || result.wersja;
    result.opis = row['Opis'] || row['opis'] || result.opis;
    result.kontakt = row['Kontakt'] || row['kontakt'] || result.kontakt;
  }
  
  return result;
};

// Parse biuro CSV data
const parseBiuroCSV = (csvText: string): any => {
  const rows = parseCSV(csvText);
  const result: Record<string, any> = {};
  
  // Look for subtitle row (first row with podtytul_AKCJA or podtytul_BIURO)
  let subtitles: { akcja?: string; biuro?: string } = {};
  
  for (const row of rows) {
    // Check for subtitle columns
    const podtytulAkcja = row['podtytul_AKCJA']?.trim();
    const podtytulBiuro = row['podtytul_BIURO']?.trim();
    
    if (podtytulAkcja || podtytulBiuro) {
      subtitles = {
        akcja: podtytulAkcja || subtitles.akcja,
        biuro: podtytulBiuro || subtitles.biuro,
      };
    }
    
    const klucz = row['klucz']?.trim() || '';
    const tytul = row['tytul']?.trim() || '';
    const podTytul = row['pod_tytul']?.trim() || row['pod_tutul']?.trim() || ''; // Handle typo in sheet
    const pdfLink = row['pdf_link']?.trim() || '';
    const ikona = row['ikona']?.trim() || '';
    
    // Ignore internal metadata rows (e.g. subtitle rows or other helper rows)
    if (!klucz || klucz.startsWith('_')) continue;
    
    // Skip entries without valid PDF link
    if (!pdfLink || pdfLink === 'brak') continue;
    
    // Convert Google Drive link to preview format
    let processedPdfLink = pdfLink;
    const pdfMatch = pdfLink.match(/\/d\/([^/]+)\//);
    if (pdfMatch) {
      processedPdfLink = `https://drive.google.com/file/d/${pdfMatch[1]}/preview`;
    }
    
    result[klucz] = {
      tytul,
      pod_tytul: podTytul,
      pdf_link: processedPdfLink,
      ikona: ikona || 'document-text', // Default icon if not specified
    };
  }
  
  // Add subtitles to result
  result['_subtitles'] = subtitles;
  
  return result;
};

// Get main page subtitles from biuro data
export interface MainPageSubtitles {
  akcja: string;
  biuro: string;
}

export const fetchMainPageSubtitles = async (): Promise<MainPageSubtitles> => {
  try {
    const biuroData = await fetchBiuro();
    const subtitles = biuroData?._subtitles || {};
    
    return {
      akcja: subtitles.akcja || 'Szybki pomocnik, procedury',
      biuro: subtitles.biuro || 'Testy, pogadanki',
    };
  } catch (error) {
    console.error('Error fetching subtitles:', error);
    return {
      akcja: 'Szybki pomocnik, procedury',
      biuro: 'Testy, pogadanki',
    };
  }
};

// Fetch data from Google Sheets
const fetchFromGoogleSheets = async (sheetName: string): Promise<string> => {
  const url = getSheetCsvUrl(sheetName);
  const response = await axios.get(url, { 
    timeout: 15000,
    responseType: 'text',
  });
  return response.data;
};

// Check if we have any cached data
export const hasInitialData = async (): Promise<boolean> => {
  try {
    const hasData = await AsyncStorage.getItem(CACHE_KEYS.HAS_INITIAL_DATA);
    return hasData === 'true';
  } catch {
    return false;
  }
};

// Mark that we have initial data
const setHasInitialData = async (): Promise<void> => {
  await AsyncStorage.setItem(CACHE_KEYS.HAS_INITIAL_DATA, 'true');
};

// Fetch szybki pomocnik data
export const fetchSzybkiPomocnik = async (forceRefresh = false): Promise<SzybkiPomocnikData | null> => {
  try {
    // Try cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.SZYBKI_POMOCNIK);
      if (cached) {
        return JSON.parse(cached);
      }
    }
    
    // Fetch from Google Sheets
    const csvText = await fetchFromGoogleSheets('szybki_pomocnik');
    const data = parseSzybkiPomocnikCSV(csvText);
    
    // Cache the data
    await AsyncStorage.setItem(CACHE_KEYS.SZYBKI_POMOCNIK, JSON.stringify(data));
    await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, new Date().toISOString());
    await setHasInitialData();
    
    return data;
  } catch (error) {
    console.error('Error fetching szybki pomocnik:', error);
    
    // Return cached data on error
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.SZYBKI_POMOCNIK);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
    
    return null;
  }
};

// Fetch procedury data
export const fetchProcedury = async (forceRefresh = false): Promise<any[] | null> => {
  try {
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.PROCEDURY);
      if (cached) {
        return JSON.parse(cached);
      }
    }
    
    const csvText = await fetchFromGoogleSheets('procedury');
    const data = parseProceduryCSV(csvText);
    
    await AsyncStorage.setItem(CACHE_KEYS.PROCEDURY, JSON.stringify(data));
    
    return data;
  } catch (error) {
    console.error('Error fetching procedury:', error);
    
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.PROCEDURY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
    
    return null;
  }
};

// Fetch biuro data
export const fetchBiuro = async (forceRefresh = false): Promise<any | null> => {
  try {
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.BIURO);
      if (cached) {
        return JSON.parse(cached);
      }
    }
    
    const csvText = await fetchFromGoogleSheets('biuro');
    const data = parseBiuroCSV(csvText);
    
    await AsyncStorage.setItem(CACHE_KEYS.BIURO, JSON.stringify(data));
    
    return data;
  } catch (error) {
    console.error('Error fetching biuro:', error);
    
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.BIURO);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
    
    return null;
  }
};

export const fetchCalculators = async (forceRefresh = false): Promise<CalculatorConfigRecord[]> => {
  try {
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATORS);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const csvText = await fetchFromGoogleSheets('calculators');
    const data = parseCalculatorConfigCSV(csvText);
    await AsyncStorage.setItem(CACHE_KEYS.CALCULATORS, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Error fetching calculators:', error);

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATORS);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    return [];
  }
};

export const fetchCalculatorFields = async (forceRefresh = false): Promise<CalculatorFieldRecord[]> => {
  try {
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATOR_FIELDS);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const csvText = await fetchFromGoogleSheets('calculator_fields');
    const data = parseCalculatorFieldsCSV(csvText);
    await AsyncStorage.setItem(CACHE_KEYS.CALCULATOR_FIELDS, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Error fetching calculator fields:', error);

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATOR_FIELDS);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    return [];
  }
};

export const fetchCalculatorResults = async (forceRefresh = false): Promise<CalculatorResultRecord[]> => {
  try {
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATOR_RESULTS);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const csvText = await fetchFromGoogleSheets('calculator_results');
    const data = parseCalculatorResultsCSV(csvText);
    await AsyncStorage.setItem(CACHE_KEYS.CALCULATOR_RESULTS, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Error fetching calculator results:', error);

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATOR_RESULTS);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    return [];
  }
};

// ============================================================
// CALCULATOR LOOKUP TABLES (OPTIONAL)
// ============================================================

// Parse calculator_tables CSV
const parseCalculatorTablesCSV = (csvText: string): CalculatorTable[] => {
  const records = parseCSV(csvText);
  return records
    .filter((row) => row.table_id?.trim())
    .map((row) => ({
      table_id: row.table_id?.trim() || '',
      table_name: row.table_name?.trim() || '',
      table_type: (row.table_type?.trim() as CalculatorTable['table_type']) || 'map',
      key_type: (row.key_type?.trim() as CalculatorTable['key_type']) || 'string',
      row_key_type: (row.row_key_type?.trim() as CalculatorTable['row_key_type']) || 'string',
      col_key_type: (row.col_key_type?.trim() as CalculatorTable['col_key_type']) || 'string',
      value_type: (row.value_type?.trim() as CalculatorTable['value_type']) || 'number',
      status: row.status?.trim() || 'active',
      description: row.description?.trim() || '',
    }));
};

// Parse calculator_table_rows CSV
const parseCalculatorTableRowsCSV = (csvText: string): CalculatorTableRow[] => {
  const records = parseCSV(csvText);
  return records
    .filter((row) => row.row_id?.trim() && row.table_id?.trim())
    .map((row) => ({
      row_id: row.row_id?.trim() || '',
      table_id: row.table_id?.trim() || '',
      row_order: row.row_order?.trim() || '0',
      key: row.key?.trim() || '',
      min_key: row.min_key?.trim() || '',
      max_key: row.max_key?.trim() || '',
      value: row.value?.trim() || '',
      label: row.label?.trim() || '',
      status: row.status?.trim() || 'active',
    }));
};

// Parse calculator_table_matrix CSV
const parseCalculatorTableMatrixCSV = (csvText: string): CalculatorTableMatrix[] => {
  const records = parseCSV(csvText);
  return records
    .filter((row) => row.matrix_id?.trim() && row.table_id?.trim())
    .map((row) => ({
      matrix_id: row.matrix_id?.trim() || '',
      table_id: row.table_id?.trim() || '',
      row_key: row.row_key?.trim() || '',
      col_key: row.col_key?.trim() || '',
      value: row.value?.trim() || '',
      status: row.status?.trim() || 'active',
    }));
};

// Fetch calculator tables (optional - returns empty if sheet doesn't exist)
export const fetchCalculatorTables = async (forceRefresh = false): Promise<CalculatorTable[]> => {
  try {
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATOR_TABLES);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const csvText = await fetchFromGoogleSheets('calculator_tables');
    const data = parseCalculatorTablesCSV(csvText);
    await AsyncStorage.setItem(CACHE_KEYS.CALCULATOR_TABLES, JSON.stringify(data));
    return data;
  } catch (error) {
    // Sheet might not exist - this is OK, return empty array
    console.log('Calculator tables sheet not found or error:', error);
    
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATOR_TABLES);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    return [];
  }
};

// Fetch calculator table rows (optional)
export const fetchCalculatorTableRows = async (forceRefresh = false): Promise<CalculatorTableRow[]> => {
  try {
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATOR_TABLE_ROWS);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const csvText = await fetchFromGoogleSheets('calculator_table_rows');
    const data = parseCalculatorTableRowsCSV(csvText);
    await AsyncStorage.setItem(CACHE_KEYS.CALCULATOR_TABLE_ROWS, JSON.stringify(data));
    return data;
  } catch (error) {
    console.log('Calculator table rows sheet not found or error:', error);
    
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATOR_TABLE_ROWS);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    return [];
  }
};

// Fetch calculator table matrix (optional)
export const fetchCalculatorTableMatrix = async (forceRefresh = false): Promise<CalculatorTableMatrix[]> => {
  try {
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATOR_TABLE_MATRIX);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const csvText = await fetchFromGoogleSheets('calculator_table_matrix');
    const data = parseCalculatorTableMatrixCSV(csvText);
    await AsyncStorage.setItem(CACHE_KEYS.CALCULATOR_TABLE_MATRIX, JSON.stringify(data));
    return data;
  } catch (error) {
    console.log('Calculator table matrix sheet not found or error:', error);
    
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CALCULATOR_TABLE_MATRIX);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    return [];
  }
};

// Fetch all lookup data at once (convenience function)
export const fetchCalculatorLookups = async (forceRefresh = false): Promise<LookupContext> => {
  const [tables, tableRows, tableMatrix] = await Promise.all([
    fetchCalculatorTables(forceRefresh),
    fetchCalculatorTableRows(forceRefresh),
    fetchCalculatorTableMatrix(forceRefresh),
  ]);
  
  return { tables, tableRows, tableMatrix };
};
export const fetchAboutApp = async (forceRefresh = false): Promise<AboutAppData> => {
  const defaultData: AboutAppData = {
    tytul: 'FireFighter Helper',
    wersja: '1.0.0',
    opis: 'Podręcznik PSP/OSP dla strażaków',
    kontakt: '',
  };

  try {
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.ABOUT_APP);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const csvText = await fetchFromGoogleSheets('O_Aplikacji');
    const data = parseAboutAppCSV(csvText);
    await AsyncStorage.setItem(CACHE_KEYS.ABOUT_APP, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Error fetching about app data:', error);

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.ABOUT_APP);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    return defaultData;
  }
};

// Category metadata interface
export interface CategoryMeta {
  key: string;
  title: string;
  tabs: { key: string; title: string }[];
  ikona?: string; // Optional icon from spreadsheet
}

// Fetch categories (extracted from szybki_pomocnik data)
export const fetchCategories = async (forceRefresh = false): Promise<CategoryMeta[]> => {
  try {
    // Try cache first
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CATEGORIES);
      if (cached) {
        return JSON.parse(cached);
      }
    }
    
    // Get szybki pomocnik data and extract categories
    const data = await fetchSzybkiPomocnik(forceRefresh);
    if (!data) return [];
    
    const categories: CategoryMeta[] = [];
    
    for (const key in data) {
      const categoryData = data[key];
      if (categoryData._meta) {
        categories.push({
          key: categoryData._meta.key,
          title: categoryData._meta.title,
          tabs: categoryData._meta.tabs,
          ikona: categoryData._meta.ikona, // Include icon from spreadsheet
        });
      }
    }
    
    // Cache categories
    await AsyncStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories));
    
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CATEGORIES);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
    
    return [];
  }
};

// Sync all data
export const syncAllData = async (): Promise<boolean> => {
  try {
    await Promise.all([
      fetchSzybkiPomocnik(true),
      fetchProcedury(true),
      fetchBiuro(true),
      fetchCalculators(true),
      fetchCalculatorFields(true),
      fetchCalculatorResults(true),
      fetchAboutApp(true),
    ]);
    return true;
  } catch (error) {
    console.error('Error syncing data:', error);
    return false;
  }
};

export const downloadAkcjaDataForOffline = async (): Promise<{ success: boolean; imageCount: number; pdfCount: number }> => {
  try {
    const [szybkiPomocnikData, proceduryData] = await Promise.all([
      fetchSzybkiPomocnik(true),
      fetchProcedury(true),
      fetchCalculators(true),
      fetchCalculatorFields(true),
      fetchCalculatorResults(true),
    ]);

    if (!szybkiPomocnikData || !proceduryData) {
      return { success: false, imageCount: 0, pdfCount: 0 };
    }

    const localizedSzybkiPomocnik = JSON.parse(JSON.stringify(szybkiPomocnikData)) as SzybkiPomocnikData;
    let imageCount = 0;
    let pdfCount = 0;

    for (const categoryKey of Object.keys(localizedSzybkiPomocnik)) {
      const categoryData = localizedSzybkiPomocnik[categoryKey];
      const contentKeys = Object.keys(categoryData).filter((key) => key !== '_meta');

      for (const contentKey of contentKeys) {
        const content = categoryData[contentKey] as ContentItem | undefined;
        if (!content || typeof content !== 'object' || !('type' in content)) continue;

        const localized = await localizeContentItem(content);
        categoryData[contentKey] = localized.content;
        imageCount += localized.imageCount;
        pdfCount += localized.pdfCount;
      }
    }

    const localizedProcedury = await Promise.all(proceduryData.map(async (procedure) => {
      pdfCount += 1;
      return {
        ...procedure,
        pdf_link: await downloadFileIfNeeded(getDriveDownloadUrl(procedure.pdf_link), OFFLINE_PDFS_DIR, '.pdf'),
      };
    }));

    await AsyncStorage.multiSet([
      [CACHE_KEYS.SZYBKI_POMOCNIK, JSON.stringify(localizedSzybkiPomocnik)],
      [CACHE_KEYS.PROCEDURY, JSON.stringify(localizedProcedury)],
      [CACHE_KEYS.LAST_SYNC, new Date().toISOString()],
      [CACHE_KEYS.HAS_INITIAL_DATA, 'true'],
    ]);

    return { success: true, imageCount, pdfCount };
  } catch (error) {
    console.error('Error downloading Akcja data for offline:', error);
    return { success: false, imageCount: 0, pdfCount: 0 };
  }
};

// Background refresh - loads cache first, then updates in background
export const refreshDataInBackground = async (): Promise<void> => {
  // This is called after showing cached data
  // It silently tries to refresh from Google Sheets
  try {
    await syncAllData();
  } catch (error) {
    // Silently fail - user will see cached data
    console.log('Background refresh failed, using cached data');
  }
};

// Get last sync time
export const getLastSyncTime = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
};

// Clear cache
export const clearCache = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    CACHE_KEYS.SZYBKI_POMOCNIK,
    CACHE_KEYS.PROCEDURY,
    CACHE_KEYS.BIURO,
    CACHE_KEYS.CALCULATORS,
    CACHE_KEYS.CALCULATOR_FIELDS,
    CACHE_KEYS.CALCULATOR_RESULTS,
    CACHE_KEYS.ABOUT_APP,
    CACHE_KEYS.CATEGORIES,
    CACHE_KEYS.LAST_SYNC,
    CACHE_KEYS.HAS_INITIAL_DATA,
  ]);
};

// Helper to get full image URL - converts any Google Drive format to working thumbnail URL
export const getFullImageUrl = (url: string): string => {
  if (!url) return '';
  
  // If it's already a thumbnail URL, return as-is
  if (url.includes('thumbnail?id=')) {
    return url;
  }
  
  // Convert lh3.googleusercontent format to thumbnail
  let match = url.match(/lh3\.googleusercontent\.com\/d\/([^=?/]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=s1000`;
  }
  
  // Convert uc?export=view format to thumbnail  
  match = url.match(/[?&]id=([^&]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=s1000`;
  }
  
  // Convert drive.google.com/file/d/ format to thumbnail
  match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=s1000`;
  }
  
  return url;
};
