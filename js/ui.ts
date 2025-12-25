
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState, DEFAULT_NOTIFICATION_SETTINGS } from './state.ts';
import { generateId } from './utils.ts';

export const ICONS = {
    trash: `<i data-feather="trash-2"></i>`,
    edit: `<i data-feather="edit-2"></i>`,
    check: `<i data-feather="check-circle"></i>`,
    alert: `<i data-feather="alert-triangle"></i>`,
    eye: `<i data-feather="eye"></i>`,
    eyeOff: `<i data-feather="eye-off"></i>`,
    arrowUp: `<i data-feather="arrow-up"></i>`,
    arrowDown: `<i data-feather="arrow-down"></i>`,
    list: `<i data-feather="list"></i>`,
    minusCircle: `<i data-feather="minus-circle"></i>`,
    bell: `<i data-feather="bell"></i>`,
};

export let DOMElements = {};

export function initializeDOMElements() {
    // ... (same implementation as before, abbreviated) ...
    DOMElements = {
        appMain: document.getElementById('app-main'),
        navLinks: document.querySelectorAll('.nav-link'),
        selectedDateInput: document.getElementById('selectedDate'),
        // ... all modals ...
        notificationsModal: document.getElementById('notifications-modal'),
        toastContainer: document.getElementById('toast-container'),
        // ... rest
        addOrderModal: document.getElementById('add-order-modal'),
        // etc
        confirmationModal: document.getElementById('confirmation-modal'),
    };
    // Re-select all just to be safe if content changed
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(m => {
        if(m.id) DOMElements[m.id.replace(/-([a-z])/g, g => g[1].toUpperCase()) + 'Modal'] = m; // rudimentary mapping if needed, mostly we used manual mapping in original
    });
    // Manual mapping ensure (restoring previous explicit map)
    DOMElements.rizkyAddOrderModal = document.getElementById('rizky-add-order-modal');
    DOMElements.rizkyOrderListModal = document.getElementById('rizky-order-list-modal');
    DOMElements.spizyIngredientOrderModal = document.getElementById('spizy-ingredient-order-modal');
    DOMElements.spizyAddOrderModal = document.getElementById('spizy-add-order-modal');
    DOMElements.spizyStockModal = document.getElementById('spizy-stock-modal');
    DOMElements.spizyModal = document.getElementById('spizy-modal');
    DOMElements.rizkyModal = document.getElementById('rizky-modal');
    DOMElements.rizkyQuickCalcModal = document.getElementById('rizky-quick-calc-modal');
    DOMElements.wingsModal = document.getElementById('wings-modal');
    DOMElements.wingsSettingsModal = document.getElementById('wings-settings-modal');
    DOMElements.kfcStockModal = document.getElementById('kfc-stock-modal');
    DOMElements.kfcAddOrderModal = document.getElementById('kfc-add-order-modal');
    DOMElements.kfcStaffModal = document.getElementById('kfc-staff-modal');
    DOMElements.maykawaModal = document.getElementById('maykawa-modal');
    DOMElements.maykawaAddOrderModal = document.getElementById('maykawa-add-order-modal');
    DOMElements.productionActionsModal = document.getElementById('production-actions-modal');
    DOMElements.addMainOrderModal = document.getElementById('add-main-order-modal');
    DOMElements.addSurovinyModal = document.getElementById('add-suroviny-modal');
    DOMElements.addChangeModal = document.getElementById('add-change-modal');
    DOMElements.priceChangeModal = document.getElementById('price-change-modal');
    DOMElements.mixRatioModal = document.getElementById('mix-ratio-modal');
    DOMElements.addOrderModal = document.getElementById('add-order-modal');
    DOMElements.planActionModal = document.getElementById('plan-action-modal');
    DOMElements.dayDetailsModal = document.getElementById('day-details-modal');
    DOMElements.calculatorAddItemModal = document.getElementById('calculator-add-item-modal');
    DOMElements.chickenCountModal = document.getElementById('chicken-count-modal');
    DOMElements.pauseModal = document.getElementById('pause-modal');
    DOMElements.breakdownModal = document.getElementById('breakdown-modal');
    DOMElements.batchReductionModal = document.getElementById('batch-reduction-modal');
    DOMElements.surovinaOverviewModal = document.getElementById('surovina-overview-modal');
    DOMElements.preProductionModal = document.getElementById('pre-production-modal');
    DOMElements.addPreProductionModal = document.getElementById('add-pre-production-modal');
    DOMElements.calibrationSourceModal = document.getElementById('calibration-source-modal');
    DOMElements.calibrationSetupModal = document.getElementById('calibration-setup-modal');
    DOMElements.yieldSettingsModal = document.getElementById('yield-settings-modal');
    DOMElements.thighSplitSettingsModal = document.getElementById('thigh-split-settings-modal');
    DOMElements.portioningSettingsModal = document.getElementById('portioning-settings-modal');
    DOMElements.tempWeightModal = document.getElementById('temp-weight-modal');
    DOMElements.confirmationModal = document.getElementById('confirmation-modal');
    DOMElements.qrDisplayModal = document.getElementById('qr-display-modal');
    DOMElements.qrAddToStockModal = document.getElementById('qr-add-to-stock-modal');
    DOMElements.mincedMeatModal = document.getElementById('minced-meat-modal');
    DOMElements.addMincedMeatOrderModal = document.getElementById('add-minced-meat-order-modal');
    DOMElements.addMaterialEstimateModal = document.getElementById('add-material-estimate-modal');
    DOMElements.chickenEstimateModal = document.getElementById('chicken-estimate-modal');
    DOMElements.exportActionsModal = document.getElementById('export-actions-modal');
    DOMElements.surovinaShortageModal = document.getElementById('surovina-shortage-modal');
    DOMElements.shortenOrderModal = document.getElementById('shorten-order-modal');
    DOMElements.surovinaSourceModal = document.getElementById('surovina-source-modal');
    DOMElements.stockAdjustmentModal = document.getElementById('single-stock-adjustment-modal');
    DOMElements.boxSettingsModal = document.getElementById('box-settings-modal');
    DOMElements.traySettingsModal = document.getElementById('tray-settings-modal');
    DOMElements.trayStockModal = document.getElementById('tray-stock-modal');
    DOMElements.trayPalletSettingsModal = document.getElementById('tray-pallet-settings-modal');
    DOMElements.quickOrderModal = document.getElementById('quick-order-modal');
    DOMElements.frozenMainModal = document.getElementById('frozen-main-modal');
    DOMElements.addFrozenProductModal = document.getElementById('add-frozen-product-modal');
    DOMElements.addFrozenRequestModal = document.getElementById('add-frozen-request-modal');
    DOMElements.notificationsModal = document.getElementById('notifications-modal');
}

/**
 * Display a toast notification.
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'error', 'info'.
 * @param {string} category - The category of the notification (key from settings). Defaults to 'system'.
 */
export function showToast(message, type = 'success', category = 'system') {
    // 1. Resolve Settings for the category
    let settings = appState.notificationSettings?.[category];
    
    // Fallback if category doesn't exist or settings missing
    if (!settings) {
        settings = DEFAULT_NOTIFICATION_SETTINGS['system'];
    }

    // 2. Add to history regardless of enabled/disabled setting (audit trail)
    const notification = {
        id: generateId(),
        message: message,
        type: type,
        category: category,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    if (!appState.notificationsHistory) appState.notificationsHistory = [];
    appState.notificationsHistory.unshift(notification);
    
    // Limit history to 50 items
    if (appState.notificationsHistory.length > 50) {
        appState.notificationsHistory = appState.notificationsHistory.slice(0, 50);
    }
    
    saveState();

    // 3. Show visual toast only if enabled for this category
    if (settings.enabled) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? ICONS.check : (type === 'info' ? ICONS.bell : ICONS.alert);
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">${icon} <span>${message}</span></div>
            <button class="toast-close-btn" style="background: none; border: none; color: inherit; opacity: 0.7; cursor: pointer; padding: 0 0 0 10px;">
                <i data-feather="x" style="width: 16px; height: 16px;"></i>
            </button>
        `;
        
        const container = document.getElementById('toast-container');
        if (container) container.appendChild(toast);
        if (typeof feather !== 'undefined') feather.replace();

        // Close logic based on specific category duration
        const duration = settings.duration;

        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, duration * 1000);
        }

        // Manual close
        const closeBtn = toast.querySelector('.toast-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => toast.remove();
        }
    }
}
    
export function showConfirmation(message, onConfirm) {
    const modal = DOMElements.confirmationModal;
    
    modal.querySelector('.modal-body').innerHTML = `<p>${message}</p>`;
    modal.classList.add('active');

    const confirmBtn = modal.querySelector('#confirmation-confirm-btn');
    const cancelBtn = modal.querySelector('#confirmation-cancel-btn');

    const confirmHandler = () => {
        onConfirm();
        closeAndCleanup();
    };
    
    const cancelHandler = () => {
        closeAndCleanup();
    };

    function closeAndCleanup() {
        modal.classList.remove('active');
        confirmBtn.removeEventListener('click', confirmHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    }
    
    confirmBtn.addEventListener('click', confirmHandler, { once: true });
    cancelBtn.addEventListener('click', cancelHandler, { once: true });
}

let autoSaveTimer;
export function showAutoSaveNotification() {
    const indicator = document.getElementById('autosave-indicator');
    if (!indicator) return;

    // Use system category, check if enabled
    const settings = appState.notificationSettings?.['system'];
    if (settings && !settings.enabled) return;

    indicator.textContent = `✓ Uloženo ${new Date().toLocaleTimeString('cs-CZ')}`;
    indicator.classList.add('visible');

    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = setTimeout(() => {
        indicator.classList.remove('visible');
    }, 3000);
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

export function playNotificationSound(type = 'success') {
    // Sound follows system category
    const settings = appState.notificationSettings?.['system'];
    if (!settings || !settings.enabled) return;

    if (!audioContext || audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.05);


    if (type === 'success') { 
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); 
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
    } else if (type === 'warning') { 
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
    }

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}
