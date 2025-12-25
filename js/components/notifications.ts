
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState, DEFAULT_NOTIFICATION_SETTINGS } from '../state.ts';
import { DOMElements, ICONS, showToast } from '../ui.ts';

let tempSettings = null;

export function openNotificationsModal() {
    // Clone current settings to temp state
    const currentSettings = appState.notificationSettings || {};
    tempSettings = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS));
    
    // Merge saved values into default structure to ensure new keys exist
    Object.keys(tempSettings).forEach(key => {
        if (currentSettings[key]) {
            tempSettings[key].enabled = currentSettings[key].enabled;
            tempSettings[key].duration = currentSettings[key].duration;
        }
    });

    renderNotificationsList();
    renderDetailedSettings();
    DOMElements.notificationsModal.classList.add('active');
}

export function saveNotificationSettings() {
    if (tempSettings) {
        appState.notificationSettings = JSON.parse(JSON.stringify(tempSettings));
        saveState();
        showToast('Nastavení upozornění bylo uloženo.', 'success', 'system');
        DOMElements.notificationsModal.classList.remove('active');
    }
}

function renderDetailedSettings() {
    const container = document.getElementById('notification-settings-table-container');
    if (!container) return;

    let html = `
        <div class="accordion nested-accordion" style="display: flex; flex-direction: column; gap: 10px;">
    `;

    Object.keys(DEFAULT_NOTIFICATION_SETTINGS).forEach(key => {
        const config = tempSettings[key];
        const isEnabled = config.enabled;
        const duration = config.duration;
        const subTypesList = config.subTypes.map(st => `<li style="font-size: 0.9rem; color: var(--text-secondary); padding: 2px 0;">• ${st}</li>`).join('');

        html += `
            <details style="background: white; border: 1px solid var(--border-color); border-radius: 8px;">
                <summary style="padding: 15px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-weight: 600; font-size: 1.05rem;">${config.label}</span>
                        <span style="font-size: 0.85rem; color: var(--text-secondary); display: none; @media(min-width: 600px){display: inline;}">${config.description}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 20px;" onclick="event.preventDefault()">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 0.85rem; margin: 0; color: var(--text-secondary);">Čas (s):</label>
                            <input type="number" min="0" class="notif-duration-input form-input" 
                                data-key="${key}" value="${duration}" 
                                placeholder="0" style="width: 60px; padding: 4px; text-align: center;">
                        </div>
                        <label class="switch" style="display: inline-flex; cursor: pointer; align-items: center; gap: 8px;">
                            <span style="font-size: 0.85rem; color: ${isEnabled ? 'var(--accent-success)' : 'var(--text-secondary)'}; font-weight: 500;">${isEnabled ? 'Zapnuto' : 'Vypnuto'}</span>
                            <input type="checkbox" class="notif-toggle-input" data-key="${key}" ${isEnabled ? 'checked' : ''} style="width: 20px; height: 20px;">
                        </label>
                        <i data-feather="chevron-down" style="width: 20px; height: 20px; color: var(--text-secondary);"></i>
                    </div>
                </summary>
                <div class="details-content" style="padding: 15px 20px; border-top: 1px solid var(--bg-tertiary); background-color: var(--bg-primary);">
                    <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">Zobrazovaná upozornění v této kategorii:</h4>
                    <ul style="list-style: none; padding: 0; columns: 2;">
                        ${subTypesList}
                    </ul>
                </div>
            </details>
        `;
    });

    html += `</div>
             <div style="margin-top: 15px; font-size: 0.85rem; color: var(--text-secondary); text-align: right;">
                * Čas 0 sekund znamená trvalé zobrazení do ručního zavření.
             </div>`;

    container.innerHTML = html;
    feather.replace();

    // Bind events to update TEMP state
    container.querySelectorAll('.notif-duration-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const key = e.target.dataset.key;
            const val = Math.max(0, parseInt(e.target.value) || 0);
            if (tempSettings[key]) tempSettings[key].duration = val;
        });
        input.addEventListener('click', (e) => e.stopPropagation()); // Prevent summary toggle
    });

    container.querySelectorAll('.notif-toggle-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const key = e.target.dataset.key;
            const isChecked = e.target.checked;
            if (tempSettings[key]) tempSettings[key].enabled = isChecked;
            
            // Update label text immediately for feedback
            const labelSpan = e.target.parentElement.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = isChecked ? 'Zapnuto' : 'Vypnuto';
                labelSpan.style.color = isChecked ? 'var(--accent-success)' : 'var(--text-secondary)';
            }
        });
        input.addEventListener('click', (e) => e.stopPropagation());
    });
}

function renderNotificationsList() {
    const listContainer = document.getElementById('notifications-list');
    if (!listContainer) return;

    if (!appState.notificationsHistory || appState.notificationsHistory.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">
                <i data-feather="bell-off" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 10px;"></i>
                <p>Žádná upozornění v historii.</p>
            </div>
        `;
        feather.replace();
        return;
    }

    let html = '';
    appState.notificationsHistory.forEach(notif => {
        const date = new Date(notif.timestamp);
        const timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('cs-CZ');
        
        let icon = ICONS.check;
        let colorClass = 'text-green-600 bg-green-50';
        let borderColor = 'border-green-200';

        if (notif.type === 'error' || notif.type === 'warning') {
            icon = ICONS.alert;
            colorClass = 'text-red-600 bg-red-50';
            borderColor = 'border-red-200';
        } else if (notif.type === 'info') {
            icon = ICONS.bell;
            colorClass = 'text-blue-600 bg-blue-50';
            borderColor = 'border-blue-200';
        }
        
        const catLabel = DEFAULT_NOTIFICATION_SETTINGS[notif.category]?.label || notif.category || 'Systém';

        html += `
            <div style="display: flex; gap: 12px; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 10px; background-color: white;">
                <div style="flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;" class="${colorClass} border ${borderColor}">
                    ${icon}
                </div>
                <div style="flex-grow: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-secondary);">${catLabel}</span>
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">${dateStr} ${timeStr}</span>
                    </div>
                    <p style="margin: 0; font-size: 0.95rem; color: var(--text-primary); line-height: 1.4;">${notif.message}</p>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;
    feather.replace();
}

export function clearNotifications() {
    appState.notificationsHistory = [];
    saveState();
    renderNotificationsList();
    showToast('Historie upozornění vymazána.', 'info', 'system');
}
