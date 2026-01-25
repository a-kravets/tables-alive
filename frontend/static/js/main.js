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
let datasourceData = {}; // Map of datasource_id -> {data, columns, columnMapping, filteredData}

// Grid layout state
let gridColumns = 12;
let gridRows = 10;
let draggingWidget = null;
let resizingWidget = null;
let resizeHandle = null;
let dragStartPos = { x: 0, y: 0 };
let resizeStartPos = { x: 0, y: 0, w: 0, h: 0 };

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
    disconnectBtn: document.getElementById('disconnect-data-btn'),
    datasourceSelector: document.getElementById('datasource-selector'),
    datasourceSelectorContainer: document.getElementById('datasource-selector-container')
};

// State Extension
// State Extension
let isLoggedIn = false;
let currentUser = null;
let currentDatasourceId = null; // Track current datasource ID if saved

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus(); // Check if already logged in
    setupEventListeners();
    
    // Initialize grid layout
    updateGridLayout();
    
    // Check for items to load from sessionStorage (from listing pages)
    checkForSavedItemToLoad();
    
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
    
    const saveDataSourceBtn = document.getElementById('save-datasource-btn');
    if (saveDataSourceBtn) saveDataSourceBtn.addEventListener('click', () => saveDataSource());

    // Datasource selector dropdown
    if (elements.datasourceSelector) {
        elements.datasourceSelector.addEventListener('change', async (e) => {
            const selectedId = e.target.value;
            if (selectedId === '') {
                // "New Datasource" selected - clear form
                elements.sheetUrl.value = '';
                elements.gidInput.value = '0';
                if (elements.hasHeaders) elements.hasHeaders.checked = true;
                currentDatasourceId = null;
                return;
            }
            
            // Load saved datasource
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please log in to load saved datasources');
                return;
            }
            
            try {
                const response = await fetch(`/api/datasources/${selectedId}`, {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });
                
                if (!response.ok) throw new Error('Failed to load datasource');
                
                const datasource = await response.json();
                await loadSavedDataSource(datasource);
            } catch (error) {
                console.error('Error loading datasource:', error);
                alert('Failed to load datasource: ' + error.message);
                // Reset selector to "New Datasource"
                e.target.value = '';
            }
        });
    }

    if (elements.addChartBtn) elements.addChartBtn.addEventListener('click', () => addWidget('chart'));
    if (elements.addTableBtn) elements.addTableBtn.addEventListener('click', () => addWidget('table'));
    
    const addReportBtn = document.getElementById('add-report-btn');
    if (addReportBtn) {
        addReportBtn.addEventListener('click', () => showReportSelectionModal());
    }
    
    const reportModal = document.getElementById('report-selection-modal');
    if (reportModal) {
        const closeBtn = document.getElementById('close-report-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => hideReportSelectionModal());
        }
        reportModal.addEventListener('click', (e) => {
            if (e.target === reportModal) hideReportSelectionModal();
        });
    }

    if (elements.addFilterBtn) elements.addFilterBtn.addEventListener('click', () => addFilterRow());

    if (elements.disconnectBtn) elements.disconnectBtn.addEventListener('click', disconnectData);
    
    const saveDashboardBtn = document.getElementById('save-dashboard-btn');
    if (saveDashboardBtn) saveDashboardBtn.addEventListener('click', () => saveDashboard());

    // Grid configuration
    if (elements.applyGridBtn) {
        elements.applyGridBtn.addEventListener('click', applyGridConfiguration);
    }
    if (elements.gridColsInput) {
        elements.gridColsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyGridConfiguration();
        });
    }
    if (elements.gridRowsInput) {
        elements.gridRowsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyGridConfiguration();
        });
    }

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
                submitBtn.textContent = mode === 'login' ? 'Login' : 'Create Account';
                // Toggle extra fields if needed (e.g. name) - for now just email/pass
            };
        });

        elements.authModal.querySelector('.auth-form').onsubmit = handleAuthSubmit;
    }

    // Logout Logic
    const logoutLink = document.querySelector('a[href="/logout"]');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
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

// --- Grid Layout Functions ---
function applyGridConfiguration() {
    const cols = parseInt(elements.gridColsInput.value) || 12;
    const rows = parseInt(elements.gridRowsInput.value) || 10;
    
    if (cols < 1 || cols > 24 || rows < 1 || rows > 50) {
        alert('Grid dimensions must be: Columns 1-24, Rows 1-50');
        return;
    }
    
    gridColumns = cols;
    gridRows = rows;
    updateGridLayout();
    saveState();
}

function updateGridLayout() {
    if (!elements.workspaceCanvas) return;
    elements.workspaceCanvas.style.setProperty('--grid-cols', gridColumns);
    elements.workspaceCanvas.style.setProperty('--grid-rows', gridRows);
    
    // Update input values
    if (elements.gridColsInput) elements.gridColsInput.value = gridColumns;
    if (elements.gridRowsInput) elements.gridRowsInput.value = gridRows;
}

function getNextAvailablePosition(w, h) {
    // Find next available position for a widget of size w x h
    for (let y = 1; y <= gridRows - h + 1; y++) {
        for (let x = 1; x <= gridColumns - w + 1; x++) {
            if (!isPositionOccupied(x, y, w, h, null)) {
                return { x, y };
            }
        }
    }
    // If no position found, try to place at end
    return { x: 1, y: Math.max(1, gridRows - h + 1) };
}

function isPositionOccupied(x, y, w, h, excludeWidgetId) {
    // Check if position (x, y) with size (w, h) overlaps with any existing widget
    for (const widget of widgets) {
        if (widget.id === excludeWidgetId) continue;
        const layout = widget.config.layout || { x: 1, y: 1, w: 4, h: 3 };
        const wx = layout.x || 1;
        const wy = layout.y || 1;
        const ww = layout.w || 4;
        const wh = layout.h || 3;
        
        // Check for overlap
        if (!(x + w <= wx || wx + ww <= x || y + h <= wy || wy + wh <= y)) {
            return true;
        }
    }
    return false;
}

function snapToGrid(clientX, clientY) {
    // Convert mouse position to grid coordinates
    const canvas = elements.workspaceCanvas;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - canvas.scrollLeft;
    const y = clientY - rect.top - canvas.scrollTop;
    
    // Calculate cell size
    const cellWidth = (rect.width - (gridColumns - 1) * 16) / gridColumns; // 16px gap
    const cellHeight = (rect.height - (gridRows - 1) * 16) / gridRows;
    
    const gridX = Math.max(1, Math.min(gridColumns, Math.floor(x / cellWidth) + 1));
    const gridY = Math.max(1, Math.min(gridRows, Math.floor(y / cellHeight) + 1));
    
    return { x: gridX, y: gridY };
}

function applyWidgetLayout(widgetElement, layout) {
    if (!layout) {
        layout = { x: 1, y: 1, w: 4, h: 3 };
    }
    widgetElement.style.setProperty('--widget-x', layout.x || 1);
    widgetElement.style.setProperty('--widget-y', layout.y || 1);
    widgetElement.style.setProperty('--widget-w', layout.w || 4);
    widgetElement.style.setProperty('--widget-h', layout.h || 3);
}

function setupWidgetDragAndResize(widgetElement, widget) {
    const header = widgetElement.querySelector('.widget-header');
    if (!header) return;
    
    // Make header draggable
    header.style.cursor = 'move';
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.widget-actions')) return;
        startDrag(e, widgetElement, widget);
    });
    
    // Setup resize handles
    const handles = widgetElement.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startResize(e, widgetElement, widget, handle);
        });
    });
}

function startDrag(e, widgetElement, widget) {
    e.preventDefault();
    draggingWidget = { element: widgetElement, widget: widget };
    const layout = widget.config.layout || { x: 1, y: 1, w: 4, h: 3 };
    dragStartPos = { 
        x: e.clientX, 
        y: e.clientY,
        gridX: layout.x,
        gridY: layout.y
    };
    
    widgetElement.classList.add('dragging');
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
}

function handleDrag(e) {
    if (!draggingWidget) return;
    
    const deltaX = e.clientX - dragStartPos.x;
    const deltaY = e.clientY - dragStartPos.y;
    
    // Convert pixel delta to grid units (approximate)
    const canvas = elements.workspaceCanvas;
    const rect = canvas.getBoundingClientRect();
    const cellWidth = (rect.width - (gridColumns - 1) * 16) / gridColumns;
    const cellHeight = (rect.height - (gridRows - 1) * 16) / gridRows;
    
    const gridDeltaX = Math.round(deltaX / cellWidth);
    const gridDeltaY = Math.round(deltaY / cellHeight);
    
    const layout = draggingWidget.widget.config.layout || { x: 1, y: 1, w: 4, h: 3 };
    const newX = Math.max(1, Math.min(gridColumns - layout.w + 1, dragStartPos.gridX + gridDeltaX));
    const newY = Math.max(1, Math.min(gridRows - layout.h + 1, dragStartPos.gridY + gridDeltaY));
    
    // Check for collisions
    if (!isPositionOccupied(newX, newY, layout.w, layout.h, draggingWidget.widget.id)) {
        layout.x = newX;
        layout.y = newY;
        applyWidgetLayout(draggingWidget.element, layout);
    }
}

function stopDrag() {
    if (draggingWidget) {
        draggingWidget.element.classList.remove('dragging');
        
        // If it's a chart widget, trigger chart resize after drag
        const placeholder = draggingWidget.element.querySelector('.chart-placeholder');
        if (placeholder) {
            setTimeout(() => {
                Plotly.Plots.resize(placeholder);
            }, 50);
        }
        
        draggingWidget = null;
        saveState();
    }
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
}

function startResize(e, widgetElement, widget, handle) {
    e.preventDefault();
    e.stopPropagation();
    
    resizingWidget = { element: widgetElement, widget: widget };
    resizeHandle = handle;
    const layout = widget.config.layout || { x: 1, y: 1, w: 4, h: 3 };
    resizeStartPos = {
        x: e.clientX,
        y: e.clientY,
        x1: layout.x,
        y1: layout.y,
        x2: layout.x + layout.w - 1,
        y2: layout.y + layout.h - 1,
        w: layout.w,
        h: layout.h
    };
    
    widgetElement.classList.add('resizing');
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
}

function handleResize(e) {
    if (!resizingWidget || !resizeHandle) return;
    
    const canvas = elements.workspaceCanvas;
    const rect = canvas.getBoundingClientRect();
    const cellWidth = (rect.width - (gridColumns - 1) * 16) / gridColumns;
    const cellHeight = (rect.height - (gridRows - 1) * 16) / gridRows;
    
    const deltaX = e.clientX - resizeStartPos.x;
    const deltaY = e.clientY - resizeStartPos.y;
    
    const gridDeltaX = Math.round(deltaX / cellWidth);
    const gridDeltaY = Math.round(deltaY / cellHeight);
    
    let newLayout = {
        x: resizeStartPos.x1,
        y: resizeStartPos.y1,
        w: resizeStartPos.w,
        h: resizeStartPos.h
    };
    
    const handleClass = resizeHandle.className;
    
    // Handle different resize directions
    if (handleClass.includes('top-left')) {
        newLayout.x = Math.max(1, Math.min(resizeStartPos.x2 - 1, resizeStartPos.x1 + gridDeltaX));
        newLayout.y = Math.max(1, Math.min(resizeStartPos.y2 - 1, resizeStartPos.y1 + gridDeltaY));
        newLayout.w = resizeStartPos.x2 - newLayout.x + 1;
        newLayout.h = resizeStartPos.y2 - newLayout.y + 1;
    } else if (handleClass.includes('top-right')) {
        newLayout.y = Math.max(1, Math.min(resizeStartPos.y2 - 1, resizeStartPos.y1 + gridDeltaY));
        newLayout.w = Math.max(2, Math.min(gridColumns - newLayout.x + 1, resizeStartPos.w + gridDeltaX));
        newLayout.h = resizeStartPos.y2 - newLayout.y + 1;
    } else if (handleClass.includes('bottom-left')) {
        newLayout.x = Math.max(1, Math.min(resizeStartPos.x2 - 1, resizeStartPos.x1 + gridDeltaX));
        newLayout.w = resizeStartPos.x2 - newLayout.x + 1;
        newLayout.h = Math.max(2, Math.min(gridRows - newLayout.y + 1, resizeStartPos.h + gridDeltaY));
    } else if (handleClass.includes('bottom-right')) {
        newLayout.w = Math.max(2, Math.min(gridColumns - newLayout.x + 1, resizeStartPos.w + gridDeltaX));
        newLayout.h = Math.max(2, Math.min(gridRows - newLayout.y + 1, resizeStartPos.h + gridDeltaY));
    } else if (handleClass.includes('top')) {
        newLayout.y = Math.max(1, Math.min(resizeStartPos.y2 - 1, resizeStartPos.y1 + gridDeltaY));
        newLayout.h = resizeStartPos.y2 - newLayout.y + 1;
    } else if (handleClass.includes('bottom')) {
        newLayout.h = Math.max(2, Math.min(gridRows - newLayout.y + 1, resizeStartPos.h + gridDeltaY));
    } else if (handleClass.includes('left')) {
        newLayout.x = Math.max(1, Math.min(resizeStartPos.x2 - 1, resizeStartPos.x1 + gridDeltaX));
        newLayout.w = resizeStartPos.x2 - newLayout.x + 1;
    } else if (handleClass.includes('right')) {
        newLayout.w = Math.max(2, Math.min(gridColumns - newLayout.x + 1, resizeStartPos.w + gridDeltaX));
    }
    
    // Ensure minimum size
    if (newLayout.w < 2) newLayout.w = 2;
    if (newLayout.h < 2) newLayout.h = 2;
    
    // Check bounds
    if (newLayout.x + newLayout.w - 1 > gridColumns) {
        newLayout.w = gridColumns - newLayout.x + 1;
    }
    if (newLayout.y + newLayout.h - 1 > gridRows) {
        newLayout.h = gridRows - newLayout.y + 1;
    }
    
    // Check for collisions (excluding self)
    if (!isPositionOccupied(newLayout.x, newLayout.y, newLayout.w, newLayout.h, resizingWidget.widget.id)) {
        resizingWidget.widget.config.layout = newLayout;
        applyWidgetLayout(resizingWidget.element, newLayout);
    }
}

function stopResize() {
    if (resizingWidget) {
        resizingWidget.element.classList.remove('resizing');
        
        // If it's a chart widget, trigger chart resize
        const placeholder = resizingWidget.element.querySelector('.chart-placeholder');
        if (placeholder) {
            setTimeout(() => {
                Plotly.Plots.resize(placeholder);
            }, 50);
        }
        
        resizingWidget = null;
        resizeHandle = null;
        saveState();
    }
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
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
        gridColumns,
        gridRows,
        widgets: widgets.map(w => ({
            id: w.id,
            type: w.type,
            datasource_id: w.datasource_id || currentDatasourceId,
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

    // Only load state on dashboard page (where these elements exist)
    if (!elements.sheetUrl || !elements.gidInput || !elements.hasHeaders) {
        return;
    }

    try {
        const state = JSON.parse(saved);
        elements.sheetUrl.value = state.sheetUrl || '';
        elements.gidInput.value = state.gid || '0';
        elements.hasHeaders.checked = state.hasHeaders !== false;

        // Restore grid configuration
        if (state.gridColumns) gridColumns = state.gridColumns;
        if (state.gridRows) gridRows = state.gridRows;
        updateGridLayout();

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
                // Restore widgets for localStorage state (they use current datasource)
                // Note: restoreWidget is async but we don't await here since it's from localStorage
                state.widgets.forEach(w => {
                    const widget = {
                        ...w,
                        datasource_id: w.datasource_id || currentDatasourceId
                    };
                    restoreWidget(widget).catch(err => console.error('Error restoring widget:', err));
                });
            }

            if (elements.disconnectBtn) elements.disconnectBtn.style.display = 'block';

            applyFilters();
        }
    } catch (e) {
        console.error("❌ Failed to load state:", e);
    }
}

async function restoreWidget(w) {
    const template = document.querySelector(`.${w.type}-widget`);
    if (!template) return;

    // Ensure widget's datasource data is loaded
    const dsId = w.datasource_id || currentDatasourceId;
    if (dsId && !datasourceData[dsId]) {
        try {
            await loadDatasourceData(dsId);
        } catch (error) {
            console.error(`Failed to load datasource ${dsId} for widget:`, error);
            // Continue anyway - widget might render with empty data
        }
    }

    const newNode = template.cloneNode(true);
    newNode.id = w.id;
    newNode.style.display = 'block';

    // Initialize layout if not present
    if (!w.config.layout) {
        const pos = getNextAvailablePosition(4, 3);
        w.config.layout = { x: pos.x, y: pos.y, w: 4, h: 3 };
    }
    
    // Apply layout to widget
    applyWidgetLayout(newNode, w.config.layout);

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

    newNode.addEventListener('click', (e) => {
        // Don't trigger settings if clicking on resize handle or action buttons
        if (!e.target.classList.contains('resize-handle') && 
            !e.target.closest('.widget-actions')) {
            showWidgetSettings(w.id);
        }
    });

    // Setup drag and resize
    setupWidgetDragAndResize(newNode, w);

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

    // Auto-select the widget's datasource in the datasource selector
    const widgetDatasourceId = w.datasource_id || currentDatasourceId;
    if (elements.datasourceSelector && widgetDatasourceId) {
        elements.datasourceSelector.value = widgetDatasourceId;
    }

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

    // Save as Report button (only for logged in users)
    if (isLoggedIn) {
        const reportSection = createConfigSection('Actions:', true);
        const saveReportBtn = document.createElement('button');
        saveReportBtn.className = 'btn-secondary';
        saveReportBtn.textContent = '💾 Save as Report';
        saveReportBtn.onclick = () => saveReport(widgetId);
        reportSection.appendChild(saveReportBtn);
        elements.sidebarSettings.appendChild(reportSection);
    }

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

    // Get widget-specific columns and mapping
    const widgetColumns = getWidgetColumns(w);
    const widgetMapping = getWidgetColumnMapping(w);
    const getWidgetMappedName = (col) => widgetMapping[col] || col;

    // X Axis
    const xSect = createConfigSection('X Axis (Multi):');
    const xSel = document.createElement('select');
    xSel.className = 'input-select';
    xSel.multiple = true;
    widgetColumns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = getWidgetMappedName(c);
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
    widgetColumns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = getWidgetMappedName(c);
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
    widgetColumns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = getWidgetMappedName(c);
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
    // Get widget-specific columns and mapping
    const widgetColumns = getWidgetColumns(w);
    const widgetMapping = getWidgetColumnMapping(w);
    const getWidgetMappedName = (col) => widgetMapping[col] || col;

    // Columns
    const cSect = createConfigSection('Columns:');
    const cSel = document.createElement('select');
    cSel.className = 'input-select';
    cSel.multiple = true;
    widgetColumns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = getWidgetMappedName(c);
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
    widgetColumns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = getWidgetMappedName(c);
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

            // Store in datasourceData map
            if (currentDatasourceId) {
                datasourceData[currentDatasourceId] = {
                    data: dashboardData,
                    filteredData: filteredData,
                    columns: currentColumns,
                    columnMapping: columnMapping
                };
            }

            renderRenameSection();
            if (elements.renameDetails) elements.renameDetails.style.display = 'block';
            updateStatus('connected');
            if (elements.disconnectBtn) elements.disconnectBtn.style.display = 'block';
            const saveDataSourceBtn = document.getElementById('save-datasource-btn');
            if (saveDataSourceBtn) saveDataSourceBtn.style.display = 'block';
            const saveDashboardBtn = document.getElementById('save-dashboard-btn');
            if (saveDashboardBtn && isLoggedIn) saveDashboardBtn.style.display = 'block';
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
    const saveDataSourceBtn = document.getElementById('save-datasource-btn');
    if (saveDataSourceBtn) saveDataSourceBtn.style.display = 'none';
    // Reset datasource selector to "New Datasource"
    if (elements.datasourceSelector) {
        elements.datasourceSelector.value = '';
    }
    currentDatasourceId = null;
    clearSidebarSettings();

    updateStatus('disconnected');

    // Clear footer filters if present
    const footer = document.getElementById('filters-footer');
    if (footer) footer.style.display = 'none';

    // Clear localStorage
    localStorage.removeItem('dashboard_state');
    
    // Reset dashboard title
    const dashboardTitle = document.getElementById('dashboard-title');
    if (dashboardTitle) {
        dashboardTitle.textContent = 'My Dashboard';
    }

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
    if (!node || !w) return;

    // Get widget-specific data
    const widgetData = getWidgetData(w);
    if (!widgetData || !widgetData.length) return;

    const xCols = w.config.xCols;
    const yCols = w.config.yCols;
    if (!xCols.length || !yCols.length) return;

    let data = [...widgetData];
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
            const widgetMapping = getWidgetColumnMapping(w);
            const getWidgetMappedName = (col) => widgetMapping[col] || col;
            traces.push({
                x: data.map(d => d[x]),
                y: data.map(d => d[y]),
                type: w.config.type === 'area' ? 'scatter' : (w.config.type === 'pie' ? 'pie' : w.config.type),
                fill: w.config.type === 'area' ? 'tozeroy' : undefined,
                name: `${getWidgetMappedName(x)} | ${getWidgetMappedName(y)}`
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
    
    // Set up resize observer to resize chart when widget is resized
    if (!node.dataset.chartResizeObserver) {
        const resizeObserver = new ResizeObserver(() => {
            if (placeholder && placeholder.offsetWidth > 0 && placeholder.offsetHeight > 0) {
                Plotly.Plots.resize(placeholder);
            }
        });
        resizeObserver.observe(node);
        node.dataset.chartResizeObserver = 'true';
    }
}

function renderTable(id) {
    const node = document.getElementById(id);
    const w = widgets.find(obj => obj.id === id);
    if (!node || !w) return;

    // Get widget-specific data
    const widgetData = getWidgetData(w);
    if (!widgetData || !widgetData.length) return;

    let data = [...widgetData];
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

    const widgetMapping = getWidgetColumnMapping(w);
    const getWidgetMappedName = (col) => widgetMapping[col] || col;
    const html = `<table class="data-table"><thead><tr>${cols.map(c => `<th>${getWidgetMappedName(c)}</th>`).join('')}</tr></thead><tbody>${data.slice(0, 50).map(r => `<tr>${cols.map(c => `<td>${r[c] !== undefined ? r[c] : ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
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
    // Apply filters to primary datasource
    if (!dashboardData) return;
    const fRows = document.querySelectorAll('.filter-row');
    
    // Helper function to filter a single row
    const filterRow = (r, columns) => {
        for (let row of fRows) {
            const c = row.querySelector('.filter-col').value;
            // Skip if column doesn't exist in this datasource
            if (!columns.includes(c)) continue;
            
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
    };
    
    // Apply filters to primary datasource
    filteredData = dashboardData.filter(r => filterRow(r, currentColumns));
    
    // Apply filters to all datasources in datasourceData
    for (const dsId in datasourceData) {
        const dsData = datasourceData[dsId];
        if (dsData && dsData.data) {
            dsData.filteredData = dsData.data.filter(r => filterRow(r, dsData.columns || []));
        }
    }
    
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
    const pos = getNextAvailablePosition(4, 3);
    const w = { 
        id: 'widget-' + Date.now(), 
        type, 
        datasource_id: currentDatasourceId, // Use current datasource
        config: { 
            name: '', 
            type: 'bar', 
            xCols: [], 
            yCols: [], 
            columns: [], 
            agg: 'sum', 
            group: '', 
            period: 'day',
            layout: { x: pos.x, y: pos.y, w: 4, h: 3 }
        } 
    };
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

// --- Auth Helpers ---

async function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
        updateAuthUI(null);
        return;
    }

    try {
        const response = await fetch('/api/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            isLoggedIn = true;
            updateAuthUI(user);
        } else {
            // Token invalid or expired
            localStorage.removeItem('token');
            isLoggedIn = false;
            updateAuthUI(null);
        }
    } catch (e) {
        console.error("Auth check failed:", e);
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const form = e.target;
    // We need to know if it is Login or Register.
    // The tabs control UI, but form is same?
    // base.html structure: 2 tabs, 1 form.
    // We can verify which tab is active.

    const activeTab = elements.authModal.querySelector('.auth-tab.active');
    const mode = activeTab ? activeTab.dataset.mode : 'login';

    // Form fields: First input is email, second is password.
    // Ideally add IDs/names to base.html inputs, but currently by order:
    const inputs = form.querySelectorAll('input');
    const email = inputs[0].value;
    const password = inputs[1].value;

    const endpoint = mode === 'login' ? '/api/login' : '/api/register';

    try {
        let body, headers;
        if (mode === 'login') {
            // Login expects form data or x-www-form-urlencoded usually for OAuth2
            // My proxy endpoint /api/login expects Form Data because it forwards to backend /token (OAuth2PasswordRequestForm)
            // Wait, backend /auth/token expects username and password form fields.
            // Frontend proxy `/api/login` does: `form = await request.form(); requests.post(..., data=form)`
            // So we should send FormData from JS.
            const formData = new FormData();
            formData.append('username', email);
            formData.append('password', password);
            body = formData;
            // No content-type header, let browser set boundary
        } else {
            // Register expects JSON: {email, password}
            body = JSON.stringify({ email, password });
            headers = { 'Content-Type': 'application/json' };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            body: body,
            headers: headers
        });

        const data = await response.json();

        if (response.ok) {
            if (mode === 'login') {
                localStorage.setItem('token', data.access_token);
                hideAuthModal();
                checkAuthStatus(); // Refresh UI
                if (window.location.pathname === '/login' || window.location.pathname === '/register') {
                    window.location.href = '/dashboard';
                }
            } else {
                alert('Registration successful! Please login.');
                // Switch to login tab
                const loginTab = elements.authModal.querySelector('[data-mode="login"]');
                if (loginTab) loginTab.click();
            }
        } else {
            alert(data.detail || 'Authentication failed');
        }
    } catch (err) {
        console.error(err);
        alert('An error occurred');
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    isLoggedIn = false;
    currentUser = null;
    updateAuthUI(null);
    if (window.location.pathname === '/dashboard') {
        window.location.href = '/';
    }
}

async function fetchSavedDatasources() {
    if (!isLoggedIn || !elements.datasourceSelector) return [];
    
    const token = localStorage.getItem('token');
    if (!token) return [];
    
    try {
        const response = await fetch('/api/datasources', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            isLoggedIn = false;
            updateAuthUI(null);
            return [];
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch datasources');
        }
        
        const datasources = await response.json();
        return datasources || [];
    } catch (error) {
        console.error('Error fetching datasources:', error);
        return [];
    }
}

function populateDatasourceSelector(datasources) {
    if (!elements.datasourceSelector) return;
    
    // Clear existing options except "New Datasource"
    elements.datasourceSelector.innerHTML = '<option value="">+ New Data Source</option>';
    
    if (datasources && datasources.length > 0) {
        datasources.forEach(ds => {
            const option = document.createElement('option');
            option.value = ds.id;
            option.textContent = ds.name || `Data Source ${ds.id}`;
            elements.datasourceSelector.appendChild(option);
        });
        
        // Show the selector container
        if (elements.datasourceSelectorContainer) {
            elements.datasourceSelectorContainer.style.display = 'block';
        }
    } else {
        // Hide the selector if no saved datasources
        if (elements.datasourceSelectorContainer) {
            elements.datasourceSelectorContainer.style.display = 'none';
        }
    }
}

async function updateDatasourceSelector() {
    if (!isLoggedIn) {
        if (elements.datasourceSelectorContainer) {
            elements.datasourceSelectorContainer.style.display = 'none';
        }
        return;
    }
    
    const datasources = await fetchSavedDatasources();
    populateDatasourceSelector(datasources);
}

function updateAuthUI(user) {
    const userBtn = elements.userBtn;
    if (!userBtn) return;

    const userNameSpan = userBtn.querySelector('.user-name');

    if (user) {
        // Logged In
        userNameSpan.textContent = user.email.split('@')[0]; // Show part of email
        // Show auth-only links
        document.querySelectorAll('.nav-link-gated').forEach(el => el.style.opacity = '1');
        // Show save dashboard button if data is loaded
        const saveDashboardBtn = document.getElementById('save-dashboard-btn');
        if (saveDashboardBtn && dashboardData) saveDashboardBtn.style.display = 'block';
        // Show add report button
        const addReportBtn = document.getElementById('add-report-btn');
        if (addReportBtn) addReportBtn.style.display = 'block';
        // Update datasource selector
        updateDatasourceSelector();
        // Note: functionality is guarded by isLoggedIn flag already
    } else {
        // Guest
        userNameSpan.textContent = 'Guest';
        // Hide datasource selector
        if (elements.datasourceSelectorContainer) {
            elements.datasourceSelectorContainer.style.display = 'none';
        }
        // Maybe dim gated links?
    }
}

// --- Save/Load Functions ---

// Check for saved items to load from sessionStorage
async function checkForSavedItemToLoad() {
    // Check for datasource to load
    const loadDataSource = sessionStorage.getItem('loadDataSource');
    if (loadDataSource) {
        sessionStorage.removeItem('loadDataSource');
        const ds = JSON.parse(loadDataSource);
        await loadSavedDataSource(ds);
        return;
    }

    // Check for dashboard to load
    const loadDashboard = sessionStorage.getItem('loadDashboard');
    if (loadDashboard) {
        sessionStorage.removeItem('loadDashboard');
        const dash = JSON.parse(loadDashboard);
        await loadSavedDashboard(dash);
        return;
    }

    // Check for report to load
    const loadReport = sessionStorage.getItem('loadReport');
    if (loadReport) {
        sessionStorage.removeItem('loadReport');
        const report = JSON.parse(loadReport);
        await loadSavedReport(report);
        return;
    }
}

// Data Source Functions
async function saveDataSource() {
    if (!isLoggedIn) {
        showAuthModal();
        return;
    }

    const url = elements.sheetUrl.value;
    const gid = elements.gidInput.value || '0';
    const hasHeaders = elements.hasHeaders ? elements.hasHeaders.checked : true;

    if (!url) {
        alert('Please enter a Google Sheet URL first');
        return;
    }

    const name = prompt('Enter a name for this data source:');
    if (!name) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/datasources', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                url: url,
                config: {
                    gid: gid,
                    has_headers: hasHeaders
                }
            })
        });

        if (response.ok) {
            const datasource = await response.json();
            currentDatasourceId = datasource.id;
            // Update the selector to include the newly saved datasource
            await updateDatasourceSelector();
            // Select the newly saved datasource in the dropdown
            if (elements.datasourceSelector) {
                elements.datasourceSelector.value = datasource.id;
            }
            alert('Data source saved successfully!');
        } else {
            const error = await response.json();
            alert(error.detail || 'Failed to save data source');
        }
    } catch (error) {
        console.error('Error saving data source:', error);
        alert('Failed to save data source');
    }
}

async function loadSavedDataSource(datasource) {
    currentDatasourceId = datasource.id;
    elements.sheetUrl.value = datasource.url;
    elements.gidInput.value = datasource.config.gid || '0';
    if (elements.hasHeaders) {
        elements.hasHeaders.checked = datasource.config.has_headers !== false;
    }
    
    // Update dropdown selector to show the selected datasource
    if (elements.datasourceSelector) {
        elements.datasourceSelector.value = datasource.id;
    }
    
    // Load the data
    await loadData();
}

// Dashboard Functions
async function saveDashboard() {
    if (!isLoggedIn) {
        showAuthModal();
        return;
    }

    if (!currentDatasourceId) {
        alert('Please save the data source first');
        return;
    }

    if (!dashboardData || widgets.length === 0) {
        alert('Please create at least one widget before saving');
        return;
    }

    const name = prompt('Enter a name for this dashboard:');
    if (!name) return;

    const token = localStorage.getItem('token');
    try {
        const filters = Array.from(document.querySelectorAll('.filter-row')).map(row => ({
            col: row.querySelector('.filter-col').value,
            op: row.querySelector('.filter-op').value,
            val: row.querySelector('.filter-val')?.value || '',
            start: row.querySelector('.filter-start')?.value || '',
            end: row.querySelector('.filter-end')?.value || ''
        }));

        const response = await fetch('/api/dashboards', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                datasource_id: currentDatasourceId,
                widgets: widgets.map(w => ({
                    type: w.type,
                    datasource_id: w.datasource_id || currentDatasourceId,
                    config: w.config
                })),
                filters: filters,
                column_mapping: columnMapping,
                grid_columns: gridColumns,
                grid_rows: gridRows
            })
        });

        if (response.ok) {
            // Apply filters before saving (they should already be applied, but ensure they are)
            applyFilters();
            alert('Dashboard saved successfully!');
        } else {
            const error = await response.json();
            alert(error.detail || 'Failed to save dashboard');
        }
    } catch (error) {
        console.error('Error saving dashboard:', error);
        alert('Failed to save dashboard');
    }
}

async function loadSavedDashboard(dashboard) {
    // First, load the datasource
    const token = localStorage.getItem('token');
    try {
        const dsResponse = await fetch(`/api/datasources/${dashboard.datasource_id}`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!dsResponse.ok) throw new Error('Failed to load data source');

        const datasource = await dsResponse.json();
        currentDatasourceId = datasource.id;
        
        // Set datasource fields
        elements.sheetUrl.value = datasource.url;
        elements.gidInput.value = datasource.config.gid || '0';
        if (elements.hasHeaders) {
            elements.hasHeaders.checked = datasource.config.has_headers !== false;
        }

        // Load the data
        await loadData();

        // Update dashboard title with saved dashboard name
        const dashboardTitle = document.getElementById('dashboard-title');
        if (dashboardTitle) {
            dashboardTitle.textContent = `My Dashboard - ${dashboard.name}`;
        }

        // Wait a bit for data to load, then restore dashboard state
        setTimeout(async () => {
            // Restore grid configuration
            if (dashboard.grid_columns) gridColumns = dashboard.grid_columns;
            if (dashboard.grid_rows) gridRows = dashboard.grid_rows;
            updateGridLayout();
            
            // Restore column mapping for primary datasource
            if (dashboard.column_mapping) {
                columnMapping = dashboard.column_mapping;
                if (datasourceData[dashboard.datasource_id]) {
                    datasourceData[dashboard.datasource_id].columnMapping = dashboard.column_mapping;
                }
                renderRenameSection();
            }

            // Clear existing widgets
            widgets = [];
            elements.workspaceCanvas.innerHTML = '';
            if (document.querySelector('.empty-canvas-message')) {
                document.querySelector('.empty-canvas-message').style.display = 'none';
            }

            // Restore filters
            if (dashboard.filters && dashboard.filters.length > 0) {
                elements.activeFiltersList.innerHTML = '';
                dashboard.filters.forEach(f => {
                    const row = addFilterRow(false);
                    row.querySelector('.filter-col').value = f.col;
                    row.querySelector('.filter-op').value = f.op;
                    row.querySelector('.filter-col').dispatchEvent(new Event('change'));
                    if (row.querySelector('.filter-val')) row.querySelector('.filter-val').value = f.val;
                    if (row.querySelector('.filter-start')) row.querySelector('.filter-start').value = f.start;
                    if (row.querySelector('.filter-end')) row.querySelector('.filter-end').value = f.end;
                });
            }

            // Restore widgets - first collect all unique datasource_ids
            if (dashboard.widgets && dashboard.widgets.length > 0) {
                const datasourceIds = new Set();
                dashboard.widgets.forEach(w => {
                    const dsId = w.datasource_id || dashboard.datasource_id;
                    if (dsId) datasourceIds.add(dsId);
                });

                // Load all required datasources
                for (const dsId of datasourceIds) {
                    if (!datasourceData[dsId]) {
                        try {
                            await loadDatasourceData(dsId);
                        } catch (error) {
                            console.error(`Failed to load datasource ${dsId}:`, error);
                        }
                    }
                }

                // Now restore widgets with their datasource_ids
                for (const w of dashboard.widgets) {
                    const widget = {
                        id: 'widget-' + Date.now() + Math.random(),
                        type: w.type,
                        datasource_id: w.datasource_id || dashboard.datasource_id,
                        config: w.config
                    };
                    await restoreWidget(widget);
                }
            }

            applyFilters();
        }, 500);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Failed to load dashboard');
    }
}

// Report Functions
async function saveReport(widgetId) {
    if (!isLoggedIn) {
        showAuthModal();
        return;
    }

    if (!currentDatasourceId) {
        alert('Please save the data source first');
        return;
    }

    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) {
        alert('Widget not found');
        return;
    }

    const name = prompt('Enter a name for this report:');
    if (!name) return;

    const token = localStorage.getItem('token');
    try {
        const filters = Array.from(document.querySelectorAll('.filter-row')).map(row => ({
            col: row.querySelector('.filter-col').value,
            op: row.querySelector('.filter-op').value,
            val: row.querySelector('.filter-val')?.value || '',
            start: row.querySelector('.filter-start')?.value || '',
            end: row.querySelector('.filter-end')?.value || ''
        }));

        const response = await fetch('/api/reports', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                datasource_id: currentDatasourceId,
                widget_config: {
                    type: widget.type,
                    config: widget.config
                },
                filters: filters,
                column_mapping: columnMapping
            })
        });

        if (response.ok) {
            // Apply filters before saving (they should already be applied, but ensure they are)
            applyFilters();
            alert('Report saved successfully!');
        } else {
            const error = await response.json();
            alert(error.detail || 'Failed to save report');
        }
    } catch (error) {
        console.error('Error saving report:', error);
        alert('Failed to save report');
    }
}

async function loadSavedReport(report) {
    // First, load the datasource
    const token = localStorage.getItem('token');
    try {
        const dsResponse = await fetch(`/api/datasources/${report.datasource_id}`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!dsResponse.ok) throw new Error('Failed to load data source');

        const datasource = await dsResponse.json();
        currentDatasourceId = datasource.id;
        
        // Set datasource fields
        elements.sheetUrl.value = datasource.url;
        elements.gidInput.value = datasource.config.gid || '0';
        if (elements.hasHeaders) {
            elements.hasHeaders.checked = datasource.config.has_headers !== false;
        }

        // Load the data
        await loadData();

        // Wait a bit for data to load, then restore report state
        setTimeout(async () => {
            // Restore column mapping for report's datasource
            if (report.column_mapping) {
                columnMapping = report.column_mapping;
                if (datasourceData[report.datasource_id]) {
                    datasourceData[report.datasource_id].columnMapping = report.column_mapping;
                }
                renderRenameSection();
            }

            // Clear existing widgets
            widgets = [];
            elements.workspaceCanvas.innerHTML = '';
            if (document.querySelector('.empty-canvas-message')) {
                document.querySelector('.empty-canvas-message').style.display = 'none';
            }

            // Restore filters
            if (report.filters && report.filters.length > 0) {
                elements.activeFiltersList.innerHTML = '';
                report.filters.forEach(f => {
                    const row = addFilterRow(false);
                    row.querySelector('.filter-col').value = f.col;
                    row.querySelector('.filter-op').value = f.op;
                    row.querySelector('.filter-col').dispatchEvent(new Event('change'));
                    if (row.querySelector('.filter-val')) row.querySelector('.filter-val').value = f.val;
                    if (row.querySelector('.filter-start')) row.querySelector('.filter-start').value = f.start;
                    if (row.querySelector('.filter-end')) row.querySelector('.filter-end').value = f.end;
                });
            }

            // Restore single widget from report
            if (report.widget_config && report.widget_config.type) {
                // Ensure report's datasource is loaded
                if (!datasourceData[report.datasource_id]) {
                    try {
                        await loadDatasourceData(report.datasource_id);
                    } catch (error) {
                        console.error(`Failed to load datasource ${report.datasource_id}:`, error);
                    }
                }

                const widget = {
                    id: 'widget-' + Date.now() + Math.random(),
                    type: report.widget_config.type,
                    datasource_id: report.datasource_id,
                    config: report.widget_config.config || {}
                };
                await restoreWidget(widget);
            }

            applyFilters();
        }, 500);
    } catch (error) {
        console.error('Error loading report:', error);
        alert('Failed to load report');
    }
}

// Datasource Data Management
async function loadDatasourceData(datasourceId) {
    // Check if already loaded
    if (datasourceData[datasourceId]) {
        return datasourceData[datasourceId];
    }

    const token = localStorage.getItem('token');
    try {
        // Fetch datasource info
        const dsResponse = await fetch(`/api/datasources/${datasourceId}`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!dsResponse.ok) throw new Error('Failed to load data source');

        const datasource = await dsResponse.json();
        
        // Load the data
        const dataResponse = await fetch('/api/proxy/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sheet_url: datasource.url, 
                gid: datasource.config.gid || '0', 
                has_headers: datasource.config.has_headers !== false 
            })
        });

        if (!dataResponse.ok) throw new Error('Failed to fetch data');

        let rawData = await dataResponse.json();

        // Process data similar to loadData()
        if (rawData.length > 0) {
            const hasHeaders = datasource.config.has_headers !== false;
            if (!hasHeaders && rawData.length > 0) {
                const keys = Object.keys(rawData[0]);
                const nameMap = {};
                keys.forEach((k, i) => {
                    nameMap[k] = `Col ${i + 1}`;
                });

                rawData = rawData.map(row => {
                    const renamed = {};
                    keys.forEach(k => {
                        renamed[nameMap[k]] = row[k];
                    });
                    return renamed;
                });
            }

            const columns = Object.keys(rawData[0]);
            const colMapping = {};
            columns.forEach(id => colMapping[id] = id);

            // Store in datasourceData map
            datasourceData[datasourceId] = {
                data: rawData,
                filteredData: [...rawData],
                columns: columns,
                columnMapping: colMapping
            };

            return datasourceData[datasourceId];
        }
    } catch (error) {
        console.error('Error loading datasource data:', error);
        throw error;
    }
}

function getWidgetData(widget) {
    const dsId = widget.datasource_id || currentDatasourceId;
    
    // If there's a datasource ID, try to get data from datasourceData
    if (dsId) {
        const dsData = datasourceData[dsId];
        if (dsData) {
            return dsData.filteredData || dsData.data;
        }
    }
    
    // Fall back to primary dashboard data (for non-logged-in users or when datasource not loaded)
    if (filteredData && filteredData.length > 0) {
        return filteredData;
    }
    if (dashboardData && dashboardData.length > 0) {
        return dashboardData;
    }
    
    return null;
}

function getWidgetColumns(widget) {
    const dsId = widget.datasource_id || currentDatasourceId;
    
    // If there's a datasource ID, try to get columns from datasourceData
    if (dsId) {
        const dsData = datasourceData[dsId];
        if (dsData && dsData.columns) {
            return dsData.columns;
        }
    }
    
    // Fall back to primary dashboard columns
    return currentColumns;
}

function getWidgetColumnMapping(widget) {
    const dsId = widget.datasource_id || currentDatasourceId;
    
    // If there's a datasource ID, try to get column mapping from datasourceData
    if (dsId) {
        const dsData = datasourceData[dsId];
        if (dsData && dsData.columnMapping) {
            return dsData.columnMapping;
        }
    }
    
    // Fall back to primary dashboard column mapping
    return columnMapping;
}

// Report Functions for Dashboard
async function fetchReports() {
    if (!isLoggedIn) {
        showAuthModal();
        return [];
    }

    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/reports', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            isLoggedIn = false;
            updateAuthUI(null);
            return [];
        }

        if (!response.ok) {
            throw new Error('Failed to load reports');
        }

        const reports = await response.json();
        return reports;
    } catch (error) {
        console.error('Error fetching reports:', error);
        return [];
    }
}

async function showReportSelectionModal() {
    if (!isLoggedIn) {
        showAuthModal();
        return;
    }

    const modal = document.getElementById('report-selection-modal');
    const listContainer = document.getElementById('reports-selection-list');
    if (!modal || !listContainer) return;

    modal.style.display = 'flex';
    listContainer.innerHTML = '<div class="loading-message">Loading reports...</div>';

    try {
        const reports = await fetchReports();
        
        if (reports.length === 0) {
            listContainer.innerHTML = '<div class="empty-state" style="text-align: center; padding: 40px;"><p>No reports available. Create a report by saving a widget first.</p></div>';
            return;
        }

        // Fetch datasource names for each report
        const token = localStorage.getItem('token');
        const reportsWithDatasources = await Promise.all(reports.map(async (report) => {
            try {
                const dsResponse = await fetch(`/api/datasources/${report.datasource_id}`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (dsResponse.ok) {
                    const datasource = await dsResponse.json();
                    return { ...report, datasource_name: datasource.name };
                }
            } catch (e) {
                console.error('Error fetching datasource:', e);
            }
            return { ...report, datasource_name: 'Unknown' };
        }));

        listContainer.innerHTML = reportsWithDatasources.map(report => {
            const widgetType = report.widget_config && report.widget_config.type ? report.widget_config.type : 'unknown';
            const itemId = `report-item-${report.id}`;
            return `
                <div class="report-selection-item" id="${itemId}" style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 10px; cursor: pointer; transition: background 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h4 style="margin: 0 0 5px 0;">${escapeHtml(report.name)}</h4>
                            <p style="margin: 5px 0; color: #666; font-size: 0.9em;">Datasource: ${escapeHtml(report.datasource_name)}</p>
                            <p style="margin: 5px 0; color: #666; font-size: 0.9em;">Type: ${widgetType.charAt(0).toUpperCase() + widgetType.slice(1)}</p>
                        </div>
                        <button class="btn-primary" style="margin-left: 10px;">Add</button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach click handlers
        reportsWithDatasources.forEach(report => {
            const item = document.getElementById(`report-item-${report.id}`);
            if (item) {
                item.addEventListener('click', () => addReportToDashboard(report.id));
                item.addEventListener('mouseenter', function() { this.style.background = '#f5f5f5'; });
                item.addEventListener('mouseleave', function() { this.style.background = ''; });
            }
        });

    } catch (error) {
        console.error('Error loading reports:', error);
        listContainer.innerHTML = '<div class="error-message">Failed to load reports. Please try again.</div>';
    }
}

function hideReportSelectionModal() {
    const modal = document.getElementById('report-selection-modal');
    if (modal) modal.style.display = 'none';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function addReportToDashboard(reportId) {
    if (!isLoggedIn) {
        showAuthModal();
        return;
    }

    const token = localStorage.getItem('token');
    try {
        // Fetch report data
        const response = await fetch(`/api/reports/${reportId}`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) throw new Error('Failed to load report');

        const report = await response.json();

        // Load the report's datasource data if not already loaded
        if (!datasourceData[report.datasource_id]) {
            await loadDatasourceData(report.datasource_id);
        }

        // Create widget from report's widget_config
        const widgetConfig = report.widget_config;
        if (!widgetConfig || !widgetConfig.type) {
            alert('Report has invalid widget configuration');
            return;
        }

        const widget = {
            id: 'widget-' + Date.now() + Math.random(),
            type: widgetConfig.type,
            datasource_id: report.datasource_id,
            config: widgetConfig.config || {}
        };

        // Merge report's filters with existing dashboard filters
        if (report.filters && report.filters.length > 0) {
            // Add report filters to dashboard (they apply to primary datasource)
            report.filters.forEach(f => {
                const row = addFilterRow(false);
                row.querySelector('.filter-col').value = f.col;
                row.querySelector('.filter-op').value = f.op;
                row.querySelector('.filter-col').dispatchEvent(new Event('change'));
                if (row.querySelector('.filter-val')) row.querySelector('.filter-val').value = f.val;
                if (row.querySelector('.filter-start')) row.querySelector('.filter-start').value = f.start;
                if (row.querySelector('.filter-end')) row.querySelector('.filter-end').value = f.end;
            });
            applyFilters();
        }

        // Merge column mappings if needed
        if (report.column_mapping && datasourceData[report.datasource_id]) {
            // Merge report's column mapping with existing mapping for that datasource
            const existingMapping = datasourceData[report.datasource_id].columnMapping || {};
            datasourceData[report.datasource_id].columnMapping = {
                ...existingMapping,
                ...report.column_mapping
            };
        }

        // Add widget to dashboard
        restoreWidget(widget);
        showWidgetSettings(widget.id);
        saveState();

        // Close the modal
        hideReportSelectionModal();

        alert('Report added to dashboard successfully!');
    } catch (error) {
        console.error('Error adding report to dashboard:', error);
        alert(`Failed to add report: ${error.message}`);
    }
}
