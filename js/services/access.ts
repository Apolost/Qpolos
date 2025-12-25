/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, showToast } from '../ui.ts';
import { render } from '../main.ts';

// A simple, dependency-free hashing function to avoid reliance on Web Crypto API (requires secure context).
// This is NOT for security, but for simple obfuscation.
function simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return '0';
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return String(hash);
}


function navigateToProductionOverview() {
    appState.ui.activeView = 'production-overview';
    render().catch(error => {
        console.error("Failed to render production overview:", error);
        const appMain = document.getElementById('app-main');
        if (appMain) {
            appMain.innerHTML = `<div class="card"><div class="card-content"><p class="shortage">Došlo k chybě při vykreslování stránky. Zkuste prosím obnovit aplikaci.</p></div></div>`;
        }
    });
}

export function handleProductionOverviewAccess() {
    if (appState.ui.isProductionOverviewUnlocked) {
        navigateToProductionOverview();
        return;
    }

    if (!appState.settings.productionPasswordHash) {
        DOMElements.setPasswordModal.classList.add('active');
        DOMElements.setPasswordModal.querySelector('#new-password').focus();
    } else {
        DOMElements.enterPasswordModal.classList.add('active');
        DOMElements.enterPasswordModal.querySelector('#login-password').focus();
    }
}

export function saveProductionPassword() {
    const newPasswordEl = DOMElements.setPasswordModal.querySelector('#new-password');
    const confirmPasswordEl = DOMElements.setPasswordModal.querySelector('#confirm-password');
    const newPassword = newPasswordEl.value;
    const confirmPassword = confirmPasswordEl.value;

    if (!newPassword) {
        showToast('Heslo nesmí být prázdné.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('Hesla se neshodují.', 'error');
        return;
    }

    appState.settings.productionPasswordHash = simpleHash(newPassword);
    saveState();
    
    appState.ui.isProductionOverviewUnlocked = true;
    showToast('Heslo bylo úspěšně nastaveno.');
    
    newPasswordEl.value = '';
    confirmPasswordEl.value = '';
    DOMElements.setPasswordModal.classList.remove('active');
    
    navigateToProductionOverview();
}
    
export function checkProductionPassword() {
    const passwordEl = DOMElements.enterPasswordModal.querySelector('#login-password');
    const password = passwordEl.value;
    const passwordHash = simpleHash(password);

    if (passwordHash === appState.settings.productionPasswordHash) {
        appState.ui.isProductionOverviewUnlocked = true;
        passwordEl.value = '';
        DOMElements.enterPasswordModal.classList.remove('active');
        navigateToProductionOverview();
    } else {
        showToast('Nesprávné heslo.', 'error');
        passwordEl.value = '';
        passwordEl.focus();
    }
}