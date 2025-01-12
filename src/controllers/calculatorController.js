const moment = require('moment');

// Auxiliary functions
const calcularPeriodos = (fechaIngreso, fechaEgreso) => {
    if (!fechaIngreso || !fechaEgreso) return 0;

    const inicio = moment(fechaIngreso);
    const fin = moment(fechaEgreso);

    const años = fin.diff(inicio, 'years');
    const mesesRestantes = fin.subtract(años, 'years').diff(inicio, 'months');

    return mesesRestantes > 3 ? años + 1 : años;
};

const calcularPreaviso = (fechaIngreso, fechaEgreso, remuneracion) => {
    if (!fechaIngreso || !fechaEgreso) return 0;

    const inicio = moment(fechaIngreso);
    const fin = moment(fechaEgreso);

    const periodoPrueba = 3;
    const mesesTotal = fin.diff(inicio, 'months');
    const añosTotal = fin.diff(inicio, 'years');

    if (mesesTotal < periodoPrueba) {
        return (remuneracion / 30) * 15;
    }
    if (mesesTotal >= periodoPrueba && añosTotal < 5) {
        return remuneracion * 1;
    }
    return remuneracion * 2;
};

const calcularIntegracionMes = (fechaEgreso, remuneracion) => {
    if (!fechaEgreso) return 0;

    const fin = moment(fechaEgreso);
    const diasTotalesMes = fin.daysInMonth();
    const diaEgreso = fin.date();
    const diasRestantes = diasTotalesMes - diaEgreso;

    return (remuneracion / diasTotalesMes) * diasRestantes;
};

const calcularDiasTrabajados = (fechaDespido) => {
    const finPeriodo = moment(fechaDespido);
    const inicioPeriodo = finPeriodo.month() < 6
        ? moment(`${finPeriodo.year()}-01-01`)
        : moment(`${finPeriodo.year()}-07-01`);

    return finPeriodo.diff(inicioPeriodo, 'days') + 1;
};

const calcularVacacionesProporcionales = (remuneracion, fechaInicioRelacion, fechaFin, antiguedad) => {
    const diasVacacionesPorAntiguedad = {
        '0-4': 14,
        '5-9': 21,
        '10-19': 28,
        '20+': 35
    };

    let diasVacaciones = 0;
    if (antiguedad >= 0 && antiguedad <= 4) {
        diasVacaciones = diasVacacionesPorAntiguedad['0-4'];
    } else if (antiguedad >= 5 && antiguedad <= 9) {
        diasVacaciones = diasVacacionesPorAntiguedad['5-9'];
    } else if (antiguedad >= 10 && antiguedad <= 19) {
        diasVacaciones = diasVacacionesPorAntiguedad['10-19'];
    } else {
        diasVacaciones = diasVacacionesPorAntiguedad['20+'];
    }

    const fechaInicioRelacionMoment = moment(fechaInicioRelacion);
    const fechaFinMoment = moment(fechaFin);

    if (!fechaInicioRelacionMoment.isValid() || !fechaFinMoment.isValid()) {
        throw new Error('Las fechas proporcionadas no son válidas.');
    }

    const inicioAnoCalendario = moment(`${fechaFinMoment.year()}-01-01`);
    const inicioComputo = moment.max(fechaInicioRelacionMoment, inicioAnoCalendario);
    const diasTrabajados = fechaFinMoment.diff(inicioComputo, 'days') + 1;
    const diasVacacionesProporcionales = (diasTrabajados / 365) * diasVacaciones;
    const montoVacaciones = (remuneracion / 25) * diasVacacionesProporcionales;

    return {
        diasVacacionesProporcionales: parseFloat(diasVacacionesProporcionales.toFixed(2)),
        montoVacaciones: parseFloat(montoVacaciones.toFixed(2))
    };
};

const calcularTopeVizzoti = (mejorRemuneracionBruta, topeLegalVigente) => {
    const topeVizzoti = mejorRemuneracionBruta * 0.67;
    return Math.min(topeVizzoti, topeLegalVigente);
};

const calcularMultas = {
    art1Ley25323: (indemnizacionTotal) => indemnizacionTotal * 0.5,
    art2Ley25323: (indemnizacionTotal) => indemnizacionTotal * 1,
    art80LCT: (mejorRemuneracionMensual) => mejorRemuneracionMensual * 3,
    art15Ley24013: (fechaInicio, fechaEgreso, mejorRemuneracion) => {
        const inicio = moment(fechaInicio);
        const egreso = moment(fechaEgreso);
        const mesesTrabajados = egreso.diff(inicio, 'months', true);
        return parseFloat((mesesTrabajados * mejorRemuneracion * 0.25).toFixed(2));
    },
    art8Ley24013: (fechaInicio, fechaEgreso, mejorRemuneracion) => {
        const inicio = moment(fechaInicio);
        const egreso = moment(fechaEgreso);
        const mesesTrabajados = egreso.diff(inicio, 'months', true);
        return parseFloat((mesesTrabajados * mejorRemuneracion * 0.25).toFixed(2));
    },
    art9Ley24013: (fechaInicio, fechaEgreso, mejorRemuneracion) => {
        const inicio = moment(fechaInicio);
        const egreso = moment(fechaEgreso);
        const mesesTrabajados = egreso.diff(inicio, 'months', true);
        return parseFloat((mesesTrabajados * mejorRemuneracion * 0.25).toFixed(2));
    },
    art10Ley24013: (fechaInicioNoRegistrada, fechaEgreso, remuneracionPercibida, remuneracionConsignada) => {
        const inicio = moment(fechaInicioNoRegistrada);
        const egreso = moment(fechaEgreso);
        const mesesNoRegistrados = egreso.diff(inicio, 'months', true);
        const montoNoRegistradoMensual = remuneracionPercibida - remuneracionConsignada;
        
        if (montoNoRegistradoMensual <= 0) {
            throw new Error('No hay remuneración no registrada para calcular la multa.');
        }

        const totalNoRegistrado = montoNoRegistradoMensual * mesesNoRegistrados;
        return parseFloat((totalNoRegistrado * 0.25).toFixed(2));
    }
};

// Main controller function
const calculateDismissal = async (req, res) => {
    try {
        const {
            // Required parameters
            fechaIngreso,
            fechaEgreso,
            remuneracion,
            
            // Optional parameters with defaults
            folderId = null,
            incluirSAC = false,
            isTopes = false,
            topeLegalVigente = 0,
            isLiquidacion = false,
            liquidacion = [],
            isMultas = false,
            multas = [],
            multaLE = 0,
            fechaFalsa = null,
            salarioFalso = 0
        } = req.body;

        // Validate required parameters
        if (!fechaIngreso || !fechaEgreso || !remuneracion) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros requeridos: fechaIngreso, fechaEgreso, remuneracion'
            });
        }

        // Calculate base values
        const periodos = calcularPeriodos(fechaIngreso, fechaEgreso);
        const remuneracionBase = parseFloat(remuneracion);
        
        // Calculate adjusted remuneration
        let remuneracionCalculada;
        if (isTopes) {
            const remuneracionTope = calcularTopeVizzoti(remuneracionBase, topeLegalVigente);
            remuneracionCalculada = incluirSAC ? remuneracionTope + remuneracionTope / 12 : remuneracionTope;
        } else {
            remuneracionCalculada = incluirSAC ? remuneracionBase + remuneracionBase / 12 : remuneracionBase;
        }

        // Calculate base indemnization
        const indemnizacion = periodos * remuneracionCalculada;

        // Initialize result object
        const resultado = {
            folderId,
            periodos,
            indemnizacion,
            remuneracionCalculada
        };

        // Calculate optional liquidation items
        if (isLiquidacion && Array.isArray(liquidacion)) {
            if (liquidacion.includes('preaviso')) {
                resultado.preaviso = calcularPreaviso(fechaIngreso, fechaEgreso, remuneracionCalculada);
            }
            if (liquidacion.includes('integracionMes')) {
                resultado.integracionMes = calcularIntegracionMes(fechaEgreso, remuneracionBase);
            }
            if (liquidacion.includes('sacPreaviso') && resultado.preaviso) {
                resultado.sacPreaviso = resultado.preaviso / 12;
            }
            if (liquidacion.includes('sacProp')) {
                const diasTrabajados = calcularDiasTrabajados(fechaEgreso);
                resultado.sacProporcional = (diasTrabajados / 365) * (remuneracionBase / 12);
            }
            if (liquidacion.includes('diasTrabajados')) {
                const fin = moment(fechaEgreso);
                resultado.diasTrabajados = fin.date() * (remuneracionBase / fin.daysInMonth());
            }
            if (liquidacion.includes('vacaciones')) {
                const vacaciones = calcularVacacionesProporcionales(
                    remuneracionBase,
                    fechaIngreso,
                    fechaEgreso,
                    periodos
                );
                resultado.diasVacaciones = vacaciones.diasVacacionesProporcionales;
                resultado.montoVacaciones = vacaciones.montoVacaciones;
            }
        }

        // Calculate penalties if required
        if (isMultas && Array.isArray(multas)) {
            if (multas.includes('multaArt1')) {
                resultado.multaArt1Ley25323 = calcularMultas.art1Ley25323(indemnizacion);
            }
            if (multas.includes('multaArt2')) {
                resultado.multaArt2Ley25323 = calcularMultas.art2Ley25323(indemnizacion);
            }
            if (multas.includes('multaArt80')) {
                resultado.multaArt80LCT = calcularMultas.art80LCT(remuneracionBase);
            }
            if (multas.includes('multaArt15')) {
                resultado.multaArt15Ley24013 = calcularMultas.art15Ley24013(
                    fechaIngreso,
                    fechaEgreso,
                    remuneracionBase
                );
            }
        }

        // Calculate special employment law penalties
        switch (multaLE) {
            case 1:
                resultado.multaArt8Ley24013 = calcularMultas.art8Ley24013(
                    fechaIngreso,
                    fechaEgreso,
                    remuneracionBase
                );
                break;
            case 2:
                if (fechaFalsa) {
                    resultado.multaArt9Ley24013 = calcularMultas.art9Ley24013(
                        fechaFalsa,
                        fechaIngreso,
                        remuneracionBase
                    );
                }
                break;
            case 3:
                if (salarioFalso) {
                    resultado.multaArt10Ley24013 = calcularMultas.art10Ley24013(
                        fechaIngreso,
                        fechaEgreso,
                        remuneracionBase,
                        salarioFalso
                    );
                }
                break;
        }

        return res.status(200).json({
            success: true,
            data: resultado
        });

    } catch (error) {
        console.error('Error en el cálculo de la liquidación:', error);
        return res.status(500).json({
            success: false,
            message: 'Error en el cálculo de la liquidación',
            error: error.message
        });
    }
};

module.exports = {
    calculateDismissal
};