import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SafeImage } from '../src/react/registry/_img.js';

describe('SafeImage', () => {
  it('renders an <img> with the validated src for a safe http(s) url', () => {
    const { container } = render(
      <SafeImage src="https://picsum.photos/seed/x/40/40" alt="x" fallback={<span>fb</span>} />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://picsum.photos/seed/x/40/40');
    expect(img?.getAttribute('alt')).toBe('x');
    expect(container.textContent).not.toContain('fb');
  });

  it('coalesces a null alt to an empty string (decorative)', () => {
    const { container } = render(
      <SafeImage src="https://picsum.photos/seed/z/40/40" alt={null} fallback={<span>fb</span>} />,
    );
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('renders the fallback (no <img>) for an unsafe src (javascript:)', () => {
    const { container } = render(
      <SafeImage src="javascript:alert(1)" alt="x" fallback={<span>fb</span>} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('fb');
  });

  it('renders the fallback for a rejected raster-spoof (data:image/svg+xml)', () => {
    const { container } = render(
      <SafeImage src="data:image/svg+xml,<svg/>" alt="x" fallback={<span>fb</span>} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('fb');
  });

  it('renders the fallback when the src is absent', () => {
    const { container } = render(<SafeImage src={null} alt="x" fallback={<span>fb</span>} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('fb');
  });

  it('swaps to the fallback when a valid src fails to load (onError)', () => {
    const { container } = render(
      <SafeImage src="https://example.com/missing.png" alt="x" fallback={<span>fb</span>} />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    fireEvent.error(img!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('fb');
  });

  it('passes aria-hidden through to the rendered <img>', () => {
    const { container } = render(
      <SafeImage src="https://picsum.photos/seed/y/40/40" alt="" ariaHidden fallback={null} />,
    );
    expect(container.querySelector('img')?.getAttribute('aria-hidden')).toBe('true');
  });
});
