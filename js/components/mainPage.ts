
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showToast, showConfirmation } from '../ui.ts';
import { generateId } from '../utils.ts';
import { getDailyNeeds, calculateTimeline, calculateYieldData, getMaykawaThighsNeeded } from '../services/calculations.ts';
import { render } from '../main.ts';

// Helper function to update stock when an order is produced/completed
function updateStockForOrderItem(item, customerId, multiplier) {
    const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
    if (!surovina) return;

    const weights = appState.boxWeights[customerId]?.[surovina.id];
    const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights[item.type] : (weights?.VL || 10000);
    const totalWeightKg = (item.boxCount * boxWeightInGrams / 1000) * multiplier;

    const adjustSurovinaStock = (surovinaToAdjust, weightKg) => {
        if (surovinaToAdjust.paletteWeight && surovinaToAdjust.paletteWeight > 0) {
            surovinaToAdjust.stock = (surovinaToAdjust.stock || 0) + (weightKg / surovinaToAdjust.paletteWeight);
        }
    };

    if (surovina.isMix) {
        const components = item.ratioOverride || appState.mixDefinitions[surovina.id]?.components || [];
        components.forEach(comp => {
            const compSurovina = appState.suroviny.find(s => s.id === comp.surovinaId);
            if (compSurovina) {
                const compWeight = totalWeightKg * (comp.percentage / 100);
                adjustSurovinaStock(compSurovina, compWeight);
            }
        });
    } else if (surovina.isProduct) {
        const product = appState.products.find(p => p.id === surovina.id);
        if (product && product.surovinaId) {
            const baseSurovina = appState.suroviny.find(s => s.id === product.surovinaId);
            if (baseSurovina) {
                let weightToAdjust = totalWeightKg;
                if (product.marinadePercent) weightToAdjust /= (1 + product.marinadePercent / 100);
                if (product.lossPercent) weightToAdjust /= (1 - product.lossPercent / 100);
                adjustSurovinaStock(baseSurovina, weightToAdjust);
            }
        }
    } else {
        adjustSurovinaStock(surovina, totalWeightKg);
    }
}

export function renderMainPage() {
    const date = appState.ui.selectedDate;

    // 1. Alerts
    renderAlerts();

    // 2. Pre-production status (Optional/Hidden for now but keeping placeholder logic)
    const preProdStatus = document.getElementById('main-page-pre-production-status');
    if (preProdStatus) {
        preProdStatus.innerHTML = '';
        preProdStatus.style.display = 'none';
    }

    // 3. Meat Needs (Green/Red Cards)
    renderMeatNeeds(date);

    // 4. Marinade Needs (Orange Cards)
    renderMarinadeNeeds(date);

    // 5. Quick Entry Cards
    renderQuickEntryCards(date);

    // 6. Order Overviews
    renderOrderOverviews(date);

    // 7. Shortages (Original shortage logic - kept for compatibility)
    renderShortages(date);

    if (typeof feather !== 'undefined') feather.replace();
}

function renderMeatNeeds(date) {
    const container = document.getElementById('main-page-yield-surplus');
    if (!container) return;

    // Calculate needs (remaining)
    const needs = getDailyNeeds(date, null, false);
    
    // Add implied thigh needs for Maykawa Steak
    const maykawaThighsKg = getMaykawaThighsNeeded(date);
    if (maykawaThighsKg > 0) {
        const stehnaSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
        if (stehnaSurovina) {
            needs[stehnaSurovina.id] = (needs[stehnaSurovina.id] || 0) + maykawaThighsKg;
        }
    }
    
    // Calculate production yield for comparison
    const { totals } = calculateTimeline(date);
    const dailyData = appState.chickenCounts[date];
    const { yieldData } = calculateYieldData(date, dailyData?.flocks, totals.totalWeight);

    let needsHtml = '<h3 class="subsection-title" style="margin-top: 20px;">Dnešní potřeba masa (k výrobě)</h3><div class="grid grid-cols-2 md:grid-cols-4 gap-2">';
    let hasAnyNeeds = false;
    
    Object.entries(needs).forEach(([surovinaId, kg]) => {
        if (kg > 0.1) {
            hasAnyNeeds = true;
            const surovina = appState.suroviny.find(s => s.id === surovinaId);
            const surovinaName = surovina?.name || 'Neznámá';
            const nameUpper = surovinaName.toUpperCase();
            
            // Calculate stock
            const stockPallets = surovina.stock || 0;
            const stockBoxes = appState.dailyStockAdjustments[date]?.[surovina.id] || 0;
            const stockKg = (stockPallets * (surovina.paletteWeight || 0)) + (stockBoxes * (surovina.boxWeight || 25));

            // Determine Yield Data Match
            let yieldItem = null;
            if (nameUpper === 'ŘÍZKY') {
                yieldItem = yieldData.find(y => y.name === 'Prsa');
            } else if (['STEHNA', 'HORNÍ STEHNA', 'SPODNÍ STEHNA', 'ČTVRTKY'].includes(nameUpper)) {
                yieldItem = yieldData.find(y => y.name.toUpperCase() === nameUpper) || yieldData.find(y => y.name === 'Stehna celkem');
            } else {
                yieldItem = yieldData.find(y => y.name.toUpperCase() === nameUpper || y.name.toUpperCase().startsWith(nameUpper + ' '));
            }
            
            const producedKg = yieldItem ? yieldItem.produced : 0;
            
            const totalAvailableKg = producedKg + stockKg;
            const isCoveredByTotal = totalAvailableKg >= kg - 0.1;
            const missingFromStockKg = kg - stockKg;

            // Styles
            const borderColor = isCoveredByTotal ? "var(--accent-success)" : "var(--accent-danger)";
            const textColor = isCoveredByTotal ? "text-green-800" : "text-red-800";
            const bgColor = isCoveredByTotal ? "#f0fdf4" : "#fef2f2";

            let mainText = "";
            let subText = "";
            let extraInfoHtml = "";

            // Calculate pallets text
            let palletText = "";
            if (surovina.paletteWeight && surovina.paletteWeight > 0) {
                const pallets = kg / surovina.paletteWeight;
                if (pallets > 0.01) {
                    palletText = ` <span style="opacity: 0.75; font-size: 0.9em;">(${pallets.toFixed(1)} pal)</span>`;
                }
            }

            if (missingFromStockKg > 0.1) {
                mainText = `Chybí: ${missingFromStockKg.toFixed(0)} kg`;
                subText = isCoveredByTotal 
                    ? `<span class="text-green-600 font-semibold">(Pokryje výroba)</span>` 
                    : `z celkových ${kg.toFixed(0)} kg${palletText}`;
                
                // --- STEAK DEBONING TIME CALCULATION ---
                if (nameUpper === 'STEAK') {
                    const speed = appState.maykawaConfig?.deboningSpeed || 0;
                    if (speed > 0) {
                        const timeHours = missingFromStockKg / speed;
                        const h = Math.floor(timeHours);
                        const m = Math.round((timeHours - h) * 60);
                        extraInfoHtml = `<div class="text-xs text-indigo-600 font-bold mt-1" title="Při rychlosti ${speed} kg/hod">Koštění: ${h} hod ${m} min</div>`;
                    }
                }

            } else {
                const surplus = Math.abs(missingFromStockKg);
                mainText = surplus > 1 ? `+ ${surplus.toFixed(0)} kg navíc` : `OK (Skladem)`;
                subText = `Potřeba: ${kg.toFixed(0)} kg${palletText}`;
            }

            const cardStyle = `
                border: 1px solid ${borderColor}; 
                background-color: ${bgColor}; 
                padding: 8px; 
                border-radius: 6px; 
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                cursor: pointer;
                transition: transform 0.1s, box-shadow 0.1s;
            `;

            // REMOVED 'onclick="event.stopPropagation()"' so the event handler can catch the bubbled event
            let stockButton = `<button class="btn btn-secondary btn-sm" style="margin-top: 5px; font-size: 0.75rem; padding: 4px 6px; width: 100%; border-color: ${borderColor}; background-color: rgba(255,255,255,0.7);" data-action="open-single-stock-adjustment" data-surovina-id="${surovina.id}"><i data-feather="package" style="width: 14px; height: 14px;"></i> Sklad</button>`;
            
            if (nameUpper === 'ŘÍZKY') {
                stockButton += `<button class="btn btn-secondary btn-sm" style="margin-top: 5px; font-size: 0.75rem; padding: 4px 6px; width: 100%; border-color: ${borderColor}; background-color: rgba(255,255,255,0.7);" data-action="open-rizky-quick-calc"><i data-feather="activity" style="width: 14px; height: 14px;"></i> Výtěžnost</button>`;
            }

            needsHtml += `
                <div style="${cardStyle}" title="Očekávaná výroba: ${producedKg.toFixed(0)} kg" 
                     data-action="open-needs-breakdown" data-surovina-id="${surovina.id}"
                     onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'"
                     onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    <div>
                        <span class="block text-xs font-bold uppercase ${textColor}" style="color: inherit;">${surovinaName}</span>
                        <strong class="text-lg ${textColor}" style="color: inherit; display: block; margin-top: 2px;">${mainText}</strong>
                        <div class="text-xs text-gray-500">${subText}</div>
                        ${extraInfoHtml}
                        <div class="text-xs text-blue-700 font-semibold mt-1">Skladem: ${stockKg.toFixed(0)} kg</div>
                    </div>
                    ${stockButton}
                </div>
            `;
        }
    });
    
    if (!hasAnyNeeds) {
        needsHtml += '<p class="text-sm text-gray-400 italic">Žádné aktivní nevyřízené položky.</p>';
    }
    needsHtml += '</div>';
    container.innerHTML = needsHtml;
}

export function openNeedsBreakdownModal(targetSurovinaId) {
    const targetSurovina = appState.suroviny.find(s => s.id === targetSurovinaId);
    if (!targetSurovina) return;

    const modal = document.getElementById('needs-breakdown-modal');
    modal.querySelector('#needs-breakdown-title').textContent = `Detail potřeby: ${targetSurovina.name}`;
    const listContainer = document.getElementById('needs-breakdown-list');
    listContainer.innerHTML = '';

    const date = appState.ui.selectedDate;
    const itemsToShow = [];

    // 1. Scan Standard Orders
    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.forEach(item => {
            if (!item.isActive) return;
            
            const remainingBoxes = Math.max(0, item.boxCount - (item.doneCount || 0));
            if (remainingBoxes <= 0) return;

            const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
            if (!surovina) return;

            const customer = appState.zakaznici.find(c => c.id === order.customerId);
            
            // Calc KG logic copied/adapted from getDailyNeeds
            let totalWeightInKg = 0;
            let isTrayOrder = false;
            
            if (surovina.isProduct) {
                const product = appState.products.find(p => p.id === surovina.id);
                if (product && product.orderInTrays) {
                    isTrayOrder = true;
                    totalWeightInKg = remainingBoxes * ((product.boxWeight || 0) / 1000);
                }
            }

            if (!isTrayOrder) {
                const weights = appState.boxWeights[order.customerId]?.[surovina.id];
                const defaultWeight = (weights && item.type && weights[item.type]) ? weights[item.type] : (weights?.VL || 10000);
                totalWeightInKg = remainingBoxes * (defaultWeight / 1000);
            }

            // Check if this item contributes to targetSurovinaId
            let contributionKg = 0;

            if (surovina.id === targetSurovinaId) {
                contributionKg = totalWeightInKg;
            } else if (surovina.isMix) {
                const components = item.ratioOverride || appState.mixDefinitions[surovina.id]?.components;
                const comp = components?.find(c => c.surovinaId === targetSurovinaId);
                if (comp) {
                    contributionKg = totalWeightInKg * (comp.percentage / 100);
                }
            } else if (surovina.isProduct) {
                const product = appState.products.find(p => p.id === surovina.id);
                if (product && product.surovinaId === targetSurovinaId) {
                    let usableMeatWeight = totalWeightInKg;
                    if (product.marinadePercent > 0) {
                        usableMeatWeight = totalWeightInKg * (1 - (product.marinadePercent / 100));
                    }
                    if (product.lossPercent > 0) {
                        contributionKg = usableMeatWeight / (1 - product.lossPercent / 100);
                    } else {
                        contributionKg = usableMeatWeight;
                    }
                }
            }

            if (contributionKg > 0.01) {
                // Calculate Pallets
                const paletteWeight = targetSurovina.paletteWeight || 0;
                const pallets = paletteWeight > 0 ? contributionKg / paletteWeight : 0;

                itemsToShow.push({
                    customerName: customer?.name || 'Neznámý',
                    productName: surovina.name,
                    variant: item.type,
                    amountBoxes: remainingBoxes,
                    kg: contributionKg,
                    pallets: pallets
                });
            }
        });
    });

    // 2. Maykawa Logic (If viewing Stehna, show Steak needs)
    if (targetSurovina.name.toUpperCase() === 'STEHNA') {
        const maykawaThighsNeeded = getMaykawaThighsNeeded(date);
        if (maykawaThighsNeeded > 0.01) {
             const paletteWeight = targetSurovina.paletteWeight || 0;
             const pallets = paletteWeight > 0 ? maykawaThighsNeeded / paletteWeight : 0;

             itemsToShow.push({
                customerName: 'Výroba',
                productName: 'Maykawa (Steak)',
                variant: 'Interní',
                amountBoxes: '-',
                kg: maykawaThighsNeeded,
                pallets: pallets
            });
        }
    }

    // Render Table
    if (itemsToShow.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-500 py-4">Žádné aktivní objednávky pro tuto surovinu.</p>';
    } else {
        itemsToShow.sort((a, b) => b.kg - a.kg);

        let tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Zákazník</th>
                        <th>Produkt</th>
                        <th>Počet</th>
                        <th style="text-align: right;">Potřeba (kg)</th>
                        <th style="text-align: right;">Palety</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let totalKg = 0;
        let totalPallets = 0;

        itemsToShow.forEach(item => {
            totalKg += item.kg;
            totalPallets += item.pallets;
            tableHtml += `
                <tr>
                    <td>${item.customerName}</td>
                    <td>${item.productName} <span class="text-xs text-gray-500">(${item.variant})</span></td>
                    <td>${item.amountBoxes}</td>
                    <td style="text-align: right; font-weight: bold;">${item.kg.toFixed(2)}</td>
                    <td style="text-align: right; color: var(--text-secondary);">${item.pallets > 0.01 ? item.pallets.toFixed(2) : '-'}</td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
                <tfoot>
                    <tr style="background-color: var(--bg-tertiary);">
                        <td colspan="3" style="font-weight: bold;">Celkem</td>
                        <td style="text-align: right; font-weight: bold;">${totalKg.toFixed(2)} kg</td>
                        <td style="text-align: right; font-weight: bold;">${totalPallets.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
        listContainer.innerHTML = tableHtml;
    }

    modal.classList.add('active');
}

function renderMarinadeNeeds(date) {
    const container = document.getElementById('main-page-marinades');
    if (!container) return;
    container.innerHTML = '';

    const marinadeNeeds = {}; // { marinadeName: { neededMarinadeKg: 0, totalProductKg: 0 } }

    // Use ALL items for the day to calculate TOTAL PLAN (ignore doneCount)
    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.forEach(item => {
            if (item.isActive) {
                const product = appState.products.find(p => p.id === item.surovinaId);
                // Check if product exists and has marinade percent > 0
                if (product && product.marinadePercent > 0) {
                    const weights = appState.boxWeights[order.customerId]?.[item.surovinaId];
                    const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights[item.type] : (weights?.VL || 10000);
                    
                    // Total Gross Weight (Meat + Marinade) of TOTAL planned boxes
                    const totalBoxes = item.boxCount;
                    const grossWeightKg = totalBoxes * (boxWeightInGrams / 1000);
                    
                    // Marinade Part Calculation (Marinade is X% OF the total weight)
                    const marinadeWeightKg = grossWeightKg * (product.marinadePercent / 100);
                    
                    const name = product.marinadeName || 'Marináda (neznámá)';
                    
                    if (!marinadeNeeds[name]) {
                        marinadeNeeds[name] = { neededMarinadeKg: 0, totalProductKg: 0 };
                    }
                    marinadeNeeds[name].neededMarinadeKg += marinadeWeightKg;
                    marinadeNeeds[name].totalProductKg += grossWeightKg;
                }
            }
        });
    });

    if (Object.keys(marinadeNeeds).length === 0) {
        return; // No marinade needed, hide section
    }

    let html = `
        <h3 class="subsection-title" style="margin-top: 20px;">Dnešní potřeba marinád</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
    `;

    // Ensure state tracking object exists
    if (!appState.dailyMarinadeDone) appState.dailyMarinadeDone = {};
    if (!appState.dailyMarinadeDone[date]) appState.dailyMarinadeDone[date] = {};

    Object.entries(marinadeNeeds).forEach(([name, data]) => {
        const doneKg = appState.dailyMarinadeDone[date][name] || 0;
        const meatOnlyKg = data.totalProductKg - data.neededMarinadeKg; // Pure meat calculation
        
        html += `
            <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <div style="font-weight: 700; color: #9a3412; font-size: 0.95rem; border-bottom: 1px solid #ffedd5; padding-bottom: 4px; margin-bottom: 2px;">
                    ${name}
                </div>
                
                <div style="font-size: 0.9rem; color: #c2410c; display: flex; justify-content: space-between; align-items: center;">
                    <span>Potřeba:</span>
                    <strong style="font-size: 1.1rem;">${data.neededMarinadeKg.toFixed(1)} kg</strong>
                </div>
                
                <div style="font-size: 0.75rem; color: #9a3412; opacity: 0.8;">
                    Celkem s masem: ${data.totalProductKg.toFixed(1)} kg
                </div>
                <div style="font-size: 0.7rem; color: #7c2d12; opacity: 0.75; font-weight: 500; margin-top: -2px;">
                    Maso bez marinády: ${meatOnlyKg.toFixed(1)} kg
                </div>

                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #ffedd5; display: flex; align-items: center; justify-content: space-between;">
                    <label style="font-size: 0.8rem; color: #7c2d12; font-weight: 500;">Hotovo:</label>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <input type="number" 
                               class="marinade-done-input form-input" 
                               data-date="${date}" 
                               data-name="${name}" 
                               value="${doneKg > 0 ? doneKg : ''}" 
                               style="width: 55px; padding: 2px 4px; font-size: 0.9rem; text-align: right; border: 1px solid #fdba74; height: 28px;">
                        <span style="font-size: 0.8rem; color: #9a3412;">kg</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

export function handleMarinadeDoneChange(target) {
    const { date, name } = target.dataset;
    const value = parseFloat(target.value) || 0;

    if (!appState.dailyMarinadeDone) appState.dailyMarinadeDone = {};
    if (!appState.dailyMarinadeDone[date]) appState.dailyMarinadeDone[date] = {};

    appState.dailyMarinadeDone[date][name] = value;
    saveState();
}

function renderQuickEntryCards(date) {
    const container = document.getElementById('main-page-quick-entry');
    if (!container) return;
    container.innerHTML = '';

    const quickProducts = appState.products.filter(p => p.showInQuickEntry || p.isOther);
    const quickProductIds = new Set(quickProducts.map(p => p.id));
    const productStats = {}; 

    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.forEach(item => {
            if (item.isActive && quickProductIds.has(item.surovinaId)) {
                const key = `${order.id}_${item.id}`;
                productStats[key] = {
                    ...item,
                    customerId: order.customerId,
                    orderId: order.id,
                    itemId: item.id
                };
            }
        });
    });

    Object.values(productStats).forEach(stat => {
        const remainingBoxes = Math.max(0, stat.boxCount - stat.doneCount);
        if (remainingBoxes > 0) {
            const product = appState.products.find(p => p.id === stat.surovinaId);
            
            // Skip products that have marinade defined
            if (product && (product.marinadePercent > 0 || product.marinadeName)) {
                return;
            }

            const customer = appState.zakaznici.find(c => c.id === stat.customerId);
            
            const card = document.createElement('div');
            card.className = 'quick-entry-card';
            card.innerHTML = `
                <h3>${product.name}</h3>
                <span style="font-size: 0.85rem; color: var(--text-secondary);">${customer.name} (${stat.type})</span>
                
                <div class="needs-display">
                    Chybí:
                    <strong style="color: var(--accent-danger); font-size: 1.8rem;">${remainingBoxes}</strong>
                    <span style="font-size: 0.9rem; color: var(--text-secondary);">beden</span>
                </div>

                <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center; width: 100%;">
                    <label style="font-size: 0.8rem;">Hotovo:</label>
                    <input type="number" 
                           class="main-order-done-input form-input" 
                           style="width: 70px; padding: 5px; text-align: center;" 
                           value="${stat.doneCount}" 
                           data-order-id="${stat.orderId}" 
                           data-item-id="${stat.itemId}">
                    <button class="btn btn-sm btn-primary" 
                            data-action="toggle-main-page-order-item-done" 
                            data-order-id="${stat.orderId}" 
                            data-item-id="${stat.itemId}">
                        <i data-feather="check"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        }
    });
}

function renderOrderOverviews(date) {
    // Marinade Overview (New)
    renderMarinadeOverview(date);

    // Spízy 
    renderSpizyOverview(date);

    // Standard Categories
    renderCategorySection('main-page-rizky', ['ŘÍZKY', 'STRIPS'], date);
    renderCategorySection('main-page-minced-meat', ['MLETÉ MASO'], date);
    renderCategorySection('main-page-prsa', ['PRSA'], date);
    renderCategorySection('main-page-steak', ['STEAK'], date);
    renderCategorySection('main-page-horni-stehna', ['HORNÍ STEHNA'], date);
    renderCategorySection('main-page-spodni-stehna', ['SPODNÍ STEHNA'], date);
    renderCategorySection('main-page-stehna', ['STEHNA'], date);
    renderCategorySection('main-page-ctvrtky', ['ČTVRTKY'], date);
}

function renderMarinadeOverview(date) {
    const container = document.getElementById('main-page-marinade-overview');
    if (!container) return;

    const parentDetails = container.closest('details');
    // Hide parent section by default
    if (parentDetails) parentDetails.style.display = 'none';

    // Group items by customer
    const itemsByCustomer = {};
    let totalItems = 0;

    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.forEach(item => {
            if (item.isActive) {
                const product = appState.products.find(p => p.id === item.surovinaId);
                // Check if it's a marinade product
                if (product && (product.marinadePercent > 0 || product.marinadeName)) {
                    if (!itemsByCustomer[order.customerId]) {
                        itemsByCustomer[order.customerId] = [];
                    }
                    itemsByCustomer[order.customerId].push({ ...item, orderId: order.id });
                    totalItems++;
                }
            }
        });
    });

    if (totalItems === 0) return;

    // Show parent section if we have items
    if (parentDetails) parentDetails.style.display = 'block';
    const badge = parentDetails?.querySelector('summary > .order-badge');
    if (badge) {
        badge.textContent = totalItems;
        badge.style.display = 'inline-block';
    }

    let html = '<div class="accordion nested-accordion">';

    Object.keys(itemsByCustomer).forEach(customerId => {
        const customer = appState.zakaznici.find(c => c.id === customerId);
        const items = itemsByCustomer[customerId];
        const remainingCount = items.reduce((acc, item) => acc + Math.max(0, item.boxCount - (item.doneCount || 0)), 0);
        
        html += `
            <details>
                <summary>
                    ${customer?.name || 'Neznámý'}
                    ${remainingCount > 0 ? `<span class="order-badge" style="background-color: #f97316;">${remainingCount}</span>` : ''}
                    <i data-feather="chevron-right" class="arrow-icon"></i>
                </summary>
                <div class="details-content">
                    <table class="data-table">
                        <thead><tr><th>Produkt</th><th>Objednáno</th><th>Vyrobeno</th><th>Akce</th></tr></thead>
                        <tbody>
        `;

        items.forEach(item => {
            const product = appState.products.find(p => p.id === item.surovinaId);
            const isDone = item.doneCount >= item.boxCount;
            const doneClass = isDone ? 'done' : '';
            const btnStyle = isDone 
                ? 'background-color: var(--accent-success); color: white; border-color: var(--accent-success);' 
                : 'background-color: var(--bg-secondary); color: var(--text-primary); border-color: var(--border-color);';
            const btnIcon = isDone ? 'check-circle' : 'circle';

            const producedInput = `
                <div style="display: flex; align-items: center; gap: 5px;">
                    <input type="number" 
                           class="main-order-done-input form-input" 
                           style="width: 60px; padding: 4px; text-align: center; border: 1px solid var(--border-color); border-radius: 4px;" 
                           value="${item.doneCount || 0}" 
                           data-order-id="${item.orderId}" 
                           data-item-id="${item.id}"
                           min="0">
                    <span style="color: var(--text-secondary); font-size: 0.9em;"> / ${item.boxCount}</span>
                </div>
            `;

            html += `
                <tr class="${doneClass}">
                    <td>${product.name} <span class="text-xs text-gray-500">(${item.type})</span></td>
                    <td><strong>${item.boxCount}</strong></td>
                    <td>${producedInput}</td>
                    <td class="actions">
                        <button class="btn btn-sm" style="padding: 6px 12px; font-size: 0.8rem; ${btnStyle}" 
                                data-action="toggle-main-page-order-item-done" 
                                data-order-id="${item.orderId}" 
                                data-item-id="${item.id}">
                            <i data-feather="${btnIcon}" style="width: 14px; height: 14px;"></i> Hotovo
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </details>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function renderSpizyOverview(date) {
    const container = document.getElementById('main-page-spizy');
    if (!container) return;

    const parentDetails = document.getElementById('main-page-spizy-container');
    
    // Default hidden
    if (parentDetails) parentDetails.style.display = 'none';

    const orders = appState.spizyOrders[date] || [];
    
    if (orders.length === 0) return;

    // Show if items exist
    if (parentDetails) parentDetails.style.display = 'block';

    const badge = parentDetails?.querySelector('.order-badge');
    if (badge) {
        badge.textContent = orders.length;
        badge.style.display = 'inline-block';
    }

    let html = `
        <table class="data-table">
            <thead><tr><th>Zákazník</th><th>Druh</th><th>Objednáno</th><th>Vyrobeno</th><th>Akce</th></tr></thead>
            <tbody>
    `;

    orders.forEach(order => {
        const customer = appState.zakaznici.find(c => c.id === order.customerId);
        const types = [
            { key: 'klobasa', label: 'Klobása', count: order.klobasa, done: order.klobasaDone, isDone: order.klobasaIsDone },
            { key: 'spek', label: 'Špek', count: order.spek, done: order.spekDone, isDone: order.spekIsDone },
            { key: 'cilli', label: 'Čilli', count: order.cilli, done: order.cilliDone, isDone: order.cilliIsDone }
        ];

        types.forEach(t => {
            if (t.count > 0) {
                const doneClass = t.isDone ? 'done' : '';
                const isFullyDone = t.isDone || (t.done >= t.count);
                const btnStyle = isFullyDone 
                    ? 'background-color: var(--accent-success); color: white; border-color: var(--accent-success);' 
                    : 'background-color: var(--bg-secondary); color: var(--text-primary); border-color: var(--border-color);';
                const btnIcon = isFullyDone ? 'check-circle' : 'circle';
                
                const producedInput = `
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <input type="number" 
                               class="spizy-done-input form-input" 
                               style="width: 60px; padding: 4px; text-align: center; border: 1px solid var(--border-color); border-radius: 4px;" 
                               value="${t.done || 0}" 
                               data-order-id="${order.id}" 
                               data-type="${t.key}"
                               min="0">
                        <span style="color: var(--text-secondary); font-size: 0.9em;"> / ${t.count}</span>
                    </div>
                `;

                html += `
                    <tr class="${doneClass}">
                        <td>${customer?.name || 'Neznámý'}</td>
                        <td>${t.label}</td>
                        <td><strong>${t.count}</strong> ks</td>
                        <td>${producedInput}</td>
                        <td class="actions">
                            <button class="btn btn-sm" style="padding: 6px 12px; font-size: 0.8rem; ${btnStyle}" 
                                    data-action="toggle-spizy-done" 
                                    data-order-id="${order.id}" 
                                    data-type="${t.key}" 
                                    title="${isFullyDone ? 'Označit jako nedokončené' : 'Označit jako hotové'}">
                                <i data-feather="${btnIcon}" style="width: 14px; height: 14px;"></i> Hotovo
                            </button>
                        </td>
                    </tr>
                `;
            }
        });
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderCategorySection(containerId, surovinaNames, date) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const parentDetails = container.closest('details');
    // Hide parent section by default
    if (parentDetails) parentDetails.style.display = 'none';

    const matchingSurovinaIds = appState.suroviny
        .filter(s => surovinaNames.includes(s.name.toUpperCase()))
        .map(s => s.id);

    const items = [];
    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.forEach(item => {
            if (matchingSurovinaIds.includes(item.surovinaId) && item.isActive) {
                items.push({ ...item, customerId: order.customerId, orderId: order.id });
            }
        });
    });

    if (items.length === 0) return;

    // Show parent section if items exist
    if (parentDetails) parentDetails.style.display = 'block';

    const badge = parentDetails?.querySelector('summary > .order-badge');
    if (badge) {
        badge.textContent = items.length;
        badge.style.display = 'inline-block';
    }

    let html = `
        <table class="data-table">
            <thead><tr><th>Zákazník</th><th>Produkt</th><th>Objednáno</th><th>Vyrobeno</th><th>Akce</th></tr></thead>
            <tbody>
    `;

    items.forEach(item => {
        const customer = appState.zakaznici.find(c => c.id === item.customerId);
        const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
        const isDone = item.doneCount >= item.boxCount;
        const doneClass = isDone ? 'done' : '';
        
        const btnStyle = isDone 
            ? 'background-color: var(--accent-success); color: white; border-color: var(--accent-success);' 
            : 'background-color: var(--bg-secondary); color: var(--text-primary); border-color: var(--border-color);';
        const btnIcon = isDone ? 'check-circle' : 'circle';
        
        const producedInput = `
            <div style="display: flex; align-items: center; gap: 5px;">
                <input type="number" 
                       class="main-order-done-input form-input" 
                       style="width: 60px; padding: 4px; text-align: center; border: 1px solid var(--border-color); border-radius: 4px;" 
                       value="${item.doneCount || 0}" 
                       data-order-id="${item.orderId}" 
                       data-item-id="${item.id}"
                       min="0">
                <span style="color: var(--text-secondary); font-size: 0.9em;"> / ${item.boxCount}</span>
            </div>
        `;

        html += `
            <tr class="${doneClass}">
                <td>${customer?.name || 'Neznámý'}</td>
                <td>${surovina?.name} <span class="text-xs text-gray-500">(${item.type})</span></td>
                <td><strong>${item.boxCount}</strong> ks</td>
                <td>${producedInput}</td>
                <td class="actions">
                    <button class="btn btn-sm" style="padding: 6px 12px; font-size: 0.8rem; ${btnStyle}" 
                            data-action="toggle-main-page-order-item-done" 
                            data-order-id="${item.orderId}" 
                            data-item-id="${item.id}" 
                            title="${isDone ? 'Označit jako nedokončené' : 'Označit jako hotové'}">
                        <i data-feather="${btnIcon}" style="width: 14px; height: 14px;"></i> Hotovo
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderAlerts() {
    const container = document.getElementById('main-page-alerts');
    if (!container) return;
    container.innerHTML = '';

    const todayStr = appState.ui.selectedDate;
    const activePriceChanges = appState.priceChanges.filter(c => 
        c.validFrom <= todayStr && 
        !appState.dismissedPriceChangeAlerts.includes(c.id)
    );

    activePriceChanges.forEach(change => {
        const customer = appState.zakaznici.find(c => c.id === change.customerId);
        const surovina = appState.suroviny.find(s => s.id === change.surovinaId);
        
        container.innerHTML += `
            <div class="alert warning flex justify-between items-center p-3 mb-2 rounded bg-yellow-100 border border-yellow-300 text-yellow-800">
                <span>Změna ceny: <strong>${customer?.name} - ${surovina?.name}</strong> na ${change.price} Kč od ${new Date(change.validFrom).toLocaleDateString('cs-CZ')}</span>
                <button class="btn-icon" data-action="dismiss-price-change-alert" data-id="${change.id}">${ICONS.eyeOff}</button>
            </div>
        `;
    });
}

function renderShortages(date) {
    const container = document.getElementById('shortages-container');
    if (!container) return;
    container.innerHTML = '';

    // Use original getDailyNeeds with ignoreDone=false (default) to show remaining needs
    const needs = getDailyNeeds(date, 'non-kfc');
    let hasShortages = false;

    for (const surovinaId in needs) {
        const surovina = appState.suroviny.find(s => s.id === surovinaId);
        if (!surovina) continue;

        const neededKg = needs[surovinaId];
        const stockBoxes = appState.dailyStockAdjustments[date]?.[surovina.id] || 0;
        const stockKg = (surovina.stock || 0) * (surovina.paletteWeight || 0) + stockBoxes * (surovina.boxWeight || 25);

        if (stockKg < neededKg) {
            hasShortages = true;
            const diff = neededKg - stockKg;
            container.innerHTML += `
                <div class="card shortage-card">
                    <div class="card-content">
                        <h3 class="shortage">Chybí: ${surovina.name}</h3>
                        <p>Potřeba: ${neededKg.toFixed(2)} kg</p>
                        <p>Skladem: ${stockKg.toFixed(2)} kg</p>
                        <p class="shortage"><strong>Manko: ${diff.toFixed(2)} kg</strong></p>
                        <div style="margin-top: 10px; display: flex; gap: 5px;">
                            <button class="btn btn-sm btn-primary" data-action="open-surovina-shortage-modal" data-surovina-id="${surovina.id}">Řešit</button>
                            <button class="btn btn-sm btn-secondary" data-action="open-single-stock-adjustment" data-surovina-id="${surovina.id}">Upravit sklad</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

function renderPreProduction(date) {
    // Stub for future pre-production logic
}

// --- Exports for eventHandler ---

export async function produceFromPlan(target) {
    const { actionId, date: futureDate } = target.dataset;
    const currentDate = appState.ui.selectedDate;
    
    // Check if input exists (from Modal)
    const input = document.getElementById(`produce-count-${actionId}-${futureDate}`);
    
    if (input) {
        const action = appState.plannedActions.find(a => a.id === actionId);
        if (!action) return;

        const dayCountData = action.dailyCounts[futureDate];
        const remainingBoxes = (dayCountData.boxCount || 0) - (dayCountData.producedCount || 0);
        let boxesToProduce = parseInt(input.value);

        if (isNaN(boxesToProduce) || boxesToProduce <= 0) boxesToProduce = remainingBoxes;

        if (boxesToProduce > remainingBoxes) {
            showToast('Nelze vyrobit více beden, než je v plánu.', 'error');
            return;
        }

        executeProduction(action, futureDate, currentDate, boxesToProduce);
        
        // Refresh modal
        const activeDaysButton = document.querySelector('#pre-production-modal .btn-group .btn.active');
        const days = activeDaysButton ? parseInt(activeDaysButton.dataset.days, 10) : 5;
        openPreProductionModal(days);
    } else {
        openPreProductionModal(2); // Open modal showing next 2 days
    }
}

function executeProduction(action, futureDate, currentDate, boxesToProduce) {
    const dayCountData = action.dailyCounts[futureDate];
    dayCountData.producedCount += boxesToProduce;

    let order = appState.orders.find(o => o.customerId === action.customerId && o.date === currentDate);
    if (!order) {
        order = { id: generateId(), date: currentDate, customerId: action.customerId, items: [] };
        appState.orders.push(order);
    }

    const pType = action.type || 'VL';
    let item = order.items.find(i => i.surovinaId === action.surovinaId && i.type === pType);
    if (!item) {
        item = { id: generateId(), surovinaId: action.surovinaId, boxCount: 0, isActive: true, type: pType, doneCount: 0 };
        order.items.push(item);
    }

    item.boxCount += boxesToProduce;
    saveState();
    renderMainPage();
    showToast(`${boxesToProduce} beden přesunuto do dnešní objednávky.`, 'success');
}

export function openPreProductionModal(days = 5) {
    const modal = DOMElements.preProductionModal;
    const body = modal.querySelector('#pre-production-body');
    const today = new Date(appState.ui.selectedDate);
    const container = document.createElement('div');
    
    modal.querySelectorAll('.btn-group .btn').forEach(btn => {
        if(parseInt(btn.dataset.days) === days) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    
    let hasActions = false;
    for (let i = 0; i <= days; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + i);
        const futureDateStr = futureDate.toISOString().split('T')[0];
        const actions = appState.plannedActions.filter(a => {
            const dayData = a.dailyCounts[futureDateStr];
            return dayData && dayData.boxCount > 0;
        });

        if (actions.length > 0) {
            hasActions = true;
            const dayDiv = document.createElement('div');
            let dayLabel = futureDate.toLocaleDateString('cs-CZ', {weekday: 'long', day: 'numeric', month: 'numeric'});
            if(i===0) dayLabel += " (Dnes)";
            
            dayDiv.innerHTML = `<h4 class="subsection-title">${dayLabel}</h4>`;
            actions.forEach(action => {
                const customer = appState.zakaznici.find(c => c.id === action.customerId);
                const surovina = appState.suroviny.find(s => s.id === action.surovinaId);
                const dayData = action.dailyCounts[futureDateStr];
                const remaining = dayData.boxCount - (dayData.producedCount || 0);
                const isCompleted = remaining <= 0;
                
                let controlsHtml = isCompleted ? 
                    `<div class="mt-2 text-green-600 font-bold flex items-center gap-2 text-sm"><i data-feather="check-circle" style="width: 16px; height: 16px;"></i> Hotovo / Přesunuto</div>`
                    : `<div class="flex gap-2 items-center mt-2">
                        <label class="text-xs text-gray-500">Přesunout:</label>
                        <input type="number" id="produce-count-${action.id}-${futureDateStr}" value="${remaining}" min="1" max="${remaining}" class="form-input text-center font-bold" style="width: 60px; padding: 4px;">
                        <button class="btn btn-primary btn-sm" data-action="produce-from-plan" data-action-id="${action.id}" data-date="${futureDateStr}">Do dnešní výroby</button>
                       </div>`;

                dayDiv.innerHTML += `
                    <div class="card p-3 mb-2 flex flex-col gap-1 ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-white'}">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-slate-700">${customer?.name} - ${surovina?.name} <span class="font-normal text-slate-500">(${action.type || 'VL'})</span></span>
                            <span class="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-sm font-bold">Zbývá: ${Math.max(0, remaining)}</span>
                        </div>
                        ${controlsHtml}
                    </div>`;
            });
            container.appendChild(dayDiv);
        }
    }
    if (!hasActions) container.innerHTML = '<div class="flex flex-col items-center justify-center h-48 text-gray-400"><i data-feather="calendar" class="w-12 h-12 mb-2"></i><p>Žádné naplánované akce v tomto období.</p></div>';
    body.innerHTML = '';
    body.appendChild(container);
    modal.classList.add('active');
    feather.replace();
}

export function openAddPreProductionModal() {
    const modal = DOMElements.addPreProductionModal;
    const custSelect = modal.querySelector('#direct-pre-prod-customer');
    const surSelect = modal.querySelector('#direct-pre-prod-surovina');
    const dateInput = modal.querySelector('#direct-pre-prod-date');

    custSelect.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    surSelect.innerHTML = appState.suroviny.filter(s => s.isActive).sort((a,b) => a.name.localeCompare(b.name)).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    const tomorrow = new Date(appState.ui.selectedDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = tomorrow.toISOString().split('T')[0];

    modal.classList.add('active');
}

export function saveDirectPreProduction() {
    const modal = DOMElements.addPreProductionModal;
    const customerId = modal.querySelector('#direct-pre-prod-customer').value;
    const surovinaId = modal.querySelector('#direct-pre-prod-surovina').value;
    const type = modal.querySelector('#direct-pre-prod-type').value;
    const boxCount = parseInt(modal.querySelector('#direct-pre-prod-boxes').value);
    const date = modal.querySelector('#direct-pre-prod-date').value;

    if (!boxCount || boxCount <= 0 || !date) {
        showToast('Zadejte platný počet beden a datum.', 'error');
        return;
    }

    let action = appState.plannedActions.find(a => a.customerId === customerId && a.surovinaId === surovinaId && a.type === type);
    if (!action) {
        action = { id: generateId(), customerId, surovinaId, type, startDate: date, endDate: date, dailyCounts: {} };
        appState.plannedActions.push(action);
    }
    
    if (!action.dailyCounts[date]) action.dailyCounts[date] = { boxCount: 0, producedCount: 0 };
    action.dailyCounts[date].boxCount += boxCount;

    saveState();
    modal.classList.remove('active');
    showToast('Předvýroba naplánována.');
    renderMainPage(); 
}

export function handleMainOrderDoneChange(target) {
    const { orderId, itemId } = target.dataset;
    const order = appState.orders.find(o => o.id === orderId);
    const item = order?.items.find(i => i.id === itemId);
    if (!item) return;

    const newValue = parseInt(target.value) || 0;
    const diff = newValue - (item.doneCount || 0);

    if (diff !== 0) {
        updateStockForOrderItem({ ...item, boxCount: Math.abs(diff) }, order.customerId, diff > 0 ? -1 : 1);
        item.doneCount = newValue;
        saveState();
        renderMainPage(); 
    }
}

export function toggleMainPageOrderItemDone(target) {
    const { orderId, itemId } = target.dataset;
    const order = appState.orders.find(o => o.id === orderId);
    const item = order?.items.find(i => i.id === itemId);
    if (!item) return;

    const isCurrentlyDone = item.doneCount >= item.boxCount;
    const targetValue = isCurrentlyDone ? 0 : item.boxCount;
    
    const diff = targetValue - (item.doneCount || 0);
    updateStockForOrderItem({ ...item, boxCount: Math.abs(diff) }, order.customerId, diff > 0 ? -1 : 1);
    
    item.doneCount = targetValue;
    saveState();
    renderMainPage();
}

export function setPreProductionDays(target) {
    const days = parseInt(target.dataset.days, 10);
    openPreProductionModal(days);
}

export function dismissPriceChangeAlert(id) {
    if (!appState.dismissedPriceChangeAlerts.includes(id)) {
        appState.dismissedPriceChangeAlerts.push(id);
        saveState();
        renderMainPage();
    }
}

export function openSingleStockAdjustmentModal(surovinaId) {
    const modal = document.getElementById('single-stock-adjustment-modal');
    const surovina = appState.suroviny.find(s => s.id === surovinaId);
    if (!surovina) return;

    modal.querySelector('.modal-title').textContent = `Upravit sklad: ${surovina.name}`;
    const currentPalettes = surovina.stock || 0;
    const date = appState.ui.selectedDate;
    const currentBoxes = appState.dailyStockAdjustments[date]?.[surovinaId] || 0;

    document.getElementById('single-stock-palettes').value = currentPalettes;
    document.getElementById('single-stock-boxes').value = currentBoxes;
    modal.dataset.surovinaId = surovinaId;
    modal.classList.add('active');
}

export function saveSingleStockAdjustment() {
    const modal = document.getElementById('single-stock-adjustment-modal');
    const surovinaId = modal.dataset.surovinaId;
    const surovina = appState.suroviny.find(s => s.id === surovinaId);
    const date = appState.ui.selectedDate;

    if (surovina) {
        const palettes = parseFloat(document.getElementById('single-stock-palettes').value) || 0;
        const boxes = parseFloat(document.getElementById('single-stock-boxes').value) || 0;

        surovina.stock = palettes;
        if (!appState.dailyStockAdjustments[date]) {
            appState.dailyStockAdjustments[date] = {};
        }
        appState.dailyStockAdjustments[date][surovinaId] = boxes;

        saveState();
        showToast('Stav skladu upraven.');
        renderMainPage();
    }
    modal.classList.remove('active');
}

// Stubbed exports for compatibility with eventHandler calls
export function toggleQuickEntryDone(id) {}
export function toggleSpizyDone(target) {}
export function deleteOrderItemFromMainPage(orderId, itemId) {}
export function openSurovinaShortageModal(surovinaId) { renderMainPage(); }
export function markShortageItemDone(orderId, itemId) {}
export function handleShortageDoneCountChange(target) {}
export function openShortenOrderModal(orderId, itemId) {}
export function saveShortenedOrder() {}
export function markPreProductionDone(target) {}
export function handlePreProductionDoneChange(target) {}
export function openTempWeightModal(target) {}
export function applySuggestedWeight(target) {}
export function saveTempWeights(target) {}
export function handleShortageStockChange(target) {}