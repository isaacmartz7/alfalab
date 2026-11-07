// Coeficientes de las tablas 17.1 (α) y 17.2 (β).
// Cada número es la mantisa de × 10⁻⁵, para mostrar el mismo valor que el libro.
const Materials = (() => {
  const solids = [
    { id: "aluminio", name: "Aluminio", short: "aluminio", article: "El", alpha: 2.4, beta: 7.2 },
    { id: "laton", name: "Latón", short: "latón", article: "El", alpha: 2, beta: 6 },
    { id: "cobre", name: "Cobre", short: "cobre", article: "El", alpha: 1.7, beta: 5.1 },
    {
      id: "vidrio",
      name: "Vidrio",
      short: "vidrio",
      article: "El",
      alpha: { min: 0.4, max: 0.9 },
      beta: { min: 1.2, max: 2.7 },
    },
    {
      id: "invar",
      name: "Invar (aleación níquel-hierro)",
      short: "invar",
      article: "El",
      alpha: 0.09,
      beta: 0.27,
    },
    { id: "cuarzo", name: "Cuarzo (fundido)", short: "cuarzo fundido", article: "El", alpha: 0.04, beta: 0.12 },
    { id: "acero", name: "Acero", short: "acero", article: "El", alpha: 1.2, beta: 3.6 },
  ];

  const liquids = [
    { id: "etanol", name: "Etanol", short: "etanol", article: "El", beta: 75 },
    { id: "disulfuro", name: "Disulfuro de carbono", short: "disulfuro de carbono", article: "El", beta: 115 },
    { id: "glicerina", name: "Glicerina", short: "glicerina", article: "La", beta: 49 },
    { id: "mercurio", name: "Mercurio", short: "mercurio", article: "El", beta: 18 },
  ];

  solids.forEach((material) => {
    material.kind = "solid";
  });
  liquids.forEach((material) => {
    material.kind = "liquid";
  });

  function all() {
    return solids.concat(liquids);
  }

  function byId(id) {
    return all().find((material) => material.id === id) || null;
  }

  function formatMantissa(value) {
    if (!Number.isFinite(value)) return "—";
    const sign = value < 0 ? "−" : "";
    const rounded = Math.round(Math.abs(value) * 1000) / 1000;
    if (rounded === 0) return "0";
    const text = (Number.isInteger(rounded) && rounded < 10
      ? rounded.toFixed(1)
      : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
    ).replace(".", ",");
    return sign + text;
  }

  function formatFromMantissa(mantissa) {
    return `${formatMantissa(mantissa)} × 10⁻⁵`;
  }

  function formatSpec(spec) {
    if (typeof spec === "number") return formatFromMantissa(spec);
    return `${formatMantissa(spec.min)}–${formatMantissa(spec.max)} × 10⁻⁵`;
  }

  function mantissa(material, which, preset) {
    if (which === "gamma") return mantissa(material, "alpha", preset) * 2;
    const spec = material[which];
    if (typeof spec === "number") return spec;
    if (preset === "min") return spec.min;
    if (preset === "max") return spec.max;
    return (spec.min + spec.max) / 2;
  }

  function value(material, which, preset) {
    return mantissa(material, which, preset) * 1e-5;
  }

  function formatValue(material, which, preset) {
    return formatFromMantissa(mantissa(material, which, preset));
  }

  function formatColumn(material, which) {
    if (which === "gamma") {
      const alpha = material.alpha;
      if (typeof alpha === "number") return formatFromMantissa(alpha * 2);
      return `${formatMantissa(alpha.min * 2)}–${formatMantissa(alpha.max * 2)} × 10⁻⁵`;
    }
    return formatSpec(material[which]);
  }

  function isRange(material, which) {
    if (which === "gamma") return typeof material.alpha !== "number";
    return typeof material[which] !== "number";
  }

  solids.forEach((material) => {
    const alphas = typeof material.alpha === "number" ? [material.alpha] : [material.alpha.min, material.alpha.max];
    const betas = typeof material.beta === "number" ? [material.beta] : [material.beta.min, material.beta.max];
    alphas.forEach((alpha, index) => {
      const expected = Math.round(alpha * 3 * 1000) / 1000;
      const got = Math.round(betas[index] * 1000) / 1000;
      if (expected !== got) console.warn("β no coincide con 3α", material.id, expected, got);
    });
  });

  return {
    solids,
    liquids,
    all,
    byId,
    mantissa,
    value,
    formatMantissa,
    formatFromMantissa,
    formatValue,
    formatColumn,
    isRange,
  };
})();
