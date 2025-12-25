
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showConfirmation, showToast } from '../ui.ts';
import { generateId, getWeekNumber } from '../utils.ts';
import { renderDailyPlan } from './dailyPlan.ts';
import { renderMainPage } from './mainPage.ts';

let currentPlanMode = 'standard'; // 'standard' or 'lima'

function getActionRawMaterialNeeds(action, dateStr) {
    if (action.isLima) return { text: '', totalKg: 0 };

    const dayCountData = action.dailyCounts?.[dateStr];
    const boxCount = (typeof dayCountData === 'object' ? dayCountData.boxCount : dayCountData) || 0;

    if (boxCount === 0) {
        return { text: '', totalKg: 0 };
    }

    const productSurovina = appState.suroviny.find(s => s.id === action.surovinaId);
    if (!productSurovina) {
        return { text: '', totalKg: 0 };
    }

    const actionType = action.type || 'VL'; // Default to VL for backward compatibility
    
    const weights = appState.boxWeights[action.customerId]?.[action.surovinaId];
    // Use selected type weight, fallback to VL, fallback to standard box weight * 1000, fallback to 10000
    const boxWeightInGrams = (weights && weights[actionType]) ? weights[actionType] : 
                             (weights?.VL || (productSurovina.boxWeight * 1000) || 10000);
                             
    const totalWeightKg = boxCount * (boxWeightInGrams / 1000);

    const needs = [];

    if (productSurovina.isProduct) {
        const productDef = appState.products.find(p => p.id === productSurovina.id);
        if (productDef && productDef.surovinaId) {
            const baseSurovina = appState.suroviny.find(s => s.id === productDef.surovinaId);
            if (baseSurovina) {
                let usableMeatWeight = totalWeightKg;
                
                // Logic Change: Marinade calculation matching global settings
                // Marinade is a percentage OF the final weight, so we subtract it.
                if (productDef.marinadePercent > 0) {
                    usableMeatWeight = totalWeightKg * (1 - (productDef.marinadePercent || 0) / 100);
                }
                
                let rawMaterialWeight = usableMeatWeight;
                if (productDef.lossPercent > 0) {
                    rawMaterialWeight /= (1 - (productDef.lossPercent || 0) / 100);
                }
                needs.push({ name: baseSurovina.name, kg: rawMaterialWeight });
            }
        }
    } else if (productSurovina.isMix) {
        const mixDef = appState.mixDefinitions[productSurovina.id];
        if (mixDef && mixDef.components) {
            mixDef.components.forEach(comp => {
                const componentSurovina = appState.suroviny.find(s => s.id === comp.surovinaId);
                if (componentSurovina) {
                    const componentWeight = totalWeightKg * (comp.percentage / 100);
                    needs.push({ name: componentSurovina.name, kg: componentWeight });
                }
            });
        }
    } else { // It's a base surovina
        needs.push({ name: productSurovina.name, kg: totalWeightKg });
    }

    if (needs.length === 0) {
        return { text: '', totalKg: 0 };
    }

    const totalKg = needs.reduce((sum, item) => sum + item.kg, 0);

    if (needs.length === 1) {
        return { text: `${needs[0].kg.toFixed(2)} kg ${needs[0].name}`, totalKg: needs[0].kg };
    } else {
        const text = needs.map(n => `${n.name}: ${n.kg.toFixed(1)}kg`).join(', ');
        return { text, totalKg };
    }
}


function renderActionsList() {
    const { year, month } = appState.ui.calendar;
    const container = document.getElementById('actions-list-container');
    if (!container) return;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const actionsForMonth = [];

    appState.plannedActions.forEach(action => {
        // Iterate through each day of the month to see if the action applies
        for (let d = new Date(firstDayOfMonth); d <= lastDayOfMonth; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dateIsInRange = dateStr >= action.startDate && (!action.endDate || dateStr <= action.endDate);
            
            if (dateIsInRange) {
                const dayCountData = action.dailyCounts?.[dateStr];
                const boxCount = (typeof dayCountData === 'object' ? dayCountData.boxCount : dayCountData) || 0;
                
                if (boxCount > 0) {
                    let title, subtitle, needsText;
                    
                    if (action.isLima) {
                        title = `LIMA: ${action.customName}`;
                        subtitle = `${boxCount} (počet)`;
                        needsText = '';
                    } else {
                        const customer = appState.zakaznici.find(c => c.id === action.customerId);
                        const surovina = appState.suroviny.find(s => s.id === action.surovinaId);
                        title = `${customer?.name || '?'} - ${surovina?.name || '?'}`;
                        subtitle = `${boxCount} beden (${action.type || 'VL'})`;
                        needsText = getActionRawMaterialNeeds(action, dateStr).text;
                    }

                    actionsForMonth.push({
                        date: dateStr,
                        title: title,
                        subtitle: subtitle,
                        needsText: needsText
                    });
                }
            }
        }
    });

    // Sort by date
    actionsForMonth.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (actionsForMonth.length === 0) {
        container.innerHTML = '<p style="font-size: 0.9rem; color: var(--text-secondary); text-align: center; padding: 20px 0;">Tento měsíc nejsou žádné akce.</p>';
        return;
    }

    container.innerHTML = actionsForMonth.map(action => {
        const dateFormatted = new Date(action.date + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
        return `
            <div class="action-list-item">
                <div class="action-list-item-header">
                    ${action.title}
                </div>
                <div class="action-list-item-details">
                    <span>${dateFormatted}</span>
                    <span style="font-weight: 500;">${action.subtitle}</span>
                </div>
                ${action.needsText ? `<div class="action-list-item-needs">${action.needsText}</div>` : ''}
            </div>
        `;
    }).join('');
}


export function changeMonth(delta) {
    appState.ui.calendar.month += delta;
    if (appState.ui.calendar.month > 11) {
        appState.ui.calendar.month = 0;
        appState.ui.calendar.year++;
    } else if (appState.ui.calendar.month < 0) {
        appState.ui.calendar.month = 11;
        appState.ui.calendar.year--;
    }
    renderCalendar();
}

export function renderCalendar() {
    const { year, month } = appState.ui.calendar;
    document.getElementById('current-month-display').textContent = new Date(year, month).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    grid.innerHTML += `<div class="calendar-header"></div>`;
    ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].forEach(day => {
        grid.innerHTML += `<div class="calendar-header">${day}</div>`;
    });

    const firstDayOfMonth = new Date(year, month, 1);
    let dayOfWeek = firstDayOfMonth.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;
    const offset = dayOfWeek - 1;

    let currentDate = new Date(firstDayOfMonth);
    currentDate.setDate(currentDate.getDate() - offset);

    for (let i = 0; i < 6; i++) {
        const weekNum = getWeekNumber(currentDate);
        grid.innerHTML += `<div class="week-number">${weekNum}</div>`;
        for (let j = 0; j < 7; j++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            if (currentDate.getMonth() !== month) {
                dayCell.style.opacity = '0.5';
            }
            const dateStr = currentDate.toISOString().split('T')[0];
            dayCell.dataset.action = 'open-day-details';
            dayCell.dataset.date = dateStr;

            dayCell.innerHTML = `<div class="day-number">${currentDate.getDate()}</div><div class="day-items"></div>`;
            
            const itemsDiv = dayCell.querySelector('.day-items');
            const dayActions = appState.plannedActions.filter(a => dateStr >= a.startDate && (!a.endDate || dateStr <= a.endDate));
            
            dayActions.forEach(action => {
                const dayCountData = action.dailyCounts?.[dateStr];
                const boxCount = (typeof dayCountData === 'object' ? dayCountData.boxCount : dayCountData) || 0;

                if (boxCount > 0) {
                    if (action.isLima) {
                        itemsDiv.innerHTML += `
                            <div class="day-pill lima-pill">
                                <span>${action.customName} (${boxCount})</span>
                            </div>`;
                    } else {
                        const customer = appState.zakaznici.find(c => c.id === action.customerId);
                        const { totalKg } = getActionRawMaterialNeeds(action, dateStr);
                        const typeLabel = action.type || 'VL';
                        itemsDiv.innerHTML += `
                            <div class="day-pill">
                                <span>${customer?.name || '?'} (${boxCount}b ${typeLabel})</span>
                                ${totalKg > 0 ? `<span class="day-pill-kg">${totalKg.toFixed(0)} kg</span>` : ''}
                            </div>`;
                    }
                }
            });

            grid.appendChild(dayCell);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
    renderActionsList();
}

function switchPlanMode(mode) {
    currentPlanMode = mode;
    const stdBtn = document.getElementById('plan-mode-standard');
    const limaBtn = document.getElementById('plan-mode-lima');
    const stdContainer = document.getElementById('plan-action-standard-container');
    const limaContainer = document.getElementById('plan-action-lima-container');
    const dateToContainer = document.getElementById('container-date-to');
    const labelDateFrom = document.getElementById('label-date-from');

    if (mode === 'standard') {
        stdBtn.classList.add('active');
        limaBtn.classList.remove('active');
        stdContainer.style.display = 'block';
        limaContainer.style.display = 'none';
        dateToContainer.style.visibility = 'visible'; // Show 'To' date
        labelDateFrom.textContent = 'Od';
    } else {
        limaBtn.classList.add('active');
        stdBtn.classList.remove('active');
        stdContainer.style.display = 'none';
        limaContainer.style.display = 'block';
        dateToContainer.style.visibility = 'hidden'; // Hide 'To' date for Lima (single day)
        labelDateFrom.textContent = 'Datum';
    }
}

export function openPlanActionModal(actionId = null) {
    appState.ui.editingActionId = actionId;
    const planActionModal = DOMElements.planActionModal;
    const planActionCustomer = planActionModal.querySelector('#plan-action-customer');
    const planActionProduct = planActionModal.querySelector('#plan-action-product');
    const planActionType = planActionModal.querySelector('#plan-action-type');
    const planActionFrom = planActionModal.querySelector('#plan-action-from');
    const planActionTo = planActionModal.querySelector('#plan-action-to');
    const planActionModalTitle = planActionModal.querySelector('.modal-title');
    
    // Lima Inputs
    const planActionLimaName = planActionModal.querySelector('#plan-action-lima-name');
    const planActionLimaCount = planActionModal.querySelector('#plan-action-lima-count');

    // Bind Toggles if not already bound (checking if element exists prevents errors, simple check for first run or rebinding is ok)
    document.getElementById('plan-mode-standard').onclick = () => switchPlanMode('standard');
    document.getElementById('plan-mode-lima').onclick = () => switchPlanMode('lima');

    planActionCustomer.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    planActionProduct.innerHTML = appState.suroviny.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    if (actionId) {
        const action = appState.plannedActions.find(a => a.id === actionId);
        if (action) {
            planActionModalTitle.textContent = 'Upravit akci';
            planActionFrom.value = action.startDate;
            
            if (action.isLima) {
                switchPlanMode('lima');
                planActionLimaName.value = action.customName || '';
                // For Lima, we assume single day logic in the modal inputs, though storage is generic. 
                // We grab the count from the start date.
                const dayCount = action.dailyCounts?.[action.startDate]?.boxCount || 0;
                planActionLimaCount.value = dayCount;
                planActionTo.value = action.startDate; // Should match
            } else {
                switchPlanMode('standard');
                planActionCustomer.value = action.customerId;
                planActionProduct.value = action.surovinaId;
                planActionType.value = action.type || 'VL';
                planActionTo.value = action.endDate;
                renderDailyCountsForPlanning();
            }
        } else {
            appState.ui.editingActionId = null;
            actionId = null;
        }
    } 
    
    if (!actionId) {
        planActionModalTitle.textContent = 'Naplánovat akci';
        planActionFrom.value = '';
        planActionTo.value = '';
        planActionType.value = 'VL';
        planActionLimaName.value = '';
        planActionLimaCount.value = '';
        switchPlanMode('standard'); // Default to standard
        renderDailyCountsForPlanning();
    }

    planActionFrom.onchange = () => {
        if(currentPlanMode === 'standard') renderDailyCountsForPlanning();
    };
    planActionTo.onchange = () => {
        if(currentPlanMode === 'standard') renderDailyCountsForPlanning();
    };
    
    planActionModal.classList.add('active');
}

function renderDailyCountsForPlanning() {
    // Only run this logic if in standard mode
    if (currentPlanMode !== 'standard') return;

    const planActionModal = DOMElements.planActionModal;
    const planActionFrom = planActionModal.querySelector('#plan-action-from');
    const planActionTo = planActionModal.querySelector('#plan-action-to');
    const planActionDailyCounts = planActionModal.querySelector('#plan-action-daily-counts');
    const from = planActionFrom.value;
    const to = planActionTo.value;
    planActionDailyCounts.innerHTML = '';
    
    const action = appState.ui.editingActionId ? appState.plannedActions.find(a => a.id === appState.ui.editingActionId) : null;
    const dailyCounts = action?.dailyCounts || {};

    if (!from || !to) {
        if(Object.keys(dailyCounts).length > 0 && action && !action.isLima) {
             // render existing saved counts fallback if dates missing but edit mode
        } else {
            return;
        }
    };

    let currentDate = new Date(from);
    const endDate = new Date(to);

    while(currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const countData = dailyCounts[dateStr];
        const count = (typeof countData === 'object' ? countData.boxCount : countData) || 0;
        const dayLabel = currentDate.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
        planActionDailyCounts.innerHTML += `
            <div class="form-row">
                <label style="flex-basis: 150px;">${dayLabel}</label>
                <div class="form-field"><input type="number" class="plan-day-count" data-date="${dateStr}" value="${count}" min="0"></div>
            </div>
        `;
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

export function openDayDetailsModal(date) {
    // Filter for actions that are active on this day AND have boxes planned for this day.
    const relevantActions = appState.plannedActions.filter(a => {
        const dateIsInRange = date >= a.startDate && (!a.endDate || date <= a.endDate);
        if (!dateIsInRange) return false;

        const dayCountData = a.dailyCounts?.[date];
        const boxCount = (typeof dayCountData === 'object' ? dayCountData.boxCount : dayCountData) || 0;
        return boxCount > 0;
    });

    // If there is exactly one relevant action, open the edit modal directly.
    if (relevantActions.length === 1) {
        openPlanActionModal(relevantActions[0].id);
        return;
    }

    // --- Original Logic for 0 or 2+ actions ---
    const modal = DOMElements.dayDetailsModal;
    modal.querySelector('.modal-title').textContent = new Date(date + 'T00:00:00').toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
    const body = modal.querySelector('.modal-body');
    body.innerHTML = '';
    
    const dayOrders = appState.orders.filter(o => o.date === date);

    if (relevantActions.length === 0 && dayOrders.length === 0) {
        body.innerHTML = '<p>Žádné události pro tento den.</p>';
    } else {
        if (relevantActions.length > 0) { // Will be > 1 here
            body.innerHTML += '<h3>Naplánované akce</h3>';
            relevantActions.forEach(action => {
                const dayCountData = action.dailyCounts?.[date];
                const boxCount = (typeof dayCountData === 'object' ? dayCountData.boxCount : dayCountData) || 0;
                
                let displayText = '';
                if (action.isLima) {
                    displayText = `<strong>LIMA: ${action.customName}</strong> (${boxCount})`;
                } else {
                    const customer = appState.zakaznici.find(c => c.id === action.customerId);
                    const product = appState.suroviny.find(s => s.id === action.surovinaId);
                    displayText = `<strong>${product?.name || '?'}</strong> pro ${customer?.name || '?'} (${boxCount} beden ${action.type || 'VL'})`;
                }

                body.innerHTML += `
                    <div class="card" style="padding: 10px; margin-bottom: 10px;">
                        ${displayText}
                        <div class="actions" style="float: right;">
                            <button class="btn-icon" data-action="edit-action" data-id="${action.id}">${ICONS.edit}</button>
                            <button class="btn-icon danger" data-action="delete-action" data-id="${action.id}">${ICONS.trash}</button>
                        </div>
                    </div>
                `;
            });
        }
         if (dayOrders.length > 0) {
             body.innerHTML += '<h3>Standardní objednávky</h3><p>Upravujte v záložce Objednávky.</p>';
         }
    }
    modal.classList.add('active');
    feather.replace();
}

export function savePlannedAction() {
    const modal = DOMElements.planActionModal;
    const planActionFrom = modal.querySelector('#plan-action-from');
    const action = appState.ui.editingActionId ? appState.plannedActions.find(a => a.id === appState.ui.editingActionId) : null;
    
    const dateFrom = planActionFrom.value;
    if (!dateFrom) {
        showToast('Zadejte datum.', 'error');
        return;
    }

    let newData = {};

    if (currentPlanMode === 'lima') {
        const name = modal.querySelector('#plan-action-lima-name').value.trim();
        const count = parseInt(modal.querySelector('#plan-action-lima-count').value);

        if (!name || isNaN(count) || count <= 0) {
            showToast('Zadejte název a počet.', 'error');
            return;
        }

        const dailyCounts = {};
        const existingProduced = action?.dailyCounts?.[dateFrom]?.producedCount || 0;
        dailyCounts[dateFrom] = { boxCount: count, producedCount: existingProduced };

        newData = {
            isLima: true,
            customName: name,
            startDate: dateFrom,
            endDate: dateFrom, // Single day for Lima
            dailyCounts: dailyCounts,
            // Nullify standard props to avoid confusion
            customerId: null,
            surovinaId: null,
            type: null
        };

    } else {
        // Standard Mode
        const planActionCustomer = modal.querySelector('#plan-action-customer');
        const planActionProduct = modal.querySelector('#plan-action-product');
        const planActionType = modal.querySelector('#plan-action-type');
        const planActionTo = modal.querySelector('#plan-action-to');

        const dailyCounts = {};
        modal.querySelectorAll('.plan-day-count').forEach(input => {
            const count = parseInt(input.value);
            if (count > 0) {
                const date = input.dataset.date;
                const existingProduced = action?.dailyCounts?.[date]?.producedCount || 0;
                dailyCounts[date] = {
                    boxCount: count,
                    producedCount: existingProduced
                };
            }
        });

        if (Object.keys(dailyCounts).length === 0) {
            showToast('Zadejte počet beden alespoň pro jeden den.', 'error');
            return;
        }

        newData = {
            isLima: false,
            customerId: planActionCustomer.value,
            surovinaId: planActionProduct.value,
            type: planActionType.value,
            startDate: dateFrom,
            endDate: planActionTo.value || dateFrom,
            dailyCounts: dailyCounts,
            customName: null
        };
    }

    if (appState.ui.editingActionId) {
        // Update existing
        Object.assign(action, newData);
        showToast('Akce upravena');
    } else {
        // Create new
        appState.plannedActions.push({
            id: generateId(),
            ...newData
        });
        showToast('Akce naplánována');
    }

    saveState();
    modal.classList.remove('active');
    
    // Refresh views
    if(appState.ui.activeView === 'calendar') renderCalendar();
    if(appState.ui.activeView === 'daily-plan') renderDailyPlan();
    if(appState.ui.activeView === 'main-page') renderMainPage();
}

export function deletePlannedAction(actionId) {
    showConfirmation('Opravdu chcete smazat tuto naplánovanou akci?', () => {
        appState.plannedActions = appState.plannedActions.filter(a => a.id !== actionId);
        saveState();
        DOMElements.dayDetailsModal.classList.remove('active');
        
        if(appState.ui.activeView === 'calendar') renderCalendar();
        if(appState.ui.activeView === 'main-page') renderMainPage();
        
        showToast('Akce smazána', 'success');
    });
}

const monthNames = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];

function renderExportMonths() {
    const listEl = DOMElements.exportActionsModal.querySelector('#export-months-list');
    listEl.innerHTML = '';
    appState.ui.exportMonths.forEach(({ year, month }) => {
        const monthName = monthNames[month];
        const item = document.createElement('div');
        item.className = 'card';
        item.style.padding = '10px';
        item.style.marginBottom = '0';
        item.textContent = `${monthName} ${year}`;
        listEl.appendChild(item);
    });
}

export function openExportActionsModal() {
    const { year, month } = appState.ui.calendar;
    appState.ui.exportMonths = [{ year, month }];
    renderExportMonths();
    DOMElements.exportActionsModal.classList.add('active');
    feather.replace();
}

export function addMonthToExport() {
    const lastMonth = appState.ui.exportMonths[appState.ui.exportMonths.length - 1];
    let { year, month } = lastMonth;

    month += 1;
    if (month > 11) {
        month = 0;
        year += 1;
    }
    appState.ui.exportMonths.push({ year, month });
    renderExportMonths();
}

export function exportActionsToPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const allActionsToExport = [];

    appState.ui.exportMonths.forEach(({ year, month }) => {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const actionsForDay = appState.plannedActions.filter(a => {
                const dayCountData = a.dailyCounts?.[dateStr];
                const boxCount = (typeof dayCountData === 'object' ? dayCountData.boxCount : dayCountData) || 0;
                return boxCount > 0 && dateStr >= a.startDate && (!a.endDate || dateStr <= a.endDate);
            });

            actionsForDay.forEach(action => {
                // Export logic for standard actions only, Lima actions might skip this or need different handling
                // For now, ignoring Lima in PDF export as it has no kg/pallets data
                if (action.isLima) return;

                const customer = appState.zakaznici.find(c => c.id === action.customerId);
                const surovina = appState.suroviny.find(s => s.id === action.surovinaId);
                if (!customer || !surovina) return;
                
                const dayCountData = action.dailyCounts[dateStr];
                const boxCount = (typeof dayCountData === 'object' ? dayCountData.boxCount : dayCountData) || 0;
                
                const actionType = action.type || 'VL';
                const weights = appState.boxWeights[customer.id]?.[surovina.id];
                const boxWeightInGrams = (weights && weights[actionType]) ? weights[actionType] : 
                                         (weights?.VL || surovina.boxWeight * 1000 || 10000);
                                         
                const neededKg = boxCount * (boxWeightInGrams / 1000);
                
                const paletteWeight = surovina.paletteWeight;
                const neededPallets = paletteWeight > 0 ? (neededKg / paletteWeight) : 0;

                allActionsToExport.push({
                    date: dateStr,
                    customerName: customer.name,
                    surovinaName: surovina.name,
                    boxCount: boxCount,
                    type: actionType,
                    neededKg: neededKg,
                    neededPallets: neededPallets
                });
            });
        }
    });

    if (allActionsToExport.length === 0) {
        showToast('Nebyly nalezeny žádné standardní akce pro export.', 'error');
        return;
    }

    // Sort by date
    allActionsToExport.sort((a, b) => new Date(a.date) - new Date(b.date));

    doc.setFontSize(18);
    doc.text(`Export Naplánovaných Akcí`, 14, 22);

    const head = [['Datum', 'Zákazník', 'Surovina', 'Typ balení', 'Počet beden', 'Potřeba (kg)', 'Potřeba (palet)']];
    const body = allActionsToExport.map(action => [
        new Date(action.date).toLocaleDateString('cs-CZ'),
        action.customerName,
        action.surovinaName,
        action.type,
        action.boxCount,
        action.neededKg.toFixed(2),
        action.neededPallets.toFixed(2)
    ]);

    doc.autoTable({
        startY: 30,
        head: head,
        body: body,
        styles: { font: 'Helvetica' },
        columnStyles: {
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
        }
    });
    
    const monthNamesString = appState.ui.exportMonths.map(({year, month}) => `${monthNames[month]}_${year}`).join('-');
    doc.save(`Export_akci_${monthNamesString}.pdf`);
    showToast('PDF s exportem akcí bylo vygenerováno.');
    DOMElements.exportActionsModal.classList.remove('active');
}
