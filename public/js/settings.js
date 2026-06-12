/**
 * settings.js — Settings module for the UAT Dashboard.
 * 
 * Manages global dashboard configuration like the branding logo.
 * 
 * Depends on: window.API, window.State, window.UI, window.Utils
 */

(function () {

  /**
   * Loads global settings from the API and stores them in State.settings.
   * @returns {Promise<void>}
   */
  async function load() {
    try {
      const data = await API.get('/api/settings');
      if (data) {
        State.settings = data;
        // Trigger UI update once settings are loaded
        if (window.UI && typeof window.UI.updateBranding === 'function') {
          window.UI.updateBranding();
        }
      }
    } catch (err) {
      console.warn('[settings] Failed to load global settings (500/401). Using defaults.', err.message);
      // Do not throw, so that loadAllData() can finish other loaders
    }
  }

  /**
   * Handles the file input change for the dashboard logo (Admin only).
   * @param {Event} event 
   */
  async function updateLogo(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      UI.showToast('Please select a valid image file.', '#ef4444');
      return;
    }

    UI.showLoading('Uploading logo...');
    try {
      const compressed = await Utils.compressImage(file, 800, 0.85);
      const res = await API.post('/api/settings', {
        dashboardLogo: compressed
      });

      if (res && res.dashboardLogo) {
        if (!State.settings) State.settings = {};
        State.settings.dashboardLogo = res.dashboardLogo;
        
        // Update UI immediately
        UI.updateBranding();
        UI.showToast('Logo updated successfully.');
      }
    } catch (err) {
      UI.showToast('Failed to update logo: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
      event.target.value = ''; // Reset input
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.Settings = {
    load,
    updateLogo,
  };

})();
