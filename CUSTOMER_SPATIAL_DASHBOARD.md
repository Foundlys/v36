# Customer spatial dashboard

This correction follows the self-contained customer-dashboard acceptance contract. It changes visualization and its tests only. Existing module ownership, tenant resolution, navigation, providers, entitlements and server authorization are unchanged.

The possible presentation products remain INKOOP, VERKOOP, FINANCE, CRM, AGENDA, MAIL, SOCIAL MEDIA, MARKETING and ANALYTICS. Only authorized active products and actual enabled capabilities are rendered. Social provider subnodes still require their own connected source entries. ZERO remains the existing shared intelligence layer.

## Composition and rendering

The renderer measures node surfaces and composes the active graph using viewport dimensions, the core footprint, cluster footprints, subnode counts, perspective and safe margins. It separates projected footprints, retains each point's camera-space Z, and transforms the resulting positions back into the rotating 3D scene. It does not use a flat overlay or normalize products onto an orbit. Primary and secondary line endpoints are updated from those same real positions.

Main products use small outlined product surfaces with line icons and restrained accent edges. Subnodes use subordinate rectangular labels. Primary structural connections are brighter than capability connections; environmental paths and particles are tertiary. The central spherical material uses an analytic WebGL surface with dimensional lighting, controlled specular/rim definition and fine surface detail. The identity stays readable independently of WebGL availability.

On compact viewports, product names remain visible and capability anchors remain interactive and permission-aware; focusing or hovering a capability reveals its full name. This is responsive label behaviour, not removal of customer capabilities. Larger viewports show capability labels directly.

The whole scene rotates automatically unless reduced motion is requested. Pause preserves the exact pose and stops animation scheduling. Resume retains that angle. Keyboard/manual inspection and unchanged periodic configuration refreshes preserve a paused view. Rendering also stops while the document is hidden.

## Verification and acceptance limits

`npm run test:spatial` retains the existing 2,560 resolver profiles, real HTTP authentication/capability denial checks, social source-state checks, actual destinations and motion tests. Additional composition checks cover 1, 3, 6 and 9 products, a complete rotation at desktop/mobile sizes, safe viewport margins, label/core separation, local subnode relationships and inverse projection into real XYZ. No existing acceptance threshold was weakened.

These checks are mathematical and DOM-unit evidence, not screenshots, GPU/FPS measurements or browser visual acceptance. The supported cloud browser explicitly rejected the production dashboard with `net::ERR_BLOCKED_BY_CLIENT`. Actual rendered appearance, WebGL material quality, antialiasing, readability and perceived motion remain **UNVERIFIED**. No visual PASS is claimed, and no network/control bypass was attempted. This is an external acceptance blocker, not permission to waive a visual failure.

The contract explicitly authorizes normal protected merge and the existing Railway deployment flow after technical gates pass, followed by deployment identity, health/readiness and dashboard availability verification. No provider, secret, data-volume or unrelated production configuration changes are part of this correction.
