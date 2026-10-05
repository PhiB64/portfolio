// Verrou d'orientation : plein écran affiché quand l'appareil est en paysage
// sur mobile. Le portfolio n'a de sens qu'en portrait.
//
// Ce composant ne fait qu'afficher. Il n'a aucune logique, aucun état, aucun
// effet : tout ce qu'il faut savoir est dans son props.
export function OrientationLock({ dialogRef }) {
  return (
    <div
      // Le dialogue ne contient aucun contrôle : `tabIndex={-1}` le rend
      // focusable par script, et le focus est posé au montage. Sans cela un
      // lecteur d'écran ouvre la page sans jamais annoncer le verrou, et le
      // visiteur doit deviner pourquoi la page ne réagit pas.
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex min-h-[calc(var(--svh))] items-center justify-center bg-[#0a0f1c] px-8 text-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="orientation-lock-title"
      aria-describedby="orientation-lock-description"
    >
      <div className="max-w-sm">
        <div className="relative mx-auto mb-8 h-20 w-12 rounded-[10px] border-2 border-[#00a5b0] shadow-[0_0_24px_rgba(0,165,176,0.25)]">
          <div className="absolute left-1/2 top-1 h-1 w-3 -translate-x-1/2 rounded-full bg-[#00a5b0]" />
          <div className="absolute inset-x-2 bottom-3 h-1 rounded-full bg-[#00a5b0]/50" />
        </div>
        <p className="mb-3 text-xs font-light tracking-[0.3em] text-[#00a5b0] uppercase">
          Orientation requise
        </p>
        <h1
          id="orientation-lock-title"
          className="mb-4 text-3xl font-light text-white"
        >
          Tournez votre appareil
        </h1>
        <p
          id="orientation-lock-description"
          className="text-sm leading-relaxed text-[#94a3b8]"
        >
          Le portfolio est disponible en format portrait.
        </p>
      </div>
    </div>
  );
}