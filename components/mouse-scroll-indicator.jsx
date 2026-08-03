"use client";

export function MouseScrollIndicator({ scrollTo } = {}) {
  const handleClick = () => {
    if (scrollTo) {
      const target = typeof scrollTo === "function" ? scrollTo() : scrollTo;
      if (typeof target === "number") {
        window.scrollBy({ top: target, behavior: "smooth" });
      } else if (target) {
        const el = typeof target === "string" ? document.querySelector(target) : target;
        if (el) el.scrollIntoView({ behavior: "smooth" });
        else window.scrollBy({ top: window.innerHeight * 0.85, behavior: "smooth" });
      }
    } else {
      window.scrollBy({ top: window.innerHeight * 0.85, behavior: "smooth" });
    }
  };

  return (
    <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 pointer-events-auto">
      <button
        type="button"
        aria-label="Défiler vers le bas"
        onClick={handleClick}
        className="group flex items-center justify-center transition-all duration-300 hover:scale-110"
      >
        <div className="relative flex h-10 w-6 items-start justify-center rounded-full border-2 border-white/50 transition-colors group-hover:border-white">
          <div className="mt-2 h-2 w-1 rounded-full bg-white transition-all duration-300 group-hover:bg-white animate-scroll-down" />
        </div>
      </button>
      <style>{`
        @keyframes scroll-down {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(6px); opacity: 0.2; }
        }
        .animate-scroll-down {
          animation: scroll-down 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
