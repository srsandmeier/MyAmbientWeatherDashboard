import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

type AxeImpact = 'minor' | 'moderate' | 'serious' | 'critical' | null;

interface AxeNode {
  readonly target: readonly string[];
  readonly html: string;
  readonly failureSummary?: string;
}

interface AxeViolation {
  readonly id: string;
  readonly impact: AxeImpact;
  readonly help: string;
  readonly description: string;
  readonly nodes: readonly AxeNode[];
}

interface AxeRunResult {
  readonly violations: readonly AxeViolation[];
}

interface AxeRuntime {
  readonly run: (context?: unknown, options?: unknown) => Promise<AxeRunResult>;
}

const axeScriptPath = path.resolve(__dirname, '..', '..', '..', 'frontend', 'node_modules', 'axe-core', 'axe.min.js');

function formatViolation(violation: AxeViolation): string {
  const targets = violation.nodes
    .slice(0, 3)
    .map((node) => {
      const target = node.target.join(' ');
      const summary = node.failureSummary ? `\n    ${node.failureSummary}` : '';
      return `  - ${target}${summary}`;
    })
    .join('\n');

  return `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n${violation.description}\n${targets}`;
}

/** Runs a full-page axe audit using the frontend's installed axe-core dependency. */
export async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
  if (!fs.existsSync(axeScriptPath)) {
    throw new Error(`axe-core script was not found at ${axeScriptPath}. Run npm install in frontend.`);
  }

  await page.addScriptTag({ path: axeScriptPath });
  const result = await page.evaluate(async () => {
    const axe = (window as typeof window & { axe?: AxeRuntime }).axe;
    if (!axe) {
      throw new Error('axe-core did not load on the page.');
    }

    return axe.run(document, {
      resultTypes: ['violations'],
    });
  });

  const details = result.violations.map(formatViolation).join('\n\n');
  expect(result.violations, `${label} axe violations:\n${details}`).toEqual([]);
}
