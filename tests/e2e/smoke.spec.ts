import { expect, test } from '@playwright/test';

test('public pages render and nothing sells tobacco', async ({ page }) => {
  for (const p of ['/', '/recipes', '/explore', '/community', '/rules', '/about']) {
    const res = await page.goto(p);
    expect(res?.status(), p).toBeLessThan(400);
    await expect(page.locator('main')).toBeVisible();
  }
  await page.goto('/');
  await expect(page.getByText(/buy now|add to cart|checkout/i)).toHaveCount(0);
});

test('robots and sitemap are served; private areas are disallowed', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
  expect((await request.get('/sitemap.xml')).status()).toBe(200);
});

test('private areas redirect anonymous visitors to login', async ({ page }) => {
  for (const p of ['/me', '/create', '/settings', '/notifications', '/moderation', '/admin']) {
    await page.goto(p);
    await expect(page, p).toHaveURL(/\/login|\/$|not-found/);
  }
});
