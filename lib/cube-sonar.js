// Géométrie de l'onde sonar : la distance maximale à laquelle la vague doit
// monter pour couvrir le conteneur, calculée depuis son rectangle.
//
// Les deux paramètres sont des rectangles, pas des sélecteurs : la fonction ne
// touche donc pas au DOM et se teste en injectant des rects.

export const sonarGeometry = (root, pointEl) => {
  const rect = root.getBoundingClientRect();
  if (!pointEl) {
    const hw = rect.width / 2;
    const hh = rect.height / 2;
    const half = Math.sqrt(hw * hw + hh * hh) / rect.width;
    return { maxR: half * 100, scaleMax: half * 2 };
  }
  const c = pointEl.getBoundingClientRect();
  const cx = c.left + c.width / 2 - rect.left;
  const cy = c.top + c.height / 2 - rect.top;
  const d = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(rect.width - cx, cy),
    Math.hypot(cx, rect.height - cy),
    Math.hypot(rect.width - cx, rect.height - cy),
  );
  return {
    center: { x: Math.round(cx), y: Math.round(cy), dmax: Math.round(d) },
  };
};