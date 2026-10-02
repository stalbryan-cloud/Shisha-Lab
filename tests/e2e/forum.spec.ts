import { expect, test } from '@playwright/test';
import { signUp, uid } from './helpers';

test('create a forum topic and reply', async ({ page }) => {
  await signUp(page, 'talker');
  const title = `E2E topic ${uid()}`;
  await page.goto('/community/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel(/category/i).selectOption({ index: 1 });
  await page.getByLabel(/body|message|content/i).first().fill('How long do you rest a glycerin-heavy mix?');
  await page.getByRole('button', { name: /post|create|publish/i }).last().click();
  await page.waitForURL(/\/community\/t\//);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await page.getByLabel(/reply/i).first().fill('Two to three days works for me.');
  await page.getByRole('button', { name: /^(post )?reply/i }).click();
  await expect(page.getByText('Two to three days works for me.')).toBeVisible();
});
