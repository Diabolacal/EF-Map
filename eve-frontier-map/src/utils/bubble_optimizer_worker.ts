// src/utils/bubble_optimizer_worker.ts

importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js");

let pyodide: any = null;
let calculateBaselineRoutePy: any = null;
let runIterativePassPy: any = null;

const METERS_PER_LY_FACTOR = 9_460_730_472_580_800;

async function initializePyodide() {
    if (pyodide) {
        return;
    }
    pyodide = await (self as any).loadPyodide();

    const response = await fetch('/optimizer_core.py');
    const pythonCode = await response.text();
    pyodide.runPython(pythonCode);

    calculateBaselineRoutePy = pyodide.globals.get('calculate_baseline_route');
    runIterativePassPy = pyodide.globals.get('run_iterative_pass');

    self.postMessage({ type: 'ready' });
}

function reverseTransformCoordinates(position: { x: number; y: number; z: number; }) {
    const x_original_ly = position.x;
    const y_original_ly = -position.z;
    const z_original_ly = position.y;

    const x_meter = x_original_ly * METERS_PER_LY_FACTOR;
    const y_meter = y_original_ly * METERS_PER_LY_FACTOR;
    const z_meter = z_original_ly * METERS_PER_LY_FACTOR;

    return { x: x_meter, y: y_meter, z: z_meter };
}

self.onmessage = async (event: MessageEvent) => {
    const { id, action, payload } = event.data;

    if (action === 'runCalculation') {
        const { path, systemsData, timePerPass, isBaseline, startSystemName } = payload;

        try {
            if (!pyodide || !calculateBaselineRoutePy || !runIterativePassPy) {
                throw new Error("Pyodide or Python functions not initialized.");
            }

            const transformedSystemsData: { [key: string]: { x: number; y: number; z: number } } = {};
            for (const systemName in systemsData) {
                const system = systemsData[systemName];
                transformedSystemsData[system.name] = reverseTransformCoordinates(system.position);
            }

            let result;
            if (isBaseline) {
                result = calculateBaselineRoutePy(path, transformedSystemsData, startSystemName);
            } else {
                result = runIterativePassPy(path, transformedSystemsData, timePerPass);
            }

            const resultJS = result.toJs({ dict_converter: Object.fromEntries });

            if (resultJS.distance !== undefined) {
                resultJS.distance_ly = resultJS.distance / METERS_PER_LY_FACTOR;
            }

            self.postMessage({ type: 'result', id: id, result: resultJS });

        } catch (error: any) {
            self.postMessage({ type: 'error', id: id, error: error.message });
        }
    }
};

initializePyodide();