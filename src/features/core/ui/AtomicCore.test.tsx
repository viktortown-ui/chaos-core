import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AtomicCore } from './AtomicCore';

describe('AtomicCore reduced motion', () => {
  it('does not start animation frame loop when reduced motion is enabled', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    render(<AtomicCore reducedMotion language="ru" />);
    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
  });
});
