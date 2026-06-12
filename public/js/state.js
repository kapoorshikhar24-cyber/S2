/**
 * state.js — Centralized mutable application state for the UAT Dashboard.
 * Single source of truth. Mutate properties directly; no wrapper needed.
 */

window.State = {

  /** @type {object|null} The currently authenticated user object. */
  currentUser: null,

  /** @type {object|null} Global settings. */
  settings: null,

  /** @type {object} Dynamic dictionary of picklists array. */
  picklists: {},

  /** @type {object[]} All registered user records. */
  users: [],

  /** @type {object[]} All project records. */
  projects: [],

  /** @type {object[]} All UAT entry / ticket records. */
  entries: [],

  /** @type {object[]} Notification objects for the current user. */
  notifications: [],

  /** @type {object[]} All shared files. */
  files: [],

  /** @type {string|null} ID of the user currently being edited in a modal. */
  currentEditUserId: null,

  /** @type {string|null} ID of the project currently being edited in a modal. */
  currentEditProjectId: null,

  /** @type {string|null} Base64 image string for the current project's logo. */
  currentProjectBase64: null,

  /**
   * @type {string|null} Base64 image string for the currently staged
   * entry attachment / screenshot before saving.
   */
  currentImageData: null,

  /** @type {number|null} setInterval handle for notification polling. */
  notifPollInterval: null,

  /** @type {string|null} ID of the entry currently being edited (for remarks). */
  editingRemarkId: null,

  /** @type {string|null} ID of the notification currently being edited. */
  editingId: null,

};
