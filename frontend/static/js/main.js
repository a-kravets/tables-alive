// ===== DASHBOARD JAVASCRIPT =====
console.log("🚀 Dashboard logic loaded");

// Global state
let dashboardData = null;
let filteredData = null;
let currentColumns = []; // Original names
let columnMapping = {}; // Original -> New
let widgets = [];
let activeFilters = [];
let selectedWidgetId = null;

// DOM Elements
const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    userBtn: document.getElementById('user-btn'),
    userDropdown: document.getElementById('user-dropdown'),
    sheetUrl: document.getElementById('sheet_url'),
    gidInput: document.getElementById('gid_input'),
    hasHeaders: document.getElementById('has_headers'),
    loadDataBtn: document.getElementById('load-data-btn'),
    reloadDataBtn: document.getElementById('reload-data-btn'),
    renameDetails: document.getElementById('column-rename-details'),
    renameInputsList: document.getElementById('rename-inputs-list'),
    addChartBtn: document.getElementById('add-chart-btn'),
    addTableBtn: document.getElementById('add-table-btn'),
    addFilterBtn: document.getElementById('add-filter-btn'),
    activeFiltersList: document.getElementById('active-filters'),
    workspaceCanvas: document.getElementById('workspace-canvas'),
    sidebarSettings: document.getElementById('sidebar-settings-content'),
    saveBtn: document.getElementById('save-dashboard-btn'),
    shareBtn: document.getElementById('share-dashboard-btn'),
    exportBtn: document.getElementById('export-dashboard-btn'),
    connStatus: document.getElementById('connection-status'),
    authModal: document.getElementById('auth-modal-overlay'),
    mobileToggle: document.getElementById('menu-toggle'),
    navMenu: document.querySelector('.nav-menu'),
    disconnectBtn: document.getElementById('disconnect-data-btn')
};

// State Extension
let isLoggedIn = false; // Mock auth state

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadState(); // Restore settings
    updateActiveNavLink();
});

function updateActiveNavLink() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === path) {
            link.classList.add('active');
        } else if (path === '/' && href === '/dashboards') {
            // Default active for root
            link.classList.add('active');
        }
    });
}

function setupEventListeners() {
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            saveState();
        });
    }

    if (elements.mobileToggle && elements.navMenu) {
        elements.mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.navMenu.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            elements.navMenu.classList.remove('show');
        });
    }

    if (elements.userBtn) {
        elements.userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isLoggedIn) {
                showAuthModal();
            } else if (elements.userDropdown) {
                elements.userDropdown.classList.toggle('show');
            }
        });

        window.addEventListener('click', () => {
            if (elements.userDropdown) elements.userDropdown.classList.remove('show');
        });
    }

    if (elements.loadDataBtn) elements.loadDataBtn.addEventListener('click', () => loadData());
    if (elements.reloadDataBtn) elements.reloadDataBtn.addEventListener('click', () => loadData());

    if (elements.addChartBtn) elements.addChartBtn.addEventListener('click', () => addWidget('chart'));
    if (elements.addTableBtn) elements.addTableBtn.addEventListener('click', () => addWidget('table'));

    if (elements.addFilterBtn) elements.addFilterBtn.addEventListener('click', () => addFilterRow());

    if (elements.disconnectBtn) elements.disconnectBtn.addEventListener('click', disconnectData);

    // Auth Gating for Header Links
    document.querySelectorAll('.nav-link-gated').forEach(link => {
        link.addEventListener('click', (e) => {
            if (!isLoggedIn) {
                e.preventDefault();
                showAuthModal();
            }
        });
    });

    // Auth Modal Logic
    if (elements.authModal) {
        elements.authModal.querySelector('.close-modal-btn').onclick = hideAuthModal;
        elements.authModal.onclick = (e) => { if (e.target === elements.authModal) hideAuthModal(); };

        const tabs = elements.authModal.querySelectorAll('.auth-tab');
        const submitBtn = elements.authModal.querySelector('.auth-submit-btn');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const mode = tab.dataset.mode;
                submitBtn.textContent = mode === 'login' ? 'Login (Coming soon)' : 'Create Account (Coming soon)';
                submitBtn.disabled = true;
            };
        });

        elements.authModal.querySelector('.auth-form').onsubmit = (e) => {
            e.preventDefault();
            isLoggedIn = true;
            hideAuthModal();
            alert('Logged in successfully!');
            // Update UI if needed
            document.querySelector('.user-name').textContent = 'User';
        };
    }

    // GID Auto-extraction
    if (elements.sheetUrl) {
        elements.sheetUrl.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.includes('gid=')) {
                const match = val.match(/[#&]gid=([0-9]+)/);
                if (match && match[1]) {
                    elements.gidInput.value = match[1];
                    saveState();
                }
            }
        });
    }
}

// --- Persistence ---
function saveState() {
    const state = {
        sheetUrl: elements.sheetUrl.value,
        gid: elements.gidInput.value,
        hasHeaders: elements.hasHeaders.checked,
        dashboardData,
        columnMapping,
        currentColumns,
        widgets: widgets.map(w => ({
            id: w.id,
            type: w.type,
            config: w.config
        })),
        filters: Array.from(document.querySelectorAll('.filter-row')).map(row => ({
            col: row.querySelector('.filter-col').value,
            op: row.querySelector('.filter-op').value,
            val: row.querySelector('.filter-val')?.value || '',
            start: row.querySelector('.filter-start')?.value || '',
            end: row.querySelector('.filter-end')?.value || ''
        }))
    };
    localStorage.setItem('dashboard_state', JSON.stringify(state));
    console.log("💾 State saved to localStorage");
}

function loadState() {
    const saved = localStorage.getItem('dashboard_state');
    if (!saved) return;

    try {
        const state = JSON.parse(saved);
        elements.sheetUrl.value = state.sheetUrl || '';
        elements.gidInput.value = state.gid || '0';
        elements.hasHeaders.checked = state.hasHeaders !== false;

        if (state.dashboardData) {
            dashboardData = state.dashboardData;
            filteredData = [...dashboardData];
            currentColumns = state.currentColumns || Object.keys(dashboardData[0]);
            columnMapping = state.columnMapping || {};

            updateStatus('connected');
            if (document.querySelector('.empty-canvas-message')) {
                document.querySelector('.empty-canvas-message').style.display = 'none';
            }

            renderRenameSection();
            if (elements.renameDetails) elements.renameDetails.style.display = 'block';

            // Restore Filters
            if (state.filters) {
                state.filters.forEach(f => {
                    const row = addFilterRow(false);
                    row.querySelector('.filter-col').value = f.col;
                    row.querySelector('.filter-op').value = f.op;
                    row.querySelector('.filter-col').dispatchEvent(new Event('change'));
                    if (row.querySelector('.filter-val')) row.querySelector('.filter-val').value = f.val;
                    if (row.querySelector('.filter-start')) row.querySelector('.filter-start').value = f.start;
                    if (row.querySelector('.filter-end')) row.querySelector('.filter-end').value = f.end;
                });
            }

            // Restore Widgets
            if (state.widgets) {
                state.widgets.forEach(w => {
                    restoreWidget(w);
                });
            }

            if (elements.disconnectBtn) elements.disconnectBtn.style.display = 'block';

            applyFilters();
        }
    } catch (e) {
        console.error("❌ Failed to load state:", e);
    }
}

function restoreWidget(w) {
    const template = document.querySelector(`.${w.type}-widget`);
    if (!template) return;

    const newNode = template.cloneNode(true);
    newNode.id = w.id;
    newNode.style.display = 'block';

    // Set Custom Name
    newNode.querySelector('.widget-title').textContent = w.config.name || (w.type === 'chart' ? 'Chart Widget' : 'Table Widget');

    newNode.querySelector('.widget-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        newNode.remove();
        widgets = widgets.filter(wid => wid.id !== w.id);
        if (selectedWidgetId === w.id) clearSidebarSettings();
        saveState();
    });

    newNode.querySelector('.widget-config-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showWidgetSettings(w.id);
    });

    newNode.addEventListener('click', () => showWidgetSettings(w.id));

    widgets.push(w);
    elements.workspaceCanvas.appendChild(newNode);
    refreshWidget(w.id);
}

// --- Sidebar Settings ---
// --- Sidebar Settings ---
function showWidgetSettings(widgetId) {
    selectedWidgetId = widgetId;
    const w = widgets.find(obj => obj.id === widgetId);
    if (!w) return;

    // Highlight active widget
    document.querySelectorAll('.widget').forEach(node => node.classList.remove('active-widget'));
    document.getElementById(widgetId).classList.add('active-widget');

    elements.sidebarSettings.innerHTML = '';

    // Common Settings: Widget Name
    const nameSection = createConfigSection('Widget Name:', true); // Open name section by default
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'input-text';
    nameInput.value = w.config.name || (w.type === 'chart' ? 'Chart Widget' : 'Table Widget');
    nameInput.oninput = (e) => {
        w.config.name = e.target.value;
        const titleNode = document.getElementById(widgetId).querySelector('.widget-title');
        if (titleNode) titleNode.textContent = e.target.value;
        saveState();
    };
    nameSection.appendChild(nameInput);
    elements.sidebarSettings.appendChild(nameSection);

    if (w.type === 'chart') {
        renderChartSettings(w);
    } else {
        renderTableSettings(w);
    }
}

function clearSidebarSettings() {
    selectedWidgetId = null;
    elements.sidebarSettings.innerHTML = '<div class="settings-empty-msg"><p>Select a widget to configure its settings</p></div>';
}

function createConfigSection(label, isOpen = false) {
    const details = document.createElement('details');
    details.className = 'config-section-expandable';
    if (isOpen) details.open = true;

    const summary = document.createElement('summary');
    summary.className = 'config-section-summary';
    summary.textContent = label;

    details.appendChild(summary);
    return details;
}

function renderChartSettings(w) {
    // Chart Type
    const typeSect = createConfigSection('Chart Type:');
    const typeSel = document.createElement('select');
    typeSel.className = 'input-select';
    ['bar', 'line', 'area', 'pie', 'scatter', 'histogram'].forEach(t => {
        const opt = document.createElement('option'); opt.value = t; opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
        opt.selected = w.config.type === t;
        typeSel.appendChild(opt);
    });
    typeSel.onchange = (e) => { w.config.type = e.target.value; renderChart(w.id); saveState(); };
    typeSect.appendChild(typeSel);
    elements.sidebarSettings.appendChild(typeSect);

    // X Axis
    const xSect = createConfigSection('X Axis (Multi):');
    const xSel = document.createElement('select');
    xSel.className = 'input-select';
    xSel.multiple = true;
    currentColumns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = getMappedName(c);
        opt.selected = w.config.xCols.includes(c);
        xSel.appendChild(opt);
    });
    xSel.onchange = (e) => { w.config.xCols = Array.from(e.target.selectedOptions).map(o => o.value); renderChart(w.id); saveState(); };
    xSect.appendChild(xSel);
    elements.sidebarSettings.appendChild(xSect);

    // Y Axis
    const ySect = createConfigSection('Y Axis (Multi):');
    const ySel = document.createElement('select');
    ySel.className = 'input-select';
    ySel.multiple = true;
    currentColumns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = getMappedName(c);
        opt.selected = w.config.yCols.includes(c);
        ySel.appendChild(opt);
    });
    ySel.onchange = (e) => { w.config.yCols = Array.from(e.target.selectedOptions).map(o => o.value); renderChart(w.id); saveState(); };
    ySect.appendChild(ySel);
    elements.sidebarSettings.appendChild(ySect);

    // Grouping
    const gSect = createConfigSection('Group By:');
    const gSel = document.createElement('select');
    gSel.className = 'input-select';
    gSel.innerHTML = '<option value="">None</option>';
    currentColumns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = getMappedName(c);
        opt.selected = w.config.group === c;
        gSel.appendChild(opt);
    });

    // Period (initially hidden)
    const pSect = createConfigSection('Period:');
    pSect.style.display = w.config.group ? 'block' : 'none';
    const pSel = document.createElement('select');
    pSel.className = 'input-select';
    ['hour', 'day', 'week', 'month', 'year'].forEach(p => {
        const opt = document.createElement('option'); opt.value = p; opt.textContent = p.charAt(0).toUpperCase() + p.slice(1);
        opt.selected = (w.config.period || 'day') === p;
        pSel.appendChild(opt);
    });
    pSel.onchange = (e) => { w.config.period = e.target.value; renderChart(w.id); saveState(); };
    pSect.appendChild(pSel);

    gSel.onchange = (e) => {
        w.config.group = e.target.value;
        pSect.style.display = e.target.value ? 'block' : 'none';
        renderChart(w.id);
        saveState();
    };
    gSect.appendChild(gSel);
    elements.sidebarSettings.appendChild(gSect);
    elements.sidebarSettings.appendChild(pSect);

    // Aggregation
    const aggSect = createConfigSection('Aggregation:');
    const aggSel = document.createElement('select');
    aggSel.className = 'input-select';
    ['sum', 'mean', 'count', 'min', 'max'].forEach(a => {
        const opt = document.createElement('option'); opt.value = a; opt.textContent = a.charAt(0).toUpperCase() + a.slice(1);
        opt.selected = w.config.agg === a;
        aggSel.appendChild(opt);
    });
    aggSel.onchange = (e) => { w.config.agg = e.target.value; renderChart(w.id); saveState(); };
    aggSect.appendChild(aggSel);
    elements.sidebarSettings.appendChild(aggSect);
}

function renderTableSettings(w) {
    // Columns
    const cSect = createConfigSection('Columns:');
    const cSel = document.createElement('select');
    cSel.className = 'input-select';
    cSel.multiple = true;
    currentColumns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = getMappedName(c);
        opt.selected = w.config.columns.includes(c);
        cSel.appendChild(opt);
    });
    cSel.onchange = (e) => {
        w.config.columns = Array.from(e.target.selectedOptions).map(o => o.value);
        renderTable(w.id);
        saveState();
        updateReorderUI(w);
    };
    cSect.appendChild(cSel);

    // Reorder UI
    const reorderDiv = document.createElement('div');
    reorderDiv.className = 'column-reorder-buttons';
    reorderDiv.id = `reorder-${w.id}`;
    cSect.appendChild(reorderDiv);
    elements.sidebarSettings.appendChild(cSect);
    updateReorderUI(w);

    // Grouping
    const gSect = createConfigSection('Group By:');
    const gSel = document.createElement('select');
    gSel.className = 'input-select';
    gSel.innerHTML = '<option value="">None</option>';
    currentColumns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = getMappedName(c);
        opt.selected = w.config.group === c;
        gSel.appendChild(opt);
    });

    const pSect = createConfigSection('Group Period:');
    pSect.style.display = w.config.group ? 'block' : 'none';
    const pSel = document.createElement('select');
    pSel.className = 'input-select';
    ['hour', 'day', 'week', 'month', 'year'].forEach(p => {
        const opt = document.createElement('option'); opt.value = p; opt.textContent = p.charAt(0).toUpperCase() + p.slice(1);
        opt.selected = (w.config.period || 'day') === p;
        pSel.appendChild(opt);
    });
    pSel.onchange = (e) => { w.config.period = e.target.value; renderTable(w.id); saveState(); };
    pSect.appendChild(pSel);

    gSel.onchange = (e) => {
        w.config.group = e.target.value;
        pSect.style.display = e.target.value ? 'block' : 'none';
        renderTable(w.id);
        saveState();
    };
    gSect.appendChild(gSel);
    elements.sidebarSettings.appendChild(gSect);
    elements.sidebarSettings.appendChild(pSect);

    // Aggregation
    const aggSect = createConfigSection('Aggregation:');
    const aggSel = document.createElement('select');
    aggSel.className = 'input-select';
    ['sum', 'mean', 'count', 'min', 'max'].forEach(a => {
        const opt = document.createElement('option'); opt.value = a; opt.textContent = a.charAt(0).toUpperCase() + a.slice(1);
        opt.selected = w.config.agg === a;
        aggSel.appendChild(opt);
    });
    aggSel.onchange = (e) => { w.config.agg = e.target.value; renderTable(w.id); saveState(); };
    aggSect.appendChild(aggSel);
    elements.sidebarSettings.appendChild(aggSect);

    // Export
    const expSect = createConfigSection('Actions:');
    const expBtn = document.createElement('button');
    expBtn.className = 'btn-secondary';
    expBtn.textContent = '📥 Export CSV';
    expBtn.onclick = () => exportCSV(w.id);
    expSect.appendChild(expBtn);
    elements.sidebarSettings.appendChild(expSect);
}

function updateReorderUI(w) {
    const container = document.getElementById(`reorder-${w.id}`);
    if (!container) return;
    container.innerHTML = '';
    w.config.columns.forEach((c, i) => {
        const tag = document.createElement('div');
        tag.className = 'reorder-tag';
        const lbl = document.createElement('span'); lbl.className = 'reorder-label'; lbl.textContent = getMappedName(c);
        tag.appendChild(lbl);
        if (i > 0) {
            const up = document.createElement('button'); up.className = 'reorder-btn-sm'; up.innerHTML = '◀';
            up.onclick = () => { [w.config.columns[i - 1], w.config.columns[i]] = [w.config.columns[i], w.config.columns[i - 1]]; updateReorderUI(w); renderTable(w.id); saveState(); };
            tag.prepend(up);
        }
        if (i < w.config.columns.length - 1) {
            const dn = document.createElement('button'); dn.className = 'reorder-btn-sm'; dn.innerHTML = '▶';
            dn.onclick = () => { [w.config.columns[i], w.config.columns[i + 1]] = [w.config.columns[i + 1], w.config.columns[i]]; updateReorderUI(w); renderTable(w.id); saveState(); };
            tag.appendChild(dn);
        }
        container.appendChild(tag);
    });
}

// --- Data Management ---
async function loadData() {
    const url = elements.sheetUrl.value;
    const gid = elements.gidInput.value || '0';
    const hasHeaders = elements.hasHeaders ? elements.hasHeaders.checked : true;

    if (!url) {
        alert('Please enter a Google Sheet URL');
        return;
    }

    updateStatus('connecting');

    try {
        const response = await fetch('/api/proxy/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheet_url: url, gid: gid, has_headers: hasHeaders })
        });

        if (!response.ok) throw new Error('Failed to fetch data');

        let rawData = await response.json();

        if (rawData.length > 0) {
            if (!hasHeaders && rawData.length > 0) {
                // Use generic headers: Col 1, Col 2...
                // keys will be "0", "1", "2"... from backend's to_dict
                const keys = Object.keys(rawData[0]);
                const nameMap = {};
                keys.forEach((k, i) => {
                    nameMap[k] = `Col ${i + 1}`;
                });

                // Map ALL records - row 0 remains row 0
                rawData = rawData.map(row => {
                    const renamed = {};
                    keys.forEach(k => {
                        renamed[nameMap[k]] = row[k];
                    });
                    return renamed;
                });
            }

            dashboardData = rawData;
            filteredData = [...dashboardData];
            currentColumns = Object.keys(dashboardData[0]);
            columnMapping = {};
            currentColumns.forEach(id => columnMapping[id] = id);

            renderRenameSection();
            if (elements.renameDetails) elements.renameDetails.style.display = 'block';
            updateStatus('connected');
            if (elements.disconnectBtn) elements.disconnectBtn.style.display = 'block';
            if (document.querySelector('.empty-canvas-message')) document.querySelector('.empty-canvas-message').style.display = 'none';
            saveState();
            refreshAllWidgets();
        }
    } catch (error) {
        console.error("❌ Error loading data:", error);
        updateStatus('error');
    }
}

function disconnectData() {
    if (!confirm('Are you sure you want to disconnect from the data source? This will clear all data and widgets.')) return;

    // Reset state
    dashboardData = null;
    filteredData = null;
    currentColumns = [];
    columnMapping = {};
    widgets = [];
    activeFilters = [];
    selectedWidgetId = null;

    // Clear UI
    elements.sheetUrl.value = '';
    elements.gidInput.value = '0';
    elements.workspaceCanvas.innerHTML = `
        <div class="empty-canvas-message">
            <div class="empty-message">
                <h3>🎯 Welcome to TablesAlive</h3>
                <p>Connect a data source and start adding charts and tables to build your dashboard!</p>
            </div>
        </div>
    `;
    elements.activeFiltersList.innerHTML = '';
    if (elements.renameInputsList) elements.renameInputsList.innerHTML = '';
    if (elements.renameDetails) elements.renameDetails.style.display = 'none';
    if (elements.disconnectBtn) elements.disconnectBtn.style.display = 'none';
    clearSidebarSettings();

    updateStatus('disconnected');

    // Clear footer filters if present
    const footer = document.getElementById('filters-footer');
    if (footer) footer.style.display = 'none';

    // Clear localStorage
    localStorage.removeItem('dashboard_state');

    console.log("🔌 Data source disconnected and state cleared.");
}

function updateStatus(state) {
    if (!elements.connStatus) return;
    const indicator = elements.connStatus.querySelector('.status-indicator');
    const text = elements.connStatus.querySelector('.status-text');
    if (indicator) indicator.className = 'status-indicator ' + state;
    if (text) text.innerHTML = state.charAt(0).toUpperCase() + state.slice(1);
}

// --- Render ---
function refreshAllWidgets() {
    widgets.forEach(w => refreshWidget(w.id));
}

function refreshWidget(id) {
    const w = widgets.find(obj => obj.id === id);
    if (!w) return;
    if (w.type === 'chart') renderChart(id);
    else renderTable(id);
}

function renderChart(id) {
    const node = document.getElementById(id);
    const w = widgets.find(obj => obj.id === id);
    if (!node || !filteredData || !filteredData.length) return;

    const xCols = w.config.xCols;
    const yCols = w.config.yCols;
    if (!xCols.length || !yCols.length) return;

    let data = [...filteredData];
    if (w.config.group) {
        const grouped = {};
        data.forEach(row => {
            let key = row[w.config.group];
            if (w.config.period && !isNaN(Date.parse(key))) {
                const d = new Date(key);
                if (w.config.period === 'year') key = d.getFullYear();
                else if (w.config.period === 'month') key = `${d.getFullYear()}-${d.getMonth() + 1}`;
                else if (w.config.period === 'week') {
                    const day = d.getDay(),
                        diff = d.getDate() - day + (day == 0 ? -6 : 1); // Monday
                    const monday = new Date(d.setDate(diff));
                    key = monday.toISOString().split('T')[0];
                }
                else if (w.config.period === 'day') key = d.toISOString().split('T')[0];
                else if (w.config.period === 'hour') key = d.toISOString().split(':')[0];
            }
            if (!grouped[key]) grouped[key] = { vals: {}, count: 0, xVals: {} };
            yCols.forEach(y => {
                if (!grouped[key].vals[y]) grouped[key].vals[y] = [];
                const v = parseFloat(row[y]);
                if (!isNaN(v)) grouped[key].vals[y].push(v);
            });
            xCols.forEach(x => { if (grouped[key].xVals[x] === undefined) grouped[key].xVals[x] = row[x]; });
            grouped[key].count++;
        });

        data = Object.keys(grouped).map(k => {
            const g = grouped[k];
            const res = { [w.config.group]: k };
            xCols.forEach(x => res[x] = g.xVals[x]);
            yCols.forEach(y => {
                const l = g.vals[y];
                let val = 0;
                if (w.config.agg === 'sum') val = l.reduce((a, b) => a + b, 0);
                else if (w.config.agg === 'mean') val = l.reduce((a, b) => a + b, 0) / (l.length || 1);
                else if (w.config.agg === 'count') val = g.count;
                else if (w.config.agg === 'min') val = l.length ? Math.min(...l) : 0;
                else if (w.config.agg === 'max') val = l.length ? Math.max(...l) : 0;
                res[y] = Math.round(val * 100) / 100;
            });
            return res;
        });
    }

    const traces = [];
    xCols.forEach(x => {
        yCols.forEach(y => {
            traces.push({
                x: data.map(d => d[x]),
                y: data.map(d => d[y]),
                type: w.config.type === 'area' ? 'scatter' : (w.config.type === 'pie' ? 'pie' : w.config.type),
                fill: w.config.type === 'area' ? 'tozeroy' : undefined,
                name: `${getMappedName(x)} | ${getMappedName(y)}`
            });
        });
    });

    const placeholder = node.querySelector('.chart-placeholder');
    const layout = {
        margin: { t: 30, b: 50, l: 50, r: 30 },
        barmode: 'group',
        autosize: true,
        xaxis: { automargin: true },
        yaxis: { automargin: true },
        font: { family: 'Inter, sans-serif' }
    };

    Plotly.react(placeholder, traces, layout, { responsive: true, displayModeBar: false });

    // Force a resize check after a micro-task to ensure container dimensions are final
    setTimeout(() => {
        Plotly.Plots.resize(placeholder);
    }, 100);
}

function renderTable(id) {
    const node = document.getElementById(id);
    const w = widgets.find(obj => obj.id === id);
    if (!node || !filteredData || !filteredData.length) return;

    let data = [...filteredData];
    const cols = w.config.columns;
    if (!cols.length) {
        node.querySelector('.table-container').innerHTML = '<div class="settings-empty-msg">Select columns in settings</div>';
        return;
    }

    if (w.config.group) {
        const grouped = {};
        data.forEach(row => {
            let key = row[w.config.group];
            if (w.config.period && !isNaN(Date.parse(key))) {
                const d = new Date(key);
                if (w.config.period === 'year') key = d.getFullYear();
                else if (w.config.period === 'month') key = `${d.getFullYear()}-${d.getMonth() + 1}`;
                else if (w.config.period === 'week') {
                    const day = d.getDay(),
                        diff = d.getDate() - day + (day == 0 ? -6 : 1); // Monday
                    const monday = new Date(d.setDate(diff));
                    key = monday.toISOString().split('T')[0];
                }
                else if (w.config.period === 'day') key = d.toISOString().split('T')[0];
                else if (w.config.period === 'hour') key = d.toISOString().split(':')[0];
            }
            if (!grouped[key]) {
                grouped[key] = { [w.config.group]: key, '_vals': {} };
                cols.forEach(c => { if (c !== w.config.group) grouped[key]._vals[c] = []; });
            }
            cols.forEach(c => {
                if (c !== w.config.group) {
                    const v = parseFloat(row[c]);
                    if (!isNaN(v)) grouped[key]._vals[c].push(v);
                    else grouped[key]._vals[c].push(row[c]);
                }
            });
        });

        data = Object.keys(grouped).map(k => {
            const g = grouped[k];
            const res = { [w.config.group]: g[w.config.group] };
            cols.forEach(c => {
                if (c !== w.config.group) {
                    const l = g._vals[c];
                    const nl = l.filter(v => typeof v === 'number');
                    if (nl.length > 0) {
                        let val = 0;
                        if (w.config.agg === 'sum') val = nl.reduce((a, b) => a + b, 0);
                        else if (w.config.agg === 'mean') val = nl.reduce((a, b) => a + b, 0) / (nl.length || 1);
                        else if (w.config.agg === 'count') val = l.length;
                        else if (w.config.agg === 'min') val = Math.min(...nl);
                        else if (w.config.agg === 'max') val = Math.max(...nl);
                        res[c] = Math.round(val * 100) / 100;
                    } else {
                        res[c] = w.config.agg === 'count' ? l.length : l[0];
                    }
                }
            });
            return res;
        });
    }

    const html = `<table class="data-table"><thead><tr>${cols.map(c => `<th>${getMappedName(c)}</th>`).join('')}</tr></thead><tbody>${data.slice(0, 50).map(r => `<tr>${cols.map(c => `<td>${r[c] !== undefined ? r[c] : ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    node.querySelector('.table-container').innerHTML = html;
}

// --- Filters ---
function addFilterRow(autoApply = true) {
    if (!currentColumns.length) return;
    const row = document.createElement('div');
    row.className = 'filter-row';
    row.innerHTML = `
        <div class="filter-controls">
            <select class="filter-col input-select"></select>
            <select class="filter-op input-select">
                <option value="=">=</option><option value="!=">!=</option>
                <option value=">">></option><option value="<"><</option>
                <option value="contains">contains</option><option value="between">between</option>
            </select>
            <button class="remove-filter-btn">✕</button>
        </div>
        <div class="filter-values">
            <input type="text" class="filter-val input-text" placeholder="Value...">
            <input type="date" class="filter-start input-text" style="display:none">
            <input type="date" class="filter-end input-text" style="display:none">
        </div>
    `;

    const cSel = row.querySelector('.filter-col');
    currentColumns.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = getMappedName(c); cSel.appendChild(o); });

    const updateUI = () => {
        const col = cSel.value;
        const op = row.querySelector('.filter-op').value;
        const sample = dashboardData?.[0]?.[col] || '';
        const isDate = !isNaN(Date.parse(sample)) && (String(sample).includes('-') || String(sample).includes('/'));

        const vIn = row.querySelector('.filter-val');
        const sIn = row.querySelector('.filter-start');
        const eIn = row.querySelector('.filter-end');

        if (isDate) {
            vIn.style.display = 'none';
            sIn.style.display = 'block';
            eIn.style.display = op === 'between' ? 'block' : 'none';
        } else {
            vIn.style.display = 'block';
            sIn.style.display = 'none';
            eIn.style.display = 'none';
        }
    };

    row.querySelectorAll('select, input').forEach(el => el.onchange = () => { if (autoApply) applyFilters(); saveState(); });
    row.querySelector('.remove-filter-btn').onclick = () => { row.remove(); applyFilters(); saveState(); };
    cSel.onchange = () => { updateUI(); if (autoApply) applyFilters(); saveState(); };
    row.querySelector('.filter-op').onchange = () => { updateUI(); if (autoApply) applyFilters(); saveState(); };

    elements.activeFiltersList.appendChild(row);
    updateUI();
    return row;
}

function applyFilters() {
    if (!dashboardData) return;
    const fRows = document.querySelectorAll('.filter-row');
    filteredData = dashboardData.filter(r => {
        for (let row of fRows) {
            const c = row.querySelector('.filter-col').value;
            const op = row.querySelector('.filter-op').value;
            const val = row.querySelector('.filter-val')?.value.toLowerCase() || '';
            const s = row.querySelector('.filter-start')?.value || '';
            const e = row.querySelector('.filter-end')?.value || '';

            let rv = r[c];
            if (rv === null || rv === undefined) return false;

            // Date handling logic
            const rvDate = Date.parse(rv);
            const isDateCol = !isNaN(rvDate) && (String(rv).includes('-') || String(rv).includes('/'));

            if (isDateCol) {
                const targetRV = new Date(rvDate).getTime();
                if (op === 'between') {
                    if (s && targetRV < new Date(s).getTime()) return false;
                    if (e && targetRV > new Date(e).getTime()) return false;
                } else if (op === '=') {
                    if (s && new Date(targetRV).toISOString().split('T')[0] !== s) return false;
                } else if (op === '!=') {
                    if (s && new Date(targetRV).toISOString().split('T')[0] === s) return false;
                } else if (op === '>') {
                    if (s && targetRV <= new Date(s).getTime()) return false;
                } else if (op === '<') {
                    if (s && targetRV >= new Date(s).getTime()) return false;
                }
            } else {
                const rs = String(rv).toLowerCase();
                if (op === 'between') {
                    const numRV = parseFloat(rv);
                    if (s && numRV < parseFloat(s)) return false;
                    if (e && numRV > parseFloat(e)) return false;
                } else if (op === '=') { if (val && rs !== val) return false; }
                else if (op === '!=') { if (val && rs === val) return false; }
                else if (op === 'contains') { if (val && !rs.includes(val)) return false; }
                else if (op === '>') { if (val && parseFloat(rv) <= parseFloat(val)) return false; }
                else if (op === '<') { if (val && parseFloat(rv) >= parseFloat(val)) return false; }
            }
        }
        return true;
    });
    refreshAllWidgets();
}

// --- Utils ---
function getMappedName(orig) { return columnMapping[orig] || orig; }

function showAuthModal() {
    if (elements.authModal) elements.authModal.style.display = 'flex';
}

function hideAuthModal() {
    if (elements.authModal) elements.authModal.style.display = 'none';
}

function addWidget(type) {
    const w = { id: 'widget-' + Date.now(), type, config: { name: '', type: 'bar', xCols: [], yCols: [], columns: [], agg: 'sum', group: '', period: 'day' } };
    restoreWidget(w);
    showWidgetSettings(w.id);
    saveState();
}
function exportCSV(id) {
    const table = document.getElementById(id).querySelector('table');
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tr'));
    const csv = rows.map(r => Array.from(r.querySelectorAll('th,td')).map(c => `"${c.innerText}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'export.csv'; a.click();
}
function exportDashboard() {
    const blob = new Blob([JSON.stringify({ widgets, activeFilters, columnMapping, dashboardData }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'dashboard-config.json'; a.click();
}
function renderRenameSection() {
    if (!elements.renameInputsList) return;
    elements.renameInputsList.innerHTML = '';
    currentColumns.forEach(orig => {
        const row = document.createElement('div'); row.className = 'rename-row';
        const input = document.createElement('input'); input.type = 'text'; input.className = 'input-text';
        input.value = columnMapping[orig] || orig;
        input.onchange = (e) => { columnMapping[orig] = e.target.value; refreshAllWidgets(); saveState(); };
        row.innerHTML = `<label>${orig}</label>`;
        row.appendChild(input);
        elements.renameInputsList.appendChild(row);
    });
}
