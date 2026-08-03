import { forwardRef } from 'react';
import { Input } from '@/components/ui/input';

/**
 * A number input that ignores the scroll wheel.
 *
 * Browsers step a focused `<input type="number">` up and down on wheel events,
 * so scrolling the page over a field silently rewrites a grade. Blurring on
 * wheel prevents that while leaving the page free to scroll; the spinner arrows
 * are hidden by a rule in `index.css`.
 */
export const NumberInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ onWheel, ...props }, ref) => (
    <Input
      type="number"
      ref={ref}
      onWheel={event => {
        // Only steals focus when the wheel would actually have changed the value.
        if (document.activeElement === event.currentTarget) event.currentTarget.blur();
        onWheel?.(event);
      }}
      {...props}
    />
  )
);

NumberInput.displayName = 'NumberInput';
