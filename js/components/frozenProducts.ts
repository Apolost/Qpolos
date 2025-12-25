/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showToast, showConfirmation } from '../ui.ts';
import { generateId } from '../utils.ts';

export function renderFrozenProductsPage() {
    const tbody = document.getElementById('frozen-products-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    appState.frozenProducts.forEach(product => {
        const rawMaterial = appState.suroviny.find(s => s.id === product.rawMaterialId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${product.name}</td>
            <td>${rawMaterial?.name || 'N/A'}</td>
            <td>${product.cartonWeightKg.toFixed(2)}</td>
            <td class="actions">
                <button class="btn-icon" data-action="edit-frozen-product" data-id="${product.id}">${ICONS.edit}</button>
                <button class="btn-icon danger" data-action="delete-frozen-product" data-id="${product.id}">${ICONS.trash}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    feather.replace();
}

export function openAddFrozenProductModal(productId = null) {
    const modal = DOMElements.addFrozenProductModal;
    const title = modal.querySelector('#frozen-product-modal-title');
    const nameInput = modal.querySelector('#frozen-product-name');
    const rawMaterialSelect = modal.querySelector('#frozen-product-raw-material');
    const weightInput = modal.querySelector('#frozen-product-carton-weight');
    
    // Populate raw material options
    rawMaterialSelect.innerHTML = appState.suroviny
        .filter(s => s.isActive && !s.isMix && !s.isProduct)
        .map(s => `<option value="${s.id}">${s.name}</option>`)
        .join('');

    appState.ui.editingFrozenProductId = productId;

    if (productId) {
        const product = appState.frozenProducts.find(p => p.id === productId);
        if (product) {
            title.textContent = 'Upravit mražený produkt';
            nameInput.value = product.name;
            rawMaterialSelect.value = product.rawMaterialId;
            weightInput.value = product.cartonWeightKg;
        }
    } else {
        title.textContent = 'Vytvořit mražený produkt';
        nameInput.value = '';
        weightInput.value = '';
    }
    modal.classList.add('active');
}

export function cancelEditFrozenProduct() {
    DOMElements.addFrozenProductModal.classList.remove('active');
    appState.ui.editingFrozenProductId = null;
}

export function saveFrozenProduct() {
    const modal = DOMElements.addFrozenProductModal;
    const id = appState.ui.editingFrozenProductId;
    const name = modal.querySelector('#frozen-product-name').value.trim();
    const rawMaterialId = modal.querySelector('#frozen-product-raw-material').value;
    const cartonWeightKg = parseFloat(modal.querySelector('#frozen-product-carton-weight').value);

    if (!name || !rawMaterialId || !cartonWeightKg || cartonWeightKg <= 0) {
        showToast('Všechna pole jsou povinná a váha musí být kladné číslo.', 'error');
        return;
    }
    
    const isDuplicate = appState.frozenProducts.some(p => p.name.toLowerCase() === name.toLowerCase() && p.id !== id);
    if (isDuplicate) {
        showToast('Produkt s tímto názvem již existuje.', 'error');
        return;
    }

    if (id) {
        const product = appState.frozenProducts.find(p => p.id === id);
        if (product) {
            product.name = name;
            product.rawMaterialId = rawMaterialId;
            product.cartonWeightKg = cartonWeightKg;
            showToast('Produkt upraven.');
        }
    } else {
        const newProduct = {
            id: `fp_${Date.now()}`,
            name,
            rawMaterialId,
            cartonWeightKg,
        };
        appState.frozenProducts.push(newProduct);
        showToast('Nový mražený produkt uložen.');
    }

    saveState();
    renderFrozenProductsPage();
    cancelEditFrozenProduct();
}

export function deleteFrozenProduct(productId) {
    const isInUse = appState.frozenProductionOrders.some(o => o.frozenProductId === productId);
    if (isInUse) {
        showToast('Tento produkt nelze smazat, protože je použit v aktivním požadavku na výrobu.', 'error');
        return;
    }

    showConfirmation('Opravdu chcete smazat tento mražený produkt?', () => {
        appState.frozenProducts = appState.frozenProducts.filter(p => p.id !== productId);
        saveState();
        showToast('Produkt smazán.');
        renderFrozenProductsPage();
    });
}