// Cuentas de dilatación. Las longitudes entran en la unidad elegida y se convierten a SI.
const Physics = (() => {
  const UNITS = {
    mm: { id: "mm", dimension: "length", toSI: 0.001, label: "mm" },
    cm: { id: "cm", dimension: "length", toSI: 0.01, label: "cm" },
    m: { id: "m", dimension: "length", toSI: 1, label: "m" },
    cm2: { id: "cm2", dimension: "area", toSI: 1e-4, label: "cm²" },
    m2: { id: "m2", dimension: "area", toSI: 1, label: "m²" },
    cm3: { id: "cm3", dimension: "volume", toSI: 1e-6, label: "cm³" },
    mL: { id: "mL", dimension: "volume", toSI: 1e-6, label: "mL" },
    L: { id: "L", dimension: "volume", toSI: 0.001, label: "L" },
    m3: { id: "m3", dimension: "volume", toSI: 1, label: "m³" },
  };

  const ORDER = {
    length: ["mm", "cm", "m"],
    area: ["cm2", "m2"],
    volume: ["cm3", "mL", "L", "m3"],
  };

  // A partir de este tamaño, la unidad de arriba se lee mejor.
  const FRIENDLY_FLOOR = {
    length: [
      { id: "m", min: 1 },
      { id: "cm", min: 0.01 },
      { id: "mm", min: 0 },
    ],
    area: [
      { id: "m2", min: 0.01 },
      { id: "cm2", min: 0 },
    ],
    volume: [
      { id: "m3", min: 0.1 },
      { id: "L", min: 0.001 },
      { id: "mL", min: 0 },
    ],
  };

  function unitsFor(dimension) {
    return ORDER[dimension].map((id) => UNITS[id]);
  }

  function unit(id) {
    return UNITS[id];
  }

  function toSI(value, unitId) {
    return value * UNITS[unitId].toSI;
  }

  function fromSI(value, unitId) {
    return value / UNITS[unitId].toSI;
  }

  function parseNumber(raw) {
    if (typeof raw !== "string") return NaN;
    const text = raw.trim().replace(/\s/g, "").replace(",", ".");
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return NaN;
    const value = Number(text);
    return Number.isFinite(value) ? value : NaN;
  }

  function deltaT(initial, final) {
    return final - initial;
  }

  function expansion(initialSI, coefficient, changeInTemperature) {
    const change = initialSI * coefficient * changeInTemperature;
    return {
      change,
      final: initialSI + change,
      fraction: initialSI === 0 ? NaN : change / initialSI,
    };
  }

  function apparent(volumeSI, betaLiquid, betaContainer, changeInTemperature) {
    const betaApparent = betaLiquid - betaContainer;
    return {
      betaApparent,
      liquid: volumeSI * betaLiquid * changeInTemperature,
      container: volumeSI * betaContainer * changeInTemperature,
      apparent: volumeSI * betaApparent * changeInTemperature,
    };
  }

  function bestUnit(absoluteSI, dimension) {
    const ladder = FRIENDLY_FLOOR[dimension];
    for (const step of ladder) {
      if (absoluteSI >= step.min) return step.id;
    }
    return ladder[ladder.length - 1].id;
  }

  function formatSig(value, digits) {
    if (!Number.isFinite(value)) return "—";
    if (Object.is(value, -0) || Math.abs(value) < 1e-15) return "0";
    const text = new Intl.NumberFormat("es-AR", {
      maximumSignificantDigits: digits,
      useGrouping: true,
    }).format(value);
    return text.replace("-", "−");
  }

  function formatPlain(value) {
    return formatSig(value, 6);
  }

  // Dibuja un cambio chico como algo visible. No es la escala del cálculo.
  function visualFraction(realFraction) {
    if (!Number.isFinite(realFraction) || realFraction === 0) return 0;
    const sign = Math.sign(realFraction);
    const log = Math.log10(Math.abs(realFraction));
    const t = (log + 6) / 5;
    const clamped = Math.min(1, Math.max(0, t));
    return sign * (0.06 + clamped * 0.24);
  }

  function validateMeasure(initial, initialTemperature, finalTemperature) {
    if (!Number.isFinite(initial) || !Number.isFinite(initialTemperature) || !Number.isFinite(finalTemperature)) {
      return "Hace falta un número en la medida y en las dos temperaturas. Los decimales pueden ir con coma o con punto.";
    }
    if (initial <= 0) return "La medida inicial tiene que ser mayor que cero.";
    return "";
  }

  return {
    UNITS,
    unitsFor,
    unit,
    toSI,
    fromSI,
    parseNumber,
    deltaT,
    expansion,
    apparent,
    bestUnit,
    formatSig,
    formatPlain,
    visualFraction,
    validateMeasure,
  };
})();
