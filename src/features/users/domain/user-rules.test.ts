import { describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, grantProblems, PERMISSION_TEMPLATES } from '@/lib/auth/permissions';

import { changeProblem, type UserLike } from './user-rules';

const admin: UserLike = { id: 'admin', active: true, permissions: [...ALL_PERMISSIONS] };
const assigner: UserLike = {
  id: 'assigner',
  active: true,
  permissions: ['permission.assign', 'purchase.view'],
};
const clerk: UserLike = { id: 'clerk', active: true, permissions: ['purchase.view'] };

describe('templates', () => {
  it('only name permissions from the catalogue, and Admin holds them all', () => {
    for (const template of PERMISSION_TEMPLATES) {
      expect(template.permissions.every((permission) => ALL_PERMISSIONS.includes(permission))).toBe(true);
    }
    expect(PERMISSION_TEMPLATES.find((template) => template.name === 'Admin')?.permissions).toEqual(
      ALL_PERMISSIONS,
    );
  });
});

describe('granting', () => {
  it('lets a user give or take away only what they hold', () => {
    expect(grantProblems(['purchase.view'], [], ['purchase.view'])).toEqual([]);
    expect(grantProblems(['purchase.view'], [], ['purchase.edit'])).toEqual(['purchase.edit']);
    expect(grantProblems(['purchase.view'], ['audit.view'], [])).toEqual(['audit.view']);
  });

  it('refuses a change by someone who cannot assign permissions', () => {
    expect(changeProblem(clerk, [admin, clerk], clerk, { ...clerk, permissions: [] })).toMatch(
      /permission to change/,
    );
  });

  it('refuses giving what the giver does not hold', () => {
    expect(
      changeProblem(assigner, [admin, assigner, clerk], clerk, {
        ...clerk,
        permissions: ['purchase.view', 'audit.view'],
      }),
    ).toMatch(/only give or take away what you hold/);
  });

  it('allows what the giver holds', () => {
    expect(
      changeProblem(assigner, [admin, assigner, clerk], clerk, { ...clerk, permissions: [] }),
    ).toBeNull();
  });
});

describe('the last user manager', () => {
  it('cannot be deactivated or lose the permission', () => {
    const users = [admin, clerk];

    expect(changeProblem(admin, users, admin, { ...admin, active: false })).toMatch(
      /must keep the permission/,
    );
    expect(
      changeProblem(admin, users, admin, {
        ...admin,
        permissions: admin.permissions.filter((permission) => permission !== 'user.manage'),
      }),
    ).toMatch(/must keep the permission/);
  });

  it('can step down once someone else holds it', () => {
    const other = { ...admin, id: 'other' };

    expect(changeProblem(admin, [admin, other], admin, { ...admin, active: false })).toBeNull();
  });
});
