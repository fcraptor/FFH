// ============================================================
// DYNAMIC CALCULATOR SCREEN
// Wrapper that uses UniversalCalculatorScreen for full functionality
// Maintains backward compatibility with existing code
// ============================================================

import React from 'react';
import { UniversalCalculatorScreen } from './UniversalCalculatorScreen';

interface DynamicCalculatorScreenProps {
  calculatorId: string;
  colors: {
    border: string;
    card: string;
    error: string;
    primary: string;
    surface: string;
    text: string;
    textSecondary: string;
    background?: string;
  };
}

// Re-export UniversalCalculatorScreen as DynamicCalculatorScreen for backward compatibility
export function DynamicCalculatorScreen({ calculatorId, colors }: DynamicCalculatorScreenProps) {
  return (
    <UniversalCalculatorScreen
      calculatorId={calculatorId}
      colors={colors}
    />
  );
}

// Also export the original component for direct use
export { UniversalCalculatorScreen };
