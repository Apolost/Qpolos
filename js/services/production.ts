/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState } from '../state.ts';
import { showToast } from '../ui.ts';

/**
 * If a certain number of lower thigh boxes are added to stock,
 * this function automatically calculates and adds the corresponding
 * number of upper thigh boxes based on the weight split percentages
 * defined in the settings.
 * @param {string} changedSurovinaId - The ID of the surovina that was changed.
 * @param {number} addedBoxes - The number of boxes *added* to stock.
 * @param {string} date - The date for the stock adjustment.
 */
export function handleThighSplitProduction(changedSurovinaId, addedBoxes, date) {
    const lowerThighSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'SPODNÍ STEHNA');
    if (!lowerThighSurovina || changedSurovinaId !== lowerThighSurovina.id) {
        return; // Not the trigger surovina
    }
    
    const upperThighSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'HORNÍ STEHNA');
    if (!upperThighSurovina) {
        console.warn('Surovina "HORNÍ STEHNA" nenalezena. Automatický zápočet nelze provést.');
        return;
    }

    const { upperThighPercent, lowerThighPercent } = appState.thighSplitSettings;
    if (!lowerThighPercent || lowerThighPercent <= 0) {
        return; // Avoid division by zero
    }

    const lowerWeightAdded = addedBoxes * (lowerThighSurovina.boxWeight || 25);
    const upperWeightProduced = (lowerWeightAdded / lowerThighPercent) * upperThighPercent;
    const upperBoxesProduced = Math.round(upperWeightProduced / (upperThighSurovina.boxWeight || 25));

    if (upperBoxesProduced > 0) {
        if (!appState.dailyStockAdjustments[date]) {
            appState.dailyStockAdjustments[date] = {};
        }
        
        appState.dailyStockAdjustments[date][upperThighSurovina.id] = (appState.dailyStockAdjustments[date][upperThighSurovina.id] || 0) + upperBoxesProduced;
        
        showToast(`Automaticky přidáno ${upperBoxesProduced} beden horních stehen na sklad.`);
    }
}