// src/utils/messageFormatter.js

const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    }).format(value);
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR');
};

const formatValue = (key, value) => {
    // Si es una fecha
    if (key.toLowerCase().includes('fecha')) {
        return formatDate(value);
    }
    // Si es períodos o días
    if (key === 'Periodos' || key.includes('Días')) {
        return Number(value).toFixed(2);
    }
    // Si es un número (asumimos que es moneda)
    if (typeof value === 'number') {
        return formatCurrency(value);
    }
    return value;
};

const formatMessageForMessenger = (parsedResult) => {
    let message = '📊 *LIQUIDACIÓN POR DESPIDO*\n\n';

    // Datos básicos
    message += '📋 *DATOS BÁSICOS*\n';
    if (parsedResult.fechaIngreso) {
        message += `▫️ Fecha de Ingreso: ${formatDate(parsedResult.fechaIngreso)}\n`;
    }
    if (parsedResult.fechaEgreso) {
        message += `▫️ Fecha de Egreso: ${formatDate(parsedResult.fechaEgreso)}\n`;
    }
    if (parsedResult.remuneracion) {
        message += `▫️ Remuneración: ${formatCurrency(parsedResult.remuneracion)}\n`;
    }
    message += '\n';

    // Indemnización
    if (parsedResult.Periodos || parsedResult.Indemnizacion) {
        message += '💰 *INDEMNIZACIÓN*\n';
        if (parsedResult.Periodos) {
            message += `▫️ Períodos: ${parsedResult.Periodos}\n`;
        }
        if (parsedResult.Indemnizacion) {
            message += `▫️ Monto: ${formatCurrency(parsedResult.Indemnizacion)}\n`;
        }
        message += '\n';
    }

    // Liquidación Final
    const liquidacionKeys = [
        'Preaviso',
        'Integracion Mes',
        'SAC s/ Preaviso',
        'SAC proporcional',
        'Días Trabajados',
        'Días Vacaciones',
        'Monto Vacaciones'
    ];

    const hasLiquidacion = liquidacionKeys.some(key => parsedResult[key]);
    
    if (hasLiquidacion) {
        message += '📝 *LIQUIDACIÓN FINAL*\n';
        liquidacionKeys.forEach(key => {
            if (parsedResult[key]) {
                message += `▫️ ${key}: ${formatValue(key, parsedResult[key])}\n`;
            }
        });
        message += '\n';
    }

    // Multas
    const multasKeys = [
        'Multa Art. 1º Ley 25.323',
        'Multa Art. 2º Ley 25.323',
        'Multa Art. 80 LCT',
        'Multa Art. 15 Ley 24.013',
        'Multa Art. 8 Ley 24.013',
        'Multa Art. 9 Ley 24.013',
        'Multa Art. 10 Ley 24.013'
    ];

    const hasMultas = multasKeys.some(key => parsedResult[key]);
    
    if (hasMultas) {
        message += '⚖️ *MULTAS*\n';
        multasKeys.forEach(key => {
            if (parsedResult[key]) {
                message += `▫️ ${key}: ${formatCurrency(parsedResult[key])}\n`;
            }
        });
        message += '\n';
    }

    // Calcular total
    const total = Object.entries(parsedResult)
        .reduce((sum, [key, value]) => {
            if (typeof value === 'number' && 
                key !== 'remuneracion' && 
                key !== 'Periodos' && 
                !key.includes('Días')) {
                return sum + value;
            }
            return sum;
        }, 0);

    // Agregar total
    message += '🔢 *TOTAL*\n';
    message += `💵 ${formatCurrency(total)}\n\n`;

    // Agregar pie de mensaje
    message += '📱 Generado por Law||Analytics';

    return message;
};

// Ejemplo de uso:
/*
const parsedResult = {
    fechaIngreso: "2020-01-01",
    fechaEgreso: "2023-12-31",
    remuneracion: 150000,
    Periodos: 4,
    Indemnizacion: 675000,
    "Preaviso": 337500,
    "Integracion Mes": 82258.06,
    "SAC s/ Preaviso": 28125,
    "SAC proporcional": 75000,
    "Días Trabajados": 145161.29,
    "Días Vacaciones": 21,
    "Monto Vacaciones": 126000,
    "Multa Art. 1º Ley 25.323": 337500,
    "Multa Art. 2º Ley 25.323": 675000,
    "Multa Art. 80 LCT": 450000
};

const message = formatMessageForMessenger(parsedResult);
console.log(message);

// Resultado:
📊 *LIQUIDACIÓN POR DESPIDO*

📋 *DATOS BÁSICOS*
▫️ Fecha de Ingreso: 1/1/2020
▫️ Fecha de Egreso: 31/12/2023
▫️ Remuneración: $ 150.000,00

💰 *INDEMNIZACIÓN*
▫️ Períodos: 4
▫️ Monto: $ 675.000,00

📝 *LIQUIDACIÓN FINAL*
▫️ Preaviso: $ 337.500,00
▫️ Integración Mes: $ 82.258,06
▫️ SAC s/ Preaviso: $ 28.125,00
▫️ SAC proporcional: $ 75.000,00
▫️ Días Trabajados: $ 145.161,29
▫️ Días Vacaciones: 21,00
▫️ Monto Vacaciones: $ 126.000,00

⚖️ *MULTAS*
▫️ Multa Art. 1º Ley 25.323: $ 337.500,00
▫️ Multa Art. 2º Ley 25.323: $ 675.000,00
▫️ Multa Art. 80 LCT: $ 450.000,00

🔢 *TOTAL*
💵 $ 2.931.544,35

📱 Generado por Law||Analytics
*/

module.exports = {
    formatMessageForMessenger
};