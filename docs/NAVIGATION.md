# Navigation integration and destination trust

ROAMY is a stationary entertainment/game application that can delegate an approved destination to the vehicle navigation app. It is not a map, turn-by-turn navigation app, or proof of a visit. The Seoul world and discovery destinations are illustrations. Legacy US-themed save/bridge IDs remain compatibility data only.

## Official API baseline

Reviewed official Pleos documentation:

- [NaviHelper initialization and release](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/initialization-and-release): initialize with service connection callbacks, register listeners after connection, remove listeners and release when finished. Using the service after release requires a new helper instance.
- [Destinations](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/destinations): `requestRoute()` submits a destination; `onRouteStarted` and `onRoutingCompleted` describe route search. A successful method call is not route-search completion. `cancelRoute()` requests cancellation; no callback here proves that a traveler arrived.
- [Permissions](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/declaring-permissions): `NAVI_ROUTE_SEARCH` covers route requests and cancellation. Query APIs and navigation-screen ownership have separate permissions; ROAMY does not request them without using those APIs.
- [Navigation app development guide](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/navigation-app-development-guide): navigation-category requirements are not an appropriate way to categorize an entertainment application. ROAMY must satisfy its game/entertainment category and driving restrictions independently.

The existing official Maven dependency remains NaviHelper 3.0.5. Its published interface also provides `cancelRoute()` and the no-argument `onRouteCancelled()` listener callback, which the adapter can use to confirm cancellation before returning to an idle state. No alternative SDK, private download URL, permission grant or connected vehicle is invented.

## Implemented contract

The origin-restricted main-frame native bridge retains version 1. Requests have a bounded correlation ID and exactly the fields allowed by their type:

| Request | Meaning |
| --- | --- |
| `capabilities` | Returns actual navigation/lighting readiness and the count of configured verified destinations. |
| `navigation-status` | Reads the adapter's current typed route-session snapshot. |
| `navigate` | Selects one native registry destination ID; JavaScript never supplies coordinates, POI IDs or URLs. |
| `navigation-retry` | Requests a fresh service connection when the adapter supports recovery. |
| `navigation-cancel` | Requests cancellation of an existing submitted/searching route when supported. |

Replies distinguish unavailable, disconnected, denied, ready, submitted, routing, route-search-finished, cancellation-requested, error and closed states. Web transport timeouts and dismissed checks are separate outcomes. The status panel explains the outcome, exposes refresh/retry where appropriate, and polls only during a pending route operation. It cancels its own requests when dismissed or safety/background restrictions remove the panel.

Concurrent replies resolve by ID. There are at most 16 pending requests, a 1.8-second response deadline, bounded response fields, a 4096-character response ceiling and clean listener/timer teardown. Unknown types, extra request fields, arbitrary IDs, coordinates, unregistered destinations and malformed replies are rejected. Dismissing a web status check is explicitly not presented as cancellation of the vehicle's route.

## Verified destinations: configured state

**The production destination registry is empty.** No authorized live POI source, verified Seoul venue dataset or provider agreement was supplied. The application therefore does not advertise usable live routing, and sample locations never start real navigation.

`DestinationRegistry` is a native-owned provider boundary, not a claim that schema validation verifies a venue. A future reviewed provider must supply an immutable vetted list of IDs, accurate coordinates, official POI identifier, name/address, HTTPS source URL and review date. Validation rejects duplicate/sample IDs, non-finite/out-of-range coordinates, invalid provenance/date shape, empty names/addresses/POI identifiers and overlong fields. The release reviewer must separately establish the source's authority, license, accuracy, freshness and geographic coverage before any entry is shipped.

The only populated registry used by tests contains explicitly labeled Seoul test illustrations. It is injected into JVM test objects; it is not part of `ProductionDestinations` and never touches a real SDK service. Unit fixtures using PARKED exercise the gate; they do not fabricate a parked signal in a vehicle build.

Even if a provider is configured later, bridge route submission additionally requires a trusted PARKED state, and the adapter independently enforces its lifecycle/permission/service guards. The current vehicle build remains locked while the trusted stationary restriction path is unverified. A supported official Pleos cloud runtime is still required before enabling vehicle gameplay or claiming real routing validation.

## Recovery and unresolved outcomes

`NavigationSession` is a pure policy object used by an optional `NavigationSessionProvider` adapter extension. Unexpected search-completion events do not create a route, and a closed session ignores late callbacks. Adapter implementations must reject stale helper generations, recheck permissions and keep connection failure separate from ordinary route errors.

Route search completion means only that the search callback finished. Cancellation remains a request until the navigation app confirms its actual state. The UI tells the user to check that app; it never labels either event arrival, a successful visit, or a collectible confirmation. Collection still requires a separate deliberate user confirmation, explicitly labeled as an illustrative demo experience.

## Validation and release gates

Added web tests cover typed reply validation, correlated capability/status requests, bounded pending requests, transport timeout/error/abort and honest navigation wording. Native JVM tests cover sample rejection before adapter calls, native-only destination fields, the trusted-state gate (including cancellation), strict protocol fields, provider validation, empty production capability and route-session lifecycle. On the navigation branch, 37 web unit tests and the TypeScript/Vite build passed; both native flavors passed 11 JVM tests each, and the vehicle debug APK built successfully. The fully integrated application still requires its own combined checks.

The final integrated cloud run must build both flavors, run unit/browser/native tests and Android lint, and inspect the navigation status panel in the production bundle. Official Pleos runtime tests remain required for service binding, granted/denied permissions, callback ordering, disconnect/retry, cancellation and foreground/background behavior. No browser screenshot or JVM fixture can establish those results.

To unlock production navigation, the minimum inputs are a reviewed authorized Seoul POI provider and a cloud worker capable of running the official Pleos emulator, followed by the trusted stationary-state and navigation runtime acceptance matrix. Release category approval and signing remain separate gates.
