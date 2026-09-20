import { expect, type Page } from '@playwright/test';

export async function expectBasicAccessibilityContract(page: Page): Promise<void> {
  const violations = await page.evaluate(() => {
    const issues: string[] = [];
    const isVisible = (element: Element): boolean => {
      const node = element as HTMLElement;
      const style = getComputedStyle(node);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && node.getClientRects().length > 0;
    };
    const referencedText = (element: Element, attribute: string): string =>
      (element.getAttribute(attribute) ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
    const labelText = (element: Element): string => {
      const control = element as HTMLInputElement;
      const labels = 'labels' in control && control.labels
        ? Array.from(control.labels).map((label) => label.textContent?.trim() ?? '').filter(Boolean)
        : [];
      return labels.join(' ');
    };
    const accessibleName = (element: Element): string => {
      return [
        element.getAttribute('aria-label')?.trim() ?? '',
        referencedText(element, 'aria-labelledby'),
        labelText(element),
        element.getAttribute('title')?.trim() ?? '',
        (element as HTMLElement).innerText?.trim() ?? '',
        element.getAttribute('alt')?.trim() ?? '',
      ].find(Boolean) ?? '';
    };

    const interactive = Array.from(document.querySelectorAll(
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"]',
    ));
    for (const element of interactive) {
      if (!isVisible(element)) continue;
      const control = element as HTMLButtonElement;
      if (control.disabled || element.getAttribute('aria-hidden') === 'true') continue;
      if (!accessibleName(element)) {
        issues.push(`unnamed interactive element: ${element.tagName.toLowerCase()}.${(element as HTMLElement).className}`);
      }
    }

    for (const image of Array.from(document.querySelectorAll('img'))) {
      if (!isVisible(image)) continue;
      if (!image.hasAttribute('alt')) issues.push(`image without alt: ${image.getAttribute('src') ?? ''}`);
    }

    const ids = new Map<string, number>();
    for (const element of Array.from(document.querySelectorAll('[id]'))) {
      const id = element.id;
      ids.set(id, (ids.get(id) ?? 0) + 1);
    }
    for (const [id, count] of ids) {
      if (count > 1) issues.push(`duplicate id: ${id}`);
    }

    for (const element of Array.from(document.querySelectorAll('[tabindex]'))) {
      const value = Number(element.getAttribute('tabindex'));
      if (Number.isFinite(value) && value > 0) {
        issues.push(`positive tabindex: ${element.getAttribute('tabindex')}`);
      }
    }

    for (const dialog of Array.from(document.querySelectorAll('[role="dialog"]'))) {
      if (!isVisible(dialog)) continue;
      if (!accessibleName(dialog)) issues.push('visible dialog has no accessible name');
    }

    return issues;
  });

  expect(violations).toEqual([]);
}
