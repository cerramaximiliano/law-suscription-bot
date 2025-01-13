const {
  calcularPeriodos,
  calcularPreaviso,
  calcularIntegracionMes,
  calcularDiasTrabajados,
  calcularVacacionesProporcionales,
  calcularTopeVizzoti,
  calcularMultas,
} = require("../utils/calculator");

// Main controller function
class DismissalController {
  static async calculateDismissal({
    fechaIngreso,
    fechaEgreso,
    remuneracion,
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
    salarioFalso = 0,
  }) {
    // Calculate base values
    const periodos = calcularPeriodos(fechaIngreso, fechaEgreso);
    const remuneracionBase = parseFloat(remuneracion);

    // Calculate adjusted remuneration
    let remuneracionCalculada;
    if (isTopes) {
      const remuneracionTope = calcularTopeVizzoti(
        remuneracionBase,
        topeLegalVigente
      );
      remuneracionCalculada = incluirSAC
        ? remuneracionTope + remuneracionTope / 12
        : remuneracionTope;
    } else {
      remuneracionCalculada = incluirSAC
        ? remuneracionBase + remuneracionBase / 12
        : remuneracionBase;
    }

    // Calculate base indemnization
    const indemnizacion = periodos * remuneracionCalculada;

    // Initialize result object
    const resultado = {
      folderId,
      periodos,
      indemnizacion,
      remuneracionCalculada,
    };

    // Calculate optional liquidation items
    if (isLiquidacion && Array.isArray(liquidacion)) {
      if (liquidacion.includes("preaviso")) {
        resultado.preaviso = calcularPreaviso(
          fechaIngreso,
          fechaEgreso,
          remuneracionCalculada
        );
      }
      if (liquidacion.includes("integracionMes")) {
        resultado.integracionMes = calcularIntegracionMes(
          fechaEgreso,
          remuneracionBase
        );
      }
      if (liquidacion.includes("sacPreaviso") && resultado.preaviso) {
        resultado.sacPreaviso = resultado.preaviso / 12;
      }
      if (liquidacion.includes("sacProp")) {
        const diasTrabajados = calcularDiasTrabajados(fechaEgreso);
        resultado.sacProporcional =
          (diasTrabajados / 365) * (remuneracionBase / 12);
      }
      if (liquidacion.includes("diasTrabajados")) {
        const fin = moment(fechaEgreso);
        resultado.diasTrabajados =
          fin.date() * (remuneracionBase / fin.daysInMonth());
      }
      if (liquidacion.includes("vacaciones")) {
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
      if (multas.includes("multaArt1")) {
        resultado.multaArt1Ley25323 =
          calcularMultas.art1Ley25323(indemnizacion);
      }
      if (multas.includes("multaArt2")) {
        resultado.multaArt2Ley25323 =
          calcularMultas.art2Ley25323(indemnizacion);
      }
      if (multas.includes("multaArt80")) {
        resultado.multaArt80LCT = calcularMultas.art80LCT(remuneracionBase);
      }
      if (multas.includes("multaArt15")) {
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

    return resultado;
  }
}


module.exports = {
  DismissalController,
};
