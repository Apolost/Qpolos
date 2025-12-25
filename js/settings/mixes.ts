/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { ICONS, showConfirmation, showToast } from '../ui.ts';
import { generateId } from '../utils.ts';

export function renderCreateMix() {
    const customerSelect = document.getElementById('new-mix-customer');
    const boxTypeSelect = document.getElementById('new-mix-box-type');

    customerSelect.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    boxTypeSelect.innerHTML = appState.boxTypes.map(bt => `<option value="${bt.id}">${bt.name}</option>`).join('');
    
    cancelEditMix();
    renderExistingMixes();
}

export function openMixEditor(mixId) {
    const mix = appState.suroviny.find(s => s.id === mixId);
    const mixDef = appState.mixDefinitions[mixId];
    if (!mix || !mixDef) return;

    appState.ui.editingMixId = mixId;
    document.getElementById('create-mix-header').textContent = `Upravit mix: ${mix.name}`;
    document.getElementById('new-product-name').value = mix.name;
    document.getElementById('new-mix-customer').value = mix.customerId || '';
    document.getElementById('new-mix-box-type').value = mix.boxTypeId || '';
    document.getElementById('save-new-product-btn').textContent = 'Uložit změny';
    document.getElementById('cancel-edit-mix-btn').style.display = 'inline-block';
    
    renderNewProductComponents(false, mixDef.components);
    window.scrollTo(0, 0);
}

export function cancelEditMix() {
    appState.ui.editingMixId = null;
    document.getElementById('create-mix-header').textContent = 'Vytvořit nový mix';
    document.getElementById('new-product-name').value = '';
    document.getElementById('new-mix-customer').value = appState.zakaznici[0]?.id || '';
    document.getElementById('new-mix-box-type').value = appState.boxTypes[0]?.id || '';
    document.getElementById('save-new-product-btn').textContent = 'Uložit mix';
    document.getElementById('cancel-edit-mix-btn').style.display = 'none';
    renderNewProductComponents();
}

export function renderNewProductComponents(addComponent = false, components = []) {
    const container = document.getElementById('new-product-components');
    if (!addComponent) {
        container.innerHTML = '';
    }
    
    const renderRow = (component = {}) => {
        const row = document.createElement('div');
        row.className = 'form-row';
        const rawMaterials = appState.suroviny.filter(s => !s.isMix);
        row.innerHTML = `
            <div class="form-field" style="flex: 2;">
                <label>Surovina</label>
                <select class="new-product-component-surovina">${rawMaterials.map(s => `<option value="${s.id}" ${component.surovinaId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
            </div>
            <div class="form-field" style="flex: 1;">
                <label>Podíl (%)</label>
                <input type="number" class="new-product-component-percentage" value="${component.percentage || 0}" min="0" max="100" step="0.1">
            </div>
            <button class="btn-icon danger" data-action="delete-new-product-component">${ICONS.trash}</button>
        `;
        container.appendChild(row);
    };

    if (addComponent) {
        renderRow();
    } else {
        if (components.length > 0) {
            components.forEach(renderRow);
        } else {
            renderRow();
        }
    }
    
    container.querySelectorAll('.new-product-component-percentage').forEach(input => {
        input.addEventListener('input', updateNewProductTotalPercentage);
    });
    updateNewProductTotalPercentage();
    feather.replace();
}

export function deleteNewProductComponent(target) {
    target.closest('.form-row').remove(); 
    updateNewProductTotalPercentage();
}

function updateNewProductTotalPercentage() {
    let total = 0;
    document.querySelectorAll('.new-product-component-percentage').forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    const totalEl = document.getElementById('new-product-total-percentage');
    totalEl.textContent = total.toFixed(1);
    totalEl.style.color = Math.abs(total - 100) > 0.1 ? 'var(--accent-danger)' : 'var(--accent-success)';
}

function renderExistingMixes() {
    const tbody = document.getElementById('existing-mixes-table-body');
    if (!tbody) return; 
    tbody.innerHTML = '';
    const mixes = appState.suroviny.filter(s => s.isMix);
    mixes.forEach(mix => {
        const mixDef = appState.mixDefinitions[mix.id];
        if (!mixDef) return;
        const componentsString = mixDef.components.map(c => {
            const surovina = appState.suroviny.find(s => s.id === c.surovinaId);
            return `${surovina?.name || '?'} (${c.percentage}%)`;
        }).join(', ');

        const customer = appState.zakaznici.find(c => c.id === mix.customerId);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${mix.name}</td>
            <td>${customer?.name || 'N/A'}</td>
            <td>${componentsString}</td>
            <td class="actions">
                <button class="btn-icon" data-action="edit-mix" data-id="${mix.id}">${ICONS.edit}</button>
                <button class="btn-icon danger" data-action="delete-mix" data-id="${mix.id}">${ICONS.trash}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

export function saveNewProduct() {
    const name = document.getElementById('new-product-name').value.trim().toUpperCase();
    const customerId = document.getElementById('new-mix-customer').value;
    const boxTypeId = document.getElementById('new-mix-box-type').value;

    if (!name) { showToast('Zadejte název mixu.', 'error'); return; }

    const isEditing = !!appState.ui.editingMixId;
    if (!isEditing && appState.suroviny.some(s => s.name === name)) {
        showToast('Produkt s tímto názvem již existuje.', 'error'); return;
    }

    const components = [];
    let totalPercentage = 0;
    document.querySelectorAll('#new-product-components .form-row').forEach(row => {
        const select = row.querySelector('.new-product-component-surovina');
        const percentageInput = row.querySelector('.new-product-component-percentage');
        const percentage = parseFloat(percentageInput.value) || 0;
        if (percentage > 0) {
            components.push({ surovinaId: select.value, percentage });
            totalPercentage += percentage;
        }
    });

    if (components.length === 0) { showToast('Mix musí mít alespoň jednu složku.', 'error'); return; }
    if (Math.abs(totalPercentage - 100) > 0.1) { showToast('Součet podílů musí být 100%.', 'error'); return; }

    if (isEditing) {
        const mixProduct = appState.suroviny.find(s => s.id === appState.ui.editingMixId);
        mixProduct.name = name;
        mixProduct.customerId = customerId;
        mixProduct.boxTypeId = boxTypeId;
        appState.mixDefinitions[appState.ui.editingMixId].components = components;
        showToast('Mix upraven');
    } else {
        const newMixId = generateId();
        const newMixProduct = { 
            id: newMixId, 
            name, 
            customerId, 
            boxTypeId, 
            paletteWeight: 0, 
            stock: 0, 
            isMix: true, 
            isActive: true, 
            isProduct: false 
        };
        appState.suroviny.push(newMixProduct);
        appState.mixDefinitions[newMixId] = { components };
        
        appState.zakaznici.forEach(c => {
            if (!appState.boxWeights[c.id]) appState.boxWeights[c.id] = {};
            appState.boxWeights[c.id][newMixId] = { OA: 4000, RB: 4000, VL: 10000, isActive: true };
        });
        showToast('Nový mix uložen');
    }

    saveState();
    cancelEditMix();
    renderCreateMix();
}

export function deleteMix(mixId) {
    const isUsedInProducts = appState.products.some(p => p.surovinaId === mixId || p.calibratedSurovinaId === mixId);
    if (isUsedInProducts) {
        showToast('Tento mix nelze smazat, je použit v existujícím produktu.', 'error');
        return;
    }
    
    showConfirmation('Opravdu chcete smazat tento mix? Bude odstraněn i ze všech objednávek.', () => {
        appState.suroviny = appState.suroviny.filter(s => s.id !== mixId);
        delete appState.mixDefinitions[mixId];
        appState.orders.forEach(order => {
            order.items = order.items.filter(item => item.surovinaId !== mixId);
        });
        saveState();
        renderCreateMix();
        showToast('Mix smazán', 'success');
    });
}