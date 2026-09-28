import * as fengari from 'fengari';
import { apiCallSync, extractValueByPath, executeRestApiFetch } from './restApiManager';

export interface ScriptApiHelper {
  get: (
    url: string,
    jsonPathOrOptions?: string | {
      path?: string;
      headers?: Record<string, string>;
      sampleStrategy?: 'sequential' | 'random';
      fallback?: unknown;
    }
  ) => unknown;
  post: (
    url: string,
    body?: unknown,
    options?: {
      headers?: Record<string, string>;
      path?: string;
      fallback?: unknown;
    }
  ) => unknown;
  extract: (data: unknown, path: string, strategy?: 'sequential' | 'random') => unknown;
  fetchAsync: (
    url: string,
    options?: {
      method?: 'GET' | 'POST';
      headers?: Record<string, string>;
      body?: unknown;
      path?: string;
    }
  ) => Promise<unknown>;
}

export interface ScriptHttpHelper {
  get: (url: string, pathOrHeaders?: string | Record<string, string>) => unknown;
  post: (url: string, body?: unknown, headers?: Record<string, string>) => unknown;
}

export interface ScriptContext {
  index: number;
  rowIndex: number;
  row: Record<string, unknown>;
  random: {
    int: (min: number, max: number) => number;
    float: (min: number, max: number, decimals?: number) => number;
    choice: <T>(arr: T[]) => T;
    weighted: <T>(items: { value: T; weight: number }[]) => T;
    boolean: (probTrue?: number) => boolean;
    date: (startYear?: number, endYear?: number) => string;
    uuid: () => string;
    hex: (len?: number) => string;
    alpha: (len?: number, uppercaseOnly?: boolean) => string;
    numeric: (len?: number) => string;
  };
  utils: {
    pad: (num: number | string, len: number, char?: string) => string;
    luhnChecksum: (numStr: string) => number;
    thaiIdChecksum: (first12Digits: string) => number;
    hash: (str: string) => string;
    slugify: (str: string) => string;
    clamp: (val: number, min: number, max: number) => number;
  };
  api: ScriptApiHelper;
  http: ScriptHttpHelper;
}

export function createScriptContext(
  rowIndex: number = 0,
  row: Record<string, unknown> = {}
): ScriptContext {
  const index = rowIndex + 1;

  const random = {
    int: (min: number, max: number): number => {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    },
    float: (min: number, max: number, decimals: number = 2): number => {
      const val = Math.random() * (max - min) + min;
      return Number(val.toFixed(decimals));
    },
    choice: <T>(arr: T[]): T => {
      if (!arr || arr.length === 0) return '' as unknown as T;
      return arr[Math.floor(Math.random() * arr.length)];
    },
    weighted: <T>(items: { value: T; weight: number }[]): T => {
      if (!items || items.length === 0) return '' as unknown as T;
      const totalWeight = items.reduce((sum, it) => sum + Math.max(0, it.weight || 0), 0);
      if (totalWeight <= 0) return items[0].value;
      let r = Math.random() * totalWeight;
      for (const item of items) {
        r -= Math.max(0, item.weight || 0);
        if (r <= 0) return item.value;
      }
      return items[items.length - 1].value;
    },
    boolean: (probTrue: number = 0.5): boolean => {
      return Math.random() < probTrue;
    },
    date: (startYear: number = 2020, endYear: number = 2026): string => {
      const start = new Date(startYear, 0, 1).getTime();
      const end = new Date(endYear, 11, 31).getTime();
      const randomTime = start + Math.random() * (end - start);
      return new Date(randomTime).toISOString().slice(0, 10);
    },
    uuid: (): string => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    hex: (len: number = 8): string => {
      let s = '';
      for (let i = 0; i < len; i++) {
        s += Math.floor(Math.random() * 16).toString(16);
      }
      return s;
    },
    alpha: (len: number = 6, uppercaseOnly: boolean = false): string => {
      const chars = uppercaseOnly
        ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      let s = '';
      for (let i = 0; i < len; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return s;
    },
    numeric: (len: number = 6): string => {
      let s = '';
      for (let i = 0; i < len; i++) {
        s += Math.floor(Math.random() * 10).toString();
      }
      return s;
    }
  };

  const utils = {
    pad: (num: number | string, len: number, char: string = '0'): string => {
      return String(num).padStart(len, char);
    },
    luhnChecksum: (numStr: string): number => {
      const clean = String(numStr).replace(/\D/g, '');
      let sum = 0;
      let alt = true;
      for (let i = clean.length - 1; i >= 0; i--) {
        let n = parseInt(clean.charAt(i), 10);
        if (alt) {
          n *= 2;
          if (n > 9) n = (n % 10) + 1;
        }
        sum += n;
        alt = !alt;
      }
      return (10 - (sum % 10)) % 10;
    },
    thaiIdChecksum: (first12Digits: string): number => {
      const clean = String(first12Digits).replace(/\D/g, '').slice(0, 12);
      if (clean.length < 12) return 0;
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(clean[i], 10) * (13 - i);
      }
      return (11 - (sum % 11)) % 10;
    },
    hash: (str: string): string => {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
      }
      return (h >>> 0).toString(16).padStart(8, '0');
    },
    slugify: (str: string): string => {
      return String(str)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    },
    clamp: (val: number, min: number, max: number): number => {
      return Math.min(Math.max(val, min), max);
    }
  };

  const api: ScriptApiHelper = {
    get: (url: string, jsonPathOrOptions?: string | { path?: string; headers?: Record<string, string>; sampleStrategy?: 'sequential' | 'random'; fallback?: unknown }): unknown => {
      let jsonPath = '';
      let headers: Record<string, string> | undefined;
      let sampleStrategy: 'sequential' | 'random' = 'sequential';
      let fallback: unknown = undefined;

      if (typeof jsonPathOrOptions === 'string') {
        jsonPath = jsonPathOrOptions;
      } else if (jsonPathOrOptions && typeof jsonPathOrOptions === 'object') {
        jsonPath = jsonPathOrOptions.path || '';
        headers = jsonPathOrOptions.headers;
        if (jsonPathOrOptions.sampleStrategy) sampleStrategy = jsonPathOrOptions.sampleStrategy;
        fallback = jsonPathOrOptions.fallback;
      }

      return apiCallSync({
        url,
        method: 'GET',
        headers,
        jsonPath,
        sampleStrategy,
        fallback,
        rowIndex,
        row
      });
    },
    post: (url: string, body?: unknown, options?: { headers?: Record<string, string>; path?: string; fallback?: unknown }): unknown => {
      return apiCallSync({
        url,
        method: 'POST',
        headers: options?.headers,
        body,
        jsonPath: options?.path,
        fallback: options?.fallback,
        rowIndex,
        row
      });
    },
    extract: (data: unknown, path: string, strategy: 'sequential' | 'random' = 'sequential'): unknown => {
      return extractValueByPath(data, path, rowIndex, strategy);
    },
    fetchAsync: async (url: string, options?: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: unknown; path?: string }): Promise<unknown> => {
      const res = await executeRestApiFetch({
        url,
        method: options?.method || 'GET',
        headers: options?.headers ? Object.entries(options.headers).map(([k, v]) => ({ key: k, value: v, enabled: true })) : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        jsonPath: options?.path
      }, { rowIndex, row });
      return res.value;
    }
  };

  const http: ScriptHttpHelper = {
    get: (url: string, pathOrHeaders?: string | Record<string, string>): unknown => {
      if (typeof pathOrHeaders === 'string') {
        return api.get(url, pathOrHeaders);
      }
      return api.get(url, { headers: pathOrHeaders });
    },
    post: (url: string, body?: unknown, headers?: Record<string, string>): unknown => {
      return api.post(url, body, { headers });
    }
  };

  return {
    index,
    rowIndex,
    row,
    random,
    utils,
    api,
    http
  };
}

// -------------------------------------------------------------
// JAVASCRIPT SCRIPT EXECUTOR
// -------------------------------------------------------------

const jsFunctionCache = new Map<string, (ctx: ScriptContext, api: ScriptApiHelper, http: ScriptHttpHelper, row: Record<string, unknown>, index: number, random: any, utils: any) => unknown>();

export function executeJavaScriptScript(
  scriptText: string,
  ctx: ScriptContext
): { success: boolean; result?: unknown; error?: string } {
  const code = (scriptText || '').trim();
  if (!code) {
    return { success: true, result: '' };
  }

  // Guard against Lua syntax accidentally passed to JavaScript engine
  if (code.startsWith('--') || /^local\s+/m.test(code)) {
    return {
      success: false,
      error: 'Lua syntax detected (-- comment or local variable). Please switch language mode to Lua 5.3.'
    };
  }

  try {
    let fn = jsFunctionCache.get(code);
    if (!fn) {
      let body: string;
      if (code.includes('function generate') || code.includes('const generate') || code.includes('let generate')) {
        // User defined a generate(ctx, api, http) function
        body = `
          ${code}
          if (typeof generate === 'function') {
            return generate(ctx, api, http);
          }
          throw new Error("Defined script did not return a value. Please call return or define generate(ctx)");
        `;
      } else if (code.includes('return ')) {
        // Contains explicit return statements
        body = code;
      } else {
        // Single expression without return statement (e.g. 'INV-' + ctx.index)
        body = `return (${code});`;
      }

      // Compile function with ctx, api, http, row, index, random, utils in scope
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      fn = new Function('ctx', 'api', 'http', 'row', 'index', 'random', 'utils', body) as any;
      if (jsFunctionCache.size > 200) {
        jsFunctionCache.clear();
      }
      jsFunctionCache.set(code, fn);
    }

    const result = fn(ctx, ctx.api, ctx.http, ctx.row, ctx.index, ctx.random, ctx.utils);
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

// -------------------------------------------------------------
// LUA <-> JAVASCRIPT VALUE CONVERTERS
// -------------------------------------------------------------

export function pushJsValueToLua(L: any, val: unknown, depth: number = 0): void {
  if (depth > 12 || val === null || val === undefined) {
    fengari.lua.lua_pushnil(L);
    return;
  }
  if (typeof val === 'boolean') {
    fengari.lua.lua_pushboolean(L, val ? 1 : 0);
  } else if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      fengari.lua.lua_pushinteger(L, val);
    } else {
      fengari.lua.lua_pushnumber(L, val);
    }
  } else if (typeof val === 'string') {
    fengari.lua.lua_pushstring(L, fengari.to_luastring(val));
  } else if (Array.isArray(val)) {
    fengari.lua.lua_createtable(L, val.length, 0);
    for (let i = 0; i < val.length; i++) {
      pushJsValueToLua(L, val[i], depth + 1);
      fengari.lua.lua_rawseti(L, -2, i + 1);
    }
  } else if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>);
    fengari.lua.lua_createtable(L, 0, entries.length);
    for (const [k, v] of entries) {
      pushJsValueToLua(L, v, depth + 1);
      fengari.lua.lua_setfield(L, -2, fengari.to_luastring(k));
    }
  } else {
    fengari.lua.lua_pushstring(L, fengari.to_luastring(String(val)));
  }
}

export function luaValueToJs(L: any, idx: number, depth: number = 0): unknown {
  if (depth > 12) return null;
  const t = fengari.lua.lua_type(L, idx);
  if (t === fengari.lua.LUA_TNIL || t === fengari.lua.LUA_TNONE) return null;
  if (t === fengari.lua.LUA_TBOOLEAN) return Boolean(fengari.lua.lua_toboolean(L, idx));
  if (t === fengari.lua.LUA_TNUMBER) {
    return fengari.lua.lua_isinteger(L, idx)
      ? fengari.lua.lua_tointeger(L, idx)
      : fengari.lua.lua_tonumber(L, idx);
  }
  if (t === fengari.lua.LUA_TSTRING) {
    return fengari.to_jsstring(fengari.lua.lua_tostring(L, idx));
  }
  if (t === fengari.lua.LUA_TTABLE) {
    const rawLen = fengari.lua.lua_rawlen(L, idx);
    if (rawLen > 0) {
      const arr: unknown[] = [];
      for (let i = 1; i <= rawLen; i++) {
        fengari.lua.lua_rawgeti(L, idx, i);
        arr.push(luaValueToJs(L, -1, depth + 1));
        fengari.lua.lua_pop(L, 1);
      }
      return arr;
    } else {
      const obj: Record<string, unknown> = {};
      fengari.lua.lua_pushnil(L);
      const tableIdx = idx < 0 ? idx - 1 : idx;
      while (fengari.lua.lua_next(L, tableIdx) !== 0) {
        const key = luaValueToJs(L, -2, depth + 1);
        const val = luaValueToJs(L, -1, depth + 1);
        if (typeof key === 'string' || typeof key === 'number') {
          obj[String(key)] = val;
        }
        fengari.lua.lua_pop(L, 1);
      }
      return obj;
    }
  }
  return fengari.to_jsstring(fengari.lua.lua_tostring(L, idx)) || null;
}

// -------------------------------------------------------------
// LUA 5.3 SCRIPT EXECUTOR (POWERED BY FENGARI)
// -------------------------------------------------------------

export function executeLuaScript(
  scriptText: string,
  ctx: ScriptContext
): { success: boolean; result?: unknown; error?: string } {
  const code = (scriptText || '').trim();
  if (!code) {
    return { success: true, result: '' };
  }

  // Guard against JavaScript syntax accidentally passed to Lua engine
  if (code.startsWith('//') || code.startsWith('/*') || /\b(const|let|var)\s+[a-zA-Z_$]/m.test(code)) {
    return {
      success: false,
      error: 'JavaScript syntax detected (// comment or const/let/var). Please switch language mode to JavaScript.'
    };
  }

  const L = fengari.lauxlib.luaL_newstate();
  try {
    fengari.lualib.luaL_openlibs(L);

    // Instruction count hook to prevent infinite loops in user scripts (max 100,000 instructions)
    fengari.lua.lua_sethook(
      L,
      () => {
        fengari.lauxlib.luaL_error(L, fengari.to_luastring('Script execution exceeded instruction limit (possible infinite loop)'));
      },
      fengari.lua.LUA_MASKCOUNT,
      100000
    );

    // 1. Create global 'ctx' table
    fengari.lua.lua_newtable(L);
    // ctx.index
    fengari.lua.lua_pushinteger(L, ctx.index);
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('index'));
    // ctx.rowIndex
    fengari.lua.lua_pushinteger(L, ctx.rowIndex);
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('rowIndex'));

    // ctx.row table
    fengari.lua.lua_newtable(L);
    for (const [k, v] of Object.entries(ctx.row)) {
      if (typeof v === 'number') {
        fengari.lua.lua_pushnumber(L, v);
      } else if (typeof v === 'boolean') {
        fengari.lua.lua_pushboolean(L, v ? 1 : 0);
      } else {
        fengari.lua.lua_pushstring(L, fengari.to_luastring(String(v ?? '')));
      }
      fengari.lua.lua_setfield(L, -2, fengari.to_luastring(k));
    }
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('row'));
    fengari.lua.lua_setglobal(L, fengari.to_luastring('ctx'));

    // 2. Create 'random' helper table
    fengari.lua.lua_newtable(L);

    // random.int(min, max)
    fengari.lua.lua_pushjsfunction(L, (l) => {
      const min = fengari.lua.lua_tointeger(l, 1);
      const max = fengari.lua.lua_tointeger(l, 2);
      const res = ctx.random.int(min, max);
      fengari.lua.lua_pushinteger(l, res);
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('int'));

    // random.float(min, max, decimals)
    fengari.lua.lua_pushjsfunction(L, (l) => {
      const min = fengari.lua.lua_tonumber(l, 1);
      const max = fengari.lua.lua_tonumber(l, 2);
      const dec = fengari.lua.lua_isnoneornil(l, 3) ? 2 : fengari.lua.lua_tointeger(l, 3);
      const res = ctx.random.float(min, max, dec);
      fengari.lua.lua_pushnumber(l, res);
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('float'));

    // random.choice(table)
    fengari.lua.lua_pushjsfunction(L, (l) => {
      if (!fengari.lua.lua_istable(l, 1)) {
        fengari.lua.lua_pushnil(l);
        return 1;
      }
      const len = fengari.lua.lua_rawlen(l, 1);
      if (len === 0) {
        fengari.lua.lua_pushnil(l);
        return 1;
      }
      const idx = Math.floor(Math.random() * len) + 1;
      fengari.lua.lua_rawgeti(l, 1, idx);
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('choice'));

    // random.uuid()
    fengari.lua.lua_pushjsfunction(L, (l) => {
      const u = ctx.random.uuid();
      fengari.lua.lua_pushstring(l, fengari.to_luastring(u));
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('uuid'));

    // random.hex(len)
    fengari.lua.lua_pushjsfunction(L, (l) => {
      const len = fengari.lua.lua_isnoneornil(l, 1) ? 8 : fengari.lua.lua_tointeger(l, 1);
      const h = ctx.random.hex(len);
      fengari.lua.lua_pushstring(l, fengari.to_luastring(h));
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('hex'));

    // random.alpha(len, uppercase)
    fengari.lua.lua_pushjsfunction(L, (l) => {
      const len = fengari.lua.lua_isnoneornil(l, 1) ? 6 : fengari.lua.lua_tointeger(l, 1);
      const up = fengari.lua.lua_toboolean(l, 2);
      const a = ctx.random.alpha(len, Boolean(up));
      fengari.lua.lua_pushstring(l, fengari.to_luastring(a));
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('alpha'));

    // random.numeric(len)
    fengari.lua.lua_pushjsfunction(L, (l) => {
      const len = fengari.lua.lua_isnoneornil(l, 1) ? 6 : fengari.lua.lua_tointeger(l, 1);
      const n = ctx.random.numeric(len);
      fengari.lua.lua_pushstring(l, fengari.to_luastring(n));
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('numeric'));

    // Set 'random' global
    fengari.lua.lua_setglobal(L, fengari.to_luastring('random'));

    // 3. Create 'utils' helper table
    fengari.lua.lua_newtable(L);

    // utils.pad(val, len, char)
    fengari.lua.lua_pushjsfunction(L, (l) => {
      const valStr = fengari.to_jsstring(fengari.lauxlib.luaL_checkstring(l, 1));
      const len = fengari.lua.lua_tointeger(l, 2);
      const ch = fengari.lua.lua_isnoneornil(l, 3) ? '0' : fengari.to_jsstring(fengari.lua.lua_tostring(l, 3));
      const res = ctx.utils.pad(valStr, len, ch);
      fengari.lua.lua_pushstring(l, fengari.to_luastring(res));
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('pad'));

    // utils.luhn(numStr)
    fengari.lua.lua_pushjsfunction(L, (l) => {
      const numStr = fengari.to_jsstring(fengari.lauxlib.luaL_checkstring(l, 1));
      const check = ctx.utils.luhnChecksum(numStr);
      fengari.lua.lua_pushinteger(l, check);
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('luhn'));

    // utils.thai_id()
    fengari.lua.lua_pushjsfunction(L, (l) => {
      let first12 = '1' + ctx.random.numeric(11);
      const check = ctx.utils.thaiIdChecksum(first12);
      fengari.lua.lua_pushstring(l, fengari.to_luastring(first12 + check));
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('thai_id'));

    // utils.hash(str)
    fengari.lua.lua_pushjsfunction(L, (l) => {
      const s = fengari.to_jsstring(fengari.lauxlib.luaL_checkstring(l, 1));
      const h = ctx.utils.hash(s);
      fengari.lua.lua_pushstring(l, fengari.to_luastring(h));
      return 1;
    });
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('hash'));

    // Set 'utils' global
    fengari.lua.lua_setglobal(L, fengari.to_luastring('utils'));

    // 4. Create 'api' helper table for REST API retrieval
    const registerLuaApi = () => {
      fengari.lua.lua_newtable(L);

      // api.get(url, jsonPath)
      fengari.lua.lua_pushjsfunction(L, (l) => {
        const urlStr = fengari.to_jsstring(fengari.lauxlib.luaL_checkstring(l, 1));
        let pathStr: string | undefined;
        if (!fengari.lua.lua_isnoneornil(l, 2)) {
          pathStr = fengari.to_jsstring(fengari.lua.lua_tostring(l, 2));
        }
        const val = ctx.api.get(urlStr, pathStr);
        pushJsValueToLua(l, val);
        return 1;
      });
      fengari.lua.lua_setfield(L, -2, fengari.to_luastring('get'));

      // api.post(url, body, jsonPath)
      fengari.lua.lua_pushjsfunction(L, (l) => {
        const urlStr = fengari.to_jsstring(fengari.lauxlib.luaL_checkstring(l, 1));
        let body: unknown = undefined;
        if (!fengari.lua.lua_isnoneornil(l, 2)) {
          body = luaValueToJs(l, 2);
        }
        let pathStr: string | undefined;
        if (!fengari.lua.lua_isnoneornil(l, 3)) {
          pathStr = fengari.to_jsstring(fengari.lua.lua_tostring(l, 3));
        }
        const val = ctx.api.post(urlStr, body, { path: pathStr });
        pushJsValueToLua(l, val);
        return 1;
      });
      fengari.lua.lua_setfield(L, -2, fengari.to_luastring('post'));

      // api.extract(data, jsonPath)
      fengari.lua.lua_pushjsfunction(L, (l) => {
        const data = luaValueToJs(l, 1);
        const pathStr = fengari.to_jsstring(fengari.lauxlib.luaL_checkstring(l, 2));
        const val = ctx.api.extract(data, pathStr);
        pushJsValueToLua(l, val);
        return 1;
      });
      fengari.lua.lua_setfield(L, -2, fengari.to_luastring('extract'));
    };

    // 5. Create 'http' helper table (convenience alias)
    const registerLuaHttp = () => {
      fengari.lua.lua_newtable(L);

      // http.get(url, jsonPath)
      fengari.lua.lua_pushjsfunction(L, (l) => {
        const urlStr = fengari.to_jsstring(fengari.lauxlib.luaL_checkstring(l, 1));
        let pathStr: string | undefined;
        if (!fengari.lua.lua_isnoneornil(l, 2)) {
          pathStr = fengari.to_jsstring(fengari.lua.lua_tostring(l, 2));
        }
        const val = ctx.http.get(urlStr, pathStr);
        pushJsValueToLua(l, val);
        return 1;
      });
      fengari.lua.lua_setfield(L, -2, fengari.to_luastring('get'));

      // http.post(url, body)
      fengari.lua.lua_pushjsfunction(L, (l) => {
        const urlStr = fengari.to_jsstring(fengari.lauxlib.luaL_checkstring(l, 1));
        let body: unknown = undefined;
        if (!fengari.lua.lua_isnoneornil(l, 2)) {
          body = luaValueToJs(l, 2);
        }
        const val = ctx.http.post(urlStr, body);
        pushJsValueToLua(l, val);
        return 1;
      });
      fengari.lua.lua_setfield(L, -2, fengari.to_luastring('post'));
    };

    // Set 'api' global
    registerLuaApi();
    fengari.lua.lua_setglobal(L, fengari.to_luastring('api'));

    // Set 'http' global
    registerLuaHttp();
    fengari.lua.lua_setglobal(L, fengari.to_luastring('http'));

    // Also attach 'api' and 'http' to 'ctx' table
    fengari.lua.lua_getglobal(L, fengari.to_luastring('ctx'));
    registerLuaApi();
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('api'));
    registerLuaHttp();
    fengari.lua.lua_setfield(L, -2, fengari.to_luastring('http'));
    fengari.lua.lua_pop(L, 1);

    // Prepare code chunk
    let luaCodeToRun = code;
    if (!code.includes('return ') && !code.includes('function generate')) {
      // Single expression e.g. "INV-" .. ctx.index
      luaCodeToRun = `return (${code})`;
    }

    const loadStatus = fengari.lauxlib.luaL_loadstring(L, fengari.to_luastring(luaCodeToRun));
    if (loadStatus !== fengari.lua.LUA_OK) {
      const errMsg = fengari.to_jsstring(fengari.lua.lua_tostring(L, -1));
      return { success: false, error: errMsg };
    }

    // Execute the chunk
    const callStatus = fengari.lua.lua_pcall(L, 0, fengari.lua.LUA_MULTRET, 0);
    if (callStatus !== fengari.lua.LUA_OK) {
      const errMsg = fengari.to_jsstring(fengari.lua.lua_tostring(L, -1));
      return { success: false, error: errMsg };
    }

    // Check if user defined function generate(ctx)
    fengari.lua.lua_getglobal(L, fengari.to_luastring('generate'));
    if (fengari.lua.lua_isfunction(L, -1)) {
      fengari.lua.lua_getglobal(L, fengari.to_luastring('ctx'));
      const fnCallStatus = fengari.lua.lua_pcall(L, 1, 1, 0);
      if (fnCallStatus !== fengari.lua.LUA_OK) {
        const errMsg = fengari.to_jsstring(fengari.lua.lua_tostring(L, -1));
        return { success: false, error: errMsg };
      }
    } else {
      // pop the non-function
      fengari.lua.lua_pop(L, 1);
    }

    // Extract return value from top of stack
    const top = fengari.lua.lua_gettop(L);
    if (top === 0) {
      return { success: true, result: '' };
    }

    const luaType = fengari.lua.lua_type(L, -1);
    let finalResult: unknown;

    if (luaType === fengari.lua.LUA_TSTRING) {
      finalResult = fengari.to_jsstring(fengari.lua.lua_tostring(L, -1));
    } else if (luaType === fengari.lua.LUA_TNUMBER) {
      if (fengari.lua.lua_isinteger(L, -1)) {
        finalResult = fengari.lua.lua_tointeger(L, -1);
      } else {
        finalResult = fengari.lua.lua_tonumber(L, -1);
      }
    } else if (luaType === fengari.lua.LUA_TBOOLEAN) {
      finalResult = Boolean(fengari.lua.lua_toboolean(L, -1));
    } else if (luaType === fengari.lua.LUA_TNIL) {
      finalResult = null;
    } else if (luaType === fengari.lua.LUA_TTABLE) {
      finalResult = luaValueToJs(L, -1);
    } else {
      finalResult = fengari.to_jsstring(fengari.lua.lua_tostring(L, -1)) || '[Lua Object]';
    }

    return { success: true, result: finalResult };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  } finally {
    fengari.lua.lua_close(L);
  }
}
