import sys

def patch_history():
    path = r"c:\Users\Shikhar Kapoor\Downloads\Programs\Salesforce\v1.0\salesforce_automator.html"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add Pagination UI below table
    old_table_end = """              <tbody id="historyTableBody">
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </form>"""
    new_table_end = """              <tbody id="historyTableBody">
              </tbody>
            </table>
          </div>
          <div id="historyPagination" style="display:flex; justify-content:flex-end; gap:8px; margin-top:1rem; align-items:center;">
             <button type="button" class="save-btn" style="padding:0.3rem 0.6rem; font-size:0.75rem; border-radius:6px;" onclick="prevHistoryPage()">Prev</button>
             <span id="historyPageInfo" style="font-size:0.8rem; color:var(--muted);">Page 1 of 1</span>
             <button type="button" class="save-btn" style="padding:0.3rem 0.6rem; font-size:0.75rem; border-radius:6px;" onclick="nextHistoryPage()">Next</button>
          </div>
        </div>
      </div>

    </form>"""
    content = content.replace(old_table_end, new_table_end)

    # 2. JS pagination variables
    old_js_vars = """  let allHistoryData = [];
  let filteredHistoryData = [];

  async function loadHistory() {"""
    new_js_vars = """  let allHistoryData = [];
  let filteredHistoryData = [];
  let historyCurrentPage = 1;
  const historyPerPage = 10;

  async function loadHistory() {"""
    content = content.replace(old_js_vars, new_js_vars)

    # 3. Update renderHistoryTable
    old_render = """  function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (filteredHistoryData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--muted);">No history found.</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    filteredHistoryData.forEach(row => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      const d = new Date(row.timestamp);
      
      let actionHtml = '';
      if (row.dataType !== 'Validation Rule') {"""
    
    new_render = """  function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (filteredHistoryData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--muted);">No history found.</td></tr>';
      document.getElementById('historyPageInfo').textContent = 'Page 1 of 1';
      return;
    }
    tbody.innerHTML = '';
    
    const totalPages = Math.ceil(filteredHistoryData.length / historyPerPage);
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    if (historyCurrentPage < 1) historyCurrentPage = 1;
    
    document.getElementById('historyPageInfo').textContent = `Page ${historyCurrentPage} of ${totalPages}`;
    
    const startIdx = (historyCurrentPage - 1) * historyPerPage;
    const pageData = filteredHistoryData.slice(startIdx, startIdx + historyPerPage);
    
    pageData.forEach(row => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      const d = new Date(row.timestamp);
      
      let actionHtml = '';
      if (row.dataType !== 'Validation Rule' && row.dataType !== 'User Creation') {"""
    content = content.replace(old_render, new_render)
    
    # 4. Add prev/next functions
    old_filter = """  function filterHistory() {"""
    new_filter = """  function prevHistoryPage() {
    if (historyCurrentPage > 1) {
      historyCurrentPage--;
      renderHistoryTable();
    }
  }
  function nextHistoryPage() {
    const totalPages = Math.ceil(filteredHistoryData.length / historyPerPage);
    if (historyCurrentPage < totalPages) {
      historyCurrentPage++;
      renderHistoryTable();
    }
  }

  function filterHistory() {"""
    content = content.replace(old_filter, new_filter)
    
    # 5. reset page on filter
    old_filter_render = """    }
    renderHistoryTable();
  }"""
    new_filter_render = """    }
    historyCurrentPage = 1;
    renderHistoryTable();
  }"""
    content = content.replace(old_filter_render, new_filter_render)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

patch_history()
