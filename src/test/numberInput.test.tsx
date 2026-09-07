import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NumberInput } from '@/components/NumberInput';

/**
 * The reason this wrapper exists is one line of it: a focused
 * `<input type="number">` steps up and down on wheel events, so scrolling the
 * page with the cursor over a marks field silently rewrites a grade. Blurring
 * on wheel stops that, and the page keeps scrolling.
 */

afterEach(cleanup);

const field = () => screen.getByLabelText('Marks achieved') as HTMLInputElement;

describe('NumberInput', () => {
  it('is a number field', () => {
    render(<NumberInput aria-label="Marks achieved" />);

    expect(field().type).toBe('number');
  });

  it('gives up focus when the wheel turns over it', () => {
    render(<NumberInput aria-label="Marks achieved" defaultValue={17} />);
    field().focus();
    expect(document.activeElement).toBe(field());

    fireEvent.wheel(field());

    expect(document.activeElement).not.toBe(field());
    expect(field().value).toBe('17');
  });

  it('leaves an unfocused field alone, since the wheel could not have changed it', () => {
    render(<NumberInput aria-label="Marks achieved" />);
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();

    fireEvent.wheel(field());

    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it('still calls a caller’s own wheel handler', () => {
    const onWheel = vi.fn();
    render(<NumberInput aria-label="Marks achieved" onWheel={onWheel} />);

    fireEvent.wheel(field());

    expect(onWheel).toHaveBeenCalled();
  });

  it('passes everything else through to the input', () => {
    const onChange = vi.fn();
    render(
      <NumberInput aria-label="Marks achieved" min={0} max={100} value={42} onChange={onChange} />
    );

    expect(field().value).toBe('42');
    expect(field().min).toBe('0');
    expect(field().max).toBe('100');

    fireEvent.change(field(), { target: { value: '43' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('forwards a ref, so a dialog can focus it', () => {
    const ref = createRef<HTMLInputElement>();

    render(<NumberInput aria-label="Marks achieved" ref={ref} />);

    expect(ref.current).toBe(field());
  });
});
