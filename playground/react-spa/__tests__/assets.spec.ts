import { expect, test } from 'vitest';
import { isBuild, page, viteTestUrl } from '../../__test-utils__';

test.runIf(!isBuild)('returns the correct home page', async () => {
	const content = await page.textContent('h1');
	expect(content).toBe('Vite + React');
});

test.runIf(!isBuild)('allows updating state', async () => {
	const button = page.getByRole('button', { name: 'increment' });
	await button.click();
	const content = await button.innerText();
	expect(content).toBe('count is 1');
});

test.runIf(!isBuild)('returns the home page for not found routes', async () => {
	await page.goto(`${viteTestUrl}/random-page`);
	const content = await page.textContent('h1');
	expect(content).toBe('Vite + React');
});
