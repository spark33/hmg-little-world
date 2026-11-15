# Android dependency attribution

This records the resolved vehicle debug runtime graph inspected alongside the pinned project dependencies. The generated app notice text includes full license material for the OSS groups below. Versions and coordinates are recorded in `upstream/sources.json` and `runtime-dependencies.json`; the underlying resolved graph is preserved in [ANDROID-RUNTIME-DEPENDENCIES.txt](ANDROID-RUNTIME-DEPENDENCIES.txt).

| Library family | Resolved examples | Evidence and full terms |
| --- | --- | --- |
| AndroidX | WebKit 1.12.1; core/core-ktx 1.8.0; annotation 1.8.1; lifecycle 2.3.1; other graph entries | Published POMs declare Apache 2.0. Exact WebKit AAR `META-INF/androidx/webkit/webkit/LICENSE.txt` is preserved in `upstream/androidx-webkit-1.12.1-LICENSE.txt`. |
| Kotlin standard library | 2.1.10 | Official Kotlin `v2.1.10` `license/LICENSE.txt`, unchanged full text. |
| Kotlin coroutines | 1.10.1 | Official kotlinx.coroutines `1.10.1` `LICENSE.txt`, unchanged full text. |
| Kotlin serialization | 1.6.3 | Official kotlinx.serialization `v1.6.3` `LICENSE.txt`, unchanged full text. |
| JetBrains annotations | 23.0.0 | Official java-annotations `23.0.0` `LICENSE.txt`, unchanged full text. |
| Guava ListenableFuture | 1.0 | Artifact inherits guava-parent 26.0-android; that published parent POM declares Apache 2.0. Canonical ASF Apache 2.0 text is preserved; no separate copyright attribution was invented. |

The source manifest pins source URLs/refs and SHA-256 hashes. Runtime-family lists conservatively retain resolved POM/BOM/common artifacts as audit data; they do not claim every listed metadata artifact contributes classes to the APK. No new blanket license is applied to ROAMY's own code.

## Proprietary Pleos SDK

`ai.pleos.playground:NaviHelper:3.0.5`, `navi-aidl:3.0.1`, and `navi-data:3.0.4` are **not represented as OSS**. The application compiles against the official repository, but that does not establish unrestricted redistribution rights or market approval. Review the official [NaviHelper import guide](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/importing-sdk), the [Pleos SDK license supplied with the official emulator manifest](https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-sys-img.xml), and the terms applicable to the developer project and competition before a release/submission.

The Apache/MIT material for other dependencies does not license the Pleos SDK. This document is an attribution inventory and review aid, not legal certification or proof of acceptance of proprietary terms. No credentials, CRN, or sensitive developer identifier is included.
