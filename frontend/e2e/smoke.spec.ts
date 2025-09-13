import { test, expect } from '@playwright/test';

test('loads home and submits a job', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Microfluidic Simulator')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New Simulation' })).toBeVisible();

  // Submit the default form
  await page.getByRole('button', { name: 'Submit Job' }).click();

  // Navigates to /jobs/:id
  await expect(page).toHaveURL(/\/jobs\//);

  // Wait until status appears and eventually becomes finished or failed
  await expect(page.getByText('Job Status')).toBeVisible();

  // Poll for finished
  const statusEl = page.getByText(/Status:/);
  await expect(statusEl).toBeVisible();

  // In inline mode this should complete quickly
  await expect.poll(async () => {
    const text = await statusEl.innerText();
    return /finished|failed/i.test(text) ? 'done' : 'pending';
  }, { timeout: 30_000 }).toBe('done');
});

