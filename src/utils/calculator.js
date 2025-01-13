const moment = require("moment");

// Auxiliary functions
const calcularPeriodos = (fechaIngreso, fechaEgreso) => {
  if (!fechaIngreso || !fechaEgreso) return 0;

  const inicio = moment(fechaIngreso);
  const fin = moment(fechaEgreso);

  const añosCompletos = fin.diff(inicio, "years");
  const inicioMasAños = moment(inicio).add(añosCompletos, "years");
  const mesesRestantes = fin.diff(inicioMasAños, "months");

  return mesesRestantes >= 3 ? añosCompletos + 1 : añosCompletos;
};

const calcularPreaviso = (fechaIngreso, fechaEgreso, remuneracion) => {
  if (!fechaIngreso || !fechaEgreso) return 0;

  const inicio = moment(fechaIngreso);
  const fin = moment(fechaEgreso);

  const periodoPrueba = 3;
  const mesesTotal = fin.diff(inicio, "months");
  const añosTotal = fin.diff(inicio, "years");

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
  const inicioPeriodo =
    finPeriodo.month() < 6
      ? moment(`${finPeriodo.year()}-01-01`)
      : moment(`${finPeriodo.year()}-07-01`);

  return finPeriodo.diff(inicioPeriodo, "days") + 1;
};

const calcularVacacionesProporcionales = (
  remuneracion,
  fechaInicioRelacion,
  fechaFin,
  antiguedad
) => {
  const diasVacacionesPorAntiguedad = {
    "0-4": 14,
    "5-9": 21,
    "10-19": 28,
    "20+": 35,
  };

  let diasVacaciones = 0;
  if (antiguedad >= 0 && antiguedad <= 4) {
    diasVacaciones = diasVacacionesPorAntiguedad["0-4"];
  } else if (antiguedad >= 5 && antiguedad <= 9) {
    diasVacaciones = diasVacacionesPorAntiguedad["5-9"];
  } else if (antiguedad >= 10 && antiguedad <= 19) {
    diasVacaciones = diasVacacionesPorAntiguedad["10-19"];
  } else {
    diasVacaciones = diasVacacionesPorAntiguedad["20+"];
  }

  const fechaInicioRelacionMoment = moment(fechaInicioRelacion);
  const fechaFinMoment = moment(fechaFin);

  if (!fechaInicioRelacionMoment.isValid() || !fechaFinMoment.isValid()) {
    throw new Error("Las fechas proporcionadas no son válidas.");
  }

  const inicioAnoCalendario = moment(`${fechaFinMoment.year()}-01-01`);
  const inicioComputo = moment.max(
    fechaInicioRelacionMoment,
    inicioAnoCalendario
  );
  const diasTrabajados = fechaFinMoment.diff(inicioComputo, "days") + 1;
  const diasVacacionesProporcionales = (diasTrabajados / 365) * diasVacaciones;
  const montoVacaciones = (remuneracion / 25) * diasVacacionesProporcionales;

  return {
    diasVacacionesProporcionales: parseFloat(
      diasVacacionesProporcionales.toFixed(2)
    ),
    montoVacaciones: parseFloat(montoVacaciones.toFixed(2)),
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
    const mesesTrabajados = egreso.diff(inicio, "months", true);
    return parseFloat((mesesTrabajados * mejorRemuneracion * 0.25).toFixed(2));
  },
  art8Ley24013: (fechaInicio, fechaEgreso, mejorRemuneracion) => {
    const inicio = moment(fechaInicio);
    const egreso = moment(fechaEgreso);
    const mesesTrabajados = egreso.diff(inicio, "months", true);
    return parseFloat((mesesTrabajados * mejorRemuneracion * 0.25).toFixed(2));
  },
  art9Ley24013: (fechaInicio, fechaEgreso, mejorRemuneracion) => {
    const inicio = moment(fechaInicio);
    const egreso = moment(fechaEgreso);
    const mesesTrabajados = egreso.diff(inicio, "months", true);
    return parseFloat((mesesTrabajados * mejorRemuneracion * 0.25).toFixed(2));
  },
  art10Ley24013: (
    fechaInicioNoRegistrada,
    fechaEgreso,
    remuneracionPercibida,
    remuneracionConsignada
  ) => {
    const inicio = moment(fechaInicioNoRegistrada);
    const egreso = moment(fechaEgreso);
    const mesesNoRegistrados = egreso.diff(inicio, "months", true);
    const montoNoRegistradoMensual =
      remuneracionPercibida - remuneracionConsignada;

    if (montoNoRegistradoMensual <= 0) {
      throw new Error(
        "No hay remuneración no registrada para calcular la multa."
      );
    }

    const totalNoRegistrado = montoNoRegistradoMensual * mesesNoRegistrados;
    return parseFloat((totalNoRegistrado * 0.25).toFixed(2));
  },
};

module.exports = {
  calcularPeriodos,
  calcularPreaviso,
  calcularIntegracionMes,
  calcularDiasTrabajados,
  calcularVacacionesProporcionales,
  calcularTopeVizzoti,
  calcularMultas,
};
