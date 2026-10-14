import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

/**
 * Where a shared rule applies. The text is fixed and the same for every space, so it reveals
 * nothing about the closed spaces underneath.
 */
export function RuleReach({ id, space, onlyHere, onOnlyHereChange, disabled }: {
  id: string;
  space: string;
  onlyHere: boolean;
  onOnlyHereChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {onlyHere
          ? `It applies only in ${space}, not in the spaces under it.`
          : `It applies to ${space} and every space under it, including spaces you can't open.`}
      </p>
      <div className="flex items-center gap-2.5">
        <Checkbox id={id} checked={onlyHere} onCheckedChange={(value) => onOnlyHereChange(value === true)} disabled={disabled} />
        <Label htmlFor={id} className="text-sm font-normal">Only in {space}</Label>
      </div>
    </div>
  );
}
