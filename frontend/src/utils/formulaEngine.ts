// ============================================================
// UNIVERSAL CALCULATOR FORMULA ENGINE
// Safe formula parser with lookups, conditions, and text functions
// ============================================================

import {
  CalculatorTable,
  CalculatorTableRow,
  CalculatorTableMatrix,
  FieldValueWithMeta,
  FormulaContext,
  FormulaEvalResult,
  LookupContext,
} from '../types/calculator';

// ============================================================
// SAFE TOKENIZER
// ============================================================

type TokenType = 
  | 'NUMBER' 
  | 'STRING' 
  | 'IDENTIFIER' 
  | 'OPERATOR' 
  | 'LPAREN' 
  | 'RPAREN' 
  | 'COMMA' 
  | 'DOT'
  | 'COMPARISON'
  | 'LOGICAL';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const tokenize = (expression: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < expression.length) {
    const char = expression[i];
    
    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    
    // String literals (double or single quotes, including fancy/curly quotes from Google Sheets)
    // Unicode: " = \u201C, " = \u201D, ' = \u2018, ' = \u2019
    const DOUBLE_QUOTES = ['"', '\u201C', '\u201D'];
    const SINGLE_QUOTES = ["'", '\u2018', '\u2019'];
    
    if (DOUBLE_QUOTES.includes(char) || SINGLE_QUOTES.includes(char)) {
      const isDoubleQuote = DOUBLE_QUOTES.includes(char);
      let str = '';
      i++;
      while (i < expression.length) {
        const c = expression[i];
        // Check for closing quote (including fancy variants)
        const isClosingQuote = isDoubleQuote 
          ? DOUBLE_QUOTES.includes(c)
          : SINGLE_QUOTES.includes(c);
        
        if (isClosingQuote) {
          break;
        }
        if (c === '\\' && i + 1 < expression.length) {
          i++;
          str += expression[i];
        } else {
          str += c;
        }
        i++;
      }
      i++; // Skip closing quote
      tokens.push({ type: 'STRING', value: str, position: i });
      continue;
    }
    
    // Numbers (including decimals)
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(expression[i + 1] || ''))) {
      let num = '';
      while (i < expression.length && /[0-9.]/.test(expression[i])) {
        num += expression[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: num, position: i });
      continue;
    }
    
    // Identifiers and function names
    if (/[A-Za-z_]/.test(char)) {
      let id = '';
      while (i < expression.length && /[A-Za-z0-9_]/.test(expression[i])) {
        id += expression[i];
        i++;
      }
      tokens.push({ type: 'IDENTIFIER', value: id, position: i });
      continue;
    }
    
    // Two-character operators
    const twoChar = expression.slice(i, i + 2);
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(twoChar)) {
      tokens.push({ 
        type: ['&&', '||'].includes(twoChar) ? 'LOGICAL' : 'COMPARISON', 
        value: twoChar, 
        position: i 
      });
      i += 2;
      continue;
    }
    
    // Single-character operators and symbols
    if (['+', '-', '*', '/', '%', '!'].includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char, position: i });
      i++;
      continue;
    }
    
    if (['>', '<'].includes(char)) {
      tokens.push({ type: 'COMPARISON', value: char, position: i });
      i++;
      continue;
    }
    
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: char, position: i });
      i++;
      continue;
    }
    
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: char, position: i });
      i++;
      continue;
    }
    
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: char, position: i });
      i++;
      continue;
    }
    
    if (char === '.') {
      tokens.push({ type: 'DOT', value: char, position: i });
      i++;
      continue;
    }
    
    // Skip unknown characters
    i++;
  }
  
  return tokens;
};

// ============================================================
// LOOKUP FUNCTIONS
// ============================================================

const findTable = (tableName: string, lookups: LookupContext): CalculatorTable | undefined => {
  return lookups.tables.find(t => 
    t.table_name === tableName || t.table_id === tableName
  );
};

// Helper: normalize European decimal format (comma to dot)
const normalizeNumber = (value: string): number | string => {
  const normalized = value.replace(',', '.');
  const numVal = Number(normalized);
  return Number.isFinite(numVal) ? numVal : value;
};

// LOOKUP(key, "value1:result1|value2:result2") or LOOKUP(key, tableName)
const lookupFunction = (
  key: string | number,
  source: string,
  lookups: LookupContext
): string | number | null => {
  // Check if source is inline mapping (contains | or :)
  if (source.includes('|') || source.includes(':')) {
    const mappings = source.split('|').map(pair => {
      const [k, v] = pair.split(':').map(s => s.trim());
      return { key: k, value: v || k };
    });
    
    const keyStr = String(key).toLowerCase().trim();
    const match = mappings.find(m => m.key.toLowerCase().trim() === keyStr);
    
    if (match) {
      return normalizeNumber(match.value);
    }
    return null;
  }
  
  // Otherwise, look up in table
  const table = findTable(source, lookups);
  if (!table) return null;
  
  const rows = lookups.tableRows.filter(r => r.table_id === table.table_id);
  const keyStr = String(key).toLowerCase().trim();
  
  const match = rows.find(r => {
    const rowKey = String(r.key || '').toLowerCase().trim();
    return rowKey === keyStr;
  });
  
  if (match) {
    return normalizeNumber(match.value);
  }
  
  return null;
};

// LOOKUP2D(rowKey, colKey, tableName)
const lookup2DFunction = (
  rowKey: string | number,
  colKey: string | number,
  tableName: string,
  lookups: LookupContext
): string | number | null => {
  const table = findTable(tableName, lookups);
  if (!table) return null;
  
  const matrix = lookups.tableMatrix.filter(m => m.table_id === table.table_id);
  const rowKeyStr = String(rowKey).toLowerCase().trim();
  const colKeyStr = String(colKey).toLowerCase().trim();
  
  const match = matrix.find(m => {
    const rk = String(m.row_key || '').toLowerCase().trim();
    const ck = String(m.col_key || '').toLowerCase().trim();
    return rk === rowKeyStr && ck === colKeyStr;
  });
  
  if (match) {
    return normalizeNumber(match.value);
  }
  
  return null;
};

// RANGE_LOOKUP(value, tableName) - finds value in range [min_key, max_key]
const rangeLookupFunction = (
  value: number,
  tableName: string,
  lookups: LookupContext
): string | number | null => {
  const table = findTable(tableName, lookups);
  if (!table) return null;
  
  const rows = lookups.tableRows
    .filter(r => r.table_id === table.table_id)
    .sort((a, b) => Number(a.row_order || 0) - Number(b.row_order || 0));
  
  for (const row of rows) {
    const minKey = Number(row.min_key);
    const maxKey = Number(row.max_key);
    
    if (Number.isFinite(minKey) && Number.isFinite(maxKey)) {
      if (value >= minKey && value <= maxKey) {
        const numVal = Number(row.value);
        return Number.isFinite(numVal) ? numVal : row.value;
      }
    }
  }
  
  return null;
};

// ============================================================
// BUILT-IN FUNCTIONS
// ============================================================

type BuiltinFunction = (...args: any[]) => any;

const createBuiltinFunctions = (lookups: LookupContext): Record<string, BuiltinFunction> => ({
  // Math functions
  MIN: (...args: number[]) => Math.min(...args.filter(v => Number.isFinite(v))),
  MAX: (...args: number[]) => Math.max(...args.filter(v => Number.isFinite(v))),
  ABS: (x: number) => Number.isFinite(x) ? Math.abs(x) : null,
  ROUND: (x: number, decimals: number = 0) => {
    if (!Number.isFinite(x)) return null;
    const mult = Math.pow(10, decimals || 0);
    return Math.round(x * mult) / mult;
  },
  FLOOR: (x: number) => Number.isFinite(x) ? Math.floor(x) : null,
  CEIL: (x: number) => Number.isFinite(x) ? Math.ceil(x) : null,
  SQRT: (x: number) => Number.isFinite(x) && x >= 0 ? Math.sqrt(x) : null,
  POW: (base: number, exp: number) => {
    if (!Number.isFinite(base) || !Number.isFinite(exp)) return null;
    return Math.pow(base, exp);
  },
  CLAMP: (x: number, min: number, max: number) => {
    if (!Number.isFinite(x)) return null;
    return Math.min(Math.max(x, min), max);
  },
  
  // Logical functions
  IF: (condition: any, trueVal: any, falseVal: any) => {
    return condition ? trueVal : falseVal;
  },
  IFS: (...args: any[]) => {
    // IFS(cond1, val1, cond2, val2, ..., fallback)
    for (let i = 0; i < args.length - 1; i += 2) {
      if (args[i]) return args[i + 1];
    }
    // Return last argument as fallback if odd number
    if (args.length % 2 === 1) return args[args.length - 1];
    return null;
  },
  AND: (...args: any[]) => args.every(Boolean),
  OR: (...args: any[]) => args.some(Boolean),
  NOT: (val: any) => !val,
  COALESCE: (...args: any[]) => {
    for (const arg of args) {
      if (arg !== null && arg !== undefined && arg !== '') return arg;
    }
    return null;
  },
  ISBLANK: (val: any) => val === null || val === undefined || val === '',
  
  // Text functions
  CONCAT: (...args: any[]) => args.map(String).join(''),
  LOWER: (text: any) => String(text || '').toLowerCase(),
  UPPER: (text: any) => String(text || '').toUpperCase(),
  TRIM: (text: any) => String(text || '').trim(),
  LEN: (text: any) => String(text || '').length,
  CONTAINS: (text: any, search: any) => String(text || '').toLowerCase().includes(String(search || '').toLowerCase()),
  STARTS_WITH: (text: any, prefix: any) => String(text || '').toLowerCase().startsWith(String(prefix || '').toLowerCase()),
  ENDS_WITH: (text: any, suffix: any) => String(text || '').toLowerCase().endsWith(String(suffix || '').toLowerCase()),
  
  // Lookup functions
  LOOKUP: (key: any, source: string) => lookupFunction(key, source, lookups),
  LOOKUP2D: (rowKey: any, colKey: any, tableName: string) => lookup2DFunction(rowKey, colKey, tableName, lookups),
  RANGE_LOOKUP: (value: number, tableName: string) => rangeLookupFunction(value, tableName, lookups),
  GET_TABLE_VALUE: (tableName: string, rowKey: any, colKey?: any) => {
    if (colKey !== undefined) {
      return lookup2DFunction(rowKey, colKey, tableName, lookups);
    }
    return lookupFunction(rowKey, tableName, lookups);
  },
});

// ============================================================
// EXPRESSION EVALUATOR (Safe, no eval)
// ============================================================

class FormulaEvaluator {
  private tokens: Token[] = [];
  private pos = 0;
  private context: FormulaContext;
  private builtins: Record<string, BuiltinFunction>;
  private debugLookups: Array<{ fn: string; args: string[]; result: any }> = [];
  
  constructor(context: FormulaContext) {
    this.context = context;
    this.builtins = createBuiltinFunctions(context.lookups);
  }
  
  evaluate(expression: string): FormulaEvalResult {
    try {
      this.tokens = tokenize(expression);
      this.pos = 0;
      this.debugLookups = [];
      
      if (this.tokens.length === 0) {
        return { value: null, error: 'Empty expression' };
      }
      
      const result = this.parseExpression();
      
      return {
        value: result,
        debugInfo: this.context.debug ? {
          expression,
          parsedTokens: this.tokens.map(t => t.value),
          lookupCalls: this.debugLookups,
        } : undefined,
      };
    } catch (error) {
      return { 
        value: null, 
        error: error instanceof Error ? error.message : 'Evaluation error' 
      };
    }
  }
  
  private current(): Token | undefined {
    return this.tokens[this.pos];
  }
  
  private advance(): Token | undefined {
    return this.tokens[this.pos++];
  }
  
  private expect(type: TokenType): Token {
    const token = this.advance();
    if (!token || token.type !== type) {
      throw new Error(`Expected ${type}, got ${token?.type || 'EOF'}`);
    }
    return token;
  }
  
  // Expression parsing with operator precedence
  private parseExpression(): any {
    return this.parseLogicalOr();
  }
  
  private parseLogicalOr(): any {
    let left = this.parseLogicalAnd();
    
    while (this.current()?.type === 'LOGICAL' && this.current()?.value === '||') {
      this.advance();
      const right = this.parseLogicalAnd();
      left = left || right;
    }
    
    return left;
  }
  
  private parseLogicalAnd(): any {
    let left = this.parseComparison();
    
    while (this.current()?.type === 'LOGICAL' && this.current()?.value === '&&') {
      this.advance();
      const right = this.parseComparison();
      left = left && right;
    }
    
    return left;
  }
  
  private parseComparison(): any {
    let left = this.parseAddSub();
    
    while (this.current()?.type === 'COMPARISON') {
      const op = this.advance()!.value;
      const right = this.parseAddSub();
      
      switch (op) {
        case '==': left = left == right; break;
        case '!=': left = left != right; break;
        case '>': left = left > right; break;
        case '>=': left = left >= right; break;
        case '<': left = left < right; break;
        case '<=': left = left <= right; break;
      }
    }
    
    return left;
  }
  
  private parseAddSub(): any {
    let left = this.parseMulDiv();
    
    while (this.current()?.type === 'OPERATOR' && ['+', '-'].includes(this.current()!.value)) {
      const op = this.advance()!.value;
      const right = this.parseMulDiv();
      
      if (op === '+') {
        // Handle string concatenation
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left) + String(right);
        } else {
          left = Number(left) + Number(right);
        }
      } else {
        left = Number(left) - Number(right);
      }
    }
    
    return left;
  }
  
  private parseMulDiv(): any {
    let left = this.parseUnary();
    
    while (this.current()?.type === 'OPERATOR' && ['*', '/', '%'].includes(this.current()!.value)) {
      const op = this.advance()!.value;
      const right = this.parseUnary();
      
      switch (op) {
        case '*': left = Number(left) * Number(right); break;
        case '/': left = Number(right) !== 0 ? Number(left) / Number(right) : null; break;
        case '%': left = Number(left) % Number(right); break;
      }
    }
    
    return left;
  }
  
  private parseUnary(): any {
    if (this.current()?.type === 'OPERATOR') {
      if (this.current()?.value === '-') {
        this.advance();
        return -Number(this.parseUnary());
      }
      if (this.current()?.value === '!') {
        this.advance();
        return !this.parseUnary();
      }
    }
    
    return this.parsePrimary();
  }
  
  private parsePrimary(): any {
    const token = this.current();
    
    if (!token) {
      throw new Error('Unexpected end of expression');
    }
    
    // Number literal
    if (token.type === 'NUMBER') {
      this.advance();
      return Number(token.value);
    }
    
    // String literal
    if (token.type === 'STRING') {
      this.advance();
      return token.value;
    }
    
    // Parentheses
    if (token.type === 'LPAREN') {
      this.advance();
      const result = this.parseExpression();
      this.expect('RPAREN');
      return result;
    }
    
    // Identifier (variable or function)
    if (token.type === 'IDENTIFIER') {
      return this.parseIdentifier();
    }
    
    throw new Error(`Unexpected token: ${token.value}`);
  }
  
  private parseIdentifier(): any {
    const name = this.advance()!.value;
    
    // Check for function call
    if (this.current()?.type === 'LPAREN') {
      return this.parseFunctionCall(name);
    }
    
    // Check for property access (field.value, field.label)
    if (this.current()?.type === 'DOT') {
      this.advance();
      const prop = this.advance();
      if (!prop || prop.type !== 'IDENTIFIER') {
        throw new Error(`Expected property name after .`);
      }
      
      const fieldMeta = this.context.fieldValues[name];
      if (fieldMeta) {
        switch (prop.value) {
          case 'value': return fieldMeta.value;
          case 'label': return fieldMeta.label || fieldMeta.value;
          case 'raw': return fieldMeta.raw || String(fieldMeta.value);
          default: return fieldMeta.value;
        }
      }
      
      return null;
    }
    
    // Check for boolean literals
    if (name.toLowerCase() === 'true') return true;
    if (name.toLowerCase() === 'false') return false;
    if (name.toLowerCase() === 'null') return null;
    
    // Look up in computed results first
    if (name in this.context.computedResults) {
      return this.context.computedResults[name];
    }
    
    // Look up in field values
    const fieldMeta = this.context.fieldValues[name];
    if (fieldMeta) {
      // Return raw value for backward compatibility
      return fieldMeta.value;
    }
    
    // Unknown identifier
    return null;
  }
  
  private parseFunctionCall(name: string): any {
    this.expect('LPAREN');
    
    const args: any[] = [];
    
    if (this.current()?.type !== 'RPAREN') {
      args.push(this.parseExpression());
      
      while (this.current()?.type === 'COMMA') {
        this.advance();
        args.push(this.parseExpression());
      }
    }
    
    this.expect('RPAREN');
    
    // Call builtin function
    const fn = this.builtins[name.toUpperCase()];
    if (fn) {
      const result = fn(...args);
      
      // Track lookup calls for debug
      if (['LOOKUP', 'LOOKUP2D', 'RANGE_LOOKUP', 'GET_TABLE_VALUE'].includes(name.toUpperCase())) {
        this.debugLookups.push({
          fn: name.toUpperCase(),
          args: args.map(String),
          result,
        });
      }
      
      return result;
    }
    
    throw new Error(`Unknown function: ${name}`);
  }
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Evaluate a formula expression with the given context
 */
export const evaluateFormula = (
  expression: string,
  context: FormulaContext
): FormulaEvalResult => {
  const evaluator = new FormulaEvaluator(context);
  return evaluator.evaluate(expression.trim());
};

/**
 * Evaluate a condition expression (returns boolean)
 */
export const evaluateCondition = (
  expression: string,
  context: FormulaContext
): boolean => {
  if (!expression || !expression.trim()) return true;
  
  const result = evaluateFormula(expression, context);
  return Boolean(result.value);
};

/**
 * Create field values with metadata from raw values
 */
export const createFieldValuesWithMeta = (
  rawValues: Record<string, boolean | number | string>,
  fieldOptions: Record<string, Array<{ label: string; value: string }>>
): Record<string, FieldValueWithMeta> => {
  const result: Record<string, FieldValueWithMeta> = {};
  
  for (const [fieldName, rawValue] of Object.entries(rawValues)) {
    const options = fieldOptions[fieldName];
    let label: string | undefined;
    
    if (options) {
      const match = options.find(opt => opt.value === String(rawValue));
      if (match) {
        label = match.label;
      }
    }
    
    // Convert to number if possible
    let value: string | number | boolean = rawValue;
    if (typeof rawValue === 'string') {
      const normalized = rawValue.replace(',', '.').trim();
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        value = parsed;
      }
    }
    
    result[fieldName] = {
      value,
      label,
      raw: String(rawValue),
    };
  }
  
  return result;
};

/**
 * Create empty lookup context
 */
export const createEmptyLookupContext = (): LookupContext => ({
  tables: [],
  tableRows: [],
  tableMatrix: [],
});
