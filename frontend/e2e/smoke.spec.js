import { test, expect } from '@playwright/test';

test('landing page loads and shows brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Map Your Digital Shadow')).toBeVisible();
});
