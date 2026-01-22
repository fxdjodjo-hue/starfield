/**
 * Costanti per animazioni fade sincronizzate dell'UI
 */
export const UI_FADE_CONFIG = {
  duration: 600, // millisecondi
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  initialOpacity: 0,
  initialScale: 0.9,
  finalOpacity: 1,
  finalScale: 1
} as const;

/**
 * Applica un fade-in sincronizzato a un elemento HTML
 */
export function applyFadeIn(element: HTMLElement, preserveTransform: string = ''): void {
  if (!element) return;

  // Imposta stato iniziale
  element.style.opacity = UI_FADE_CONFIG.initialOpacity.toString();
  const initialTransform = preserveTransform 
    ? `${preserveTransform} scale(${UI_FADE_CONFIG.initialScale})`
    : `scale(${UI_FADE_CONFIG.initialScale})`;
  element.style.transform = initialTransform;
  element.style.transition = `opacity ${UI_FADE_CONFIG.duration}ms ${UI_FADE_CONFIG.easing}, transform ${UI_FADE_CONFIG.duration}ms ${UI_FADE_CONFIG.easing}`;
  
  // Assicurati che l'elemento sia visibile
  if (element.style.display === 'none') {
    element.style.display = '';
  }

  // Applica animazione dopo che il display è stato impostato
  requestAnimationFrame(() => {
    element.style.opacity = UI_FADE_CONFIG.finalOpacity.toString();
    const finalTransform = preserveTransform 
    ? `${preserveTransform} scale(${UI_FADE_CONFIG.finalScale})`
    : `scale(${UI_FADE_CONFIG.finalScale})`;
    element.style.transform = finalTransform;
  });
}
