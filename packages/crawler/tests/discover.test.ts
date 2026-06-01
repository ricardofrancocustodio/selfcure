import { describe, it, expect } from 'vitest';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverProject, detectFramework, detectPackageManager } from '../src/discover.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeProject(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'sc-discover-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, content, 'utf-8');
  }
  return dir;
}

// ---------------------------------------------------------------------------
// detectFramework
// ---------------------------------------------------------------------------

describe('detectFramework', () => {
  it('detects Next.js', async () => {
    const dir = await makeProject({ 'package.json': JSON.stringify({ dependencies: { next: '14.0.0', react: '18.0.0' } }) });
    try { expect(await detectFramework(dir)).toBe('next'); } finally { await rm(dir, { recursive: true }); }
  });

  it('detects Nuxt', async () => {
    const dir = await makeProject({ 'package.json': JSON.stringify({ dependencies: { nuxt: '3.0.0' } }) });
    try { expect(await detectFramework(dir)).toBe('nuxt'); } finally { await rm(dir, { recursive: true }); }
  });

  it('detects Vue (without nuxt)', async () => {
    const dir = await makeProject({ 'package.json': JSON.stringify({ dependencies: { vue: '3.0.0' } }) });
    try { expect(await detectFramework(dir)).toBe('vue'); } finally { await rm(dir, { recursive: true }); }
  });

  it('detects React SPA (without next)', async () => {
    const dir = await makeProject({ 'package.json': JSON.stringify({ dependencies: { react: '18.0.0' } }) });
    try { expect(await detectFramework(dir)).toBe('react'); } finally { await rm(dir, { recursive: true }); }
  });

  it('detects Angular', async () => {
    const dir = await makeProject({ 'package.json': JSON.stringify({ dependencies: { '@angular/core': '16.0.0' } }) });
    try { expect(await detectFramework(dir)).toBe('angular'); } finally { await rm(dir, { recursive: true }); }
  });

  it('returns unknown when no framework is detected', async () => {
    const dir = await makeProject({ 'package.json': JSON.stringify({ dependencies: { express: '4.0.0' } }) });
    try { expect(await detectFramework(dir)).toBe('unknown'); } finally { await rm(dir, { recursive: true }); }
  });

  it('returns unknown when no package.json exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sc-discover-'));
    try { expect(await detectFramework(dir)).toBe('unknown'); } finally { await rm(dir, { recursive: true }); }
  });
});

// ---------------------------------------------------------------------------
// detectPackageManager
// ---------------------------------------------------------------------------

describe('detectPackageManager', () => {
  it('detects npm via package-lock.json', async () => {
    const dir = await makeProject({ 'package-lock.json': '{}' });
    try { expect(await detectPackageManager(dir)).toBe('npm'); } finally { await rm(dir, { recursive: true }); }
  });

  it('detects pnpm via pnpm-lock.yaml', async () => {
    const dir = await makeProject({ 'pnpm-lock.yaml': '' });
    try { expect(await detectPackageManager(dir)).toBe('pnpm'); } finally { await rm(dir, { recursive: true }); }
  });

  it('detects yarn via yarn.lock', async () => {
    const dir = await makeProject({ 'yarn.lock': '' });
    try { expect(await detectPackageManager(dir)).toBe('yarn'); } finally { await rm(dir, { recursive: true }); }
  });

  it('returns unknown when no lockfile exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sc-discover-'));
    try { expect(await detectPackageManager(dir)).toBe('unknown'); } finally { await rm(dir, { recursive: true }); }
  });

  it('prefers bun over npm when both lockfiles exist', async () => {
    const dir = await makeProject({ 'bun.lockb': '', 'package-lock.json': '{}' });
    try { expect(await detectPackageManager(dir)).toBe('bun'); } finally { await rm(dir, { recursive: true }); }
  });
});

// ---------------------------------------------------------------------------
// discoverProject — Next.js pages router
// ---------------------------------------------------------------------------

describe('discoverProject — Next.js pages router', () => {
  it('finds routes from pages/ directory', async () => {
    const dir = await makeProject({
      'package.json':              JSON.stringify({ dependencies: { next: '14.0.0' } }),
      'pages/index.tsx':           'export default function Home() {}',
      'pages/about.tsx':           'export default function About() {}',
      'pages/checkout/index.tsx':  'export default function Checkout() {}',
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      expect(map.framework).toBe('next');
      const paths = map.routeCandidates.map((r) => r.path);
      expect(paths).toContain('/');
      expect(paths).toContain('/about');
      expect(paths).toContain('/checkout');
    } finally { await rm(dir, { recursive: true }); }
  });

  it('skips _app and _document special files', async () => {
    const dir = await makeProject({
      'package.json':       JSON.stringify({ dependencies: { next: '14.0.0' } }),
      'pages/_app.tsx':     '',
      'pages/_document.tsx':'',
      'pages/index.tsx':    '',
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      const paths = map.routeCandidates.map((r) => r.path);
      expect(paths).not.toContain('/_app');
      expect(paths).not.toContain('/_document');
    } finally { await rm(dir, { recursive: true }); }
  });

  it('marks dynamic routes as isDynamic', async () => {
    const dir = await makeProject({
      'package.json':              JSON.stringify({ dependencies: { next: '14.0.0' } }),
      'pages/products/[id].tsx':   '',
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      const dyn = map.routeCandidates.find((r) => r.isDynamic);
      expect(dyn).toBeDefined();
      expect(dyn?.path).toBe('/products/:id');
    } finally { await rm(dir, { recursive: true }); }
  });
});

// ---------------------------------------------------------------------------
// discoverProject — Next.js app router
// ---------------------------------------------------------------------------

describe('discoverProject — Next.js app router', () => {
  it('finds routes from app/**/page.tsx', async () => {
    const dir = await makeProject({
      'package.json':              JSON.stringify({ dependencies: { next: '14.0.0' } }),
      'app/page.tsx':              '',
      'app/about/page.tsx':        '',
      'app/dashboard/page.tsx':    '',
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      const paths = map.routeCandidates.map((r) => r.path);
      expect(paths).toContain('/');
      expect(paths).toContain('/about');
      expect(paths).toContain('/dashboard');
    } finally { await rm(dir, { recursive: true }); }
  });
});

// ---------------------------------------------------------------------------
// discoverProject — Vue
// ---------------------------------------------------------------------------

describe('discoverProject — Vue', () => {
  it('finds routes from src/views/', async () => {
    const dir = await makeProject({
      'package.json':           JSON.stringify({ dependencies: { vue: '3.0.0' } }),
      'src/views/HomeView.vue': '',
      'src/views/AboutView.vue':'',
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      expect(map.framework).toBe('vue');
      const paths = map.routeCandidates.map((r) => r.path);
      expect(paths).toContain('/HomeView');
      expect(paths).toContain('/AboutView');
    } finally { await rm(dir, { recursive: true }); }
  });
});

// ---------------------------------------------------------------------------
// discoverProject — React SPA with pages convention
// ---------------------------------------------------------------------------

describe('discoverProject — React SPA', () => {
  it('finds routes from src/pages/', async () => {
    const dir = await makeProject({
      'package.json':          JSON.stringify({ dependencies: { react: '18.0.0' } }),
      'src/pages/Home.tsx':    '',
      'src/pages/Login.tsx':   '',
      'src/pages/NotFound.tsx':'',
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      expect(map.framework).toBe('react');
      const paths = map.routeCandidates.map((r) => r.path);
      expect(paths).toContain('/Home');
      expect(paths).toContain('/Login');
    } finally { await rm(dir, { recursive: true }); }
  });
});

// ---------------------------------------------------------------------------
// discoverProject — general behaviour
// ---------------------------------------------------------------------------

describe('discoverProject — general', () => {
  it('always includes "/" route candidate', async () => {
    const dir = await makeProject({
      'package.json': JSON.stringify({ dependencies: { react: '18.0.0' } }),
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      expect(map.routeCandidates.some((r) => r.path === '/')).toBe(true);
    } finally { await rm(dir, { recursive: true }); }
  });

  it('deduplicates routes from multiple sources', async () => {
    const dir = await makeProject({
      'package.json':       JSON.stringify({ dependencies: { next: '14.0.0' } }),
      'pages/about.tsx':    '',
      'app/about/page.tsx': '',  // same route from both routers
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      const aboutRoutes = map.routeCandidates.filter((r) => r.path === '/about');
      expect(aboutRoutes).toHaveLength(1); // deduplicated
    } finally { await rm(dir, { recursive: true }); }
  });

  it('detects dev/build commands from scripts', async () => {
    const dir = await makeProject({
      'package.json': JSON.stringify({
        dependencies: { next: '14.0.0' },
        scripts: { dev: 'next dev', build: 'next build', test: 'jest' },
      }),
      'package-lock.json': '{}',
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      expect(map.devCommand).toContain('dev');
      expect(map.buildCommand).toContain('build');
    } finally { await rm(dir, { recursive: true }); }
  });

  it('lists component candidates from src/', async () => {
    const dir = await makeProject({
      'package.json':         JSON.stringify({ dependencies: { react: '18.0.0' } }),
      'src/Button.tsx':       '',
      'src/Modal.tsx':        '',
      'src/forms/Input.tsx':  '',
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      const names = map.componentCandidates.map((c) => c.name);
      expect(names).toContain('Button');
      expect(names).toContain('Modal');
      expect(names).toContain('Input');
    } finally { await rm(dir, { recursive: true }); }
  });

  it('returns a generatedAt timestamp', async () => {
    const dir = await makeProject({
      'package.json': JSON.stringify({ dependencies: { react: '18.0.0' } }),
    });
    try {
      const map = await discoverProject({ projectRoot: dir });
      expect(() => new Date(map.generatedAt)).not.toThrow();
    } finally { await rm(dir, { recursive: true }); }
  });
});
