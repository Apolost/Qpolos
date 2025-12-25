
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState } from '../state.ts';
import { showToast } from '../ui.ts';

// Seznam všech souborů aplikace. Je nutné udržovat aktuální.
const APP_FILES = [
    'index.tsx',
    'js/state.ts',
    'js/ui.ts',
    'js/utils.ts',
    'js/main.ts',
    'js/eventHandler.ts',
    'js/services/calculations.ts',
    'js/services/production.ts',
    'js/services/access.ts',
    'js/services/build.ts',
    'js/components/mainPage.ts',
    'js/components/dailyPlan.ts',
    'js/components/orders.ts',
    'js/components/calendar.ts',
    'js/components/kfc.ts',
    'js/components/changes.ts',
    'js/components/spizy.ts',
    'js/components/modals.ts',
    'js/components/calculator.ts',
    'js/components/productionOverview.ts',
    'js/components/rawMaterialOrders.ts',
    'js/components/qrCode.ts',
    'js/components/stock.ts',
    'js/components/export.ts',
    'js/components/monthlyOverview.ts',
    'js/components/frozenProducts.ts',
    'js/components/frozen.ts',
    'js/components/importOrders.ts',
    'js/components/employees.ts',
    'js/components/weeklyOverview.ts',
    'js/components/wheelchair.ts',
    'js/settings/products.ts',
    'js/settings/mixes.ts',
    'js/settings/boxWeights.ts',
    'js/settings/paletteWeights.ts',
    'js/settings/customers.ts',
    'js/settings/lineSettings.ts',
    'js/employees/state.ts',
    'js/employees/ui.ts',
    'js/employees/modules/general.ts',
    'js/employees/modules/scheduling.ts',
    'js/employees/modules/hours.ts',
    'js/employees/modules/export.ts'
];

/**
 * Pomocná funkce pro bezpečné kódování Unicode stringů do Base64
 */
function utf8_to_b64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}

/**
 * Tato funkce vytvoří kompletní kopii aplikace v jednom HTML souboru.
 */
export async function buildSingleHtmlApp() {
    showToast('Zahajuji sestavování aplikace...', 'info');
    const startBtn = document.querySelector('button[data-action="build-app-html"]');
    const originalBtnText = startBtn ? startBtn.innerHTML : '';
    
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = `<i data-feather="loader" class="spin"></i> Pracuji...`;
        if (typeof feather !== 'undefined') feather.replace();
    }

    try {
        // 1. Získání základního HTML (index.html)
        const indexResponse = await fetch('index.html');
        if (!indexResponse.ok) throw new Error("Nelze načíst index.html");
        let html = await indexResponse.text();

        // 2. Načtení všech CSS
        // Zkoušíme načíst rozdělené CSS soubory podle index.html, nebo fallback na index.css
        const cssFiles = ['css/core.css', 'css/components.css', 'css/views.css'];
        let combinedCss = '';
        
        // Zkusíme načíst index.css jako fallback, pokud existuje
        try {
            const indexCssRes = await fetch('index.css');
            if (indexCssRes.ok) combinedCss += await indexCssRes.text() + '\n';
        } catch (e) { console.log('index.css nenalezen, pokračuji...'); }

        for (const file of cssFiles) {
            try {
                const res = await fetch(file);
                if (res.ok) combinedCss += await res.text() + '\n';
            } catch (e) {
                console.warn(`CSS soubor ${file} se nepodařilo načíst.`);
            }
        }

        // 3. Načtení všech Views (HTML šablony)
        const viewFiles = [
            'main-page.html', 'daily-plan.html', 'orders.html', 'calendar.html', 
            'kfc.html', 'zmeny.html', 'calculator.html', 'production-overview.html', 
            'raw-material-orders.html', 'qr-code.html', 'export-data.html', 
            'monthly-overview.html', 'stock-boxes.html', 'stock-trays.html', 
            'customers.html', 'create-product.html', 'create-mix.html', 
            'frozen-products.html', 'box-weights.html', 'palette-weights.html', 
            'spizy-settings.html', 'kfc-products.html', 'line-settings.html',
            'employees.html', 'weekly-overview.html', 'wheelchair-calendar.html',
            'modals_general.html', 'modals_production.html', 'modals_orders.html',
            'modals_settings.html', 'modals_employees.html', 'modals_minced_meat.html',
            'modals_monthly_overview.html', 'modals_stock.html', 'modals_trays.html',
            'modals_changes.html', 'modals_frozen.html', 'modals_import.html'
        ];

        let embeddedViews = {};
        for (const file of viewFiles) {
            const path = `views/${file}`;
            try {
                const res = await fetch(path);
                if (res.ok) {
                    const content = await res.text();
                    embeddedViews[file] = content;
                    // Pro zpětnou kompatibilitu uložíme i bez přípony, pokud to není modal
                    const nameOnly = file.replace('.html', '');
                    if (!file.startsWith('modals_')) {
                        embeddedViews[nameOnly] = content;
                    }
                }
            } catch (e) {
                console.warn(`View ${file} se nepodařilo načíst.`);
            }
        }

        // 4. Načtení TypeScript kompilátoru (pro offline použití)
        showToast('Stahuji kompilátor (toto může chvíli trvat)...', 'info');
        let tsCompilerCode = '';
        try {
            // Používáme specifickou verzi pro stabilitu
            const tsRes = await fetch('https://unpkg.com/typescript@5.3.3/lib/typescript.js');
            if (tsRes.ok) {
                tsCompilerCode = await tsRes.text();
            } else {
                throw new Error("Nepodařilo se stáhnout TypeScript kompilátor.");
            }
        } catch (e) {
            console.error(e);
            throw new Error("Chyba při stahování kompilátoru. Zkontrolujte připojení k internetu.");
        }

        // 5. Načtení a zakódování zdrojových kódů aplikace
        showToast('Balím zdrojové kódy...', 'info');
        const sourceFilesMap = {};
        for (const file of APP_FILES) {
            try {
                const res = await fetch(file);
                if (res.ok) {
                    const content = await res.text();
                    sourceFilesMap[file] = utf8_to_b64(content);
                } else {
                    console.warn(`Soubor ${file} nebyl nalezen.`);
                }
            } catch (e) {
                console.warn(`Chyba při čtení ${file}:`, e);
            }
        }

        // 6. Modifikace HTML
        
        // a) Vložení CSS
        html = html.replace(/<link rel="stylesheet" href="css\/core\.css">/, `<style>${combinedCss}</style>`);
        html = html.replace(/<link rel="stylesheet" href="css\/components\.css">/, '');
        html = html.replace(/<link rel="stylesheet" href="css\/views\.css">/, '');

        // b) Odstranění Splash Screenu (v přenosné verzi často ruší nebo se zasekává)
        html = html.replace(/<div id="splash-screen">[\s\S]*?<\/div>/, '');

        // c) Odstranění původních skriptů
        html = html.replace(/<script type="module" src="index\.tsx"><\/script>/, '');
        // Odstraníme i případné další externí skripty, které nahrazujeme (např. sheetjs, jspdf pokud bychom je bundlovali, ale ty necháváme CDN pro úsporu místa, pokud uživatel nechce full offline)
        // Pro TS kompilátor:
        html = html.replace(/<script src="https:\/\/unpkg\.com\/typescript@.*?"><\/script>/, ''); 

        // d) Příprava dat pro vložení (Base64)
        const encodedData = utf8_to_b64(JSON.stringify(appState));
        const encodedViews = utf8_to_b64(JSON.stringify(embeddedViews));
        const encodedSources = JSON.stringify(sourceFilesMap); 

        // e) Vložení Bootloaderu
        const bootloader = `
            <!-- EMBEDDED TYPESCRIPT COMPILER -->
            <script>${tsCompilerCode}</script>

            <!-- APPLICATION BOOTLOADER -->
            <script>
                // Helper to decode Base64 UTF-8
                function b64_to_utf8(str) {
                    return decodeURIComponent(escape(window.atob(str)));
                }

                // 1. Load Data & Views
                try {
                    window.EMBEDDED_DATA = JSON.parse(b64_to_utf8("${encodedData}"));
                    window.EMBEDDED_VIEWS = JSON.parse(b64_to_utf8("${encodedViews}"));
                } catch(e) { console.error("Error loading embedded data", e); }

                // 2. Load Sources
                const sources = ${encodedSources};

                // Path resolution helper
                function resolvePath(currentFile, importPath) {
                    if (!importPath.startsWith('.')) return importPath; 
                    
                    const currentParts = currentFile.split('/');
                    currentParts.pop(); // remove filename
                    
                    const importParts = importPath.split('/');
                    
                    for (const part of importParts) {
                        if (part === '.') continue;
                        if (part === '..') {
                            if (currentParts.length > 0) currentParts.pop();
                        } else {
                            currentParts.push(part);
                        }
                    }
                    return currentParts.join('/');
                }

                (function startApp() {
                    if (!window.ts) {
                        console.error("TypeScript compiler not loaded!");
                        document.body.innerHTML = '<div style="padding: 20px; color: red;">Chyba: Kompilátor se nenačetl.</div>';
                        return;
                    }

                    console.log("Compiling application...");
                    const importMap = { imports: {} };
                    
                    // A. Compile & Rewrite Imports
                    for (const [filename, b64Content] of Object.entries(sources)) {
                        try {
                            const tsCode = b64_to_utf8(b64Content);
                            
                            // Transpile TS -> JS
                            let jsCode = window.ts.transpile(tsCode, { 
                                target: window.ts.ScriptTarget.ES2020, 
                                module: window.ts.ModuleKind.ESNext 
                            });

                            // Rewrite relative imports to absolute keys
                            // Regex upraven pro lepší zachycení mezer
                            jsCode = jsCode.replace(/(import\s+.*?from\s+['"])(.*?)(['"])|(import\s+['"])(.*?)(['"])/g, (match, p1, p2, p3, p4, p5, p6) => {
                                const prefix = p1 || p4;
                                const path = p2 || p5;
                                const suffix = p3 || p6;
                                
                                if (path.startsWith('.')) {
                                    let resolved = resolvePath(filename, path);
                                    // Pokud cesta nekončí na .ts nebo .js, zkusíme přidat .ts (protože klíče v sources mají .ts)
                                    // Ale importMap klíče budou mít přesnou shodu.
                                    // Zde raději necháme resolved cestu, import map to vyřeší.
                                    return prefix + resolved + suffix;
                                }
                                return match;
                            });

                            // Create Blob
                            const blob = new Blob([jsCode], { type: 'text/javascript' });
                            const blobUrl = URL.createObjectURL(blob);
                            
                            // Add to ImportMap
                            // 1. Map full filename (e.g. "js/main.ts")
                            importMap.imports[filename] = blobUrl;
                            
                            // 2. Map without extension (e.g. "js/main" -> for imports like "./main")
                            if (filename.endsWith('.ts')) {
                                const noExt = filename.replace(/\.ts$/, '');
                                importMap.imports[noExt] = blobUrl;
                                // Také mapovat s ./ prefixem pro jistotu
                                importMap.imports['./' + noExt] = blobUrl;
                            }
                            // 3. Map simple root imports if needed
                            if (filename === 'index.tsx') {
                                importMap.imports['index.tsx'] = blobUrl;
                                importMap.imports['./index.tsx'] = blobUrl;
                            }

                        } catch (err) {
                            console.error("Error compiling " + filename, err);
                        }
                    }

                    // B. Inject ImportMap
                    const mapEl = document.createElement('script');
                    mapEl.type = 'importmap';
                    mapEl.textContent = JSON.stringify(importMap);
                    document.head.appendChild(mapEl);

                    // C. Start Entry Point
                    console.log("Starting app...");
                    const entry = document.createElement('script');
                    entry.type = 'module';
                    // Importujeme index.tsx. ImportMap se postará o nalezení Blob URL.
                    entry.textContent = "import 'index.tsx';";
                    document.body.appendChild(entry);
                })();
            </script>
        `;
        
        // Vložení bootloaderu
        html = html.replace('</body>', () => `${bootloader}</body>`);

        // 7. Stažení souboru
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url;
        a.download = `DZ_Control_Portable_${timestamp}.html`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        showToast('Aplikace byla sestavena a stažena.', 'success');

    } catch (err) {
        console.error(err);
        showToast('Chyba při sestavování aplikace: ' + err.message, 'error');
    } finally {
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = originalBtnText;
            if (typeof feather !== 'undefined') feather.replace();
        }
    }
}
