import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAppliedTheme } from './useAppliedTheme';

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('useAppliedTheme', () => {
  it('reads the theme from the dark class on the document', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useAppliedTheme());
    expect(result.current).toBe('dark');
  });

  it('follows the class when the theme is applied after the first render', async () => {
    const { result } = renderHook(() => useAppliedTheme());
    expect(result.current).toBe('light');

    act(() => { document.documentElement.classList.add('dark'); });
    await waitFor(() => { expect(result.current).toBe('dark'); });

    act(() => { document.documentElement.classList.remove('dark'); });
    await waitFor(() => { expect(result.current).toBe('light'); });
  });
});
