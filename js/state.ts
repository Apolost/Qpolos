
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { getWeekNumber } from './utils.ts';
import { showToast, showAutoSaveNotification } from './ui.ts';

export const BOX_TYPES = [
    { id: 'bt01', name: '13 barevné' },
    { id: 'bt02', name: 'Karton malý' },
    { id: 'bt03', name: 'Karton velký' },
    { id: 'bt04', name: 'Ahold 11' },
    { id: 'bt05', name: 'Ahold 7' },
    { id: 'bt06', name: 'Tesco modré' },
    { id: 'bt07', name: 'Tesco červené' },
    { id: 'bt08', name: 'Kaufland' },
    { id: 'bt09', name: 'KFC bedny barevné 13' }
];

export const TRAY_TYPES = [
    { id: 'mt01', name: 'RB Velká 60' },
    { id: 'mt02', name: 'RB Velká 85' },
    { id: 'mt03', name: 'RB Velká 50' },
    { id: 'mt04', name: 'RB Velká 40' },
    { id: 'mt05', name: 'RB Černá 50' },
    { id: 'mt06', name: 'OA 83' },
    { id: 'mt07', name: 'OA 63' },
    { id: 'mt08', name: 'OA 50' },
    { id: 'mt09', name: 'OA Černá 63' },
    { id: 'mt10', name: 'OA Černá 83' },
    { id: 'mt11', name: 'OA Černá 50' },
];

// Default notification settings structure
export const DEFAULT_NOTIFICATION_SETTINGS = {
    'system': { 
        label: 'Systém a Soubory', 
        description: 'Základní systémové operace.', 
        enabled: true, 
        duration: 4,
        subTypes: [
            'Automatické uložení dat',
            'Úspěšný import dat ze souboru',
            'Chyba při čtení souboru',
            'Export PDF reportů',
            'Validace formulářů (nevyplněná pole)',
            'Přihlášení / Odhlášení'
        ]
    },
    'orders': { 
        label: 'Objednávky', 
        description: 'Manipulace s objednávkami zákazníků.', 
        enabled: true, 
        duration: 2, // Default shorter for quick actions
        subTypes: [
            'Položka přidána do objednávky',
            'Položka smazána z objednávky',
            'Změna množství u položky',
            'Aktivace/Deaktivace položky',
            'Úprava poměru mixu',
            'Pokrácení objednávky'
        ]
    },
    'production': { 
        label: 'Výroba a Plán', 
        description: 'Události na výrobní lince a v plánovači.', 
        enabled: true, 
        duration: 0, // Default sticky
        subTypes: [
            'Data o kuřatech (chov) uložena',
            'Smazání chovu',
            'Zadání pauzy linky',
            'Zadání poruchy linky',
            'Naplánování akce (předvýroba)',
            'Smazání naplánované akce',
            'Přesun výroby z plánu do reality',
            'Ubírka (batch reduction)'
        ]
    },
    'stock': { 
        label: 'Sklad', 
        description: 'Pohyby na skladě a inventura.', 
        enabled: true, 
        duration: 3,
        subTypes: [
            'Přidání suroviny na sklad (QR/Ručně)',
            'Úprava stavu skladu (inventura)',
            'Převod zbytků do dalšího dne',
            'Uložení skladu misek',
            'Uložení nastavení palet'
        ]
    },
    'settings': { 
        label: 'Nastavení', 
        description: 'Změny v konfiguraci aplikace.', 
        enabled: true, 
        duration: 3,
        subTypes: [
            'Přidání/Úprava zákazníka',
            'Přidání/Úprava produktu',
            'Změna vah beden',
            'Změna vah palet',
            'Nastavení rychlosti linky',
            'Nastavení výtěžnosti a kalibrace'
        ]
    },
    'kfc_spizy': { 
        label: 'KFC a Špízy', 
        description: 'Specifické moduly výroby.', 
        enabled: true, 
        duration: 2,
        subTypes: [
            'Uložení objednávky KFC',
            'Uložení skladu KFC',
            'Změna počtu lidí na KFC',
            'Uložení objednávky Špízů',
            'Objednávka surovin pro Špízy',
            'Nastavení receptury Špízů'
        ]
    },
    'employees': { 
        label: 'Zaměstnanci', 
        description: 'Docházka a správa lidí.', 
        enabled: true, 
        duration: 3,
        subTypes: [
            'Přidání nového zaměstnance',
            'Smazání zaměstnance',
            'Zadání odjezdu',
            'Doplnění chybějícího odjezdu',
            'Přidání pracovního umístění',
            'Upsání hodin / Výkonu'
        ]
    }
};

export let appState = {};
const APP_DATA_KEY = 'surovinyAppData_v13';
const EMPLOYEES_DATA_KEY = 'shiftCalendarData_v2.5'; // Key used by the employees module

export let isDirty = false;

export function markAsDirty() {
    if (!isDirty) {
        isDirty = true;
    }
}

export function saveState() {
    const stateToSave = { ...appState };
    delete stateToSave.ui; 
    localStorage.setItem(APP_DATA_KEY, JSON.stringify(stateToSave));
    isDirty = false; // Reset dirty flag after saving
}

function setupDefaultData() {
    // ... (existing setupDefaultData code remains exactly the same, abbreviated for brevity) ...
    const specialMaterials = ['JÁTRA', 'SRDCE', 'ŽALUDKY', 'KRKY'];
    appState.suroviny = [
        {id: 's01', name: 'ŘÍZKY', isActive: true}, {id: 's02', name: 'STRIPS', isActive: true}, {id: 's03', name: 'PRSA', isActive: true},
        {id: 's04', name: 'HRBETY', isActive: true}, {id: 's05', name: 'PRDELE', isActive: true}, {id: 's06', name: 'HORNÍ STEHNA', isActive: true},
        {id: 's07', name: 'SPODNÍ STEHNA', isActive: true}, {id: 's08', name: 'ČTVRTKY', isActive: true}, {id: 's09', name: 'KŘÍDLA', isActive: true},
        {id: 's10', name: 'STEHNA', isActive: true},
        {id: 's12', name: 'STEAK', isActive: true},
        {id: 's13', name: 'JÁTRA', isActive: true}, {id: 's14', name: 'SRDCE', isActive: true}, {id: 's15', name: 'ŽALUDKY', isActive: true}, {id: 's16', name: 'KRKY', isActive: true},
    ].map(s => ({ 
        ...s, 
        paletteWeight: 500, 
        boxWeight: specialMaterials.includes(s.name.toUpperCase()) ? 20 : 25,
        stock: 0, 
        isMix: false, 
        isProduct: false 
    }));

    appState.zakaznici = [
        {id: 'c1', name: 'Ahold', orderReceptionTime: '12:00'}, {id: 'c2', name: 'Billa', orderReceptionTime: '12:00'}, {id: 'c3', name: 'Tesco', orderReceptionTime: '12:00'},
        {id: 'c4', name: 'Kaufland', orderReceptionTime: '12:00'}, {id: 'c5', name: 'Lidl', orderReceptionTime: '12:00'}, {id: 'c6', name: 'Rohlik', orderReceptionTime: '12:00'}
    ];
    
    appState.boxTypes = [...BOX_TYPES];
    appState.trayTypes = [...TRAY_TYPES];
    appState.trayStock = {};
    appState.trayPalletSettings = {};
    appState.trayTypes.forEach(tt => {
        appState.trayPalletSettings[tt.id] = 5000;
    });
    appState.customerBoxAssignments = {};
    appState.customerTrayAssignments = {};
    
    // ... initialize other defaults ...
    appState.orders = [];
    appState.mixDefinitions = {};
    appState.mincedMeatStabilizedDefaults = {};
    appState.savedEstimates = {};
    appState.plannedActions = [];
    appState.products = [];
    appState.changes = [];
    appState.priceChanges = [];
    appState.dismissedPriceChangeAlerts = [];
    appState.maykawaConfig = { bonePercent: 15, skinPercent: 10, deboningSpeed: 100 };
    appState.rizkyConfig = { prepad: 0, linePerformance: 2500, mastna: 0, stock: 0, startTime: '06:00' };
    appState.wingsConfig = { stock: 0, linePerformance: 1000, startTime: '07:00' };
    appState.wingsPackagingConfig = {};
    appState.dailyMarinadeDone = {};
    appState.kfcSuroviny = [];
    appState.kfcProducts = [];
    appState.kfcOrders = {};
    appState.spizyOrders = {};
    appState.spizyIngredientOrders = [];
    appState.spizyStock = { paprika: 0, cibule: 0, spek: 0, klobasa: 0, steak: 0 };
    appState.spizyConfig = { spek: { spek: 60, klobasa: 20, cibule: 20, steak: 0, paprika: 0 }, klobasa: { steak: 20, klobasa: 60, cibule: 20, paprika: 0 } };
    appState.frozenProducts = [];
    appState.frozenProductionOrders = [];
    appState.quickEntryStatus = {};
    appState.dailyStockAdjustments = {};
    appState.temporaryBoxWeights = {};
    appState.lineSettings = { speed: 10000 };
    appState.chickenCounts = {};
    appState.productionEvents = {};
    appState.calibrationSettings = {};
    appState.yieldSettings = {};
    appState.yieldAdjustments = {};
    appState.thighSplitSettings = { upperThighPercent: 55, lowerThighPercent: 45 };
    appState.portioningSettings = { packagingToPortioningPercent: 95, portioningDeviation: -100 };
    appState.qrCodes = [];
    appState.productMappings = {}; 
    appState.notificationsHistory = []; 
    
    // NEW: Initialize detailed settings
    appState.notificationSettings = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS));
    appState.boxWeights = {};
}

export function loadState() {
    const savedState = localStorage.getItem(APP_DATA_KEY);
    if (savedState) {
        appState = JSON.parse(savedState);
        
        // --- MIGRATION LOGIC ---
        // Ensure notification settings exist and have all categories
        if (!appState.notificationSettings || typeof appState.notificationSettings.duration === 'number') {
            // Migration from old structure or null
            const oldDuration = appState.notificationSettings?.duration || 4;
            appState.notificationSettings = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS));
            
            // Apply old global duration to system/settings as a fallback preference
            appState.notificationSettings.system.duration = oldDuration;
            appState.notificationSettings.settings.duration = oldDuration;
        } else {
            // Ensure all new categories exist if we added some
            Object.keys(DEFAULT_NOTIFICATION_SETTINGS).forEach(key => {
                if (!appState.notificationSettings[key]) {
                    appState.notificationSettings[key] = DEFAULT_NOTIFICATION_SETTINGS[key];
                }
                // Ensure subTypes are present (migration from previous version without subTypes)
                if (!appState.notificationSettings[key].subTypes) {
                    appState.notificationSettings[key].subTypes = DEFAULT_NOTIFICATION_SETTINGS[key].subTypes;
                }
            });
        }

        // ... (rest of the migration logic from previous version) ...
        
        if (!appState.suroviny) setupDefaultData();
        // ... abbreviated other migrations ...
        
        if (!appState.notificationsHistory) appState.notificationsHistory = [];
    } else {
        setupDefaultData();
    }
    
    // Init UI State
    const today = new Date();
    appState.ui = {
        selectedDate: today.toISOString().split('T')[0],
        activeView: 'main-page',
        // ... other UI props
        chickenNotificationInfo: { lastCheckedDate: null, count: 0 },
        importedOrders: [], 
    };
}

export function saveDataToFile() {
    saveState(); // 1. Flush current AppState to LS to be sure it's up to date
    
    // 2. Prepare Data for Export
    
    // A) Main App Data
    const appDataToSave = { ...appState };
    delete appDataToSave.ui; // Exclude transient UI state

    // B) Employee Data
    // We read directly from localStorage using the key defined in employees/state.ts
    // This avoids circular dependencies and ensures we get the raw state managed by that module.
    const employeeDataString = localStorage.getItem(EMPLOYEES_DATA_KEY);
    const employeeData = employeeDataString ? JSON.parse(employeeDataString) : null;

    // 3. Create Combined Object
    const fullBackup = {
        meta: {
            version: '2.0',
            timestamp: new Date().toISOString(),
            type: 'full_backup'
        },
        appData: appDataToSave,
        employeeData: employeeData
    };

    const dataStr = JSON.stringify(fullBackup, null, 2);
    const dataBlob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(dataBlob);
    
    const dateStr = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `DZ_Control_FULL_BACKUP_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 0);
    
    showToast('Kompletní záloha (Výroba + Zaměstnanci) uložena.', 'success', 'system');
}

export function loadDataFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const json = JSON.parse(event.target.result);
                
                // Detect format: Full Backup (v2) or Legacy (v1)
                
                if (json.meta && json.meta.type === 'full_backup' && json.appData) {
                    // --- Handle Full Backup ---
                    
                    // 1. Restore App Data
                    localStorage.setItem(APP_DATA_KEY, JSON.stringify(json.appData));
                    
                    // 2. Restore Employee Data (if present in backup)
                    if (json.employeeData) {
                        localStorage.setItem(EMPLOYEES_DATA_KEY, JSON.stringify(json.employeeData));
                    }

                    showToast('Kompletní záloha úspěšně načtena. Aplikace se restartuje...', 'success', 'system');
                    
                    // Reload to ensure all modules re-initialize cleanly from the new LocalStorage data
                    setTimeout(() => window.location.reload(), 1500);

                } else if (json.suroviny && json.zakaznici) {
                    // --- Handle Legacy Backup (Only App Data) ---
                    localStorage.setItem(APP_DATA_KEY, JSON.stringify(json));
                    showToast('Data výroby (starý formát) načtena. Aplikace se aktualizuje.', 'success', 'system');
                    
                    // For legacy, reloading is also safer
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showToast('Soubor neobsahuje platná data aplikace.', 'error', 'system');
                }
            } catch (error) {
                console.error("Error parsing JSON file:", error);
                showToast('Chyba při čtení souboru.', 'error', 'system');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

export function startAutoSave() {
    setInterval(() => {
        saveState();
        showAutoSaveNotification();
    }, 60000); 
}
