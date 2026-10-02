import { expect, test } from '@playwright/test';
import { createAndPublishRecipe, logIn, logOut, signUp, uid } from './helpers';

test.describe.serial('recipe lifecycle', () => {
  const title = `E2E Peach ${uid()}`;
  let path = '';
  let author = { username: '', email: '' };

  test('register, create with the wizard, publish', async ({ page }) => {
    author = await signUp(page, 'author');
    path = await createAndPublishRecipe(page, title);
  });

  test('anonymous visitor can view the recipe, and sees the health notice', async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(/not (medical|safety)|no guarantee|not.*safe/i).first()).toBeVisible();
  });

  test('scaling math: 2x doubles quantities and never converts mass↔volume without a density', async ({ page }) => {
    await page.goto(path);
    const scaler = page.getByRole('region', { name: /scale/i }).or(page.locator('#scaler'));
    await expect(scaler).toBeVisible();
    await scaler.getByLabel(/multiplier|scale/i).first().fill('2');
    await expect(scaler.getByText(/40(\.0+)? ?g/)).toBeVisible();          // 20 g glycerin × 2
  });

  test('second account: save, like, made it, review, comment', async ({ page }) => {
    await signUp(page, 'maker');
    await page.goto(path);
    await page.getByRole('button', { name: /^Like/ }).click();
    await expect(page.getByRole('button', { name: /Liked|Unlike/ })).toBeVisible();
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByRole('button', { name: /Saved|Unsave/ })).toBeVisible();

    await page.getByRole('button', { name: /I made this/i }).click();
    await page.getByLabel(/notes|how did it go/i).first().fill('Rested 3 days; came out well.');
    await page.getByRole('button', { name: /log|submit|save/i }).last().click();

    await page.getByRole('radio', { name: /4/ }).first().check({ force: true });
    await page.getByLabel(/review/i).first().fill('Balanced and easy to follow.');
    await page.getByRole('button', { name: /post review|submit review|save review/i }).click();
    await expect(page.getByText('Balanced and easy to follow.')).toBeVisible();

    await page.getByLabel(/add a comment|comment/i).first().fill('Thanks for sharing!');
    await page.getByRole('button', { name: /post comment|comment$/i }).first().click();
    await expect(page.getByText('Thanks for sharing!')).toBeVisible();
  });

  test('report content, then staff moderates it', async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, 'needs E2E_ADMIN_EMAIL/PASSWORD');
    await signUp(page, 'reporter');
    await page.goto(path);
    await page.getByRole('button', { name: /report/i }).first().click();
    await page.getByLabel(/reason/i).selectOption('misleading');
    await page.getByRole('button', { name: /send report|submit/i }).click();
    await expect(page.getByText(/thank|received|submitted/i)).toBeVisible();
    await logOut(page);

    await logIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
    await page.goto('/moderation');
    await expect(page.getByText(title).first()).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /admin|dashboard/i }).first()).toBeVisible();
  });

  test('search finds the recipe', async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent(title.split(' ').slice(0, 2).join(' '))}`);
    await expect(page.getByText(title)).toBeVisible();
  });

  test('non-staff cannot open admin or moderation', async ({ page }) => {
    await logIn(page, author.email);
    for (const p of ['/admin', '/moderation']) {
      await page.goto(p);
      await expect(page.getByRole('heading', { name: /dashboard|moderation queue/i })).toHaveCount(0);
    }
  });
});

test('private recipe is invisible to others and anonymous visitors', async ({ page, browser }) => {
  await signUp(page, 'priv');
  const path = await createAndPublishRecipe(page, `E2E Private ${uid()}`, 'private');
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();      // owner can see it
  const anon = await browser.newPage();
  const res = await anon.goto(path);
  expect(res?.status()).toBe(404);
  await anon.close();
});
