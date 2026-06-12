/**
 * picklists.js
 * Manages the Picklist Administration UI and State populating.
 * 
 * Depends on: window.API, window.State, window.UI
 */

(function () {
    let currentDragItem = null;

    async function loadPicklists() {
        try {
            const data = await API.get('/api/picklists');
            if (data) {
                State.picklists = data;
                populateDropdowns();
                if (State.currentUser && State.currentUser.role === 'admin') {
                    renderPicklistEditor();
                }
            }
        } catch (err) {
            console.warn('[picklists] Failed to load picklists', err.message);
        }
    }

    /**
     * Injects the dynamic picklist data into the UI dropdowns
     */
    function populateDropdowns() {
        if (!State.picklists) return;

        // Modules
        if (State.picklists['Modules']) {
            const moduleSelect = document.getElementById('pageModuleSelect');
            if (moduleSelect) {
                // Keep the first placeholder
                const placeholder = moduleSelect.options[0].outerHTML;
                moduleSelect.innerHTML = placeholder + State.picklists['Modules'].map(v => 
                    `<option value="${Utils.escapeHtml(v)}">${Utils.escapeHtml(v)}</option>`
                ).join('');
            }
        }

        // Designations
        if (State.picklists['Designations']) {
            const desigSelect = document.getElementById('userDesignationSelect');
            if (desigSelect) {
                // Keep the first placeholder
                const placeholder = desigSelect.options[0].outerHTML;
                desigSelect.innerHTML = placeholder + State.picklists['Designations'].map(v => 
                    `<option value="${Utils.escapeHtml(v)}">${Utils.escapeHtml(v)}</option>`
                ).join('');
            }
        }
    }

    /**
     * Renders the picklist editor in the Admin panel
     */
    function renderPicklistEditor() {
        try {
            const select = document.getElementById('picklistSelect');
            const container = document.getElementById('picklistValuesContainer');
            if (!select || !container || !State.picklists) return;

        const currentName = select.value;
        if (!currentName) {
            container.innerHTML = '<div style="color:#888; font-size:12px;">Please select a picklist.</div>';
            return;
        }
        
        const values = State.picklists[currentName] || [];

        if (values.length === 0) {
            container.innerHTML = '<div style="color:#888; font-size:12px;">No values found for this picklist.</div>';
            return;
        }

        container.innerHTML = '';
        values.forEach((value, index) => {
            const row = document.createElement('div');
            row.className = 'picklist-item';
            row.style.background = 'rgba(255,255,255,0.05)';
            row.style.padding = '8px 12px';
            row.style.marginBottom = '6px';
            row.style.borderRadius = '6px';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.cursor = 'grab';
            row.draggable = true;
            row.dataset.value = value;
            row.dataset.index = index;

            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; flex:1;">
                    <span style="opacity:0.5; cursor:grab;">☰</span>
                    <span class="value-text" style="flex:1;">${Utils.escapeHtml(value)}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-secondary rename-btn" style="padding:4px 8px; font-size:11px;" title="Rename">✏️</button>
                    <button class="btn-danger delete-btn" style="padding:4px 8px; font-size:11px;" title="Delete">❌</button>
                </div>
            `;

            // Drag events
            row.addEventListener('dragstart', handleDragStart);
            row.addEventListener('dragover', handleDragOver);
            row.addEventListener('drop', handleDrop);
            row.addEventListener('dragend', handleDragEnd);

            // Button events
            row.querySelector('.rename-btn').addEventListener('click', () => promptRename(currentName, value));
            row.querySelector('.delete-btn').addEventListener('click', () => promptDelete(currentName, value));

            container.appendChild(row);
        });
        } catch (err) {
            console.error('[Picklists] Render error:', err);
            const container = document.getElementById('picklistValuesContainer');
            if (container) container.innerHTML = '<div style="color:#ef4444; padding:10px;">Error rendering picklist.</div>';
        }
    }

    // --- Drag and Drop Logic --- //

    function handleDragStart(e) {
        currentDragItem = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        this.style.opacity = '0.4';
    }

    function handleDragOver(e) {
        if (e.preventDefault) e.preventDefault(); // Necessary. Allows us to drop.
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    async function handleDrop(e) {
        if (e.stopPropagation) e.stopPropagation();

        if (currentDragItem !== this) {
            const container = document.getElementById('picklistValuesContainer');
            const items = Array.from(container.querySelectorAll('.picklist-item'));
            const fromIndex = parseInt(currentDragItem.dataset.index);
            const toIndex = parseInt(this.dataset.index);

            // Reorder the array locally
            const currentName = document.getElementById('picklistSelect').value;
            const arr = State.picklists[currentName];
            
            const [movedItem] = arr.splice(fromIndex, 1);
            arr.splice(toIndex, 0, movedItem);

            renderPicklistEditor();

            // Save to server
            UI.showLoading('Saving order...');
            try {
                await API.post('/api/picklists', {
                    action: 'reorder',
                    name: currentName,
                    values: arr
                });
                populateDropdowns();
            } catch (err) {
                UI.showToast('Failed to save order: ' + err.message, '#ef4444');
                await loadPicklists(); // Re-sync from server to fix mismatch
            } finally {
                UI.hideLoading();
            }
        }
        return false;
    }

    function handleDragEnd(e) {
        this.style.opacity = '1';
        currentDragItem = null;
    }

    // --- Action Handlers --- //

    async function handleAddValue() {
        const input = document.getElementById('newPicklistValue');
        const val = input.value.trim();
        const currentName = document.getElementById('picklistSelect').value;

        if (!val) return;
        if (State.picklists[currentName]?.includes(val)) {
            UI.showToast('Value already exists', '#ef4444');
            return;
        }

        UI.showLoading('Adding...');
        try {
            await API.post('/api/picklists', { action: 'add', name: currentName, value: val });
            if (!State.picklists[currentName]) State.picklists[currentName] = [];
            State.picklists[currentName].push(val);
            input.value = '';
            
            renderPicklistEditor();
            populateDropdowns();
            UI.showToast('Value added');
        } catch (err) {
            UI.showToast('Failed to add: ' + err.message, '#ef4444');
        } finally {
            UI.hideLoading();
        }
    }

    async function promptRename(name, oldValue) {
        const newVal = prompt(`Rename '${oldValue}' to:`, oldValue);
        if (!newVal || newVal.trim() === oldValue.trim()) return;

        UI.showLoading('Renaming and updating records...');
        try {
            await API.post('/api/picklists', { action: 'rename', name, oldValue, newValue: newVal.trim() });
            
            // local update
            const idx = State.picklists[name].indexOf(oldValue);
            if (idx !== -1) State.picklists[name][idx] = newVal.trim();
            
            renderPicklistEditor();
            populateDropdowns();
            UI.showToast('Renamed successfully (including related records)');
        } catch (err) {
            UI.showToast('Failed to rename: ' + err.message, '#ef4444');
        } finally {
            UI.hideLoading();
        }
    }

    async function promptDelete(name, value) {
        if (!confirm(`Are you sure you want to delete '${value}'?`)) return;

        UI.showLoading('Checking usage...');
        try {
            // First attempt to delete without a replacement
            await API.post('/api/picklists', { action: 'delete', name, value });
            
            // if success, update locally
            State.picklists[name] = State.picklists[name].filter(v => v !== value);
            renderPicklistEditor();
            populateDropdowns();
            UI.showToast('Deleted successfully');

        } catch (err) {
            UI.hideLoading();
            // Handle specific IN_USE error
            if (err.message && err.message.includes('IN_USE')) {
                // Determine a replacement via prompt (in a real app, a custom modal is better, doing simple prompt here)
                const options = State.picklists[name].filter(v => v !== value);
                const replacement = prompt(`${err.message.replace('IN_USE: ', '')}\n\nEnter one of the following exact replacements:\n${options.join(', ')}`);
                
                if (replacement && options.includes(replacement.trim())) {
                    UI.showLoading('Migrating records and deleting...');
                    try {
                        await API.post('/api/picklists', { action: 'delete', name, value, replacementValue: replacement.trim() });
                        State.picklists[name] = State.picklists[name].filter(v => v !== value);
                        renderPicklistEditor();
                        populateDropdowns();
                        UI.showToast(`Records migrated to '${replacement}' and old value deleted`);
                    } catch (e2) {
                        UI.showToast('Migration Error: ' + e2.message, '#ef4444');
                    }
                } else if (replacement) {
                    UI.showToast('Invalid replacement value entered. Deletion cancelled.', '#ef4444');
                }
            } else {
                UI.showToast('Failed to delete: ' + err.message, '#ef4444');
            }
        } finally {
            UI.hideLoading();
        }
    }

    // --- Init --- //

    function setupEventListeners() {
        document.getElementById('picklistSelect')?.addEventListener('change', renderPicklistEditor);
        
        const addBtn = document.getElementById('addPicklistValueBtn');
        const addInput = document.getElementById('newPicklistValue');
        
        if (addBtn) addBtn.addEventListener('click', handleAddValue);
        if (addInput) addInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAddValue();
        });
    }

    window.Picklists = {
        load: loadPicklists,
        render: renderPicklistEditor,
        initUI: () => {
            setupEventListeners();
            renderPicklistEditor();
        }
    };

})();
