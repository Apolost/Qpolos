/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState } from '../state.ts';
import { getDailyNeeds, getMaykawaThighsNeeded, getKfcSurovinyNeeds, getSpizyNeeds } from '../services/calculations.ts';
import { showToast } from '../ui.ts';

// This function is called when the view is rendered but is not required
// to do anything as the view is currently static HTML.
export function renderExportData() {
    // The view is static, so no dynamic rendering is needed here.
}

/**
 * Generates a comprehensive PDF report of all raw material needs for the selected date,
 * comparing required amounts with current stock levels to show deficits.
 */
export function exportRawMaterialsReport() {
    const date = appState.ui.selectedDate;
    const allNeeds = {}; // { surovinaIdOrName: neededKg }

    // 1. Standard orders (non-KFC)
    const standardNeeds = getDailyNeeds(date);
    for (const surovinaId in standardNeeds) {
        allNeeds[surovinaId] = (allNeeds[surovinaId] || 0) + standardNeeds[surovinaId];
    }

    // 2. Maykawa needs for steak production
    const maykawaThighsNeeded = getMaykawaThighsNeeded(date);
    if (maykawaThighsNeeded > 0) {
        const thighsSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
        if (thighsSurovina) {
            allNeeds[thighsSurovina.id] = (allNeeds[thighsSurovina.id] || 0) + maykawaThighsNeeded;
        }
    }
    
    // 3. Spizy needs
    const spizyNeeds = getSpizyNeeds(date);
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    if (rizkySurovina && spizyNeeds.rizky > 0) {
         allNeeds[rizkySurovina.id] = (allNeeds[rizkySurovina.id] || 0) + spizyNeeds.rizky;
    }
    
    // Spizy ingredients are tracked separately
    if (spizyNeeds.klobasa > 0) allNeeds['Špíz-Klobása'] = spizyNeeds.klobasa;
    if (spizyNeeds.spek > 0) allNeeds['Špíz-Špek'] = spizyNeeds.spek;
    if (spizyNeeds.cibule > 0) allNeeds['Špíz-Cibule'] = spizyNeeds.cibule;
    if (spizyNeeds.paprika > 0) allNeeds['Špíz-Paprika'] = spizyNeeds.paprika;
    if (spizyNeeds.steak > 0) allNeeds['Špíz-Steak'] = spizyNeeds.steak;

    // 4. KFC needs (will be listed separately by name)
    const kfcNeedsInBoxes = getKfcSurovinyNeeds(date);
    appState.kfcSuroviny.forEach(kfcSurovina => {
        const neededBoxes = kfcNeedsInBoxes[kfcSurovina.id] || 0;
        if (neededBoxes > 0) {
             const neededKg = neededBoxes * (kfcSurovina.boxWeight / 1000);
             allNeeds[`KFC-${kfcSurovina.name}`] = neededKg;
        }
    });

    if (Object.keys(allNeeds).length === 0) {
        showToast('Pro tento den není potřeba žádná surovina.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const formattedDate = new Date(date).toLocaleDateString('cs-CZ');

    doc.setFontSize(18);
    doc.text(`Souhrn potreby surovin - ${formattedDate}`, 14, 22);

    const surovinyMap = new Map(appState.suroviny.map(s => [s.id, s]));
    const spizyStockMap = appState.spizyStock;
    const kfcStockMap = new Map(appState.kfcSuroviny.map(s => [`KFC-${s.name}`, s.stockBoxes * (s.boxWeight / 1000)]));

    const head = [['Surovina', 'Potreba (kg)', 'Skladem (kg)', 'Chybi (kg)']];
    
    const body = Object.entries(allNeeds).map(([surovinaIdOrName, neededKg]) => {
        const surovina = surovinyMap.get(surovinaIdOrName);
        const name = surovina?.name || surovinaIdOrName.replace(/^(Špíz-|KFC-)/, '');
        
        let stockKg = 0;
        if (surovina) {
             const boxes = appState.dailyStockAdjustments[date]?.[surovina.id] || 0;
             stockKg = (surovina.stock || 0) * (surovina.paletteWeight || 0) + boxes * (surovina.boxWeight || 0);
        } else if (surovinaIdOrName.startsWith('Špíz-')) {
             const key = surovinaIdOrName.replace('Špíz-', '').toLowerCase();
             stockKg = spizyStockMap[key] || 0;
        } else if (surovinaIdOrName.startsWith('KFC-')) {
             stockKg = kfcStockMap.get(surovinaIdOrName) || 0;
        }
        
        const deficit = Math.max(0, neededKg - stockKg);

        return [name, neededKg.toFixed(2), stockKg.toFixed(2), deficit.toFixed(2)];
    }).sort((a,b) => a[0].localeCompare(b[0]));

    doc.autoTable({
        startY: 30,
        head: head,
        body: body,
        styles: { font: 'Helvetica' },
        columnStyles: {
            3: { cellWidth: 25, halign: 'right' },
            2: { halign: 'right' },
            1: { halign: 'right' },
        },
        didParseCell: function (data) {
            if (data.column.index === 3 && parseFloat(data.cell.raw) > 0) {
                data.cell.styles.textColor = [220, 53, 69]; // red
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    doc.save(`Potreba_surovin_${date}.pdf`);
    showToast('PDF se souhrnem potřebných surovin bylo vygenerováno.');
}


/**
 * Generates a PDF report detailing schnitzel ('řízky') orders for the selected date,
 * broken down by customer, with a final summary of totals.
 */
export function exportSchnitzelReport() {
    const date = appState.ui.selectedDate;
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    if (!rizkySurovina) {
        showToast('Surovina "ŘÍZKY" nebyla nalezena.', 'error');
        return;
    }

    const customerTotals = {}; // { customerId: totalKg }
    appState.orders
        .filter(o => o.date === date)
        .forEach(order => {
            order.items.forEach(item => {
                if (item.surovinaId === rizkySurovina.id && item.isActive) {
                    const weights = appState.boxWeights[order.customerId]?.[rizkySurovina.id];
                    const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights.VL : 10000;
                    const kg = item.boxCount * (boxWeightInGrams / 1000);
                    customerTotals[order.customerId] = (customerTotals[order.customerId] || 0) + kg;
                }
            });
        });

    if (Object.keys(customerTotals).length === 0) {
        showToast('Pro tento den nejsou žádné objednávky řízků.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const formattedDate = new Date(date).toLocaleDateString('cs-CZ');

    doc.setFontSize(18);
    doc.text(`Prehled rizku - ${formattedDate}`, 14, 22);

    const head = [['Zakaznik', 'Potreba rizku (kg)']];
    const body = Object.entries(customerTotals).map(([customerId, totalKg]) => {
        const customer = appState.zakaznici.find(c => c.id === customerId);
        return [customer ? customer.name : 'Neznamy', totalKg.toFixed(2)];
    }).sort((a,b) => a[0].localeCompare(b[0]));

    doc.autoTable({
        startY: 30,
        head: head,
        body: body,
        styles: { font: 'Helvetica' },
        columnStyles: { 1: { halign: 'right' } }
    });

    let finalY = doc.autoTable.previous.finalY + 15;

    // --- Summary ---
    const totalNeededKg = Object.values(customerTotals).reduce((sum, kg) => sum + kg, 0);
    const paletteWeight = rizkySurovina.paletteWeight || 500;
    const totalPalettes = paletteWeight > 0 ? (totalNeededKg / paletteWeight) : 0;
    const linePerformance = appState.rizkyConfig.linePerformance || 2500;
    
    let timeString = 'N/A';
    if (totalNeededKg > 0 && linePerformance > 0) {
        const runtimeHoursDecimal = totalNeededKg / linePerformance;
        const runtimeHours = Math.floor(runtimeHoursDecimal);
        const runtimeMinutes = Math.round((runtimeHoursDecimal - runtimeHours) * 60);
        timeString = `${runtimeHours} hod ${runtimeMinutes} min`;
    }

    doc.setFontSize(14);
    doc.text('Celkovy soucet', 14, finalY);
    finalY += 8;
    doc.setFontSize(11);
    doc.text(`Celkova potreba: ${totalNeededKg.toFixed(2)} kg`, 14, finalY);
    finalY += 7;
    doc.text(`Potreba palet: ${totalPalettes.toFixed(2)}`, 14, finalY);
    finalY += 7;
    doc.text(`Potrebny cas linky: ${timeString}`, 14, finalY);

    doc.save(`Prehled_rizku_${date}.pdf`);
    showToast('PDF s přehledem řízků bylo vygenerováno.');
}

/**
 * Generates a PDF report for KFC production overview for the selected date.
 */
export function exportKfcReport() {
    const date = appState.ui.selectedDate;
    const order = appState.kfcOrders[date];

    if (!order || !order.today || Object.keys(order.today).length === 0) {
        showToast('Pro tento den nejsou žádné objednávky pro KFC.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const formattedDate = new Date(date).toLocaleDateString('cs-CZ');

    doc.setFontSize(18);
    doc.text(`Prehled KFC - ${formattedDate}`, 14, 22);

    // --- 1. Orders Table ---
    let totalMinutes = 0;
    const orderTableBody = appState.kfcProducts.map(product => {
        const orderData = order.today[product.id] || { ordered: 0, produced: 0 };
        const orderedCount = orderData.ordered || 0;
        const producedCount = orderData.produced || 0;
        const missingCount = Math.max(0, orderedCount - producedCount);

        if (missingCount > 0) {
            totalMinutes += missingCount * (product.minutesPerBox || 10);
        }

        return [product.name, orderedCount, producedCount, missingCount];
    }).filter(row => row[1] > 0); // Only show products that were ordered

    doc.setFontSize(14);
    doc.text('Objednavka produktu', 14, 32);

    doc.autoTable({
        startY: 38,
        head: [['Produkt', 'Objednano (beden)', 'Vyrobeno (beden)', 'Chybi vyrobit (beden)']],
        body: orderTableBody,
        styles: { font: 'Helvetica' },
        headStyles: { fillColor: [41, 128, 186] },
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
        },
        didParseCell: function (data) {
            if (data.column.index === 3 && data.cell.raw > 0) {
                data.cell.styles.textColor = [220, 53, 69]; // red
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    let finalY = doc.autoTable.previous.finalY + 15;

    // --- 2. Summary Section ---
    const addedStaff = order.addedStaff || 0;
    const totalStaff = 1 + addedStaff;
    
    let timeString = 'Hotovo';
    if (totalMinutes > 0) {
        const newTotalMinutes = totalMinutes / totalStaff;
        const kfcStartTime = 8 * 60; // 08:00
        const endMinuteOfDay = kfcStartTime + newTotalMinutes;
        
        const endHour = Math.floor(endMinuteOfDay / 60) % 24;
        const endMinute = Math.round(endMinuteOfDay % 60);

        timeString = `do ~${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    }

    doc.setFontSize(14);
    doc.text('Souhrn vyroby', 14, finalY);
    finalY += 8;
    doc.setFontSize(11);
    doc.text(`Pocet lidi na KFC: ${totalStaff}`, 14, finalY);
    finalY += 7;
    doc.text(`Odhadovany cas dokonceni: ${timeString}`, 14, finalY);
    finalY += 15;

    // --- 3. Raw Material Needs Table ---
    const surovinyNeeded = getKfcSurovinyNeeds(date);
    const materialTableBody = Object.entries(surovinyNeeded).map(([surovinaId, neededBoxes]) => {
        const surovina = appState.kfcSuroviny.find(s => s.id === surovinaId);
        if (!surovina) return null;
        const neededKg = neededBoxes * (surovina.boxWeight / 1000);
        return [surovina.name, neededKg.toFixed(2)];
    }).filter(Boolean); // Filter out nulls if surovina not found

    if (materialTableBody.length > 0) {
        doc.setFontSize(14);
        doc.text('Potreba surovin', 14, finalY);
        finalY += 6;
        
        doc.autoTable({
            startY: finalY,
            head: [['Surovina', 'Potreba (kg)']],
            body: materialTableBody,
            styles: { font: 'Helvetica' },
            headStyles: { fillColor: [41, 128, 186] },
            columnStyles: { 1: { halign: 'right' } }
        });
    }

    doc.save(`Prehled_KFC_${date}.pdf`);
    showToast('PDF s přehledem pro KFC bylo vygenerováno.');
}