import { expect, test } from '@playwright/test';

/** Load the map, inspect T2 and the Sahar road, run Scenario A, reset to the exact baseline. */
test('map loads, selection works, scenario runs and resets exactly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/?intro=off');
  await expect(page.locator('.cesium-widget canvas')).toBeVisible();
  // The mode badge was removed from the top bar on request; the mode is shown in Settings.
  await expect(page.getByText('MOCK MODE')).toHaveCount(0);
  // FR-01: the Cesium scene really renders frames.
  await expect.poll(() => page.evaluate(() => (document.querySelector('.cesium-widget canvas') as HTMLCanvasElement).width), { timeout: 20_000 }).toBeGreaterThan(0);

  const inspector = page.getByRole('complementary', { name: 'Intelligence' });
  await inspector.getByRole('button', { name: /Terminal 2/ }).click();
  await expect(inspector.getByRole('heading', { name: 'Terminal 2' })).toBeVisible();
  await expect(inspector.getByText('42', { exact: true })).toBeVisible();

  await page.getByRole('complementary', { name: 'Telemetry' }).locator('[data-tour="road-sahar-inbound"]').click();
  await expect(inspector.getByText('Incident / blockage state')).toBeVisible();

  await inspector.locator('[data-tour="run-scenario"]').click();
  await expect(inspector.getByText('Scenario active')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('region', { name: 'Active recommendation' })).toBeVisible();
  await expect(inspector.getByText(/42 → 86/)).toBeVisible();

  await inspector.locator('[data-tour="reset-scenario"]').click();
  await expect(page.getByRole('region', { name: 'Active recommendation' })).toHaveCount(0);
  await inspector.getByRole('button', { name: 'Clear selection' }).click();
  await expect(inspector.getByText(/Terminal 2\s*Index 42 · Moderate/)).toBeVisible();

  expect(errors, errors.join('\n')).toEqual([]);
});

test('first visit shows the guided-demo start tile, which can be skipped', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('bom_demo_seen_v1'));
  await page.reload();
  await expect(page.getByRole('dialog', { name: /Monsoon squall meets/ })).toBeVisible();
  await page.getByRole('button', { name: /Start the guided demo/ }).click();
  const card = page.getByRole('region', { name: 'Guided demo' });
  await expect(card.getByText('Every value says where it came from')).toBeVisible();
  await card.getByRole('button', { name: 'Next' }).click();
  await card.getByRole('button', { name: 'Select T2 for me' }).click();
  await expect(card.getByText('Select the Sahar Elevated Access Road')).toBeVisible({ timeout: 5_000 });
  await card.getByRole('button', { name: 'Skip tour' }).click();
  await expect(card).toHaveCount(0);
});
