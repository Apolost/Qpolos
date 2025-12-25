/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState } from '../state.ts';
import { DOMElements, ICONS, showToast } from '../ui.ts';
import { generateId } from '../utils.ts';

export function renderCalculator() {
    const resultsContainer = document.getElementById('calculator-results');
    const { calculatorItems } = appState.ui;

    if (!calculatorItems || calculatorItems.length === 0) {
        resultsContainer.innerHTML = '<div class="card"><p style="text-align: center; padding: 20px;">Zatím nebyly přidány žádné položky. Začněte kliknutím na "Přidat položku".</p></div>';
        return;
    }

    // --- 1. Summary Calculation ---
    const summary = {}; // { surovinaId: totalKg }
    calculatorItems.forEach(item => {
        const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
        if (!surovina) return;

        let itemTotalKg = 0;
        for (const customerId in item.customerBoxes) {
            const boxCount = item.customerBoxes[customerId];
            if (boxCount > 0) {
                const weights = appState.boxWeights[customerId]?.[item.surovinaId];
                const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights[item.type] : 10000;
                itemTotalKg += boxCount * (boxWeightInGrams / 1000);
            }
        }

        if (!summary[item.surovinaId]) {
            summary[item.surovinaId] = 0;
        }
        summary[item.surovinaId] += itemTotalKg;
    });

    // --- 2. Render HTML ---
    let summaryHtml = `
        <div class="card">
            <div class="card-header"><h2 class="card-title">Celková potřeba</h2></div>
            <div class="card-content">
                <table class="data-table">
                    <thead><tr><th>Surovina</th><th>Celkem potřeba (kg)</th></tr></thead>
                    <tbody>
    `;
    for (const surovinaId in summary) {
        const surovina = appState.suroviny.find(s => s.id === surovinaId);
        summaryHtml += `
            <tr>
                <td>${surovina?.name || 'Neznámá'}</td>
                <td><strong>${summary[surovinaId].toFixed(2)} kg</strong></td>
            </tr>
        `;
    }
    summaryHtml += '</tbody></table></div></div>';

    let detailsHtml = `
        <div class="card" style="margin-top: 32px;">
            <div class="card-header"><h2 class="card-title">Zadané položky</h2></div>
            <div class="card-content">
                <table class="data-table">
                    <thead><tr><th>Surovina</th><th>Typ balení</th><th>Zákazníci</th><th class="actions">Akce</th></tr></thead>
                    <tbody>
    `;
    calculatorItems.forEach(item => {
        const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
        const customerDetails = Object.entries(item.customerBoxes)
            .filter(([, count]) => count > 0)
            .map(([customerId, count]) => {
                const customer = appState.zakaznici.find(c => c.id === customerId);
                return `${customer?.name || '?'}: ${count} beden`;
            }).join('<br>');
        
        detailsHtml += `
            <tr>
                <td>${surovina?.name || '?'}</td>
                <td>${item.type}</td>
                <td>${customerDetails}</td>
                <td class="actions">
                    <button class="btn-icon danger" data-action="delete-calculator-item" data-id="${item.id}">${ICONS.trash}</button>
                </td>
            </tr>
        `;
    });
    detailsHtml += '</tbody></table></div></div>';

    resultsContainer.innerHTML = summaryHtml + detailsHtml;
    feather.replace();
}

export function openAddItemModal() {
    const modal = DOMElements.calculatorAddItemModal;
    const surovinaSelect = modal.querySelector('#calculator-item-surovina');
    
    surovinaSelect.innerHTML = '<option value="">-- Vyberte --</option>' + 
        appState.suroviny
            .filter(s => s.isActive)
            .map(s => `<option value="${s.id}">${s.name}</option>`)
            .join('');

    modal.querySelector('#calculator-item-type').value = '';
    renderCustomerInputs();
    modal.classList.add('active');
}

export function renderCustomerInputs() {
    const modal = DOMElements.calculatorAddItemModal;
    const surovinaId = modal.querySelector('#calculator-item-surovina').value;
    const type = modal.querySelector('#calculator-item-type').value;
    const container = modal.querySelector('#calculator-customer-inputs');

    if (!surovinaId || !type) {
        container.innerHTML = '<p>Nejprve vyberte surovinu a typ balení.</p>';
        return;
    }

    let html = '<table class="data-table"><tbody>';
    appState.zakaznici.forEach(customer => {
        html += `
            <tr>
                <td>${customer.name}</td>
                <td><input type="number" class="calculator-box-count" data-customer-id="${customer.id}" min="0" placeholder="Počet beden" style="width: 150px; text-align: right;"></td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

export function saveItem() {
    const modal = DOMElements.calculatorAddItemModal;
    const surovinaId = modal.querySelector('#calculator-item-surovina').value;
    const type = modal.querySelector('#calculator-item-type').value;

    if (!surovinaId || !type) {
        showToast('Vyberte surovinu a typ balení.', 'error');
        return;
    }

    const customerBoxes = {};
    let hasValues = false;
    modal.querySelectorAll('.calculator-box-count').forEach(input => {
        const count = parseInt(input.value) || 0;
        if (count > 0) {
            hasValues = true;
            customerBoxes[input.dataset.customerId] = count;
        }
    });

    if (!hasValues) {
        showToast('Zadejte počet beden alespoň pro jednoho zákazníka.', 'error');
        return;
    }

    appState.ui.calculatorItems.push({
        id: generateId(),
        surovinaId,
        type,
        customerBoxes,
    });

    modal.classList.remove('active');
    renderCalculator();
    showToast('Položka přidána do kalkulace.');
}

export function deleteItem(itemId) {
    appState.ui.calculatorItems = appState.ui.calculatorItems.filter(item => item.id !== itemId);
    renderCalculator();
    showToast('Položka z kalkulace odebrána.');
}

export function exportCalculatorToPdf() {
    const { calculatorItems } = appState.ui;
    if (!calculatorItems || calculatorItems.length === 0) {
        showToast('Není co exportovat. Přidejte položky do kalkulace.', 'error');
        return;
    }

    const summary = {};
    calculatorItems.forEach(item => {
        const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
        if (!surovina) return;

        let itemTotalKg = 0;
        for (const customerId in item.customerBoxes) {
            const boxCount = item.customerBoxes[customerId];
            if (boxCount > 0) {
                const weights = appState.boxWeights[customerId]?.[item.surovinaId];
                const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights[item.type] : 10000;
                itemTotalKg += boxCount * (boxWeightInGrams / 1000);
            }
        }
        summary[item.surovinaId] = (summary[item.surovinaId] || 0) + itemTotalKg;
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const date = appState.ui.selectedDate;
    const formattedDate = new Date(date).toLocaleDateString('cs-CZ');

    doc.setFontSize(18);
    doc.text(`Kalkulacka suroviny - ${formattedDate}`, 14, 22);

    const head = [['Surovina', 'Celkem potreba (kg)']];
    const body = Object.entries(summary).map(([surovinaId, totalKg]) => {
        const surovina = appState.suroviny.find(s => s.id === surovinaId);
        return [surovina?.name || 'Neznama', totalKg.toFixed(2)];
    });

    doc.autoTable({
        startY: 30,
        head: head,
        body: body,
        styles: { font: 'Helvetica' }
    });

    doc.save(`Kalkulacka_suroviny_${date}.pdf`);
    showToast('PDF s výsledky kalkulace bylo vygenerováno.');
}