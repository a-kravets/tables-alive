document.addEventListener("DOMContentLoaded", () => {
    // Sidebar Toggle Logic
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    // Set initial state based on screen size
    function setInitialSidebarState() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            sidebar.classList.remove('open');
            sidebar.classList.remove('collapsed');
        } else {
            sidebar.classList.remove('open');
            sidebar.classList.remove('collapsed');
        }
    }

    // Toggle sidebar
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                sidebar.classList.toggle('open');
            } else {
                sidebar.classList.toggle('collapsed');
            }

            sidebarToggle.classList.toggle('active');
        });
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            sidebar.classList.remove('open');
        } else {
            sidebar.classList.remove('collapsed');
        }
    });

    // Set initial state
    setInitialSidebarState();

    // DOM Elements
    const inputUrl = document.getElementById("sheet_url");
    const inputGid = document.getElementById("gid_input");
    const btnRefresh = document.getElementById("refresh-btn");
    const divInitial = document.getElementById("initial-state");
    const divLoading = document.getElementById("loading-state");
    const divDashboard = document.getElementById("dashboard-state");
    const divTable = document.getElementById("data-table-container");
    const divChart = document.getElementById("chart-container");
    const divMetrics = document.getElementById("metrics-display");

    const selChartType = document.getElementById("chart-type");
    const selX = document.getElementById("x-axis");
    const selY = document.getElementById("y-axis");
    const selColor = document.getElementById("color-axis");
    const selMetric = document.getElementById("metric-select");

    const inputXMin = document.getElementById("x-min");
    const inputXMax = document.getElementById("x-max");
    const inputYMin = document.getElementById("y-min");
    const inputYMax = document.getElementById("y-max");
    const btnApplyRanges = document.getElementById("apply-ranges-btn");

    // Clear range inputs on page load
    if (inputXMin) inputXMin.value = "";
    if (inputXMax) inputXMax.value = "";
    if (inputYMin) inputYMin.value = "";
    if (inputYMax) inputYMax.value = "";

    // Data Tools
    const divRename = document.getElementById("rename-container");
    const selFilterCol = document.getElementById("filter-col-select");
    const btnAddFilter = document.getElementById("add-filter-btn");
    const divActiveFilters = document.getElementById("active-filters-container");
    const btnApplyFilters = document.getElementById("apply-filters-btn");
    const btnLoadData = document.getElementById("load-data-btn");
    const selGroupCols = document.getElementById("group-by-select");
    const selGroupMetrics = document.getElementById("group-metric-select");
    const selGroupFunc = document.getElementById("group-func-select");
    const selGroupPeriod = document.getElementById("group-period-select");
    const periodRow = document.getElementById("period-row");
    const btnApplyGroup = document.getElementById("apply-group-btn");

    // Table Grouping Controls
    const selTableGroupCols = document.getElementById("table-group-by-select");
    const selTableGroupMetrics = document.getElementById("table-group-metric-select");
    const selTableGroupFunc = document.getElementById("table-group-func-select");
    const selTableGroupPeriod = document.getElementById("table-group-period-select");
    const tablePeriodRow = document.getElementById("table-period-row");
    const btnApplyTableGroup = document.getElementById("apply-table-group-btn");

    // Column Reorder Controls
    const btnToggleReorder = document.getElementById("toggle-reorder-btn");
    const divReorderControls = document.getElementById("reorder-controls");
    const ulColumnList = document.getElementById("column-list");
    const btnApplyReorder = document.getElementById("apply-reorder-btn");

    // Data Types Controls
    const divDataTypes = document.getElementById("data-types-container");
    const btnApplyDataTypes = document.getElementById("apply-data-types-btn");

    // Show/hide period dropdown based on selected column type
    if (selGroupCols) {
        selGroupCols.addEventListener('change', () => {
            const col = selGroupCols.value;
            if (col && rawData.length > 0) {
                const type = detectType(rawData[0][col]);
                if (type === 'date') {
                    periodRow.style.display = 'block';
                } else {
                    periodRow.style.display = 'none';
                    selGroupPeriod.value = '';
                }
            } else {
                periodRow.style.display = 'none';
            }
        });
    }

    if (selTableGroupCols) {
        selTableGroupCols.addEventListener('change', () => {
            const selected = Array.from(selTableGroupCols.selectedOptions).map(o => o.value);
            let hasDate = false;
            if (rawData.length > 0) {
                selected.forEach(col => {
                    if (detectType(rawData[0][col]) === 'date') hasDate = true;
                });
            }
            if (hasDate) {
                tablePeriodRow.style.display = 'block';
            } else {
                tablePeriodRow.style.display = 'none';
                selTableGroupPeriod.value = '';
            }
        });
    }

    // State
    let rawData = [];
    let currentData = []; // This will remain but we might want separate ones
    let vizData = [];
    let tableData = [];
    let renameMap = {};
    let activeFilters = [];
    let groupConfig = { enabled: false, col: '', metrics: [], func: 'sum', period: '' };
    let tableGroupConfig = { enabled: false, cols: [], metrics: [], func: 'sum', period: '' };
    let columnOrder = [];
    let dataTypesConfig = {}; // { columnName: { type: 'string'|'number'|'date', numberFormat: 'int'|'float', decimals: 2 } }

    // State Persistence Functions
    function saveDataToolsState() {
        sessionStorage.setItem('renameMap', JSON.stringify(renameMap));
        sessionStorage.setItem('activeFilters', JSON.stringify(activeFilters));
        sessionStorage.setItem('groupConfig', JSON.stringify(groupConfig));
        sessionStorage.setItem('tableGroupConfig', JSON.stringify(tableGroupConfig));
        sessionStorage.setItem('columnOrder', JSON.stringify(columnOrder));
        sessionStorage.setItem('dataTypesConfig', JSON.stringify(dataTypesConfig));
    }

    function restoreDataToolsState() {
        try {
            const savedRenameMap = sessionStorage.getItem('renameMap');
            const savedFilters = sessionStorage.getItem('activeFilters');
            const savedGroupConfig = sessionStorage.getItem('groupConfig');
            const savedTableGroupConfig = sessionStorage.getItem('tableGroupConfig');
            const savedColumnOrder = sessionStorage.getItem('columnOrder');
            const savedDataTypesConfig = sessionStorage.getItem('dataTypesConfig');

            if (savedRenameMap) renameMap = JSON.parse(savedRenameMap);
            if (savedFilters) activeFilters = JSON.parse(savedFilters);
            if (savedGroupConfig) groupConfig = JSON.parse(savedGroupConfig);
            if (savedTableGroupConfig) {
                tableGroupConfig = JSON.parse(savedTableGroupConfig);
                if (selTableGroupPeriod) selTableGroupPeriod.value = tableGroupConfig.period || '';
            }
            if (savedColumnOrder) columnOrder = JSON.parse(savedColumnOrder);
            if (savedDataTypesConfig) dataTypesConfig = JSON.parse(savedDataTypesConfig);
        } catch (e) {
            console.error('Error restoring state:', e);
        }
    }

    // Tab Switching
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.tab;
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(target).classList.add("active");
        });
    });

    // --- Init ---
    const urlParams = new URLSearchParams(window.location.search);
    let sessionUrl = sessionStorage.getItem("sheet_url");
    let sessionGid = sessionStorage.getItem("gid");

    // Priority: URL Params -> Session Storage
    let targetUrl = urlParams.get("sheet_url") || sessionUrl;
    let targetGid = urlParams.get("gid") || sessionGid;

    if (targetUrl) {
        if (inputUrl) inputUrl.value = targetUrl;
        if (inputGid) inputGid.value = targetGid || "";

        if (!urlParams.has("sheet_url")) {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set("sheet_url", targetUrl);
            if (targetGid) newUrl.searchParams.set("gid", targetGid);
            window.history.replaceState({}, "", newUrl);
        }

        if (divDashboard) {
            fetchData();
        }
    }

    // Event Listeners
    if (btnRefresh) {
        btnRefresh.addEventListener("click", triggerFetch);
    }
    if (btnLoadData) {
        btnLoadData.addEventListener("click", triggerFetch);
    }

    // Enter key support
    [inputUrl, inputGid].forEach(input => {
        if (input) {
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    triggerFetch();
                }
            });
        }
    });

    // Data Tools Event Listeners
    if (btnAddFilter) {
        btnAddFilter.addEventListener("click", () => {
            const col = selFilterCol.value;
            if (col === "Select Column") return;
            addFilterUI(col);
        });
    }

    if (btnApplyFilters) {
        btnApplyFilters.addEventListener("click", () => {
            // Rebuild activeFilters from UI
            activeFilters = [];
            const filterItems = divActiveFilters.querySelectorAll(".filter-item");
            filterItems.forEach(item => {
                const col = item.dataset.col;
                const type = item.dataset.type;
                if (type === 'num') {
                    const min = parseFloat(item.querySelector(".min-input").value);
                    const max = parseFloat(item.querySelector(".max-input").value);
                    // Fixed logic: allow one or both
                    if (!isNaN(min) || !isNaN(max)) activeFilters.push({ col, type, min, max });
                } else if (type === 'date') {
                    const min = item.querySelector(".min-input").value;
                    const max = item.querySelector(".max-input").value;
                    if (min || max) activeFilters.push({ col, type, min, max });
                } else {
                    const val = item.querySelector(".text-input").value.toLowerCase();
                    if (val) activeFilters.push({ col, type, val });
                }
            });
            saveDataToolsState();
            processData();
        });
    }

    // Handle viz grouping details toggle
    const vizGroupingDetails = document.querySelector('.viz-grouping-details');
    if (vizGroupingDetails) {
        vizGroupingDetails.addEventListener('toggle', (e) => {
            groupConfig.enabled = e.target.open;
            if (!e.target.open) processData();
        });
    }

    if (btnApplyGroup) {
        btnApplyGroup.addEventListener("click", () => {
            groupConfig.enabled = true;
            groupConfig.col = selGroupCols.value;
            groupConfig.metrics = Array.from(selGroupMetrics.selectedOptions).map(o => o.value);
            groupConfig.func = selGroupFunc.value;
            groupConfig.period = selGroupPeriod.value;
            saveDataToolsState();
            processData();
        });
    }

    // Handle table grouping details toggle
    const tableGroupingDetails = document.querySelector('.table-grouping-details');
    if (tableGroupingDetails) {
        tableGroupingDetails.addEventListener('toggle', (e) => {
            tableGroupConfig.enabled = e.target.open;
        });
    }

    if (btnApplyTableGroup) {
        btnApplyTableGroup.addEventListener("click", () => {
            tableGroupConfig.enabled = true;
            tableGroupConfig.cols = Array.from(selTableGroupCols.selectedOptions).map(o => o.value);
            tableGroupConfig.metrics = Array.from(selTableGroupMetrics.selectedOptions).map(o => o.value);
            tableGroupConfig.func = selTableGroupFunc.value;
            tableGroupConfig.period = selTableGroupPeriod.value;
            saveDataToolsState();
            processData();
            renderReorderList();
        });
    }

    if (btnToggleReorder) {
        btnToggleReorder.addEventListener("click", () => {
            divReorderControls.style.display = divReorderControls.style.display === "none" ? "block" : "none";
        });
    }

    if (btnApplyReorder) {
        btnApplyReorder.addEventListener("click", () => {
            // columnOrder is updated by the move buttons
            saveDataToolsState();
            processData();
        });
    }

    if (btnApplyDataTypes) {
        btnApplyDataTypes.addEventListener("click", () => {
            applyDataTypeChanges();
            saveDataToolsState();
            processData();
        });
    }

    function triggerFetch() {
        if (!inputUrl.value) {
            alert("Please enter a Google Sheet URL");
            return;
        }
        sessionStorage.setItem("sheet_url", inputUrl.value);
        if (inputGid.value) sessionStorage.setItem("gid", inputGid.value);
        else sessionStorage.removeItem("gid");

        const newUrl = new URL(window.location);
        newUrl.searchParams.set("sheet_url", inputUrl.value);
        if (inputGid.value) newUrl.searchParams.set("gid", inputGid.value);
        else newUrl.searchParams.delete("gid");
        window.history.pushState({}, "", newUrl);

        fetchData();
    }

    // Viz Event Listeners
    if (selChartType) {
        [selChartType, selX, selY, selColor].forEach(el => el.addEventListener("change", updateChart));
    }
    if (selMetric) {
        selMetric.addEventListener("change", updateMetrics);
    }

    function updateMetrics() {
        renderMetrics();
    }
    if (btnApplyRanges) {
        btnApplyRanges.addEventListener("click", (e) => {
            if (e) e.preventDefault();
            updateChart();
        });
    }

    async function fetchData() {
        if (!divDashboard) return;

        divInitial.style.display = "none";
        divLoading.style.display = "block";
        divDashboard.style.display = "none";

        try {
            const resp = await fetch("/api/proxy/data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sheet_url: inputUrl.value,
                    gid: inputGid.value
                })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || "Failed to fetch");
            }

            rawData = await resp.json();

            if (rawData.length === 0) {
                alert("No data found.");
                divLoading.style.display = "none";
                divInitial.style.display = "block";
                return;
            }

            // Restore saved state
            restoreDataToolsState();

            // Init Tools UI
            initRenameUI(Object.keys(rawData[0]));
            initDataTypesUI(Object.keys(rawData[0]));

            // Initial Population of Tools using helper that supports renaming
            updateToolControls();

            // Restore group UI state
            if (groupConfig.enabled) {
                const vizGroupingDetails = document.querySelector('.viz-grouping-details');
                if (vizGroupingDetails) vizGroupingDetails.open = true;
            }

            processData();

            divLoading.style.display = "none";
            divDashboard.style.display = "block";

        } catch (e) {
            alert("Error: " + e.message);
            divLoading.style.display = "none";
            divInitial.style.display = "block";
        }
    }

    function initRenameUI(cols) {
        divRename.innerHTML = "";

        // Restore saved renames or initialize
        if (!renameMap || Object.keys(renameMap).length === 0) {
            renameMap = {};
            cols.forEach(col => renameMap[col] = col);
        }

        cols.forEach(col => {
            const currentName = renameMap[col] || col;
            const div = document.createElement("div");
            div.className = "rename-input-group";
            div.innerHTML = `<label>${col}</label><input type="text" value="${currentName}" class="input-text rename-input" data-col="${col}">`;
            divRename.appendChild(div);

            // Listener
            div.querySelector("input").addEventListener("change", (e) => {
                renameMap[col] = e.target.value;
                saveDataToolsState();
                updateToolControls();
                initDataTypesUI(Object.keys(rawData[0]));
                processData();
            });
        });
    }

    function updateToolControls() {
        if (!rawData || !rawData.length) return;
        const cols = Object.keys(rawData[0]);

        // Helper to map cols to options
        const options = cols.map(c => ({
            text: renameMap[c] || c,
            value: c
        }));

        // Helper to preserve selection during rebuild
        const rebuildSelect = (sel, opts, multi = false) => {
            const current = multi ? Array.from(sel.selectedOptions).map(o => o.value) : sel.value;
            sel.innerHTML = "";
            if (!multi) {
                const def = document.createElement("option");
                def.text = "Select Column"; def.value = "Select Column";
                sel.appendChild(def);
            }
            opts.forEach(o => {
                const el = document.createElement("option");
                el.text = o.text;
                el.value = o.value;
                if (multi) {
                    if (current.includes(o.value)) el.selected = true;
                } else {
                    if (current === o.value) el.selected = true;
                }
                sel.appendChild(el);
            });
        };

        rebuildSelect(selFilterCol, options);
        rebuildSelect(selGroupCols, options, false);
        rebuildSelect(selTableGroupCols, options, true);

        const metricOptions = cols.filter(c => isNumeric(rawData[0][c])).map(c => ({
            text: renameMap[c] || c,
            value: c
        }));
        rebuildSelect(selGroupMetrics, metricOptions, false);
        rebuildSelect(selTableGroupMetrics, metricOptions, true);

        // Clear range inputs when data changes
        if (inputXMin) inputXMin.value = "";
        if (inputXMax) inputXMax.value = "";
        if (inputYMin) inputYMin.value = "";
        if (inputYMax) inputYMax.value = "";

        refreshActiveFiltersUI();
        initReorderUI(cols);
    }

    function refreshActiveFiltersUI() {
        divActiveFilters.innerHTML = "";
        activeFilters.forEach(f => {
            renderFilterItem(f);
        });
    }

    function renderFilterItem(f) {
        const dispName = renameMap[f.col] || f.col;
        const div = document.createElement("div");
        div.className = "filter-item";
        div.dataset.col = f.col;
        div.dataset.type = f.type;

        let html = `<strong>${dispName}</strong>`;
        if (f.type === 'num') {
            html += `<input type="number" value="${f.min || ''}" placeholder="Min" class="input-text min-input" style="width:80px"> - 
                      <input type="number" value="${f.max || ''}" placeholder="Max" class="input-text max-input" style="width:80px">`;
        } else if (f.type === 'date') {
            html += `<input type="date" value="${f.min || ''}" class="input-text min-input" style="width:130px"> - 
                      <input type="date" value="${f.max || ''}" class="input-text max-input" style="width:130px">`;
        } else {
            html += `<input type="text" value="${f.val || ''}" placeholder="Contains..." class="input-text text-input">`;
        }
        html += `<button class="btn-remove">X</button>`;
        div.innerHTML = html;

        div.querySelector(".btn-remove").addEventListener("click", () => {
            activeFilters = activeFilters.filter(item => item !== f);
            div.remove();
        });
        divActiveFilters.appendChild(div);
    }

    function initReorderUI(cols) {
        if (!columnOrder || columnOrder.length === 0) {
            columnOrder = [...cols];
        } else {
            // Match current raw columns
            const currentCols = new Set(cols);
            columnOrder = columnOrder.filter(c => currentCols.has(c));
            cols.forEach(c => {
                if (!columnOrder.includes(c)) columnOrder.push(c);
            });
        }
        renderReorderList();
    }

    function renderReorderList() {
        if (!ulColumnList) return;
        ulColumnList.innerHTML = "";

        // Filter columns to show only those relevant to the current table view
        let visibleCols = [...columnOrder];
        if (tableGroupConfig.enabled && tableGroupConfig.cols.length > 0) {
            const allowed = new Set([...tableGroupConfig.cols, ...tableGroupConfig.metrics]);
            visibleCols = columnOrder.filter(c => allowed.has(c));
        }

        visibleCols.forEach((col) => {
            const li = document.createElement("li");
            li.className = "reorder-item";

            const span = document.createElement("span");
            span.textContent = renameMap[col] || col;
            li.appendChild(span);

            const btnDiv = document.createElement("div");
            btnDiv.className = "reorder-buttons";

            const upBtn = document.createElement("button");
            upBtn.className = "reorder-btn";
            upBtn.textContent = "↑";
            upBtn.addEventListener("click", () => moveColumn(col, -1));

            const downBtn = document.createElement("button");
            downBtn.className = "reorder-btn";
            downBtn.textContent = "↓";
            downBtn.addEventListener("click", () => moveColumn(col, 1));

            btnDiv.appendChild(upBtn);
            btnDiv.appendChild(downBtn);
            li.appendChild(btnDiv);
            ulColumnList.appendChild(li);
        });
    }

    function moveColumn(colName, dir) {
        let visibleCols = [...columnOrder];
        if (tableGroupConfig.enabled && tableGroupConfig.cols.length > 0) {
            const allowed = new Set([...tableGroupConfig.cols, ...tableGroupConfig.metrics]);
            visibleCols = columnOrder.filter(c => allowed.has(c));
        }

        const currentIdx = visibleCols.indexOf(colName);
        const targetIdx = currentIdx + dir;

        if (targetIdx < 0 || targetIdx >= visibleCols.length) return;

        const otherColName = visibleCols[targetIdx];

        // Find their positions in the master columnOrder and swap them
        const masterIdx1 = columnOrder.indexOf(colName);
        const masterIdx2 = columnOrder.indexOf(otherColName);

        const temp = columnOrder[masterIdx1];
        columnOrder[masterIdx1] = columnOrder[masterIdx2];
        columnOrder[masterIdx2] = temp;

        renderReorderList();
    }

    function initDataTypesUI(cols) {
        divDataTypes.innerHTML = "";
        cols.forEach(col => {
            const displayName = renameMap[col] || col;
            const colDiv = document.createElement("div");
            colDiv.className = "rename-input-group";
            colDiv.innerHTML = `
                <label>${displayName}</label>
                <select class="data-type-select input-select" data-col="${col}">
                    <option value="auto">Auto Detect</option>
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                </select>
                <div class="number-options" style="display:none; margin-top:5px;">
                    <select class="number-format-select input-select" data-col="${col}">
                        <option value="float">Float</option>
                        <option value="int">Integer</option>
                    </select>
                    <input type="number" class="decimals-input input-text" data-col="${col}" placeholder="Decimals" min="0" max="10" value="2" style="margin-top:5px; width:100%;">
                </div>
            `;
            divDataTypes.appendChild(colDiv);

            // Add event listeners
            const typeSelect = colDiv.querySelector('.data-type-select');
            const numberOptions = colDiv.querySelector('.number-options');
            const formatSelect = colDiv.querySelector('.number-format-select');

            typeSelect.addEventListener('change', (e) => {
                const selectedType = e.target.value;
                numberOptions.style.display = selectedType === 'number' ? 'block' : 'none';
            });

            // Set initial values from config
            if (dataTypesConfig[col]) {
                typeSelect.value = dataTypesConfig[col].type || 'auto';
                if (dataTypesConfig[col].type === 'number') {
                    numberOptions.style.display = 'block';
                    formatSelect.value = dataTypesConfig[col].numberFormat || 'float';
                    const decimalsInput = colDiv.querySelector('.decimals-input');
                    decimalsInput.value = dataTypesConfig[col].decimals || 2;
                }
            }
        });
    }

    function applyDataTypeFormatting(value, column) {
        const config = dataTypesConfig[column];
        if (!config || config.type === 'auto') return value;

        if (config.type === 'string') {
            return String(value);
        } else if (config.type === 'number') {
            let num = parseFloat(value);
            if (!isNaN(num)) {
                if (config.numberFormat === 'int') {
                    return Math.round(num);
                } else {
                    return parseFloat(num.toFixed(config.decimals));
                }
            }
        } else if (config.type === 'date') {
            // Try to parse as date, keep original if fails
            const dateVal = new Date(value);
            if (!isNaN(dateVal.getTime())) {
                return dateVal.toISOString().split('T')[0]; // YYYY-MM-DD format
            }
        }
        return value;
    }

    function applyDataTypeChanges() {
        // Collect data type settings from UI
        const typeSelects = divDataTypes.querySelectorAll('.data-type-select');
        typeSelects.forEach(select => {
            const col = select.dataset.col;
            const type = select.value;
            dataTypesConfig[col] = { type };

            if (type === 'number') {
                const colDiv = select.closest('.rename-input-group');
                const formatSelect = colDiv.querySelector('.number-format-select');
                const decimalsInput = colDiv.querySelector('.decimals-input');
                dataTypesConfig[col].numberFormat = formatSelect.value;
                dataTypesConfig[col].decimals = parseInt(decimalsInput.value) || 2;
            }
        });

        // Data type conversions are now applied in processData()
        // No need to modify rawData here as it will be handled during processing
    }

    function addFilterUI(col) {
        const type = detectType(rawData[0][col]);
        const f = { col, type };
        renderFilterItem(f);
    }

    function processData() {
        if (!rawData || rawData.length === 0) return;

        // 1. Shared Pre-processing: Apply data type conversions first
        let shared = rawData.map(row => {
            const newRow = { ...row };
            // Apply data type conversions
            Object.keys(dataTypesConfig).forEach(col => {
                const config = dataTypesConfig[col];
                if (config.type === 'string') {
                    newRow[col] = String(newRow[col]);
                } else if (config.type === 'number') {
                    let num = parseFloat(newRow[col]);
                    if (!isNaN(num)) {
                        if (config.numberFormat === 'int') {
                            newRow[col] = Math.round(num);
                        } else {
                            newRow[col] = parseFloat(num.toFixed(config.decimals));
                        }
                    }
                } else if (config.type === 'date') {
                    // Try to parse as date, keep original if fails
                    const dateVal = new Date(newRow[col]);
                    if (!isNaN(dateVal.getTime())) {
                        newRow[col] = dateVal.toISOString().split('T')[0]; // YYYY-MM-DD format
                    }
                }
                // 'auto' means no conversion
            });
            return newRow;
        });

        // 2. Apply filters
        shared = shared.filter(row => {
            for (let f of activeFilters) {
                const val = row[f.col];
                if (f.type === 'num') {
                    const num = parseFloat(val);
                    if (isNaN(num) || (f.min !== undefined && !isNaN(f.min) && num < f.min) || (f.max !== undefined && !isNaN(f.max) && num > f.max)) return false;
                } else if (f.type === 'date') {
                    const d = Date.parse(val);
                    if (isNaN(d)) return false;
                    if (f.min) { const dm = Date.parse(f.min); if (d < dm) return false; }
                    if (f.max) { const dx = Date.parse(f.max); if (d > dx) return false; }
                } else {
                    if (!String(val).toLowerCase().includes(f.val)) return false;
                }
            }
            return true;
        });

        // 2. Shared Pre-processing: Rename
        shared = shared.map(row => {
            const newRow = {};
            Object.keys(row).forEach(k => {
                const newName = renameMap[k] || k;
                newRow[newName] = row[k];
            });
            return newRow;
        });

        // 3. Independent Paths
        processDataForViz(shared);
        processDataForTable(shared);

        renderDashboard();
    }

    function processDataForViz(data) {
        let processed = [...data];
        if (groupConfig.enabled && groupConfig.col && groupConfig.metrics && groupConfig.metrics.length > 0) {
            const groupCol = renameMap[groupConfig.col] || groupConfig.col;
            const metricCols = groupConfig.metrics.map(m => renameMap[m] || m);
            const period = groupConfig.period;

            const groups = {};
            processed.forEach(row => {
                let keyVal = row[groupCol];
                if (period && detectType(keyVal) === 'date') {
                    const d = new Date(keyVal);
                    if (!isNaN(d.getTime())) {
                        if (period === 'week') {
                            const day = d.getDay();
                            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                            const monday = new Date(d.setDate(diff));
                            keyVal = monday.toISOString().split('T')[0];
                        } else if (period === 'month') {
                            keyVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        } else if (period === 'year') {
                            keyVal = String(d.getFullYear());
                        }
                    }
                }
                const key = String(keyVal);
                if (!groups[key]) {
                    groups[key] = { count: 0, sums: {}, keys: {} };
                    groups[key].keys[groupCol] = keyVal;
                    metricCols.forEach(m => groups[key].sums[m] = []);
                }
                groups[key].count++;
                metricCols.forEach(m => groups[key].sums[m].push(Number(row[m]) || 0));
            });

            processed = Object.values(groups).map(g => {
                const r = { ...g.keys };
                metricCols.forEach(m => {
                    let aggregatedValue;
                    const vals = g.sums[m];
                    if (groupConfig.func === 'sum') aggregatedValue = vals.reduce((a, b) => a + b, 0);
                    else if (groupConfig.func === 'mean') aggregatedValue = vals.reduce((a, b) => a + b, 0) / vals.length;
                    else if (groupConfig.func === 'min') aggregatedValue = Math.min(...vals);
                    else if (groupConfig.func === 'max') aggregatedValue = Math.max(...vals);
                    else if (groupConfig.func === 'count') aggregatedValue = g.count;

                    // Apply data type formatting to aggregated result
                    r[m] = applyDataTypeFormatting(aggregatedValue, m);
                });
                return r;
            });
        }
        vizData = processed;
    }

    function processDataForTable(data) {
        let processed = [...data];
        if (tableGroupConfig.enabled && tableGroupConfig.cols.length > 0 && tableGroupConfig.metrics.length > 0) {
            const groups = {};
            const mappedCols = tableGroupConfig.cols.map(c => renameMap[c] || c);
            const mappedMetrics = tableGroupConfig.metrics.map(m => renameMap[m] || m);
            const period = tableGroupConfig.period;

            processed.forEach(row => {
                const groupVals = {};
                mappedCols.forEach(c => {
                    let val = row[c];
                    // Apply period grouping if it's a date
                    if (period && detectType(val) === 'date') {
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) {
                            if (period === 'week') {
                                const day = d.getDay();
                                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                                const monday = new Date(d.setDate(diff));
                                val = monday.toISOString().split('T')[0];
                            } else if (period === 'month') {
                                val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            } else if (period === 'year') {
                                val = String(d.getFullYear());
                            }
                        }
                    }
                    groupVals[c] = val;
                });

                const key = mappedCols.map(c => groupVals[c]).join("::");
                if (!groups[key]) {
                    groups[key] = { count: 0, sums: {}, keys: groupVals };
                    mappedMetrics.forEach(m => groups[key].sums[m] = []);
                }
                groups[key].count++;
                mappedMetrics.forEach(m => groups[key].sums[m].push(Number(row[m]) || 0));
            });

            processed = Object.values(groups).map(g => {
                const r = { ...g.keys };
                mappedMetrics.forEach(m => {
                    let aggregatedValue;
                    const vals = g.sums[m];
                    if (tableGroupConfig.func === 'sum') aggregatedValue = vals.reduce((a, b) => a + b, 0);
                    else if (tableGroupConfig.func === 'mean') aggregatedValue = vals.reduce((a, b) => a + b, 0) / vals.length;
                    else if (tableGroupConfig.func === 'min') aggregatedValue = Math.min(...vals);
                    else if (tableGroupConfig.func === 'max') aggregatedValue = Math.max(...vals);
                    else if (tableGroupConfig.func === 'count') aggregatedValue = g.count;

                    // Apply data type formatting to aggregated result
                    r[m] = applyDataTypeFormatting(aggregatedValue, m);
                });
                return r;
            });
        }
        tableData = processed;
    }

    function renderDashboard() {
        if (vizData.length === 0 && tableData.length === 0) {
            divTable.innerHTML = "<p>No data matching filters.</p>";
            divChart.innerHTML = "";
            return;
        }

        const sample = vizData[0] || tableData[0] || {};
        const columns = Object.keys(sample);

        populateSelect(selX, columns);
        populateSelect(selY, columns);
        populateSelect(selColor, columns, true);
        populateSelect(selMetric, columns.filter(c => isNumeric(sample[c])));

        // Restore State for viz controls
        const restore = (el, key, def) => {
            const saved = sessionStorage.getItem(key);
            if (saved && Array.from(el.options).some(o => o.value === saved)) el.value = saved;
            else if (def) el.value = def;
        };
        const savedType = sessionStorage.getItem("chart_type");
        if (savedType) selChartType.value = savedType;

        // Restore X Multi-Axis
        const savedX = sessionStorage.getItem("x_axis");
        if (savedX) {
            try {
                const vals = JSON.parse(savedX);
                Array.from(selX.options).forEach(o => o.selected = vals.includes(o.value));
            } catch (e) {
                selX.value = savedX;
            }
        } else {
            selX.value = columns[0];
        }

        // Restore Y Multi-Axis
        const savedY = sessionStorage.getItem("y_axis");
        const defY = columns.slice(1).find(c => isNumeric(sample[c])) || columns[1] || columns[0];
        if (savedY) {
            try {
                const vals = JSON.parse(savedY);
                Array.from(selY.options).forEach(o => o.selected = vals.includes(o.value));
            } catch (e) {
                selY.value = savedY;
            }
        } else if (defY) {
            selY.value = defY;
        }

        restore(selColor, "color_axis", "");

        // Restore Axis Ranges
        if (inputXMin) inputXMin.value = sessionStorage.getItem("x_min") || "";
        if (inputXMax) inputXMax.value = sessionStorage.getItem("x_max") || "";
        if (inputYMin) inputYMin.value = sessionStorage.getItem("y_min") || "";
        if (inputYMax) inputYMax.value = sessionStorage.getItem("y_max") || "";

        updateChart();
        renderTable();
        renderMetrics();
    }

    function renderTable() {
        if (!tableData || tableData.length === 0) {
            divTable.innerHTML = "<p>No data matching filters.</p>";
            return;
        }

        const cols = Object.keys(tableData[0]);
        // Respect reorder if available and relevant
        let displayCols = columnOrder.map(c => renameMap[c] || c).filter(c => cols.includes(c));
        // Add any missing columns
        cols.forEach(c => { if (!displayCols.includes(c)) displayCols.push(c); });

        let html = `<table><thead><tr>`;
        displayCols.forEach(c => html += `<th>${c}</th>`);
        html += `</tr></thead><tbody>`;

        tableData.forEach(row => {
            html += `<tr>`;
            displayCols.forEach(c => html += `<td>${row[c] !== undefined ? row[c] : ""}</td>`);
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        divTable.innerHTML = html;
    }

    function updateChart() {
        if (!vizData || vizData.length === 0) return;

        const type = selChartType.value;
        const xCols = Array.from(selX.selectedOptions).map(o => o.value);
        const yCols = Array.from(selY.selectedOptions).map(o => o.value);
        const colorCol = selColor.value;

        // Save State
        sessionStorage.setItem("chart_type", type);
        sessionStorage.setItem("x_axis", JSON.stringify(xCols));
        sessionStorage.setItem("y_axis", JSON.stringify(yCols));
        sessionStorage.setItem("color_axis", colorCol);

        if (inputXMin) sessionStorage.setItem("x_min", inputXMin.value);
        if (inputXMax) sessionStorage.setItem("x_max", inputXMax.value);
        if (inputYMin) sessionStorage.setItem("y_min", inputYMin.value);
        if (inputYMax) sessionStorage.setItem("y_max", inputYMax.value);

        if (xCols.length === 0 || yCols.length === 0) {
            divChart.innerHTML = "";
            return;
        }

        const plotData = [];

        // Handle X values - preserve numeric if single column
        let xValues;
        if (xCols.length === 1) {
            const firstVal = vizData[0][xCols[0]];
            if (isNumeric(firstVal)) {
                xValues = vizData.map(d => Number(d[xCols[0]]));
            } else {
                xValues = vizData.map(d => d[xCols[0]]);
            }
        } else {
            xValues = vizData.map(d => xCols.map(c => d[c]).join(" - "));
        }

        if (type === 'pie') {
            plotData.push({
                values: vizData.map(d => d[yCols[0]]),
                labels: xValues,
                type: 'pie'
            });
        } else {
            yCols.forEach(yCol => {
                let groups = {};
                if (colorCol && colorCol !== "None") {
                    vizData.forEach((d, i) => {
                        const cVal = d[colorCol] || "Unknown";
                        if (!groups[cVal]) groups[cVal] = { x: [], y: [] };
                        groups[cVal].x.push(xValues[i]);
                        groups[cVal].y.push(d[yCol]);
                    });
                } else {
                    groups[yCol] = {
                        x: xValues,
                        y: vizData.map(d => d[yCol])
                    };
                }

                Object.keys(groups).forEach(name => {
                    const g = groups[name];
                    plotData.push({
                        x: g.x,
                        y: g.y,
                        name: name,
                        type: type === 'scatter' ? 'scatter' : (type === 'bar' ? 'bar' : (type === 'histogram' ? 'histogram' : 'scatter')),
                        mode: type === 'line' ? 'lines' : (type === 'scatter' ? 'markers' : undefined),
                        fill: type === 'area' ? 'tozeroy' : undefined
                    });
                });
            });
        }

        const layout = {
            title: { text: `${yCols.join(", ")} by ${xCols.join(", ")}` },
            autosize: true,
            margin: { t: 40, r: 20, l: 40, b: 40 },
            barmode: 'group',
            xaxis: { autorange: true },
            yaxis: { autorange: true }
        };

        // Apply Manual Ranges
        let xRangeApplied = false;
        const xMinVal = inputXMin && inputXMin.value !== "" ? parseFloat(inputXMin.value) : null;
        const xMaxVal = inputXMax && inputXMax.value !== "" ? parseFloat(inputXMax.value) : null;
        const yMinVal = inputYMin && inputYMin.value !== "" ? parseFloat(inputYMin.value) : null;
        const yMaxVal = inputYMax && inputYMax.value !== "" ? parseFloat(inputYMax.value) : null;

        if (xMinVal !== null || xMaxVal !== null) {
            layout.xaxis.range = [xMinVal, xMaxVal];
            layout.xaxis.autorange = false;
            xRangeApplied = true;
        } else {
            // Reset to autorange if no range specified
            layout.xaxis.autorange = true;
            delete layout.xaxis.range;
        }

        if (yMinVal !== null || yMaxVal !== null) {
            layout.yaxis.range = [yMinVal, yMaxVal];
            layout.yaxis.autorange = false;
        } else {
            // Reset to autorange if no range specified
            layout.yaxis.autorange = true;
            delete layout.yaxis.range;
        }

        console.log("Plotting with layout:", layout);
        Plotly.newPlot(divChart, plotData, layout, { responsive: true });
    }

    function renderMetrics() {
        const data = vizData;
        if (!data || data.length === 0) {
            divMetrics.innerHTML = "";
            return;
        }

        const selectedColumn = selMetric.value;
        if (!selectedColumn) {
            divMetrics.innerHTML = "<p>Select a column to view statistics</p>";
            return;
        }

        const vals = data.map(r => Number(r[selectedColumn])).filter(v => !isNaN(v));
        if (vals.length === 0) {
            divMetrics.innerHTML = "<p>No numeric data available for selected column</p>";
            return;
        }

        const sum = vals.reduce((a, b) => a + b, 0);
        const avg = sum / vals.length;
        const min = Math.min(...vals);
        const max = Math.max(...vals);

        // Calculate standard deviation
        const variance = vals.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / vals.length;
        const std = Math.sqrt(variance);

        const html = `
        <div class="metric-cards-horizontal">
            <div class="metric-card-horizontal">
                <div class="metric-label">Sum</div>
                <div class="metric-value">${sum.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
            </div>
            <div class="metric-card-horizontal">
                <div class="metric-label">Avg</div>
                <div class="metric-value">${avg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
            </div>
            <div class="metric-card-horizontal">
                <div class="metric-label">Min</div>
                <div class="metric-value">${min.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
            </div>
            <div class="metric-card-horizontal">
                <div class="metric-label">Max</div>
                <div class="metric-value">${max.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
            </div>
            <div class="metric-card-horizontal">
                <div class="metric-label">Std</div>
                <div class="metric-value">${std.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
            </div>
        </div>`;

        divMetrics.innerHTML = html;
        // Change parent class to avoid grid layout conflicts
        divMetrics.className = 'metrics-horizontal';
    }

    function populateSelect(sel, options, hasNone = false) {
        const current = sel.multiple ? Array.from(sel.selectedOptions).map(o => o.value) : [sel.value];
        sel.innerHTML = "";
        if (hasNone) {
            const opt = document.createElement("option");
            opt.value = ""; opt.text = "None";
            sel.appendChild(opt);
        }
        options.forEach(o => {
            const opt = document.createElement("option");
            opt.value = o; opt.text = o;
            if (current.includes(o)) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    function detectType(val) {
        if (isNumeric(val)) return 'num';
        // Date check: Date.parse AND contains typical date chars
        if (!isNaN(Date.parse(val)) && String(val).match(/[-/:]/)) return 'date';
        return 'str';
    }
});
