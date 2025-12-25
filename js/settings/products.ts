
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { ICONS, showConfirmation, showToast } from '../ui.ts';
import { generateId } from '../utils.ts';

export function renderCreateProduct() {
    const newProdCustomer = document.getElementById('new-prod-customer');
    const newProdSurovina = document.getElementById('new-prod-surovina');
    const newProdBoxType = document.getElementById('new-prod-box-type');
    const newProdTrayType = document.getElementById('new-prod-tray-type'); // New
    const newProdCalibratedSurovina = document.getElementById('new-prod-calibrated-surovina');
    const newProdCalibratedWeight = document.getElementById('new-prod-calibrated-weight');
    const saveCaliberBtn = document.getElementById('save-caliber-btn');
    const orderInTraysCheckbox = document.getElementById('new-prod-order-in-trays'); // New
    
    const customerOptions = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    newProdCustomer.innerHTML = customerOptions;
    
    const surovinaOptions = appState.suroviny.filter(s => !s.isMix && !s.isProduct).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    newProdSurovina.innerHTML = surovinaOptions;
    newProdCalibratedSurovina.innerHTML = '<option value="">-- Vyberte --</option>' + surovinaOptions;

    const boxTypeOptions = appState.boxTypes.map(bt => `<option value="${bt.id}">${bt.name}</option>`).join('');
    newProdBoxType.innerHTML = boxTypeOptions;

    // Populate Tray Types
    const trayTypeOptions = '<option value="">-- Vyberte --</option>' + appState.trayTypes.map(tt => `<option value="${tt.id}">${tt.name}</option>`).join('');
    newProdTrayType.innerHTML = trayTypeOptions;
    
    const toggleSaveCaliberBtn = () => {
        saveCaliberBtn.disabled = !(newProdCalibratedSurovina.value && newProdCalibratedWeight.value.trim());
    };
    newProdCalibratedSurovina.onchange = toggleSaveCaliberBtn;
    newProdCalibratedWeight.oninput = toggleSaveCaliberBtn;

    // Toggle Order in Trays Logic
    orderInTraysCheckbox.onchange = () => {
        const isTrays = orderInTraysCheckbox.checked;
        const labelWeight = document.getElementById('label-box-weight');
        const containerBoxType = document.getElementById('container-box-type');
        const containerTrayType = document.getElementById('container-tray-type');
        const containerTraysPerBox = document.getElementById('container-trays-per-box');

        if (isTrays) {
            // Režim Misky: Skryjeme počet misek v bedně (je to 1:1), zobrazíme typ misky
            labelWeight.textContent = 'Výchozí váha misky (g)';
            containerBoxType.style.display = 'none';
            containerTrayType.style.display = 'block';
            containerTraysPerBox.style.display = 'none'; 
        } else {
            // Režim Bedny: Zobrazíme počet misek v bedně (pro definici obsahu), zobrazíme typ bedny
            labelWeight.textContent = 'Výchozí váha bedny (g)';
            containerBoxType.style.display = 'block';
            containerTrayType.style.display = 'none';
            containerTraysPerBox.style.display = 'block';
        }
    };

    // Initialize UI state based on default checkbox state
    orderInTraysCheckbox.dispatchEvent(new Event('change'));

    renderExistingProducts();
}

function renderExistingProducts() {
    const tbody = document.getElementById('existing-products-table-body');
    tbody.innerHTML = '';
    const boxTypeMap = new Map(appState.boxTypes.map(bt => [bt.id, bt.name]));
    const trayTypeMap = new Map(appState.trayTypes.map(tt => [tt.id, tt.name]));

    appState.products.forEach(product => {
        const customer = appState.zakaznici.find(c => c.id === product.customerId);
        const surovina = appState.suroviny.find(s => s.id === product.surovinaId);
        const tr = document.createElement('tr');
        if (!product.isActive) {
            tr.classList.add('product-inactive');
        }
        const activeIcon = product.isActive ? ICONS.eye : ICONS.eyeOff;
        
        let packagingInfo = '';
        if (product.orderInTrays) {
            const trayName = trayTypeMap.get(product.trayTypeId) || 'Neznámá miska';
            packagingInfo = `<span style="color: var(--accent-primary); font-weight: 500;">Misky: ${trayName}</span>`;
        } else {
            packagingInfo = boxTypeMap.get(product.boxTypeId) || 'Nenastaveno';
            if (product.traysPerBox > 0) {
                packagingInfo += ` (${product.traysPerBox} ks/bed)`;
            }
        }

        tr.innerHTML = `
            <td>${product.name}</td>
            <td>${customer?.name || 'N/A'}</td>
            <td>${surovina?.name || 'N/A'}</td>
            <td>${packagingInfo}</td>
            <td><button class="btn-icon" data-action="toggle-product-active" data-id="${product.id}">${activeIcon}</button></td>
            <td class="actions">
                <button class="btn-icon" data-action="edit-product" data-id="${product.id}">${ICONS.edit}</button>
                <button class="btn-icon danger" data-action="delete-product" data-id="${product.id}">${ICONS.trash}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

export function openProductEditor(productId) {
    const product = appState.products.find(p => p.id === productId);
    if (!product) return;

    appState.ui.editingProductId = productId;
    document.getElementById('create-product-header').textContent = `Upravit produkt: ${product.name}`;
    document.getElementById('new-prod-name').value = product.name;
    document.getElementById('new-prod-customer').value = product.customerId;
    document.getElementById('new-prod-surovina').value = product.surovinaId;
    document.getElementById('new-prod-box-weight').value = product.boxWeight;
    
    // Checkbox and specific fields
    const checkbox = document.getElementById('new-prod-order-in-trays');
    checkbox.checked = product.orderInTrays || false;
    
    // Set values before triggering change
    document.getElementById('new-prod-trays-per-box').value = product.traysPerBox || '';

    if (product.orderInTrays) {
        document.getElementById('new-prod-tray-type').value = product.trayTypeId || '';
    } else {
        document.getElementById('new-prod-box-type').value = product.boxTypeId || '';
    }
    
    // Trigger change event to update UI visibility
    checkbox.dispatchEvent(new Event('change'));

    document.getElementById('new-prod-quick-entry').checked = product.showInQuickEntry || false;
    document.getElementById('new-prod-is-other').checked = product.isOther || false;
    document.getElementById('new-prod-marinade-name').value = product.marinadeName;
    document.getElementById('new-prod-marinade-percent').value = product.marinadePercent;
    document.getElementById('new-prod-loss-percent').value = product.lossPercent;
    document.getElementById('new-prod-calibrated-surovina').value = product.calibratedSurovinaId;
    document.getElementById('new-prod-calibrated-weight').value = product.calibratedWeight;

    document.getElementById('save-new-prod-btn').textContent = 'Uložit změny';
    document.getElementById('cancel-edit-prod-btn').style.display = 'inline-block';
    window.scrollTo(0, 0);
}

export function cancelEditProd() {
    appState.ui.editingProductId = null;
    document.getElementById('create-product-header').textContent = 'Vytvořit nový produkt';
    document.getElementById('new-prod-name').value = '';
    document.getElementById('new-prod-box-weight').value = '';
    document.getElementById('new-prod-box-type').value = appState.boxTypes[0]?.id || '';
    document.getElementById('new-prod-order-in-trays').checked = false;
    document.getElementById('new-prod-tray-type').value = '';
    document.getElementById('new-prod-trays-per-box').value = '';
    // Reset UI state
    document.getElementById('new-prod-order-in-trays').dispatchEvent(new Event('change'));

    document.getElementById('new-prod-quick-entry').checked = false;
    document.getElementById('new-prod-is-other').checked = false;
    document.getElementById('new-prod-marinade-name').value = '';
    document.getElementById('new-prod-marinade-percent').value = '';
    document.getElementById('new-prod-loss-percent').value = '';
    document.getElementById('new-prod-calibrated-weight').value = '';
    document.getElementById('save-new-prod-btn').textContent = 'Uložit produkt';
    document.getElementById('cancel-edit-prod-btn').style.display = 'none';
}

export function saveNewProd() {
    const { newProdName, newProdCustomer, newProdSurovina, newProdBoxWeight, newProdBoxType, newProdQuickEntry, newProdIsOther, newProdMarinadeName, newProdMarinadePercent, newProdLossPercent, newProdCalibratedSurovina, newProdCalibratedWeight } = {
        newProdName: document.getElementById('new-prod-name'),
        newProdCustomer: document.getElementById('new-prod-customer'),
        newProdSurovina: document.getElementById('new-prod-surovina'),
        newProdBoxWeight: document.getElementById('new-prod-box-weight'),
        newProdBoxType: document.getElementById('new-prod-box-type'),
        newProdQuickEntry: document.getElementById('new-prod-quick-entry'),
        newProdIsOther: document.getElementById('new-prod-is-other'),
        newProdMarinadeName: document.getElementById('new-prod-marinade-name'),
        newProdMarinadePercent: document.getElementById('new-prod-marinade-percent'),
        newProdLossPercent: document.getElementById('new-prod-loss-percent'),
        newProdCalibratedSurovina: document.getElementById('new-prod-calibrated-surovina'),
        newProdCalibratedWeight: document.getElementById('new-prod-calibrated-weight'),
    };

    const orderInTrays = document.getElementById('new-prod-order-in-trays').checked;
    const trayTypeId = document.getElementById('new-prod-tray-type').value;
    // If orderInTrays is TRUE, traysPerBox is 1 (direct ordering). 
    // If FALSE, we take the value from the input (optional for standard boxes).
    const traysPerBox = orderInTrays ? 1 : (parseInt(document.getElementById('new-prod-trays-per-box').value) || 0);
    const inputWeight = parseFloat(newProdBoxWeight.value) || 0;

    const name = newProdName.value.trim();
    if (!name) {
        showToast('Zadejte název produktu.', 'error');
        return;
    }
    
    // Updated validation: if orderInTrays, we only need trayTypeId
    if (orderInTrays && !trayTypeId) {
        showToast('Při objednávce v miskách musíte vybrat typ misky.', 'error');
        return;
    }

    const productData = {
        name: name,
        customerId: newProdCustomer.value,
        surovinaId: newProdSurovina.value,
        boxWeight: inputWeight, // This is tray weight if orderInTrays is true
        boxTypeId: orderInTrays ? null : newProdBoxType.value,
        showInQuickEntry: newProdQuickEntry.checked,
        isOther: newProdIsOther.checked,
        marinadeName: newProdMarinadeName.value.trim(),
        marinadePercent: parseFloat(newProdMarinadePercent.value) || 0,
        lossPercent: parseFloat(newProdLossPercent.value) || 0,
        calibratedSurovinaId: newProdCalibratedSurovina.value,
        calibratedWeight: newProdCalibratedWeight.value.trim(),
        isActive: true,
        orderInTrays: orderInTrays,
        trayTypeId: orderInTrays ? trayTypeId : null,
        traysPerBox: traysPerBox
    };

    const isEditing = !!appState.ui.editingProductId;
    let productId = appState.ui.editingProductId;

    // --- Save Product ---
    if (isEditing) {
        const index = appState.products.findIndex(p => p.id === productId);
        if (index !== -1) {
            appState.products[index] = { ...appState.products[index], ...productData };
            showToast('Produkt upraven');
        }
    } else {
        productId = generateId();
        appState.products.push({ id: productId, ...productData });
        showToast('Nový produkt uložen.');
    }
    
    // --- Update Surovina Proxy ---
    const surovinaProxy = {
        id: productId,
        name: productData.name,
        isMix: false,
        isProduct: true,
        baseSurovinaId: productData.surovinaId,
        paletteWeight: 0,
        stock: 0,
        isActive: productData.isActive
    };

    const surovinaIndex = appState.suroviny.findIndex(s => s.id === productId);
    if (surovinaIndex > -1) {
        appState.suroviny[surovinaIndex] = { ...appState.suroviny[surovinaIndex], ...surovinaProxy };
    } else {
        appState.suroviny.push(surovinaProxy);
    }

    // --- AUTO-SAVE WEIGHT SETTINGS ---
    // If orderInTrays is set, save single tray weight as the "box" weight.
    // If orderInTrays is NOT set, save standard box weight.
    if (inputWeight > 0) {
        if (!appState.boxWeights[productData.customerId]) {
            appState.boxWeights[productData.customerId] = {};
        }
        
        let fullBoxWeightGrams;
        
        if (orderInTrays) {
            // For tray ordering, "box weight" for calculation is the weight of 1 tray
            fullBoxWeightGrams = Math.round(inputWeight); 
        } else {
            // For standard box ordering, inputWeight is the full box weight
            fullBoxWeightGrams = Math.round(inputWeight); 
        }
        
        // Initialize or update the weight entry
        appState.boxWeights[productData.customerId][productId] = {
            OA: fullBoxWeightGrams,
            RB: fullBoxWeightGrams,
            VL: orderInTrays ? 0 : fullBoxWeightGrams, // Disable VL for tray products
            isActive: true,
            oaTraysPerBox: traysPerBox, // 1 for direct tray ordering
            rbTraysPerBox: traysPerBox  // 1 for direct tray ordering
        };
        
        // Also ensure tray assignment is saved if applicable
        if (productData.trayTypeId) {
            if (!appState.customerTrayAssignments[productData.customerId]) {
                appState.customerTrayAssignments[productData.customerId] = {};
            }
            appState.customerTrayAssignments[productData.customerId][productId] = productData.trayTypeId;
        }
    }
    
    saveState();
    cancelEditProd();
    renderCreateProduct();
}

export function deleteProduct(productId) {
    showConfirmation('Opravdu chcete smazat tento produkt?', () => {
        appState.products = appState.products.filter(p => p.id !== productId);
        appState.suroviny = appState.suroviny.filter(s => s.id !== productId);
        appState.orders.forEach(order => {
            order.items = order.items.filter(item => item.surovinaId !== productId);
        });
        Object.keys(appState.boxWeights).forEach(customerId => {
            delete appState.boxWeights[customerId][productId];
        });

        saveState();
        renderCreateProduct();
        showToast('Produkt smazán', 'success');
    });
}

export function toggleProductActive(productId) {
    const product = appState.products.find(p => p.id === productId);
    const surovina = appState.suroviny.find(s => s.id === productId);
    if(product) {
        product.isActive = !product.isActive;
        if (surovina) {
            surovina.isActive = product.isActive;
        }
        saveState();
        renderExistingProducts();
        showToast(product.isActive ? 'Produkt aktivován' : 'Produkt deaktivován');
    }
}

export function saveCaliberAsSurovina() {
    const newProdCalibratedSurovina = document.getElementById('new-prod-calibrated-surovina');
    const newProdCalibratedWeight = document.getElementById('new-prod-calibrated-weight');
    const baseSurovinaId = newProdCalibratedSurovina.value;
    const caliberRange = newProdCalibratedWeight.value.trim();

    if (!baseSurovinaId || !caliberRange) {
        showToast('Vyberte surovinu a zadejte váhu pro uložení kalibru.', 'error');
        return;
    }

    const baseSurovina = appState.suroviny.find(s => s.id === baseSurovinaId);
    const newName = `${baseSurovina.name} (${caliberRange}g)`;

    if (appState.suroviny.some(s => s.name === newName)) {
        showToast('Surovina s tímto kalibrem již existuje.', 'error');
        return;
    }

    const newSurovina = {
        id: generateId(),
        name: newName,
        isMix: false,
        isCalibrated: true,
        baseSurovinaId: baseSurovinaId,
        caliberRange: caliberRange,
        paletteWeight: baseSurovina.paletteWeight,
        stock: 0,
        isActive: true
    };

    appState.suroviny.push(newSurovina);
    saveState();
    showToast(`Nová surovina "${newName}" byla vytvořena.`);
    renderCreateProduct();
}
