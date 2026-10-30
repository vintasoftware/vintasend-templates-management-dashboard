// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://dashboard.test/tags"}

/**
 * Tests for the route error boundary.
 *
 * A failed *query* is rendered inline by the page, with the API's own message,
 * so anything reaching this boundary is a render fault or a misconfiguration.
 * It therefore has to log for operators, offer a way back, and keep the raw
 * error out of production output.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplatesError from '@/app/error';

const renderBoundary = (error = new Error('API unreachable'), reset = vi.fn()) => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = render(<TemplatesError error={error} reset={reset} />);
  return { ...result, reset, consoleError };
};

// Vitest runs on Node's real `process.env`, which only accepts plain writable
// values, so the override goes through `vi.stubEnv` rather than a descriptor.
const withNodeEnv = (value: string, run: () => void) => {
  vi.stubEnv('NODE_ENV', value);
  try {
    run();
  } finally {
    vi.unstubAllEnvs();
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TemplatesError', () => {
  it('explains the failure and names the settings most likely behind it', () => {
    renderBoundary();

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/TEMPLATES_API_URL and TEMPLATES_API_KEY/)).toBeInTheDocument();
  });

  it('logs the error so it reaches monitoring', () => {
    const error = new Error('API unreachable');
    const { consoleError } = renderBoundary(error);

    expect(consoleError).toHaveBeenCalledWith('Templates dashboard error:', error);
  });

  it('calls reset when the user retries', async () => {
    const interaction = userEvent.setup();
    const { reset } = renderBoundary();

    await interaction.click(screen.getByRole('button', { name: /Try again/ }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('navigates away when the user chooses to go back to the list', async () => {
    const interaction = userEvent.setup();
    const { consoleError } = renderBoundary();

    await interaction.click(screen.getByRole('button', { name: 'Back to templates' }));

    // jsdom refuses to navigate and locks `window.location` against stubbing, so
    // the observable signal is its "navigation not implemented" report. It only
    // fires for a real location change, which is what the handler is for.
    expect(
      consoleError.mock.calls.some((call) =>
        String(call[0]).includes('Not implemented: navigation'),
      ),
    ).toBe(true);
  });

  it('shows the raw message in development', () => {
    withNodeEnv('development', () => {
      renderBoundary(new Error('connect ECONNREFUSED 127.0.0.1:3333'));

      expect(screen.getByText('Error details')).toBeInTheDocument();
      expect(screen.getByText('connect ECONNREFUSED 127.0.0.1:3333')).toBeInTheDocument();
    });
  });

  it('hides the raw message in production', () => {
    withNodeEnv('production', () => {
      renderBoundary(new Error('connect ECONNREFUSED 127.0.0.1:3333'));

      expect(screen.queryByText('Error details')).not.toBeInTheDocument();
      expect(screen.queryByText('connect ECONNREFUSED 127.0.0.1:3333')).not.toBeInTheDocument();
    });
  });
});
