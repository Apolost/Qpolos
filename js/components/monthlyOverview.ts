/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState, saveState } from '../state.ts';
import { calculateYieldData, getDailyNeeds, calculateTimeline } from '../services/calculations.ts';
import { DOMElements, showConfirmation, showToast } from '../ui.ts';
import { generateId } from '../utils.ts';

let overviewChart = null;
let estimateCalendarDate = new Date();


const MATERIAL_MAP = {
    'Prsa': ['PRSA'],
    'Řízky': ['ŘÍZKY'],
    'Stehna': ['STEHNA'],
    'Droby': ['JÁTRA', 'SRDCE', 'ŽALUDKY', 'KRKY']
};

const COLORS = [
    '#36a2eb', // Blue
    '#ff6384', // Red
    '#4bc0c0', // Teal
    '#ffcd56', // Yellow
    '#9966ff', // Purple
    '#ff9f40', // Orange
    '#c9cbcf'  // Grey
];


function getBaseSurovinyForFilter(filter) {
    const surovinaNames = MATERIAL_MAP[filter];
    if (!surovinaNames) return [];

    return appState.suroviny.filter(s => surovinaNames.includes(s.name.toUpperCase()));
}

function getEstimatedNeeds(date, surovinyToTrackIds) {
    const needs = {};
    const estimatesForDay = appState.ui.materialEstimates?.filter(e => e.date === date) || [];

    estimatesForDay.forEach(estimate => {
        estimate.items.forEach(item => {
            if (surovinyToTrackIds.has(item.surovinaId)) {
                const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
                if (!surovina) return;

                const boxWeightInGrams = appState.boxWeights[estimate.customerId]?.[surovina.id]?.[item.type] || 10000;
                const totalWeightInKg = item.boxCount * (boxWeightInGrams / 1000);
                
                needs[surovina.id] = (needs[surovina.id] || 0) + totalWeightInKg;
            }
        });
    });

    return needs;
}


function calculateStockProjection(startDateStr, endDateStr, filter) {
    const projections = {};
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    const isThighGroup = filter === 'Stehna';
    let surovinyToTrack = getBaseSurovinyForFilter(filter);

    if (isThighGroup) {
        const stehnaMasterSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
        if (stehnaMasterSurovina) {
            surovinyToTrack = [stehnaMasterSurovina]; // Process only this one as the master pool
        }
    }
    
    // Suroviny needed for thigh calculations
    const horniSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'HORNÍ STEHNA');
    const spodniSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'SPODNÍ STEHNA');
    const ctvrtkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ČTVRTKY');
    const allThighSurovinyIds = new Set([horniSurovina?.id, spodniSurovina?.id, ctvrtkySurovina?.id, ...surovinyToTrack.map(s => s.id)].filter(Boolean));


    surovinyToTrack.forEach(surovina => {
        const initialStockKg = (surovina.stock || 0) * (surovina.paletteWeight || 0) 
                             + (appState.dailyStockAdjustments[startDateStr]?.[surovina.id] || 0) * (surovina.boxWeight || 25);

        let runningStockReal = initialStockKg;
        let runningStockEstimate = initialStockKg;

        const dataPointsReal = [];
        const dataPointsEstimate = [];
        let totalDemandReal = 0;
        let totalDemandEstimatePart = 0; 
        let totalProduction = 0;

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            
            // A. Calculate Production for the day
            let productionKg = 0;
            const surovinaNameUpper = surovina.name.toUpperCase();
            const dailyData = appState.chickenCounts[dateStr];
            const { totals } = calculateTimeline(dateStr);
            const { yieldData } = calculateYieldData(dateStr, dailyData?.flocks, totals.totalWeight);
            
            if (isThighGroup) {
                const thighYieldInfo = yieldData.find(y => y.name.toUpperCase() === 'STEHNA CELKEM');
                productionKg = thighYieldInfo?.produced || 0;
            } else if (surovinaNameUpper === 'ŘÍZKY') {
                const prsaSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'PRSA');
                if (prsaSurovina) {
                    const prsaYieldInfo = yieldData.find(y => y.name.toUpperCase() === 'PRSA');
                    const prsaProduction = prsaYieldInfo?.produced || 0;
                    const prsaRealNeed = getDailyNeeds(dateStr, null, true)[prsaSurovina.id] || 0;
                    const prsaStock = (prsaSurovina.stock || 0) * prsaSurovina.paletteWeight + (appState.dailyStockAdjustments[dateStr]?.[prsaSurovina.id] || 0) * prsaSurovina.boxWeight;
                    const prsaSurplus = prsaStock + prsaProduction - prsaRealNeed;
                    productionKg = Math.max(0, prsaSurplus) * 0.70;
                }
            } else {
                const yieldItem = yieldData.find(y => y.name.toUpperCase() === surovinaNameUpper.replace(' (SKELETY)',''));
                if(yieldItem) {
                    productionKg = yieldItem.produced || 0;
                }
            }

            totalProduction += productionKg;
            
            // B. Calculate Demand for the day
            const realNeeds = getDailyNeeds(dateStr, null, true);
            
            let realDemandKg = 0;
            let estimateDemandKg = 0;

            if (isThighGroup) {
                const estimatedNeedsOnly = getEstimatedNeeds(dateStr, allThighSurovinyIds);
                const { upperThighPercent, lowerThighPercent } = appState.thighSplitSettings;
                const CtvrtkaToStehnoRatio = 0.727;
                
                // Real demand
                const realNeedStehna = realNeeds[surovina.id] || 0;
                const realNeedHorni = realNeeds[horniSurovina?.id] || 0;
                const realNeedSpodni = realNeeds[spodniSurovina?.id] || 0;
                const realNeedCtvrtky = realNeeds[ctvrtkySurovina?.id] || 0;
                const stehnaForHorniSpodni_real = (upperThighPercent > 0 && lowerThighPercent > 0) ? Math.max(realNeedHorni / (upperThighPercent / 100), realNeedSpodni / (lowerThighPercent / 100)) : 0;
                const stehnaForCtvrtky_real = realNeedCtvrtky * CtvrtkaToStehnoRatio;
                realDemandKg = realNeedStehna + stehnaForHorniSpodni_real + stehnaForCtvrtky_real;

                // Estimate demand
                const estNeedStehna = estimatedNeedsOnly[surovina.id] || 0;
                const estNeedHorni = estimatedNeedsOnly[horniSurovina?.id] || 0;
                const estNeedSpodni = estimatedNeedsOnly[spodniSurovina?.id] || 0;
                const estNeedCtvrtky = estimatedNeedsOnly[ctvrtkySurovina?.id] || 0;
                const stehnaForHorniSpodni_est = (upperThighPercent > 0 && lowerThighPercent > 0) ? Math.max(estNeedHorni / (upperThighPercent / 100), estNeedSpodni / (lowerThighPercent / 100)) : 0;
                const stehnaForCtvrtky_est = estNeedCtvrtky * CtvrtkaToStehnoRatio;
                estimateDemandKg = estNeedStehna + stehnaForHorniSpodni_est + stehnaForCtvrtky_est;

            } else {
                const surovinaIdSet = new Set(surovinyToTrack.map(s=>s.id));
                const estimatedNeedsOnly = getEstimatedNeeds(dateStr, surovinaIdSet);
                realDemandKg = surovinyToTrack.reduce((sum, s) => sum + (realNeeds[s.id] || 0), 0);
                estimateDemandKg = surovinyToTrack.reduce((sum, s) => sum + (estimatedNeedsOnly[s.id] || 0), 0);
            }
            
            // C. Update stocks
            runningStockReal += productionKg - realDemandKg;
            runningStockEstimate += productionKg - (realDemandKg + estimateDemandKg);

            // D. Store data points (end of day stock)
            dataPointsReal.push({ date: dateStr, stock: runningStockReal });
            dataPointsEstimate.push({ date: dateStr, stock: runningStockEstimate });
            
            // E. For summary
            totalDemandReal += realDemandKg;
            totalDemandEstimatePart += estimateDemandKg;
        }
        
        projections[surovina.id] = {
            name: isThighGroup ? 'Stehna (všechny druhy)' : surovina.name,
            dataReal: dataPointsReal,
            dataEstimate: dataPointsEstimate,
            initialStock: initialStockKg,
            totalDemandReal,
            totalDemandEstimate: totalDemandReal + totalDemandEstimatePart,
            totalProduction,
        };
    });

    return projections;
}

function renderEstimatesList() {
    const container = document.getElementById('overview-estimates-list-container');
    if (!container) return;

    const estimates = appState.ui.materialEstimates || [];
    if (estimates.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let listHtml = `<h3 class="subsection-title">Aktivní odhady pro graf</h3>
                    <ul style="list-style-type: disc; padding-left: 20px;">`;

    const groupedByDate = estimates.reduce((acc, est) => {
        (acc[est.date] = acc[est.date] || []).push(est);
        return acc;
    }, {});
    
    Object.entries(groupedByDate).sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB)).forEach(([date, dateEstimates]) => {
        dateEstimates.forEach(est => {
            const customer = appState.zakaznici.find(c => c.id === est.customerId);
            est.items.forEach(item => {
                 const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
                 listHtml += `<li>${new Date(date + 'T00:00:00').toLocaleDateString('cs-CZ')}: ${customer.name} - ${item.boxCount}x ${surovina.name} (${item.type})</li>`;
            });
        });
    });

    listHtml += `</ul><button class="btn btn-danger" style="margin-top: 15px;" data-action="clear-material-estimates"><i data-feather="trash-2"></i> Smazat odhady</button>`;
    container.innerHTML = listHtml;
    feather.replace();
}


function renderChartAndSummary(projections, filter) {
    const canvas = document.getElementById('overview-chart');
    const summaryContainer = document.getElementById('overview-summary-container');
    if (!canvas || !summaryContainer) return;
    const ctx = canvas.getContext('2d');

    if (overviewChart) {
        overviewChart.destroy();
    }

    const firstProjectionKey = Object.keys(projections)[0];
    const firstProjection = projections[firstProjectionKey];

    if (!firstProjection || !firstProjection.dataReal || firstProjection.dataReal.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'grey';
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillText('Pro vybrané období a filtr nejsou dostupná žádná data.', canvas.width / 2, canvas.height / 2);
        
        summaryContainer.innerHTML = '<p>Pro vybrané období a filtr nejsou dostupná žádná data.</p>';
        renderEstimatesList();
        return;
    }
    
    const chartTitle = document.getElementById('overview-chart-title');
    const isThighGroup = filter === 'Stehna';
    chartTitle.textContent = `Graf vývoje skladu pro ${isThighGroup ? 'Stehna (vše)' : filter}`;
    
    const allDates = firstProjection.dataReal.map(dp => new Date(dp.date + 'T00:00:00').toLocaleDateString('cs-CZ'));

    const datasets = [];
    let colorIndex = 0;

    for (const surovinaId in projections) {
        const p = projections[surovinaId];
        const color = COLORS[colorIndex % COLORS.length];
        colorIndex++;

        datasets.push({
            label: `${p.name} (obj.)`,
            data: p.dataReal.map(d => d.stock),
            borderColor: color,
            backgroundColor: `${color}33`,
            fill: false,
            tension: 0.1
        });

        datasets.push({
            label: `${p.name} (odh.)`,
            data: p.dataEstimate.map(d => d.stock),
            borderColor: color,
            backgroundColor: `${color}33`,
            borderDash: [5, 5],
            fill: false,
            tension: 0.1
        });
    }
    
    overviewChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allDates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Zůstatek na skladě (kg)' }
                }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += `${context.parsed.y.toFixed(2)} kg`;
                            return label;
                        }
                    }
                }
            }
        }
    });
    
    let summaryHtml = `<table class="data-table">
        <thead>
            <tr>
                <th>Surovina</th>
                <th>Počáteční stav (kg)</th>
                <th>Celková výroba (kg)</th>
                <th>Spotřeba (obj.) (kg)</th>
                <th>Spotřeba (odh.) (kg)</th>
                <th>Konec (po obj.) (kg)</th>
                <th>Konec (po odh.) (kg)</th>
            </tr>
        </thead>
        <tbody>
    `;
    for (const surovinaId in projections) {
        const p = projections[surovinaId];
        const finalStockReal = p.dataReal.length > 0 ? p.dataReal[p.dataReal.length - 1].stock : p.initialStock;
        const finalStockEstimate = p.dataEstimate.length > 0 ? p.dataEstimate[p.dataEstimate.length - 1].stock : p.initialStock;
        const diffClassReal = finalStockReal < 0 ? 'shortage' : 'surplus';
        const diffClassEstimate = finalStockEstimate < 0 ? 'shortage' : 'surplus';
        
        summaryHtml += `
            <tr>
                <td>${p.name}</td>
                <td>${p.initialStock.toFixed(2)}</td>
                <td>${p.totalProduction.toFixed(2)}</td>
                <td>${p.totalDemandReal.toFixed(2)}</td>
                <td>${(p.totalDemandEstimate - p.totalDemandReal).toFixed(2)}</td>
                <td class="font-bold ${diffClassReal}">${finalStockReal.toFixed(2)}</td>
                <td class="font-bold ${diffClassEstimate}">${finalStockEstimate.toFixed(2)}</td>
            </tr>
        `;
    }
    summaryHtml += '</tbody></table>';
    summaryContainer.innerHTML = summaryHtml;
    renderEstimatesList();
}

function handleRenderButtonClick() {
    const fromDate = document.getElementById('overview-date-from').value;
    const toDate = document.getElementById('overview-date-to').value;
    const activeFilterEl = document.querySelector('#overview-material-filters .btn.active');
    
    if (!fromDate || !toDate) {
        showToast('Vyberte prosím počáteční a koncové datum.', 'error');
        return;
    }
    if (new Date(toDate) < new Date(fromDate)) {
        showToast('Koncové datum nemůže být dříve než počáteční.', 'error');
        return;
    }

    const filter = activeFilterEl.dataset.filter;
    const projections = calculateStockProjection(fromDate, toDate, filter);
    renderChartAndSummary(projections, filter);
}


export function openAddEstimateModal() {
    const modal = DOMElements.addMaterialEstimateModal;
    const customerSelect = modal.querySelector('#estimate-customer');
    const dateInput = modal.querySelector('#estimate-date');
    const productsContainer = modal.querySelector('#estimate-products-container');

    dateInput.value = document.getElementById('overview-date-from').value;
    customerSelect.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    let productsHtml = '<table class="data-table"><thead><tr><th>Produkt</th><th>Počet beden</th></tr></thead><tbody>';
    appState.suroviny.filter(s => s.isActive).forEach(s => {
        productsHtml += `
            <tr>
                <td>${s.name}</td>
                <td><input type="number" min="0" class="estimate-box-count" data-surovina-id="${s.id}" style="width: 100px;"></td>
            </tr>
        `;
    });
    productsHtml += '</tbody></table>';
    productsContainer.innerHTML = productsHtml;

    modal.classList.add('active');
}

export function saveMaterialEstimate() {
    const modal = DOMElements.addMaterialEstimateModal;
    const date = modal.querySelector('#estimate-date').value;
    const customerId = modal.querySelector('#estimate-customer').value;
    const type = modal.querySelector('#estimate-type').value;

    const items = [];
    modal.querySelectorAll('.estimate-box-count').forEach(input => {
        const boxCount = parseInt(input.value);
        if (boxCount > 0) {
            items.push({ surovinaId: input.dataset.surovinaId, boxCount: boxCount, type: type });
        }
    });

    if (items.length === 0) {
        showToast('Zadejte počet beden alespoň pro jednu položku.', 'error');
        return;
    }

    if (!appState.ui.materialEstimates) {
        appState.ui.materialEstimates = [];
    }
    appState.ui.materialEstimates.push({ date, customerId, items });
    
    modal.classList.remove('active');
    handleRenderButtonClick(); // Re-render the chart with new estimate
    showToast('Odhad byl přidán do grafu.');
}

export function generateAutomaticEstimate() {
    showConfirmation("Opravdu chcete vygenerovat a přidat automatický odhad? Tím přepíšete stávající odhady.", () => {
        const fromDateStr = document.getElementById('overview-date-from').value;
        const toDateStr = document.getElementById('overview-date-to').value;

        const historyEndDate = new Date(fromDateStr);
        const historyStartDate = new Date(historyEndDate);
        historyStartDate.setDate(historyEndDate.getDate() - 7);
        const historyStartDateStr = historyStartDate.toISOString().split('T')[0];

        const averageOrders = {}; // { customerId: { surovinaId: { type: totalBoxes } } }
        
        const ordersInHistory = appState.orders.filter(o => o.date >= historyStartDateStr && o.date < fromDateStr);
        ordersInHistory.forEach(order => {
            if (!averageOrders[order.customerId]) averageOrders[order.customerId] = {};
            order.items.forEach(item => {
                if (!averageOrders[order.customerId][item.surovinaId]) averageOrders[order.customerId][item.surovinaId] = {};
                averageOrders[order.customerId][item.surovinaId][item.type] = (averageOrders[order.customerId][item.surovinaId][item.type] || 0) + item.boxCount;
            });
        });
        
        // Calculate average
        for (const customerId in averageOrders) {
            for (const surovinaId in averageOrders[customerId]) {
                for (const type in averageOrders[customerId][surovinaId]) {
                    averageOrders[customerId][surovinaId][type] = Math.round(averageOrders[customerId][surovinaId][type] / 7);
                }
            }
        }
        
        const newEstimates = [];
        const loopStartDate = new Date(fromDateStr);
        const loopEndDate = new Date(toDateStr);

        for (let d = new Date(loopStartDate); d <= loopEndDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            for (const customerId in averageOrders) {
                const items = [];
                for (const surovinaId in averageOrders[customerId]) {
                    for (const type in averageOrders[customerId][surovinaId]) {
                        const boxCount = averageOrders[customerId][surovinaId][type];
                        if (boxCount > 0) {
                             items.push({ surovinaId, boxCount, type });
                        }
                    }
                }
                if (items.length > 0) {
                    newEstimates.push({ date: dateStr, customerId, items });
                }
            }
        }
        
        appState.ui.materialEstimates = newEstimates;
        handleRenderButtonClick();
        showToast('Automatický odhad byl vygenerován a přidán do grafu.');
    });
}

export function generateCalendarEstimate() {
     showConfirmation("Opravdu chcete přidat odhady z kalendáře? Tím se přidají k stávajícím odhadům.", () => {
        const fromDateStr = document.getElementById('overview-date-from').value;
        const toDateStr = document.getElementById('overview-date-to').value;
        const loopStartDate = new Date(fromDateStr);
        const loopEndDate = new Date(toDateStr);
        
        let estimatesAdded = 0;
        if (!appState.ui.materialEstimates) appState.ui.materialEstimates = [];

        for (let d = new Date(loopStartDate); d <= loopEndDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const actionsForDay = appState.plannedActions.filter(a => {
                const dayCountData = a.dailyCounts?.[dateStr];
                return dayCountData && dayCountData.boxCount > 0 && dateStr >= a.startDate && (!a.endDate || dateStr <= a.endDate);
            });

            actionsForDay.forEach(action => {
                const dayData = action.dailyCounts[dateStr];
                const newEstimate = {
                    date: dateStr,
                    customerId: action.customerId,
                    items: [{
                        surovinaId: action.surovinaId,
                        boxCount: dayData.boxCount,
                        type: 'VL' // Planned actions are always VL
                    }]
                };
                appState.ui.materialEstimates.push(newEstimate);
                estimatesAdded++;
            });
        }
        
        if (estimatesAdded > 0) {
            handleRenderButtonClick();
            showToast(`${estimatesAdded} odhadů z kalendáře bylo přidáno do grafu.`);
        } else {
            showToast('V zadaném období nebyly nalezeny žádné naplánované akce.', 'warning');
        }
    });
}

export function clearEstimates() {
    showConfirmation("Opravdu chcete smazat všechny přidané odhady z grafu?", () => {
        appState.ui.materialEstimates = [];
        handleRenderButtonClick();
        showToast('Všechny odhady byly smazány.');
    });
}

export function renderMonthlyOverview() {
    appState.ui.materialEstimates = appState.ui.materialEstimates || [];
    const fromDateInput = document.getElementById('overview-date-from');
    const toDateInput = document.getElementById('overview-date-to');
    
    // Set default dates
    const today = new Date(appState.ui.selectedDate);
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    
    fromDateInput.value = today.toISOString().split('T')[0];
    toDateInput.value = sevenDaysLater.toISOString().split('T')[0];

    // Setup event listeners
    document.getElementById('render-overview-chart-btn').onclick = handleRenderButtonClick;
    fromDateInput.addEventListener('change', handleRenderButtonClick);
    toDateInput.addEventListener('change', handleRenderButtonClick);
    document.getElementById('export-overview-pdf-btn').onclick = exportOverviewToPdf;

    document.querySelectorAll('#overview-material-filters .btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#overview-material-filters .btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            handleRenderButtonClick(); // Automatically re-render when filter changes
        });
    });
    
    // Initial render
    handleRenderButtonClick();
}

function renderChickenEstimateCalendar() {
    const modal = DOMElements.chickenEstimateModal;
    const container = modal.querySelector('#chicken-estimate-calendar-container');
    const display = modal.querySelector('#current-month-chicken-estimate-display');

    const year = estimateCalendarDate.getFullYear();
    const month = estimateCalendarDate.getMonth();

    display.textContent = `${new Date(year, month).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}`;
    container.innerHTML = '';

    const firstDayOfMonth = new Date(year, month, 1);
    let dayOfWeek = firstDayOfMonth.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;
    const offset = dayOfWeek - 1;

    let currentDate = new Date(firstDayOfMonth);
    currentDate.setDate(currentDate.getDate() - offset);

    // Header
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.style.gridColumn = '1 / -1';
    header.style.display = 'grid';
    header.style.gridTemplateColumns = 'repeat(7, 1fr)';
    header.innerHTML = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(day => `<div class="text-center font-semibold text-sm text-gray-500 p-2">${day}</div>`).join('');
    container.appendChild(header);

    for (let i = 0; i < 42; i++) { // Render 6 weeks to cover all possibilities
        const dayCell = document.createElement('div');
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayData = appState.chickenCounts[dateStr];
        const count = dayData?.flocks[0]?.count || '';
        const weight = dayData?.flocks[0]?.avgWeight || '';

        dayCell.className = 'border rounded-lg p-2 flex flex-col gap-2';
        if (currentDate.getMonth() !== month) {
            dayCell.classList.add('bg-slate-50');
        }

        dayCell.innerHTML = `
            <div class="font-bold text-sm ${currentDate.getMonth() !== month ? 'text-slate-400' : 'text-slate-800'}">${currentDate.getDate()}</div>
            <div class="form-field" style="margin-bottom: 0;">
                <input type="number" data-date="${dateStr}" data-type="count" value="${count}" placeholder="ks" class="w-full p-1 border rounded text-sm">
            </div>
            <div class="form-field" style="margin-bottom: 0;">
                <input type="number" step="0.01" data-date="${dateStr}" data-type="weight" value="${weight}" placeholder="kg" class="w-full p-1 border rounded text-sm">
            </div>
        `;
        container.appendChild(dayCell);
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

export function openChickenEstimateModal() {
    estimateCalendarDate = new Date(document.getElementById('overview-date-from').value);
    renderChickenEstimateCalendar();
    DOMElements.chickenEstimateModal.classList.add('active');
}

export function changeChickenEstimateMonth(delta) {
    estimateCalendarDate.setMonth(estimateCalendarDate.getMonth() + delta);
    renderChickenEstimateCalendar();
}

export function saveChickenEstimates() {
    const modal = DOMElements.chickenEstimateModal;
    let changes = 0;

    const inputs = modal.querySelectorAll('#chicken-estimate-calendar-container input');
    const dailyInputs = {};
    inputs.forEach(input => {
        const { date, type } = input.dataset;
        if (!dailyInputs[date]) dailyInputs[date] = {};
        dailyInputs[date][type] = input.value;
    });

    for (const date in dailyInputs) {
        const count = parseInt(dailyInputs[date].count) || 0;
        const weight = parseFloat(dailyInputs[date].weight) || 0;

        if (count > 0 && weight > 0) {
            if (!appState.chickenCounts[date]) {
                 appState.chickenCounts[date] = {
                    startTime: '06:00',
                    delayHours: 0,
                    delayMinutes: 0,
                    flocks: []
                 };
            }
            // Overwrite or create a single "Odhad" flock
            appState.chickenCounts[date].flocks = [{
                name: 'Odhad',
                count: count,
                avgWeight: weight,
                deviation: 10 // default deviation for estimates
            }];
            changes++;
        } else if (appState.chickenCounts[date]) {
            // If inputs are cleared, remove the estimate if it was one
            const flockIndex = appState.chickenCounts[date].flocks.findIndex(f => f.name === 'Odhad');
            if (flockIndex !== -1) {
                appState.chickenCounts[date].flocks.splice(flockIndex, 1);
                if (appState.chickenCounts[date].flocks.length === 0) {
                    delete appState.chickenCounts[date];
                }
                changes++;
            }
        }
    }
    
    if (changes > 0) {
        saveState();
        showToast('Odhady naskladnění kuřat byly uloženy.');
        handleRenderButtonClick(); // Re-render main chart
    }

    DOMElements.chickenEstimateModal.classList.remove('active');
}

// --- PDF EXPORT ---

function getNeedsByCustomer(date, surovinyToTrack, filter, isEstimate) {
    const needsByCustomer = {};
    const surovinyToTrackIds = new Set(surovinyToTrack.map(s => s.id));
    const isThighGroup = filter === 'Stehna';

    const source = isEstimate ? (appState.ui.materialEstimates || []) : appState.orders;
    const itemsForDay = source.filter(o => o.date === date);

    if (isThighGroup) {
        const horniSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'HORNÍ STEHNA');
        const spodniSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'SPODNÍ STEHNA');
        const ctvrtkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ČTVRTKY');
        const stehnaSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
        const allThighSurovinyIds = new Set([horniSurovina?.id, spodniSurovina?.id, ctvrtkySurovina?.id, stehnaSurovina?.id].filter(Boolean));
        
        const customerItems = itemsForDay.reduce((acc, order) => {
            acc[order.customerId] = [...(acc[order.customerId] || []), ...order.items];
            return acc;
        }, {});

        for(const customerId in customerItems){
            const items = customerItems[customerId];
            const findItemKg = (surovinaId) => {
                 let totalKg = 0;
                 items.filter(i => i.surovinaId === surovinaId).forEach(item => {
                    const boxWeightInGrams = appState.boxWeights[customerId]?.[surovinaId]?.[item.type] || 10000;
                    totalKg += item.boxCount * (boxWeightInGrams / 1000);
                 });
                 return totalKg;
             };
             const needStehna = findItemKg(stehnaSurovina?.id);
             const needHorni = findItemKg(horniSurovina?.id);
             const needSpodni = findItemKg(spodniSurovina?.id);
             const needCtvrtky = findItemKg(ctvrtkySurovina?.id);

             const { upperThighPercent, lowerThighPercent } = appState.thighSplitSettings;
             const CtvrtkaToStehnoRatio = 0.727;

             const stehnaForHorniSpodni = (upperThighPercent > 0 && lowerThighPercent > 0) ? Math.max(needHorni / (upperThighPercent / 100), needSpodni / (lowerThighPercent / 100)) : 0;
             const stehnaForCtvrtky = needCtvrtky * CtvrtkaToStehnoRatio;
             
             needsByCustomer[customerId] = needStehna + stehnaForHorniSpodni + stehnaForCtvrtky;
        }

    } else { // Not thigh group
        itemsForDay.forEach(order => {
            order.items.forEach(item => {
                if (surovinyToTrackIds.has(item.surovinaId)) {
                    const boxWeightInGrams = appState.boxWeights[order.customerId]?.[item.surovinaId]?.[item.type] || 10000;
                    const kg = item.boxCount * (boxWeightInGrams / 1000);
                    needsByCustomer[order.customerId] = (needsByCustomer[order.customerId] || 0) + kg;
                }
            });
        });
    }

    return needsByCustomer;
}

async function exportOverviewToPdf() {
    const fromDate = document.getElementById('overview-date-from').value;
    const toDate = document.getElementById('overview-date-to').value;
    const activeFilterEl = document.querySelector('#overview-material-filters .btn.active');
    const filter = activeFilterEl.dataset.filter;
    
    if (!fromDate || !toDate) {
        showToast('Vyberte prosím období pro export.', 'error');
        return;
    }
    
    const projections = calculateStockProjection(fromDate, toDate, filter);
    const surovinyToTrack = getBaseSurovinyForFilter(filter);
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const formattedDate = `${new Date(fromDate).toLocaleDateString('cs-CZ')} - ${new Date(toDate).toLocaleDateString('cs-CZ')}`;
    doc.setFontSize(18);
    doc.text(`Prehled suroviny: ${filter}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Obdobi: ${formattedDate}`, 14, 30);
    
    let y = 40;
    
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    
    const customerMap = new Map(appState.zakaznici.map(c => [c.id, c.name]));

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        const projectionKey = Object.keys(projections)[0];
        if (!projections[projectionKey]) continue;
        
        const dayIndex = projections[projectionKey].dataReal.findIndex(dp => dp.date === dateStr);
        if (dayIndex === -1) continue;
        
        const dayDataReal = projections[projectionKey].dataReal[dayIndex];
        const dayDataEstimate = projections[projectionKey].dataEstimate[dayIndex];
        const previousDayStock = dayIndex > 0 ? projections[projectionKey].dataReal[dayIndex - 1].stock : projections[projectionKey].initialStock;

        const dailyData = appState.chickenCounts[dateStr];
        const { totals } = calculateTimeline(dateStr);
        const { yieldData } = calculateYieldData(dateStr, dailyData?.flocks, totals.totalWeight);
        let productionKg = 0;
        
        const isThighGroup = filter === 'Stehna';
        if(isThighGroup) {
            productionKg = yieldData.find(y => y.name.toUpperCase() === 'STEHNA CELKEM')?.produced || 0;
        } else {
            const yieldItem = yieldData.find(y => y.name.toUpperCase() === filter.toUpperCase());
            productionKg = yieldItem?.produced || 0;
        }
        
        if (y > 250) { doc.addPage(); y = 20; }

        doc.setFontSize(14);
        doc.text(new Date(dateStr+'T00:00:00').toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long'}), 14, y);
        y += 7;
        
        doc.setFontSize(11);
        doc.text(`Zustatek z minuleho dne: ${previousDayStock.toFixed(2)} kg`, 14, y);
        y += 5;
        doc.text(`Vyrobeno z kurat: ${productionKg.toFixed(2)} kg`, 14, y);
        y += 7;

        const needsByCustomer = getNeedsByCustomer(dateStr, surovinyToTrack, filter, false);
        const estimatesByCustomer = getNeedsByCustomer(dateStr, surovinyToTrack, filter, true);
        
        if (Object.keys(needsByCustomer).length > 0) {
            doc.setFontSize(12);
            doc.text('Objednavky:', 14, y);
            const body = Object.entries(needsByCustomer).map(([customerId, kg]) => [customerMap.get(customerId) || 'Neznamy', kg.toFixed(2)]);
            doc.autoTable({ startY: y + 2, head: [['Zakaznik', 'Spotreba (kg)']], body: body, theme: 'grid' });
            y = doc.autoTable.previous.finalY + 5;
        }

        if (Object.keys(estimatesByCustomer).length > 0) {
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFontSize(12);
            doc.text('Odhady:', 14, y);
            const body = Object.entries(estimatesByCustomer).map(([customerId, kg]) => [customerMap.get(customerId) || 'Neznamy', kg.toFixed(2)]);
            doc.autoTable({ startY: y + 2, head: [['Zakaznik', 'Spotreba (kg)']], body: body, theme: 'grid' });
            y = doc.autoTable.previous.finalY + 5;
        }
        
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`Zustatek na konci dne (po objednavkach): ${dayDataReal.stock.toFixed(2)} kg`, 14, y);
        y += 5;
        doc.text(`Zustatek na konci dne (po odhadech): ${dayDataEstimate.stock.toFixed(2)} kg`, 14, y);
        y += 10;
        doc.setFont(undefined, 'normal');
    }
    
    doc.save(`Prehled_suroviny_${filter}_${fromDate}.pdf`);
    showToast('PDF s prehledem bylo vygenerovano.');
}