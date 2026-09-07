import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AdvancedOptions } from '@/components/AdvancedOptions';
import { AdvancedOptionsDialog } from '@/components/AdvancedOptionsDialog';
import { GradingPolicy, NO_POLICY, NO_POLICY_DRAFT, PolicyDraft } from '@/lib/gradePolicies';

/**
 * The grading-policy switches, and the dialog that commits them.
 *
 * The rules themselves live in `gradePolicies.ts` and are asserted there. What
 * these cover is the editing model the conventions insist on: numbers are raw
 * text so a box can be emptied and retyped, nothing is parsed or defaulted per
 * keystroke, and Cancel genuinely discards — the breakdown's grade must not
 * move around while the student is still deciding.
 */

afterEach(cleanup);

const switchFor = (label: string) => screen.getByRole('switch', { name: label });
const boxFor = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe('AdvancedOptions', () => {
  /** Renders the field group controlled, the way both its callers do. */
  function renderGroup(over: Partial<PolicyDraft> = {}) {
    const onChange = vi.fn();
    const draft = { ...NO_POLICY_DRAFT, ...over };
    render(<AdvancedOptions draft={draft} onChange={onChange} />);
    return { onChange, draft };
  }

  it('hides each option’s box until the option is switched on', () => {
    renderGroup();

    expect(screen.queryByLabelText('Number to drop')).toBeNull();
    expect(screen.queryByLabelText('Number to downweight')).toBeNull();
    expect(screen.queryByLabelText('Full credit percentage')).toBeNull();
  });

  it('reports a switch as a whole new draft, never a field setter', () => {
    const { onChange, draft } = renderGroup();

    fireEvent.click(switchFor('Drop lowest'));

    expect(onChange).toHaveBeenCalledWith({ ...draft, dropLowest: true });
  });

  it('shows the box, seeded with a usable default, once switched on', () => {
    renderGroup({ dropLowest: true });

    expect(boxFor('Number to drop').value).toBe('1');
  });

  it('opens full credit blank, so the threshold is stated rather than guessed', () => {
    renderGroup({ fullCredit: true });

    expect(boxFor('Full credit percentage').value).toBe('');
  });

  it('locks out downweight while drop lowest is on, and the other way round', () => {
    // They are alternatives — applying both would mean dropping a mark and then
    // halving one that is already gone.
    const { unmount } = render(
      <AdvancedOptions draft={{ ...NO_POLICY_DRAFT, dropLowest: true }} onChange={() => {}} />
    );
    expect(switchFor('Downweight lowest')).toBeDisabled();
    unmount();

    render(
      <AdvancedOptions draft={{ ...NO_POLICY_DRAFT, downweight: true }} onChange={() => {}} />
    );
    expect(switchFor('Drop lowest')).toBeDisabled();
  });

  it('leaves equal weight and full credit switchable alongside either', () => {
    renderGroup({ dropLowest: true });

    expect(switchFor('Equal weight')).toBeEnabled();
    expect(switchFor('Full credit grade')).toBeEnabled();
    expect(switchFor('Bonus grade')).toBeEnabled();
  });

  it('passes typing through as raw text, uncorrected', () => {
    // Clamping mid-keystroke would rewrite "100" to "10" the moment "10" existed.
    const { onChange, draft } = renderGroup({ fullCredit: true });

    fireEvent.change(boxFor('Full credit percentage'), { target: { value: '1' } });

    expect(onChange).toHaveBeenCalledWith({ ...draft, fullCreditGrade: '1' });
  });

  it('shows both downweight boxes, each with its own default', () => {
    renderGroup({ downweight: true });

    expect(boxFor('Number to downweight').value).toBe('1');
    expect(boxFor('Downweight percentage').value).toBe('50');
  });

  it('reports each downweight box separately', () => {
    const { onChange, draft } = renderGroup({ downweight: true });

    fireEvent.change(boxFor('Number to downweight'), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, downweightLowestCount: '2' });

    fireEvent.change(boxFor('Downweight percentage'), { target: { value: '25' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, downweightPercent: '25' });
  });

  it('switches downweight on through the same whole-draft callback', () => {
    const { onChange, draft } = renderGroup();

    fireEvent.click(switchFor('Downweight lowest'));

    expect(onChange).toHaveBeenCalledWith({ ...draft, downweight: true });
  });

  it('switches equal weight and bonus, which carry no box of their own', () => {
    const { onChange, draft } = renderGroup();

    fireEvent.click(switchFor('Equal weight'));
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, equalWeight: true });

    fireEvent.click(switchFor('Bonus grade'));
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, isBonus: true });

    fireEvent.click(switchFor('Full credit grade'));
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, fullCredit: true });
  });

  it('lets a box be emptied', () => {
    const { onChange, draft } = renderGroup({ dropLowest: true });

    fireEvent.change(boxFor('Number to drop'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({ ...draft, dropLowestCount: '' });
  });
});

describe('AdvancedOptionsDialog', () => {
  const dropOne: GradingPolicy = { ...NO_POLICY, dropLowestCount: 1 };

  function open(policy: GradingPolicy = NO_POLICY) {
    const onApply = vi.fn();
    const onOpenChange = vi.fn();
    const view = render(
      <AdvancedOptionsDialog open onOpenChange={onOpenChange} policy={policy} onApply={onApply} />
    );
    return { onApply, onOpenChange, view };
  }

  const apply = () => fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

  it('seeds the draft from the committed policy', () => {
    open({ ...NO_POLICY, fullCreditGrade: 80 });

    expect(switchFor('Full credit grade')).toBeChecked();
    expect(boxFor('Full credit percentage').value).toBe('80');
  });

  it('commits nothing until Apply is pressed', () => {
    const { onApply } = open();

    fireEvent.click(switchFor('Bonus grade'));

    expect(onApply).not.toHaveBeenCalled();
  });

  it('applies the committed policy and closes', () => {
    const { onApply, onOpenChange } = open();

    fireEvent.click(switchFor('Equal weight'));
    apply();

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ equalWeightSubBreakdowns: true })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('refuses a switched-on option with an empty box, and says which', () => {
    // Applying it would have to invent a number, and guessing at a grading rule
    // is worse than saying no.
    const { onApply } = open(dropOne);

    fireEvent.change(boxFor('Number to drop'), { target: { value: '' } });
    apply();

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/can't have an empty box/i).textContent).toMatch(/drop/i);
  });

  it('drops the complaint as soon as the box is typed in again', () => {
    const { onApply } = open(dropOne);
    fireEvent.change(boxFor('Number to drop'), { target: { value: '' } });
    apply();

    fireEvent.change(boxFor('Number to drop'), { target: { value: '2' } });

    expect(screen.queryByText(/can't have an empty box/i)).toBeNull();
    apply();
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ dropLowestCount: 2 }));
  });

  it('names every empty box at once, not just the first', () => {
    const { onApply } = open({ ...NO_POLICY, downweightLowestCount: 2, downweightPercent: 50 });

    fireEvent.change(boxFor('Number to downweight'), { target: { value: '' } });
    fireEvent.change(boxFor('Downweight percentage'), { target: { value: '' } });
    apply();

    expect(onApply).not.toHaveBeenCalled();
    const complaint = screen.getByText(/can't have an empty box/i).textContent ?? '';
    expect(complaint).toMatch(/and/);
  });

  it('commits a downweight policy in full', () => {
    const { onApply } = open();

    fireEvent.click(switchFor('Downweight lowest'));
    fireEvent.change(boxFor('Number to downweight'), { target: { value: '2' } });
    fireEvent.change(boxFor('Downweight percentage'), { target: { value: '25' } });
    apply();

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ downweightLowestCount: 2, downweightPercent: 25 })
    );
  });

  it('discards the draft on Cancel', () => {
    const { onApply, onOpenChange } = open();

    fireEvent.click(switchFor('Bonus grade'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onApply).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('starts over on the next open, rather than resuming an abandoned draft', () => {
    // The form is keyed on `open`, so closing remounts it. Trusting Radix to
    // unmount on close instead left the stale draft in place whenever the exit
    // animation never fired.
    const { view } = open();
    fireEvent.click(switchFor('Bonus grade'));
    expect(switchFor('Bonus grade')).toBeChecked();

    view.rerender(
      <AdvancedOptionsDialog
        open={false}
        onOpenChange={() => {}}
        policy={NO_POLICY}
        onApply={() => {}}
      />
    );
    view.rerender(
      <AdvancedOptionsDialog
        open
        onOpenChange={() => {}}
        policy={NO_POLICY}
        onApply={() => {}}
      />
    );

    expect(switchFor('Bonus grade')).not.toBeChecked();
  });
});
