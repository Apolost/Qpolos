/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, showToast, showConfirmation } from '../ui.ts';
import { generateId } from '../utils.ts';

let videoStream = null;
let videoElement = null;
let scanAnimationId = null;

function renderQrCodeList() {
    const tableBody = document.querySelector('#qr-code-list-table tbody');
    if (!tableBody) return;

    // Sort by creation date, newest first
    const sortedCodes = [...(appState.qrCodes || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (sortedCodes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nebyly vygenerovány žádné QR kódy.</td></tr>';
        return;
    }

    tableBody.innerHTML = sortedCodes.map(code => {
        const createdAt = new Date(code.createdAt).toLocaleString('cs-CZ');
        const assignedAt = code.assignedAt ? new Date(code.assignedAt).toLocaleString('cs-CZ') : '-';
        let statusBadge = '';
        if (code.status === 'active') {
            statusBadge = `<span style="background-color: var(--accent-success); color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8em;">Aktivní</span>`;
        } else {
            statusBadge = `<span style="background-color: var(--text-secondary); color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8em;">Neaktivní</span>`;
        }

        return `
            <tr>
                <td>${createdAt}</td>
                <td>${statusBadge}</td>
                <td>${code.assignedSurovinaName || '-'}</td>
                <td>${assignedAt}</td>
                <td class="actions">
                    <button class="btn-icon" data-action="show-qr-code" data-id="${code.id}" title="Zobrazit QR kód"><i data-feather="eye"></i></button>
                    <button class="btn-icon" data-action="print-qr-code" data-id="${code.id}" data-surovina-name="${code.assignedSurovinaName || ''}" title="Tisk QR kódu"><i data-feather="printer"></i></button>
                    <button class="btn-icon danger" data-action="delete-qr-code" data-id="${code.id}" title="Smazat QR kód"><i data-feather="trash-2"></i></button>
                </td>
            </tr>
        `;
    }).join('');
    feather.replace();
}

function stopScanLogic() {
    if (scanAnimationId) {
        cancelAnimationFrame(scanAnimationId);
        scanAnimationId = null;
    }
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    if (videoElement) {
        videoElement.style.display = 'none';
        videoElement.srcObject = null;
    }
    appState.ui.qrScanningContext = { mode: 'none', surovinaId: null, surovinaName: null };
}

function onQrCodeScanned(code) {
    const data = code.data;
    const resultEl = document.getElementById('qr-result');
    resultEl.textContent = `Nalezen kód: ${data}`;

    const { mode, surovinaId, surovinaName } = appState.ui.qrScanningContext;
    const qrCode = appState.qrCodes.find(c => c.id === data);

    if (mode === 'remove') {
        if (qrCode) {
            appState.qrCodes = appState.qrCodes.filter(c => c.id !== data);
            saveState();
            renderQrCodeList();
            showToast(`QR kód ${data} byl odebrán ze seznamu.`);
        } else {
            showToast('Tento QR kód nebyl nalezen v seznamu.', 'error');
        }
    } else if (mode === 'add') {
        if (qrCode) {
            if (qrCode.status === 'active') {
                showToast(`Chyba: QR kód ${data} je již aktivní.`, 'error');
            } else {
                qrCode.status = 'active';
                qrCode.assignedSurovinaId = surovinaId;
                qrCode.assignedSurovinaName = surovinaName;
                qrCode.assignedAt = new Date().toISOString();

                const surovina = appState.suroviny.find(s => s.id === surovinaId);
                if (surovina) {
                    surovina.stock = (surovina.stock || 0) + 1; // Add one palette
                    saveState();
                    renderQrCodeList();
                    showToast(`Paleta suroviny "${surovinaName}" byla přidána na sklad.`, 'success');
                } else {
                    showToast('Chyba: Surovina pro přiřazení nebyla nalezena.', 'error');
                }
            }
        } else {
            showToast('Naskenovaný QR kód není platný kód z tohoto systému.', 'error');
        }
    } else {
        return; // In idle mode, just display the result, do nothing else.
    }
    
    // After a successful action, stop the scan and reset UI
    handleStopQrScan();
}

function tick() {
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        const canvasElement = document.createElement('canvas');
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        const canvas = canvasElement.getContext('2d');
        canvas.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });

        if (code) {
            onQrCodeScanned(code);
            return; // Stop scanning after a successful scan
        }
    }
    scanAnimationId = requestAnimationFrame(tick);
}

async function startScanLogic() {
    const startBtn = document.getElementById('start-scan-btn');
    const stopBtn = document.getElementById('stop-scan-btn');
    const scanningUi = document.getElementById('scanning-ui');
    const instructions = document.getElementById('qr-instructions');
    const resultEl = document.getElementById('qr-result');
    videoElement = document.getElementById('qr-video');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        instructions.textContent = 'Chyba: Váš prohlížeč nepodporuje přístup ke kameře.';
        return;
    }

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        videoElement.srcObject = videoStream;
        videoElement.style.display = 'block';
        videoElement.onloadedmetadata = () => videoElement.play();

        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-flex';
        scanningUi.style.display = 'block';
        instructions.textContent = 'Vyberte akci níže.';
        document.getElementById('scan-mode-title').textContent = 'Skenování aktivní';
        resultEl.textContent = 'Čeká se na skenování...';
        
        // Start the scanning loop
        scanAnimationId = requestAnimationFrame(tick);
        
    } catch (err) {
        console.error("Error accessing camera: ", err);
        instructions.textContent = 'Chyba: Nepodařilo se získat přístup ke kameře. Zkontrolujte oprávnění.';
    }
}

// --- Public Handlers ---

export function renderQrCodePage() {
    renderQrCodeList();
    // Ensure scanner is off when navigating to the page
    if (videoStream) {
        handleStopQrScan();
    }
}

export function handleGenerateQrCode() {
    const newId = generateId();
    const newCode = {
        id: newId,
        createdAt: new Date().toISOString(),
        status: 'inactive',
        assignedSurovinaId: null,
        assignedSurovinaName: null,
        assignedAt: null,
    };

    if (!appState.qrCodes) appState.qrCodes = [];
    appState.qrCodes.push(newCode);
    saveState();
    renderQrCodeList();
    
    // Display the generated QR code in a modal
    const modal = DOMElements.qrDisplayModal;
    const canvas = modal.querySelector('#qr-canvas');
    const title = modal.querySelector('.modal-title');
    title.textContent = 'Vygenerovaný QR Kód';
    window.QRCode.toCanvas(canvas, newId, { width: 300 }, function (error) {
        if (error) console.error(error);
        modal.querySelector('#qr-data-text').textContent = newId;
        modal.classList.add('active');
    });
}

export function handleStartQrScan() {
    appState.ui.qrScanningContext.mode = 'idle';
    startScanLogic();
}

export function handleStopQrScan() {
    stopScanLogic();
    const startBtn = document.getElementById('start-scan-btn');
    const stopBtn = document.getElementById('stop-scan-btn');
    const scanningUi = document.getElementById('scanning-ui');
    
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
    if (scanningUi) scanningUi.style.display = 'none';
}

export function handleScanForRemoval() {
    appState.ui.qrScanningContext.mode = 'remove';
    document.getElementById('scan-mode-title').textContent = 'Skenování pro odebrání';
    document.getElementById('qr-instructions').textContent = 'Namiřte kameru na QR kód, který chcete odebrat ze seznamu.';
    showToast('Režim odebrání aktivní. Naskenujte kód.');
}

export function handleStartAddToStock() {
    const modal = DOMElements.qrAddToStockModal;
    const listContainer = modal.querySelector('#qr-add-to-stock-surovina-list');
    
    const surovinyToAdd = ['SPODNÍ STEHNA', 'HORNÍ STEHNA', 'ŘÍZKY', 'ČTVRTKY'];
    const suroviny = appState.suroviny.filter(s => surovinyToAdd.includes(s.name.toUpperCase()));

    listContainer.innerHTML = suroviny.map(s => 
        `<button class="btn btn-secondary" style="width: 100%;" data-action="select-surovina-for-qr" data-surovina-id="${s.id}" data-surovina-name="${s.name}">${s.name}</button>`
    ).join('');

    modal.classList.add('active');
}

export function handleSelectSurovinaForQr(surovinaId, surovinaName) {
    appState.ui.qrScanningContext = {
        mode: 'add',
        surovinaId,
        surovinaName
    };
    DOMElements.qrAddToStockModal.classList.remove('active');
    document.getElementById('scan-mode-title').textContent = `Přidat na sklad: ${surovinaName}`;
    document.getElementById('qr-instructions').textContent = `Namiřte kameru na QR kód pro přidání palety suroviny ${surovinaName}.`;
    showToast(`Režim přidání aktivní pro ${surovinaName}.`);
}

export function handleShowQrCode(qrId) {
    const code = appState.qrCodes.find(c => c.id === qrId);
    if (!code) {
        showToast('QR kód nebyl nalezen.', 'error');
        return;
    }

    const modal = DOMElements.qrDisplayModal;
    const canvas = modal.querySelector('#qr-canvas');
    const title = modal.querySelector('.modal-title');
    
    title.textContent = 'Zobrazení QR Kódu';
    window.QRCode.toCanvas(canvas, code.id, { width: 300 }, function (error) {
        if (error) console.error(error);
        modal.querySelector('#qr-data-text').textContent = code.id;
        modal.classList.add('active');
    });
}

export function handleDeleteQrCode(qrId) {
    const code = appState.qrCodes.find(c => c.id === qrId);
    if (!code) return;

    showConfirmation(`Opravdu chcete smazat QR kód "${qrId}"?`, () => {
        appState.qrCodes = appState.qrCodes.filter(c => c.id !== qrId);
        saveState();
        renderQrCodeList();
        showToast('QR kód byl smazán.', 'success');
    });
}

export function handlePrintQrCode(qrId, surovinaName) {
    const code = appState.qrCodes.find(c => c.id === qrId);
    if (!code) {
        showToast('QR kód nebyl nalezen.', 'error');
        return;
    }
    
    const printArea = document.getElementById('print-area');
    const printCanvas = document.getElementById('print-qr-canvas');
    const printTitle = document.getElementById('print-qr-title');
    const printId = document.getElementById('print-qr-id');
    
    if (!printArea || !printCanvas || !printTitle || !printId) {
        console.error('Print elements not found in DOM.');
        showToast('Chyba při přípravě tisku.', 'error');
        return;
    }

    printTitle.textContent = code.assignedSurovinaName || 'Nezařazeno';
    printId.textContent = code.id;

    window.QRCode.toCanvas(printCanvas, code.id, { width: 300, margin: 2 }, function (error) {
        if (error) {
            console.error(error);
            showToast('Nepodařilo se vygenerovat QR kód pro tisk.', 'error');
            return;
        }
        
        // Use a short timeout to ensure the canvas has rendered before printing
        setTimeout(() => {
            window.print();
        }, 100);
    });
}