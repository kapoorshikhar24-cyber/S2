/**
 * files.js — Shared Files module for the UAT Dashboard.
 *
 * Manages file uploads, listing, and sharing for Admins and Users.
 *
 * Depends on: window.API, window.State, window.UI, window.Utils
 */

(function () {

  let stagedFile = null;

  /**
   * Fetches all files from the API and stores them in State.files.
   */
  async function load() {
    try {
      const data = await API.get('/api/files');
      if (data) State.files = data;
    } catch (err) {
      console.error('[files] Failed to load files:', err);
    }
  }

  /**
   * Handles the file input change event for admin uploads.
   * Swaps placeholder for file info UI.
   * Now accepts either an event or a direct File object.
   */
  function handleFileSelect(inputSource) {
    let file = null;
    if (inputSource instanceof File) {
      file = inputSource;
    } else if (inputSource && inputSource.target && inputSource.target.files) {
      file = inputSource.target.files[0];
    }

    if (!file) return;

    // Vercel Serverless limit is 4.5MB total. With base64 overhead, 3MB is a safe limit.
    if (file.size > 3 * 1024 * 1024) {
      UI.showToast('File is too large for serverless upload. Max 3MB.', '#ef4444');
      if (!(inputSource instanceof File)) inputSource.target.value = '';
      return;
    }

    stagedFile = file;

    const placeholder = document.getElementById('fileUploadPlaceholder');
    const info        = document.getElementById('fileUploadInfo');
    const nameLabel   = document.getElementById('uploadedFileName');
    const sizeLabel   = document.getElementById('uploadedFileSize');

    if (nameLabel) nameLabel.textContent = file.name;
    if (sizeLabel) sizeLabel.textContent = formatBytes(file.size);
    if (placeholder) placeholder.style.display = 'none';
    if (info)        info.style.display = 'block';
  }

  /**
   * Reads the file, converts to base64, and POSTs to /api/files.
   */
  async function upload() {
    const projectSelect = document.getElementById('fileProjectSelect');
    const uploadBtn = document.getElementById('fileUploadBtn');

    if (!stagedFile) {
      UI.showToast('Please select a file to upload.', '#ef4444');
      return;
    }

    const file = stagedFile;
    const project = projectSelect ? projectSelect.value : 'Global';

    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading...';
    }

    UI.showLoading('Uploading file...');
    try {
      const base64 = await fileToBase64(file);
      
      const response = await API.post('/api/files', {
        name: file.name,
        type: file.type,
        size: file.size,
        project: project,
        fileData: base64
      });

      if (response) {
        State.files.unshift(response);
        render();
        resetUploadForm();
        UI.showToast('File uploaded successfully.');
      }
    } catch (err) {
      UI.showToast('Upload failed: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '➕ Upload File';
      }
    }
  }

  /**
   * Deletes a file record.
   */
  async function deleteFile(id) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    UI.showLoading('Deleting file...');
    try {
      await API.del('/api/files', { _id: id });
      State.files = State.files.filter(f => f._id !== id);
      render();
      UI.showToast('File deleted.');
    } catch (err) {
      UI.showToast('Delete failed: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * Renders the files table.
   */
  function render() {
    const tbody = document.getElementById('filesTableBody');
    const empty = document.getElementById('emptyFiles');
    const searchInput = document.getElementById('fileSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (!tbody) return;

    let filtered = State.files || [];
    if (query) {
      filtered = filtered.filter(f => f.name.toLowerCase().includes(query));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
    } else {
      if (empty) empty.style.display = 'none';

      const isAdmin = State.currentUser && State.currentUser.role === 'admin';

      tbody.innerHTML = filtered.map((file, idx) => {
        const date = Utils.formatDate(file.createdAt);
        const size = formatBytes(file.size);
        const projectBadge = file.project === 'Global' 
          ? '<span class="badge" style="background:rgba(139, 92, 246, 0.2); color:#a78bfa;">Global</span>'
          : '<span class="badge badge-user">' + Utils.escapeHtml(file.project) + '</span>';

        let actions = '<a href="' + file.url + '" target="_blank" class="btn btn-sm btn-secondary" style="text-decoration:none;">📥 Download</a>';
        if (isAdmin) {
          actions += ' <button class="btn btn-sm btn-danger" onclick="Files.deleteFile(\'' + file._id + '\')">🗑️ Delete</button>';
        }

        return '<tr>' +
          '<td>' + (idx + 1) + '</td>' +
          '<td style="font-weight:500;">' + Utils.escapeHtml(file.name) + '</td>' +
          '<td>' + projectBadge + '</td>' +
          '<td>' + size + '</td>' +
          '<td>' + date + '</td>' +
          '<td>' + actions + '</td>' +
          '</tr>';
      }).join('');
    }
  }

  /**
   * Populates the project selection dropdown.
   */
  function populateProjectSelect() {
    const select = document.getElementById('fileProjectSelect');
    if (!select) return;

    // Keep "Global"
    select.innerHTML = '<option value="Global">Global (Visible to all)</option>';

    if (State.projects) {
      State.projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        select.appendChild(opt);
      });
    }
  }

  /**
   * Resets the upload form UI.
   */
  function resetUploadForm() {
    stagedFile = null;
    const fileInput = document.getElementById('fileInput');
    const placeholder = document.getElementById('fileUploadPlaceholder');
    const info        = document.getElementById('fileUploadInfo');
    
    if (fileInput) fileInput.value = '';
    if (placeholder) placeholder.style.display = 'block';
    if (info)        info.style.display = 'none';
  }

  // --- Internal Helpers ---

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function init() {
    const area = document.getElementById('fileUploadArea');
    if (area) {
      area.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        const input = document.getElementById('fileInput');
        if (input) input.click();
      });
      
      area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.style.borderColor = 'var(--primary)';
        area.style.background = 'rgba(79, 70, 229, 0.05)';
      });

      area.addEventListener('dragleave', () => {
        area.style.borderColor = '';
        area.style.background = '';
      });

      area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.style.borderColor = '';
        area.style.background = '';
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
          handleFileSelect(file);
        }
      });
    }

    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);

    const uploadBtn = document.getElementById('fileUploadBtn');
    if (uploadBtn) uploadBtn.addEventListener('click', upload);

    const searchInput = document.getElementById('fileSearchInput');
    if (searchInput) searchInput.addEventListener('input', render);
  }

  // Run init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.Files = {
    load,
    render,
    deleteFile,
    populateProjectSelect
  };

})();
