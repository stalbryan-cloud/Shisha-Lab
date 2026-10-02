import { expect, type Page } from '@playwright/test';

export const uid = () => Math.random().toString(36).slice(2, 9);
export const PASSWORD = 'correct-horse-battery-9';

export async function signUp(page: Page, tag = 'user') {
  const id = uid();
  const username = `${tag}_${id}`;
  const email = `${username}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.locator('input[name="age_ack"]').check();
  await page.locator('input[name="rules_ack"]').check();
  await page.getByRole('button', { name: /create account|sign up/i }).click();
  await page.waitForURL(/\/me/);
  return { username, email };
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

export async function logOut(page: Page) {
  await page.getByRole('button', { name: /account|menu/i }).first().click();
  await page.getByRole('button', { name: /log ?out|sign out/i }).click();
}

/** Walks the 10-step wizard with the minimum publishable dataset and returns the public recipe path. */
export async function createAndPublishRecipe(page: Page, title: string, visibility: 'public' | 'unlisted' | 'private' = 'public') {
  await page.goto('/create');
  await page.getByLabel('Recipe title').fill(title);
  await page.getByLabel('Short description').fill('A demo recipe created by an automated test.');
  await page.getByLabel('Visibility').selectOption(visibility);
  await page.getByRole('button', { name: /Next/ }).click();                                    // 2 tobacco
  await page.getByLabel('Leaf family').selectOption('blonde');
  await page.getByRole('button', { name: /Next/ }).click();                                    // 3 base
  await page.getByRole('button', { name: 'Add base ingredient' }).click();
  await page.getByLabel('Name').first().fill('Vegetable glycerin');
  await page.getByLabel('Weight (g)').first().fill('20');
  await page.getByRole('button', { name: /Next/ }).click();                                    // 4 aromas
  await page.getByRole('button', { name: 'Add aroma' }).click();
  await page.getByLabel('Flavour').first().fill('Peach');
  await page.getByLabel('% of batch').first().fill('4');
  await page.getByRole('button', { name: /Next/ }).click();                                    // 5 process
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByLabel('Title').first().fill('Mix');
  await page.getByLabel('Instructions').first().fill('Combine everything evenly.');
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /Next/ }).click();       // → 10 review/publish
  await page.getByRole('button', { name: /^Publish recipe$/ }).click();
  await page.waitForURL(/\/recipes\/[^/]+$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  return new URL(page.url()).pathname;
}
