import { test, expect } from '@playwright/test';

test.describe('Static Studio eBook to Audiobook Golden Path', () => {
  test('loads static studio page and performs sample ebook conversion', async ({ page }) => {
    await page.goto('/static');

    // Page title and header check
    await expect(page.getByRole('heading', { name: 'Static eBook to Audiobook' })).toBeVisible();

    // Click "Try Sample eBook"
    const sampleBtn = page.getByRole('button', { name: 'Try Sample eBook' });
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    // Verify chapters loaded
    await expect(page.getByText('3 Chapters')).toBeVisible();
    await expect(page.getByText('Chapter 1: The Beginning')).toBeVisible();
    await expect(page.getByText('Chapter 2: Local Synthesis')).toBeVisible();

    // Click "Generate Complete Audiobook"
    const generateBtn = page.getByRole('button', { name: /Generate Complete Audiobook/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Verify audiobook package ready and download button visible
    await expect(page.getByText('Audiobook Package Ready')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /Download Package/i })).toBeVisible();
  });
});
