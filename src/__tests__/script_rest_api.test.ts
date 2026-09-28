import { describe, it, expect, beforeEach } from 'vitest';
import { executeJavaScriptScript, executeLuaScript, createScriptContext } from '../utils/scriptEngine';
import { setCachedApiResponse, extractUrlsFromText } from '../utils/restApiManager';

describe('REST API Integration in Script (JS) and Lua', () => {
  beforeEach(() => {
    // Seed test API cache
    setCachedApiResponse('https://dummyjson.com/users', {
      users: [
        { id: 1, firstName: 'Terry', email: 'terry@dummyjson.com' },
        { id: 2, firstName: 'Sheldon', email: 'sheldon@dummyjson.com' }
      ]
    });

    setCachedApiResponse('https://dummyjson.com/products', {
      products: [
        { id: 101, title: 'Laptop Pro', price: 999.99, category: 'Electronics' },
        { id: 102, title: 'Wireless Mouse', price: 29.99, category: 'Accessories' }
      ]
    });

    setCachedApiResponse('https://jsonplaceholder.typicode.com/posts/1', {
      userId: 1,
      id: 1,
      title: 'sunt aut facere',
      body: 'quia et suscipit'
    });
  });

  describe('JavaScript Script REST API Integration', () => {
    it('should access api.get with JSONPath extraction', () => {
      const ctx = createScriptContext(0, { rowId: 1 });
      const script = `return api.get('https://dummyjson.com/users', 'users[].email');`;
      const res = executeJavaScriptScript(script, ctx);
      expect(res.success).toBe(true);
      expect(res.result).toBe('terry@dummyjson.com');
    });

    it('should access ctx.api.get and inspect raw object', () => {
      const ctx = createScriptContext(0, { rowId: 1 });
      const script = `
        const data = ctx.api.get('https://dummyjson.com/products');
        return data.products[0].title + ' ($' + data.products[0].price + ')';
      `;
      const res = executeJavaScriptScript(script, ctx);
      expect(res.success).toBe(true);
      expect(res.result).toBe('Laptop Pro ($999.99)');
    });

    it('should support http.get convenience alias', () => {
      const ctx = createScriptContext(0, {});
      const script = `return http.get('https://dummyjson.com/users', 'users[].firstName');`;
      const res = executeJavaScriptScript(script, ctx);
      expect(res.success).toBe(true);
      expect(res.result).toBe('Terry');
    });

    it('should support function generate(ctx, api, http) signature', () => {
      const ctx = createScriptContext(1, {});
      const script = `
        function generate(ctx, api) {
          const email = api.get('https://dummyjson.com/users', 'users[].email');
          return 'ROW-' + ctx.index + ':' + email;
        }
      `;
      const res = executeJavaScriptScript(script, ctx);
      expect(res.success).toBe(true);
      expect(res.result).toBe('ROW-2:sheldon@dummyjson.com');
    });
  });

  describe('Lua 5.3 Script REST API Integration', () => {
    it('should execute api.get in Lua and extract path', () => {
      const ctx = createScriptContext(0, {});
      const script = `return api.get("https://dummyjson.com/users", "users[].email")`;
      const res = executeLuaScript(script, ctx);
      expect(res.success).toBe(true);
      expect(res.result).toBe('terry@dummyjson.com');
    });

    it('should execute ctx.api.get in Lua and return parsed string', () => {
      const ctx = createScriptContext(1, {});
      const script = `
        local email = ctx.api.get("https://dummyjson.com/users", "users[].email")
        return string.upper(email)
      `;
      const res = executeLuaScript(script, ctx);
      expect(res.success).toBe(true);
      expect(res.result).toBe('SHELDON@DUMMYJSON.COM');
    });

    it('should execute http.get convenience alias in Lua', () => {
      const ctx = createScriptContext(0, {});
      const script = `return http.get("https://dummyjson.com/products", "products[].title")`;
      const res = executeLuaScript(script, ctx);
      expect(res.success).toBe(true);
      expect(res.result).toBe('Laptop Pro');
    });

    it('should inspect Lua table returned from api.get without path', () => {
      const ctx = createScriptContext(0, {});
      const script = `
        local post = api.get("https://jsonplaceholder.typicode.com/posts/1")
        if post and post.title then
          return "POST: " .. post.title
        end
        return "UNKNOWN"
      `;
      const res = executeLuaScript(script, ctx);
      expect(res.success).toBe(true);
      expect(res.result).toBe('POST: sunt aut facere');
    });

    it('should support function generate(ctx) in Lua', () => {
      const ctx = createScriptContext(0, {});
      const script = `
        function generate(ctx)
          local title = api.get("https://dummyjson.com/products", "products[].title")
          return string.format("ITEM-%04d: %s", ctx.index, title)
        end
      `;
      const res = executeLuaScript(script, ctx);
      expect(res.success).toBe(true);
      expect(res.result).toBe('ITEM-0001: Laptop Pro');
    });
  });

  describe('Script URL Extraction for Prefetching', () => {
    it('should extract URLs from JavaScript scripts', () => {
      const jsCode = `
        const u = api.get('https://dummyjson.com/users', 'users[].email');
        const p = api.get("https://dummyjson.com/products");
      `;
      const urls = extractUrlsFromText(jsCode);
      expect(urls).toContain('https://dummyjson.com/users');
      expect(urls).toContain('https://dummyjson.com/products');
    });

    it('should extract URLs from Lua scripts', () => {
      const luaCode = `
        local u = api.get("https://jsonplaceholder.typicode.com/posts", "[].title")
      `;
      const urls = extractUrlsFromText(luaCode);
      expect(urls).toContain('https://jsonplaceholder.typicode.com/posts');
    });
  });
});
