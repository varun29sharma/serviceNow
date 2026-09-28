/**
 * HeroArt — the landing page's illustration.
 *
 * The reference composition is a soft 3D scene: one hero object, a halo of
 * smaller objects floating around it, pastel depth, no hard outlines. This is
 * that composition built from the product's own material instead of stock
 * education props — the hero object is a Case being routed, and the things
 * orbiting it are the outputs the engine produces: the assignmentGroup, the
 * urgency, the SLA target, the priority, and the trigger words that decided it.
 *
 * Written as inline SVG rather than shipped as an image for three reasons: it
 * inherits the live theme tokens (so it re-tones with the app instead of
 * fighting it), it costs nothing in the single-file bundle, and it cannot go
 * missing from a clone.
 *
 * All motion lives in styles.css so `prefers-reduced-motion` can switch it off
 * in one place, alongside every other animation in the app.
 */

export default function HeroArt() {
  return (
    <svg
      className="hero-art"
      viewBox="0 0 760 620"
      role="img"
      aria-label="A Case being read by the Assignment Rule and routed to an assignmentGroup with an urgency and an SLA target"
    >
      <defs>
        <radialGradient id="ha-halo" cx="50%" cy="46%" r="60%">
          <stop offset="0%" stopColor="rgba(167,139,250,0.42)" />
          <stop offset="55%" stopColor="rgba(109,63,224,0.14)" />
          <stop offset="100%" stopColor="rgba(109,63,224,0)" />
        </radialGradient>

        <linearGradient id="ha-screen" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#22223a" />
          <stop offset="100%" stopColor="#12121f" />
        </linearGradient>

        <linearGradient id="ha-lid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b3b58" />
          <stop offset="100%" stopColor="#22223a" />
        </linearGradient>

        <linearGradient id="ha-base" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#4a4a6d" />
          <stop offset="100%" stopColor="#26263c" />
        </linearGradient>

        <linearGradient id="ha-card" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="rgba(236,235,245,0.16)" />
          <stop offset="100%" stopColor="rgba(236,235,245,0.05)" />
        </linearGradient>

        <linearGradient id="ha-violet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6d3fe0" />
        </linearGradient>

        <filter id="ha-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>

      {/* ---------------------------------------------------------- atmosphere */}
      <ellipse cx="380" cy="300" rx="350" ry="270" fill="url(#ha-halo)" />
      <ellipse
        className="hero-art-shadow"
        cx="380"
        cy="536"
        rx="200"
        ry="26"
        fill="rgba(0,0,0,0.55)"
        filter="url(#ha-soft)"
      />

      {/* ------------------------------------------------------- the laptop */}
      <g className="hero-art-float-a">
        {/* lid */}
        <rect x="176" y="132" width="408" height="272" rx="18" fill="url(#ha-lid)" />
        <rect
          x="186"
          y="142"
          width="388"
          height="252"
          rx="12"
          fill="url(#ha-screen)"
          stroke="rgba(236,235,245,0.14)"
        />

        {/* --- the screen: the queue, the rule, the outcome --- */}

        {/* app bar */}
        <circle cx="210" cy="168" r="5" fill="#e5484d" />
        <circle cx="228" cy="168" r="5" fill="#d9a03f" />
        <circle cx="246" cy="168" r="5" fill="#6fcf97" />
        <rect x="272" y="163" width="104" height="10" rx="5" fill="rgba(236,235,245,0.16)" />
        <rect x="500" y="161" width="58" height="14" rx="7" fill="rgba(167,139,250,0.3)" />

        {/* the incoming message */}
        <rect x="206" y="196" width="348" height="52" rx="12" fill="rgba(236,235,245,0.06)" />
        <circle cx="230" cy="222" r="13" fill="rgba(236,235,245,0.18)" />
        <rect x="254" y="209" width="150" height="9" rx="4.5" fill="rgba(236,235,245,0.42)" />
        <rect x="254" y="226" width="216" height="8" rx="4" fill="rgba(236,235,245,0.18)" />

        {/* the routing arrow + the three outputs */}
        <path
          d="M380 258v22"
          stroke="rgba(167,139,250,0.75)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 5"
        />
        <path
          d="M380 286l-5-6h10z"
          fill="rgba(167,139,250,0.85)"
        />

        <rect x="206" y="294" width="108" height="38" rx="12" fill="rgba(167,139,250,0.22)" />
        <rect x="219" y="306" width="82" height="8" rx="4" fill="rgba(236,235,245,0.5)" />
        <rect x="219" y="319" width="46" height="6" rx="3" fill="rgba(236,235,245,0.26)" />

        <rect x="326" y="294" width="108" height="38" rx="12" fill="rgba(229,72,77,0.24)" />
        <rect x="339" y="306" width="72" height="8" rx="4" fill="rgba(236,235,245,0.5)" />
        <rect x="339" y="319" width="36" height="6" rx="3" fill="rgba(236,235,245,0.26)" />

        <rect x="446" y="294" width="108" height="38" rx="12" fill="rgba(111,207,151,0.2)" />
        <rect x="459" y="306" width="76" height="8" rx="4" fill="rgba(236,235,245,0.5)" />
        <rect x="459" y="319" width="42" height="6" rx="3" fill="rgba(236,235,245,0.26)" />

        {/* progress line — the SLA clock */}
        <rect x="206" y="352" width="348" height="6" rx="3" fill="rgba(236,235,245,0.09)" />
        <rect x="206" y="352" width="150" height="6" rx="3" fill="url(#ha-violet)" />

        {/* base / keyboard */}
        <path
          d="M150 404h460l22 42a10 10 0 0 1-9 14H137a10 10 0 0 1-9-14z"
          fill="url(#ha-base)"
        />
        <path
          d="M150 404h460l7 13H143z"
          fill="rgba(0,0,0,0.28)"
        />
      </g>

      {/* -------------------------------------------------- floating objects */}

      {/* assignmentGroup / routing */}
      <g className="hero-art-float-b">
        <rect x="44" y="196" width="176" height="64" rx="18" fill="url(#ha-card)" stroke="rgba(167,139,250,0.45)" />
        <circle cx="76" cy="228" r="15" fill="url(#ha-violet)" />
        <path
          d="M70 228l5 5 9-10"
          stroke="#0d0a1a"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect x="102" y="216" width="92" height="9" rx="4.5" fill="rgba(236,235,245,0.62)" />
        <rect x="102" y="232" width="62" height="8" rx="4" fill="rgba(236,235,245,0.28)" />
      </g>

      {/* urgency */}
      <g className="hero-art-float-c">
        <rect x="556" y="150" width="162" height="58" rx="18" fill="url(#ha-card)" stroke="rgba(229,72,77,0.5)" />
        <circle cx="586" cy="179" r="9" fill="#e5484d" />
        <circle cx="586" cy="179" r="15" fill="none" stroke="rgba(229,72,77,0.4)" strokeWidth="2" />
        <rect x="608" y="168" width="84" height="9" rx="4.5" fill="rgba(236,235,245,0.62)" />
        <rect x="608" y="184" width="52" height="8" rx="4" fill="rgba(236,235,245,0.28)" />
      </g>

      {/* SLA target */}
      <g className="hero-art-float-d">
        <rect x="588" y="332" width="150" height="58" rx="18" fill="url(#ha-card)" stroke="rgba(236,235,245,0.2)" />
        <circle cx="618" cy="361" r="14" fill="none" stroke="rgba(236,235,245,0.18)" strokeWidth="4" />
        <path
          d="M618 347a14 14 0 0 1 12 21"
          stroke="url(#ha-violet)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="644" y="350" width="76" height="9" rx="4.5" fill="rgba(236,235,245,0.62)" />
        <rect x="644" y="366" width="44" height="8" rx="4" fill="rgba(236,235,245,0.28)" />
      </g>

      {/* a trigger word */}
      <g className="hero-art-float-e">
        <rect x="96" y="440" width="128" height="44" rx="22" fill="rgba(217,160,63,0.18)" stroke="rgba(217,160,63,0.5)" />
        <text
          x="160"
          y="468"
          textAnchor="middle"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize="17"
          fill="#d9a03f"
        >
          #evicted
        </text>
      </g>

      {/* the lightbulb — the rule that made the call */}
      <g className="hero-art-float-b">
        <circle cx="666" cy="66" r="17" fill="rgba(217,179,106,0.22)" stroke="rgba(217,179,106,0.55)" strokeWidth="1.6" />
        <path
          d="M659 62a7 7 0 1 1 10 6v3h-6v-3"
          stroke="#e8c98a"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* sparks */}
      {[
        [120, 96],
        [706, 232],
        [62, 344],
        [516, 98],
        [742, 470],
        [286, 512],
      ].map(([cx, cy], i) => (
        <path
          key={`${cx}-${cy}`}
          className={`hero-art-spark hero-art-spark-${i % 3}`}
          d={`M${cx} ${cy - 7}L${cx + 2} ${cy - 2}L${cx + 7} ${cy}L${cx + 2} ${cy + 2}L${cx} ${cy + 7}L${cx - 2} ${cy + 2}L${cx - 7} ${cy}L${cx - 2} ${cy - 2}Z`}
          fill={i % 2 ? 'rgba(167,139,250,0.7)' : 'rgba(217,179,106,0.6)'}
        />
      ))}
    </svg>
  );
}
