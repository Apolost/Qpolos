
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, showToast, ICONS, showConfirmation } from '../ui.ts';
import { generateId } from '../utils.ts';
import { renderOrders } from './orders.ts';
import { renderMainPage } from './mainPage.ts';

export function openImportOrdersModal() {
    appState.ui.importedOrders = []; // Clear temp storage
    const modal = document.getElementById('import-orders-modal');
    
    // Reset file input
    const fileInput = modal.querySelector('#import-file-input');
    fileInput.value = '';
    modal.querySelector('#import-file-name').textContent = 'Žádný soubor nevybrán';
    
    renderImportTable();
    modal.classList.add('active');
}

export function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('import-file-name').textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        parseExcel(data);
    };
    reader.readAsArrayBuffer(file);
}

function parseExcel(data) {
    try {
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const processedOrders = [];

        jsonData.forEach(row => {
            // Logic: Check for 6-digit product code
            const productCode = row['VÝROBEK'];
            if (!productCode || String(productCode).length !== 6 || isNaN(Number(productCode))) {
                return; // Skip invalid rows
            }

            const reqQty = parseFloat(row['MNOŽSTVÍ POŽ.']) || 0;
            const delQty = parseFloat(row['MNOŽSTVÍ ODV.']) || 0;
            
            // Logic: Net Quantity = Requested - Delivered
            // Ignore decimals like .000 by using Math.round if it's very close, but here we keep precision
            // and just check > 0.
            const netQty = reqQty - delQty;

            if (netQty > 0.001) {
                processedOrders.push({
                    code: String(productCode),
                    reqQty: reqQty,
                    delQty: delQty,
                    netQty: netQty,
                    status: 'unknown', // 'unknown' or 'mapped'
                    mapping: null // { customerId, surovinaId, type }
                });
            }
        });

        // Match with existing mappings
        processedOrders.forEach(order => {
            if (appState.productMappings[order.code]) {
                order.status = 'mapped';
                order.mapping = appState.productMappings[order.code];
            }
        });

        appState.ui.importedOrders = processedOrders;
        renderImportTable();
        showToast(`Načteno ${processedOrders.length} položek z Excelu.`);

    } catch (error) {
        console.error("Excel parsing error:", error);
        showToast('Chyba při čtení Excel souboru.', 'error');
    }
}

function renderImportTable() {
    const tbody = document.getElementById('import-orders-table-body');
    const confirmBtn = document.getElementById('confirm-import-btn');
    const totalCountEl = document.getElementById('import-total-count');
    
    if (!appState.ui.importedOrders || appState.ui.importedOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Žádná data k zobrazení.</td></tr>';
        confirmBtn.disabled = true;
        totalCountEl.textContent = '0';
        return;
    }

    let readyCount = 0;
    let html = '';

    appState.ui.importedOrders.forEach((order, index) => {
        const isMapped = order.status === 'mapped';
        if (isMapped) readyCount++;

        let statusBadge = '';
        let actionBtn = '';
        let mappingInfo = '';

        if (isMapped) {
            const customer = appState.zakaznici.find(c => c.id === order.mapping.customerId);
            const surovina = appState.suroviny.find(s => s.id === order.mapping.surovinaId);
            statusBadge = `<span style="color: var(--accent-success); font-weight: bold;">Připraveno</span>`;
            mappingInfo = `<br><small style="color: var(--text-secondary);">${customer?.name || '?'} - ${surovina?.name || '?'} (${order.mapping.type})</small>`;
            actionBtn = `<button class="btn-icon" title="Upravit zařazení" onclick="document.querySelector('[data-action=\\'open-classify-modal\\'][data-code=\\'${order.code}\\']').click()"><i data-feather="edit-2"></i></button>`;
        } else {
            statusBadge = `<span style="color: var(--accent-danger); font-weight: bold;">Nezařazeno</span>`;
            actionBtn = `<button class="btn btn-sm btn-primary" data-action="open-classify-modal" data-code="${order.code}" data-index="${index}">Zařadit</button>`;
        }

        html += `
            <tr>
                <td>${order.code}${mappingInfo}</td>
                <td>${order.reqQty}</td>
                <td>${order.delQty}</td>
                <td><strong>${order.netQty}</strong></td>
                <td>${statusBadge}</td>
                <td class="actions">${actionBtn}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    totalCountEl.textContent = readyCount;
    confirmBtn.disabled = readyCount === 0;
    confirmBtn.textContent = `Importovat vybrané (${readyCount})`;
    
    feather.replace();
}

export function openClassifyModal(code) {
    const modal = document.getElementById('classify-product-modal');
    const customerSelect = document.getElementById('classify-customer');
    const surovinaSelect = document.getElementById('classify-surovina');
    
    document.getElementById('classify-product-code').textContent = code;
    document.getElementById('classify-product-code-hidden').value = code;

    // Populate dropdowns if empty
    if (customerSelect.options.length === 0) {
        customerSelect.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    if (surovinaSelect.options.length === 0) {
        surovinaSelect.innerHTML = appState.suroviny.filter(s => s.isActive).sort((a,b) => a.name.localeCompare(b.name)).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }

    // Pre-select if existing mapping exists (for editing)
    if (appState.productMappings[code]) {
        const mapping = appState.productMappings[code];
        customerSelect.value = mapping.customerId;
        surovinaSelect.value = mapping.surovinaId;
        document.getElementById('classify-type').value = mapping.type;
    } else {
        // Defaults
        customerSelect.selectedIndex = 0;
        surovinaSelect.selectedIndex = 0;
        document.getElementById('classify-type').value = 'VL';
    }

    modal.classList.add('active');
}

export function saveProductClassification() {
    const code = document.getElementById('classify-product-code-hidden').value;
    const customerId = document.getElementById('classify-customer').value;
    const surovinaId = document.getElementById('classify-surovina').value;
    const type = document.getElementById('classify-type').value;

    if (!customerId || !surovinaId) {
        showToast('Vyberte zákazníka a produkt.', 'error');
        return;
    }

    // Save mapping
    appState.productMappings[code] = { customerId, surovinaId, type };
    saveState();

    // Update temp orders
    if (appState.ui.importedOrders) {
        appState.ui.importedOrders.forEach(order => {
            if (order.code === code) {
                order.status = 'mapped';
                order.mapping = { customerId, surovinaId, type };
            }
        });
    }

    document.getElementById('classify-product-modal').classList.remove('active');
    renderImportTable();
    showToast(`Produkt ${code} byl zařazen.`);
}

export function confirmImportOrders() {
    const date = appState.ui.selectedDate;
    let addedCount = 0;

    appState.ui.importedOrders.forEach(importItem => {
        if (importItem.status === 'mapped' && importItem.netQty > 0) {
            const { customerId, surovinaId, type } = importItem.mapping;
            
            let order = appState.orders.find(o => o.customerId === customerId && o.date === date);
            if (!order) {
                order = { id: generateId(), date: date, customerId: customerId, items: [] };
                appState.orders.push(order);
            }

            // Try to find existing item to merge, or create new
            let item = order.items.find(i => i.surovinaId === surovinaId && i.type === type);
            
            const boxCount = Math.round(importItem.netQty);

            if (boxCount > 0) {
                if (item) {
                    item.boxCount += boxCount;
                } else {
                    order.items.push({
                        id: generateId(),
                        surovinaId: surovinaId,
                        boxCount: boxCount,
                        isActive: true,
                        type: type,
                        doneCount: 0
                    });
                }
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        saveState();
        showToast(`Úspěšně importováno ${addedCount} položek do objednávek.`);
        document.getElementById('import-orders-modal').classList.remove('active');
        
        if (appState.ui.activeView === 'orders') renderOrders();
        else if (appState.ui.activeView === 'main-page') renderMainPage();
    } else {
        showToast('Nebyly nalezeny žádné položky k importu.', 'warning');
    }
}

// --- Mapping Management ---

export function openMappingsModal() {
    const modal = document.getElementById('manage-mappings-modal');
    const tbody = document.getElementById('mappings-table-body');
    tbody.innerHTML = '';

    const mappings = Object.entries(appState.productMappings);
    
    if (mappings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Žádná uložená zařazení.</td></tr>';
    } else {
        mappings.forEach(([code, map]) => {
            const customer = appState.zakaznici.find(c => c.id === map.customerId);
            const surovina = appState.suroviny.find(s => s.id === map.surovinaId);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${code}</td>
                <td>${customer?.name || 'Neznámý'}</td>
                <td>${surovina?.name || 'Neznámý'}</td>
                <td>${map.type}</td>
                <td class="actions">
                    <button class="btn-icon danger" data-action="delete-mapping" data-code="${code}">${ICONS.trash}</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    feather.replace();
    modal.classList.add('active');
}

export function deleteMapping(code) {
    showConfirmation(`Opravdu chcete smazat zařazení pro kód ${code}?`, () => {
        delete appState.productMappings[code];
        saveState();
        openMappingsModal(); // Refresh table
        
        // Also refresh the import table if open, to show "Nezařazeno"
        if (appState.ui.importedOrders) {
            appState.ui.importedOrders.forEach(o => {
                if (o.code === code) {
                    o.status = 'unknown';
                    o.mapping = null;
                }
            });
            renderImportTable();
        }
        showToast('Zařazení smazáno.');
    });
}

// --- Sortiment Numbers Management ---

function renderSortimentNumbersList() {
    const container = document.getElementById('sortiment-numbers-list');
    container.innerHTML = '';

    const mappings = Object.entries(appState.productMappings || {});
    
    if (mappings.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Žádná čísla sortimentu nejsou uložena.</p>';
        return;
    }

    // Group by Customer ID
    const grouped = {};
    mappings.forEach(([code, data]) => {
        const custId = data.customerId;
        if (!grouped[custId]) grouped[custId] = [];
        grouped[custId].push({ code, ...data });
    });

    // Render grouped lists
    for (const custId in grouped) {
        const customer = appState.zakaznici.find(c => c.id === custId);
        const customerName = customer ? customer.name : 'Neznámý zákazník';
        const items = grouped[custId];

        const section = document.createElement('div');
        section.className = 'card';
        section.style.marginBottom = '20px';
        
        let itemsHtml = `
            <div class="card-header" style="border-bottom: 2px solid var(--border-color); padding-bottom: 10px;">
                <h3 class="card-title" style="font-size: 1.1rem;">${customerName}</h3>
            </div>
            <div class="card-content" style="padding: 0;">
                <table class="data-table" style="border: none;">
                    <thead>
                        <tr>
                            <th style="width: 20%;">Kód</th>
                            <th>Sortiment / Výrobek</th>
                            <th style="width: 15%;">Typ</th>
                            <th style="width: 10%; text-align: right;">Akce</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        items.forEach(item => {
            const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
            const surovinaName = surovina ? surovina.name : 'Neznámý produkt';
            
            itemsHtml += `
                <tr>
                    <td style="font-family: monospace; font-weight: bold; color: var(--accent-primary);">${item.code}</td>
                    <td>${surovinaName}</td>
                    <td>${item.type}</td>
                    <td class="actions" style="text-align: right;">
                        <button class="btn-icon danger" onclick="document.querySelector('[data-action=\\'delete-mapping\\'][data-code=\\'${item.code}\\']').click()"><i data-feather="trash-2"></i></button>
                    </td>
                </tr>
            `;
        });

        itemsHtml += `</tbody></table></div>`;
        section.innerHTML = itemsHtml;
        container.appendChild(section);
    }
    feather.replace();
}

export function openSortimentNumbersModal() {
    renderSortimentNumbersList();
    document.getElementById('sortiment-numbers-modal').classList.add('active');
}

export function openAddSortimentNumberModal() {
    const modal = document.getElementById('add-sortiment-number-modal');
    
    const custSelect = modal.querySelector('#new-sortiment-customer');
    const surSelect = modal.querySelector('#new-sortiment-surovina');
    const codeInput = modal.querySelector('#new-sortiment-code');
    const typeSelect = modal.querySelector('#new-sortiment-type');

    // 1. Populate Customers
    custSelect.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    // 2. Helper function to update available products
    const updateAvailableProducts = () => {
        const selectedCustId = custSelect.value;
        const existingMappings = Object.values(appState.productMappings || {});

        // Find currently mapped surovina IDs for this customer
        const usedSurovinaIds = new Set(
            existingMappings
                .filter(m => m.customerId === selectedCustId)
                .map(m => m.surovinaId)
        );

        // Filter: Active surovina AND not currently mapped for this customer
        const availableSuroviny = appState.suroviny
            .filter(s => s.isActive && !usedSurovinaIds.has(s.id))
            .sort((a, b) => a.name.localeCompare(b.name));

        surSelect.innerHTML = availableSuroviny.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    };

    // 3. Attach change listener
    custSelect.onchange = updateAvailableProducts;

    // 4. Initial update & reset fields
    updateAvailableProducts();
    codeInput.value = '';
    typeSelect.value = 'VL'; // Default

    modal.classList.add('active');
}

export function saveSortimentNumber() {
    const code = document.getElementById('new-sortiment-code').value;
    const customerId = document.getElementById('new-sortiment-customer').value;
    const surovinaId = document.getElementById('new-sortiment-surovina').value;
    const type = document.getElementById('new-sortiment-type').value;

    if (!code || code.length !== 6) {
        showToast('Kód musí mít přesně 6 číslic.', 'error');
        return;
    }
    if (appState.productMappings[code]) {
        showToast('Tento kód sortimentu již existuje.', 'error');
        return;
    }
    if (!customerId || !surovinaId) {
        showToast('Vyberte zákazníka a produkt.', 'error');
        return;
    }

    appState.productMappings[code] = { customerId, surovinaId, type };
    saveState();
    
    showToast('Číslo sortimentu uloženo.');
    document.getElementById('add-sortiment-number-modal').classList.remove('active');
    renderSortimentNumbersList();
}
