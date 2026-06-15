import { useBlocker } from 'react-router';
import { Button } from '../ui/button';

interface UnsavedRouteGuardProps {
  readonly when: boolean;
  readonly title: string;
  readonly description: string;
  readonly testId: string;
  readonly isSaving?: boolean;
  readonly onSave: () => Promise<boolean>;
  readonly onDiscard: () => void;
}

/** Blocks in-app route changes while a settings layout surface has unsaved edits. */
export function UnsavedRouteGuard({
  when,
  title,
  description,
  testId,
  isSaving = false,
  onSave,
  onDiscard,
}: UnsavedRouteGuardProps) {
  const blocker = useBlocker(when);
  const titleId = `${testId}-title`;
  const descriptionId = `${testId}-description`;

  if (blocker.state !== 'blocked') {
    return null;
  }

  const saveAndContinue = async () => {
    const didSave = await onSave();
    if (didSave) {
      blocker.proceed();
    }
  };

  const discardAndContinue = () => {
    onDiscard();
    blocker.proceed();
  };

  return (
    <div
      className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-test-id={testId}
    >
      <p id={titleId} className="font-medium text-foreground">
        {title}
      </p>
      <p id={descriptionId} className="mt-1 text-muted-foreground">
        {description}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isSaving}
          onClick={() => { void saveAndContinue(); }}
          data-test-id={`${testId}-save`}
        >
          {isSaving ? 'Saving...' : 'Save and continue'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={discardAndContinue}
          data-test-id={`${testId}-discard`}
        >
          Discard and continue
        </Button>
      </div>
    </div>
  );
}
