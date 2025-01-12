// src/utils/dismissalParser.js

const formatKey = (key) => {
    const keyMappings = {
        // Datos básicos
        'fechaIngreso': 'fechaIngreso',
        'fechaEgreso': 'fechaEgreso',
        'remuneracion': 'remuneracion',
        'folderId': 'folderId',
        'folderName': 'folderName',

        // Indemnización y períodos
        'periodos': 'Periodos',
        'indemnizacion': 'Indemnizacion',

        // Liquidación
        'preaviso': 'Preaviso',
        'integracionMes': 'Integracion Mes',
        'sacPreaviso': 'SAC s/ Preaviso',
        'sacProporcional': 'SAC proporcional',
        'diasTrabajados': 'Días Trabajados',
        'diasVacaciones': 'Días Vacaciones',
        'montoVacaciones': 'Monto Vacaciones',

        // Multas
        'multaArt1Ley25323': 'Multa Art. 1º Ley 25.323',
        'multaArt2Ley25323': 'Multa Art. 2º Ley 25.323',
        'multaArt80LCT': 'Multa Art. 80 LCT',
        'multaArt15Ley24013': 'Multa Art. 15 Ley 24.013',
        'multaArt8Ley24013': 'Multa Art. 8 Ley 24.013',
        'multaArt9Ley24013': 'Multa Art. 9 Ley 24.013',
        'multaArt10Ley24013': 'Multa Art. 10 Ley 24.013'
    };

    return keyMappings[key] || key;
};

const parseControllerResponse = (response) => {
    if (!response.success || !response.data) {
        throw new Error('Respuesta inválida del controlador');
    }

    const { data } = response;
    
    // Crear objeto base con valores por defecto
    const parsedResult = {
        // Datos básicos que siempre deberían estar presentes
        fechaIngreso: data.fechaIngreso || '',
        fechaEgreso: data.fechaEgreso || '',
        remuneracion: data.remuneracion || 0,
        folderId: data.folderId || '',
        folderName: data.folderName || '',

        // Flags de configuración
        incluirSAC: data.incluirSAC || false,
        isTopes: data.isTopes || false,
        isLiquidacion: true,
        isMultas: Boolean(Object.keys(data).some(key => key.includes('multa'))),
        
        // Arrays para marcar qué cálculos se realizaron
        liquidacion: [],
        multas: []
    };

    // Mapear los resultados calculados
    Object.entries(data).forEach(([key, value]) => {
        const formattedKey = formatKey(key);
        
        // Agregar el valor al resultado
        if (value !== null && value !== undefined) {
            parsedResult[formattedKey] = value;
        }

        // Actualizar arrays de liquidación y multas según los cálculos presentes
        if (key === 'preaviso') parsedResult.liquidacion.push('preaviso');
        if (key === 'integracionMes') parsedResult.liquidacion.push('integracionMes');
        if (key === 'sacPreaviso') parsedResult.liquidacion.push('sacPreaviso');
        if (key === 'sacProporcional') parsedResult.liquidacion.push('sacProp');
        if (key === 'diasTrabajados') parsedResult.liquidacion.push('diasTrabajados');
        if (key === 'diasVacaciones' || key === 'montoVacaciones') {
            if (!parsedResult.liquidacion.includes('vacaciones')) {
                parsedResult.liquidacion.push('vacaciones');
            }
        }

        // Actualizar array de multas
        if (key === 'multaArt1Ley25323') parsedResult.multas.push('multaArt1');
        if (key === 'multaArt2Ley25323') parsedResult.multas.push('multaArt2');
        if (key === 'multaArt80LCT') parsedResult.multas.push('multaArt80');
        if (key === 'multaArt15Ley24013') parsedResult.multas.push('multaArt15');
    });

    return parsedResult;
};

// Ejemplo de uso:
/*
const controllerResponse = {
    success: true,
    data: {
        folderId: "12345",
        fechaIngreso: "2020-01-01",
        fechaEgreso: "2023-12-31",
        remuneracion: 150000,
        periodos: 4,
        indemnizacion: 675000,
        preaviso: 337500,
        integracionMes: 82258.06,
        sacPreaviso: 28125,
        sacProporcional: 75000,
        diasTrabajados: 145161.29,
        diasVacaciones: 21,
        montoVacaciones: 126000,
        multaArt1Ley25323: 337500,
        multaArt2Ley25323: 675000,
        multaArt80LCT: 450000
    }
};

const parsedResult = parseControllerResponse(controllerResponse);
console.log(parsedResult);
*/

// Test de la función
const testParser = () => {
    const testResponse = {
        success: true,
        data: {
            fechaIngreso: "2020-01-01",
            fechaEgreso: "2023-12-31",
            remuneracion: 150000,
            periodos: 4,
            indemnizacion: 675000,
            preaviso: 337500
        }
    };

    const expected = {
        fechaIngreso: "2020-01-01",
        fechaEgreso: "2023-12-31",
        remuneracion: 150000,
        folderId: "",
        folderName: "",
        incluirSAC: false,
        isTopes: false,
        isLiquidacion: true,
        isMultas: false,
        liquidacion: ["preaviso"],
        multas: [],
        Periodos: 4,
        Indemnizacion: 675000,
        Preaviso: 337500
    };

    const result = parseControllerResponse(testResponse);
    console.assert(
        JSON.stringify(result) === JSON.stringify(expected),
        'Test fallido: La salida no coincide con lo esperado'
    );
};

module.exports = {
    parseControllerResponse,
    testParser
};