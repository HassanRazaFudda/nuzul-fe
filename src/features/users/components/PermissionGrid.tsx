import { PERMISSION_GROUPS, type Permission } from '@/lib/auth/permissions';

interface PermissionGridProps {
  selected: readonly string[];
  /** What the signed-in user may give or take away: their own permissions. */
  grantable: readonly string[];
  disabled: boolean;
  onChange: (permissions: string[]) => void;
}

/** Every permission, grouped by area. A user holds exactly what is ticked here. */
export function PermissionGrid({ selected, grantable, disabled, onChange }: PermissionGridProps) {
  function toggle(permission: Permission, isOn: boolean) {
    onChange(isOn ? [...selected, permission] : selected.filter((item) => item !== permission));
  }

  return (
    <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-3">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.area}>
          <legend className="text-foreground mb-2 text-sm font-semibold">{group.area}</legend>
          <ul className="space-y-1.5">
            {group.permissions.map(([permission, label]) => {
              const canGrant = grantable.includes(permission);
              return (
                <li key={permission}>
                  <label className="text-foreground flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary mt-0.5 size-4"
                      checked={selected.includes(permission)}
                      disabled={disabled || !canGrant}
                      onChange={(event) => {
                        toggle(permission, event.target.checked);
                      }}
                    />
                    <span>
                      {label}
                      <span className="text-muted block text-xs">
                        {permission}
                        {!canGrant && ' · you do not hold this, so you cannot change it'}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
