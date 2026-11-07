import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { mockDb } from '@/mock-api/db';

// Lazy route code can take a moment on the first test of a run.
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => mockDb.resetToSeed());
afterEach(cleanup);

// jsdom has no modal dialogs; the real ones are checked in a browser.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false;
};
