import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USAGE_STORAGE_KEY = '@firefighter_category_usage';

interface CategoryUsage {
  [key: string]: number;
}

interface UsageContextType {
  usageData: CategoryUsage;
  trackUsage: (categoryKey: string) => void;
  getMostUsed: (limit?: number) => string[];
  clearUsageData: () => void;
}

const UsageContext = createContext<UsageContextType | undefined>(undefined);

export const UsageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usageData, setUsageData] = useState<CategoryUsage>({});

  // Load usage data from storage on mount
  useEffect(() => {
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    try {
      const stored = await AsyncStorage.getItem(USAGE_STORAGE_KEY);
      if (stored) {
        setUsageData(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading usage data:', error);
    }
  };

  const saveUsageData = async (data: CategoryUsage) => {
    try {
      await AsyncStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving usage data:', error);
    }
  };

  const trackUsage = useCallback((categoryKey: string) => {
    setUsageData(prev => {
      const newData = {
        ...prev,
        [categoryKey]: (prev[categoryKey] || 0) + 1,
      };
      saveUsageData(newData);
      return newData;
    });
  }, []);

  const getMostUsed = useCallback((limit: number = 4): string[] => {
    const sorted = Object.entries(usageData)
      .sort(([, a], [, b]) => b - a)
      .map(([key]) => key);
    return sorted.slice(0, limit);
  }, [usageData]);

  const clearUsageData = useCallback(async () => {
    setUsageData({});
    try {
      await AsyncStorage.removeItem(USAGE_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing usage data:', error);
    }
  }, []);

  return (
    <UsageContext.Provider value={{ usageData, trackUsage, getMostUsed, clearUsageData }}>
      {children}
    </UsageContext.Provider>
  );
};

export const useUsage = (): UsageContextType => {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error('useUsage must be used within a UsageProvider');
  }
  return context;
};
