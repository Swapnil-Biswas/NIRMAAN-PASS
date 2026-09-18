import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { updateSession } from '@/utils/supabase/middleware';

describe('Middleware Invocation Resilience', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('runs smoothly with default environment variables without throwing', async () => {
    const req = new NextRequest('http://localhost:3000/');
    const res = await middleware(req);
    expect(res).toBeDefined();
    expect(res.status).toBe(200);
  });

  it('does NOT throw 500 when NEXT_PUBLIC_SUPABASE_URL is completely undefined', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const req = new NextRequest('http://localhost:3000/pass');
    let res;
    expect(async () => {
      res = await middleware(req);
    }).not.toThrow();

    res = await middleware(req);
    expect(res).toBeDefined();
    expect(res.status).toBe(200);
  });

  it('does NOT throw when NEXT_PUBLIC_SUPABASE_URL is an invalid URL', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not_a_valid_url';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some_key';

    const req = new NextRequest('http://localhost:3000/dashboard');
    const res = await middleware(req);
    expect(res).toBeDefined();
    expect(res.status).toBe(200);
  });

  it('does NOT throw when NEXT_PUBLIC_SUPABASE_URL contains placeholder', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-anon-key';

    const req = new NextRequest('http://localhost:3000/admin/dashboard');
    const res = await middleware(req);
    expect(res).toBeDefined();
    expect(res.status).toBe(200);
  });

  it('updateSession handles null/undefined request cookies gracefully', async () => {
    const req = new NextRequest('http://localhost:3000/');
    const res = await updateSession(req);
    expect(res).toBeDefined();
    expect(res.status).toBe(200);
  });
});
