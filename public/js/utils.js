/**
 * utils.js — Pure utility functions for the UAT Dashboard.
 * No side effects, no DOM manipulation, no global state.
 */

window.Utils = {

  /**
   * Escapes a string for safe HTML insertion (XSS prevention).
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  },

  /**
   * Formats an ISO date string into a locale-friendly string.
   * Returns '—' for falsy input.
   * @param {string} iso
   * @returns {string}
   */
  formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  },

  /**
   * Maps a ticket status string to its corresponding CSS class.
   * @param {string} status
   * @returns {string}
   */
  getBadgeClass(status) {
    const map = {
      'backlog':     'status-backlog',
      'pending':     'status-pending',
      'in review':   'status-pending',
      'in progress': 'status-inprogress',
      'solved':      'status-solved',
      'closed':      'status-closed',
      'accepted':    'status-accepted',
      'rejected':    'status-rejected',
    };
    return map[(status || '').toLowerCase()] || '';
  },

  /**
   * Compresses an image File to a base64 string using canvas.
   * @param {File} file
   * @param {number} maxWidth
   * @param {number} quality
   * @returns {Promise<string>} base64 data URL
   */
  compressImage(file, maxWidth = 1200, quality = 0.80) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement('canvas');
          canvas.width  = img.width  * scale;
          canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * Compresses a base64 image string using canvas.
   * @param {string} base64
   * @param {number} maxWidth
   * @param {number} quality
   * @returns {Promise<string>} base64 data URL
   */
  compressImageFromBase64(base64, maxWidth = 250, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = base64;
    });
  },

  /**
   * Triggers a CSV file download in the browser.
   * @param {string} content  — CSV text
   * @param {string} filename — desired file name
   */
  downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Parses CSV text into an array of row arrays, skipping the header row.
   * @param {string} text
   * @returns {string[][]}
   */
  parseCSVRows(text) {
    return text
      .split('\n')
      .map(line => line.split(','))
      .slice(1); // skip header
  },

};
