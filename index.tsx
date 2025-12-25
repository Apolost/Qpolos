
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// @ts-nocheck
import { loadState, startAutoSave, isDirty, markAsDirty, appState } from './js/state.ts';
import { bindEvents, render, startClock, updateInfoBar, initializeNotificationInterval } from './js/main.ts';
import { initializeDOMElements } from './js/ui.ts';

async function loadModals() {
    const modalFiles = [
        'modals_general.html',
        'modals_production.html',
        'modals_orders.html',
        'modals_settings.html',
        'modals_employees.html',
        'modals_minced_meat.html',
        'modals_monthly_overview.html',
        'modals_stock.html',
        'modals_trays.html',
        'modals_changes.html',
        'modals_frozen.html',
        'modals_import.html'
    ];
    const container = document.getElementById('modals-container');
    if (!container) return;

    // Check if we are in embedded mode
    if (window.EMBEDDED_VIEWS) {
        modalFiles.forEach(file => {
            if (window.EMBEDDED_VIEWS[file]) {
                container.insertAdjacentHTML('beforeend', window.EMBEDDED_VIEWS[file]);
            }
        });
    } else {
        for (const file of modalFiles) {
            try {
                const response = await fetch(`views/${file}`);
                if (response.ok) {
                    const html = await response.text();
                    container.insertAdjacentHTML('beforeend', html);
                }
            } catch (error) {
                console.error(`Error fetching modals from ${file}:`, error);
            }
        }
    }
}

function checkAuth() {
    return sessionStorage.getItem('dzControlAuth') === 'true';
}

function showLogin() {
    const loginModal = document.getElementById('login-modal');
    const passwordInput = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const errorMsg = document.getElementById('login-error');
    
    if(!loginModal) return;

    loginModal.style.display = 'flex';
    passwordInput.value = '';
    errorMsg.style.display = 'none';
    passwordInput.focus();

    const attemptLogin = async () => {
        const val = passwordInput.value;
        if (val === '322032200') {
            sessionStorage.setItem('dzControlAuth', 'true');
            sessionStorage.setItem('dzControlRole', 'admin');
            loginModal.style.display = 'none';
            await render(); 
        } else if (val === 'Netto111') {
            sessionStorage.setItem('dzControlAuth', 'true');
            sessionStorage.setItem('dzControlRole', 'restricted');
            loginModal.style.display = 'none';
            await render();
        } else {
            errorMsg.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    };

    loginBtn.onclick = attemptLogin;
    passwordInput.onkeydown = (e) => {
        if (e.key === 'Enter') attemptLogin();
    };
}

// Main Initialization Logic
async function initApp() {
    console.log('Inicializace aplikace...');
    
    // --- APP DATA OVERRIDE (For Build) ---
    if (window.EMBEDDED_DATA && !localStorage.getItem('surovinyAppData_v13')) {
        localStorage.setItem('surovinyAppData_v13', JSON.stringify(window.EMBEDDED_DATA));
    }

    // --- SPLASH SCREEN LOGIC ---
    const splashScreen = document.getElementById('splash-screen');
    const hideSplash = () => {
        if (!checkAuth()) {
            showLogin();
        }
    };

    if (splashScreen) {
        // Force fade out
        requestAnimationFrame(() => {
            splashScreen.classList.add('fade-out');
            setTimeout(() => {
                splashScreen.style.display = 'none';
                hideSplash();
            }, 600);
        });
    } else {
        hideSplash();
    }

    // --- APP INITIALIZATION ---
    await loadModals();
    initializeDOMElements();
    loadState();
    bindEvents();
    startClock();
    initializeNotificationInterval();
    setInterval(updateInfoBar, 5000);
    startAutoSave();
    await render();
    
    if (typeof feather !== 'undefined') {
        feather.replace();
    }

    // --- UNSAVED CHANGES WARNING ---
    window.addEventListener('beforeunload', (event) => {
        if (isDirty) {
            event.preventDefault();
            event.returnValue = 'Máte neuložené změny.';
        }
    });

    document.body.addEventListener('input', () => markAsDirty());
    document.body.addEventListener('change', () => markAsDirty());

    document.body.addEventListener('appDataLoaded', () => {
        loadState();
        render();
    });
}

// Start strategy that works for both normal load and delayed bootloader load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM is already ready (Portable App scenario)
    initApp();
}
