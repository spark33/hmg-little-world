# Official Pleos installation and boot attempt

Follow-up performed **2026-11-15 (Asia/Seoul)** in the cloud workspace. Application source was `5eb59a1`; this work changed no application code or safety gate.

**Installation succeeded. Supported startup failed, and a software-only fallback did not finish Android boot. ROAMY was not successfully installed or launched in the emulator. Animation smoothness remains unvalidated.**

## Installed from the official source

The [official installation guide](https://document.pleos.ai/en/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator) links the Windows/Linux manifest at `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-sys-img.xml`. The archive URL was parsed from that manifest, not guessed.

- Archive: **4,087,751,964 bytes**. Full download matched the published SHA-1 `b4f858d5bcc6c71506d7edfc872bcb9e5a11acaa`.
- All ZIP member CRCs were checked during extraction. The files have about **19.6 GB logical size**; zero-filled regions were stored sparsely without changing their bytes. The verified archive was removed after extraction to recover space.
- The archive's own `source.properties` identifies the installed package as `system-images;android-34;android-automotive;x86_64`, while the publishing manifest uses `system-images;android-34;pleos_car_emulator;x86_64`. CLI tools canonicalized the package to the archive's identifier. **This is the downloaded Pleos image, not a generic Android Automotive image.**
- The included **Pleos Connect v2.1.0** device profile created `ROAMY_Pleos_2_1`: **2560×1440, 160 dpi, 4096 MiB RAM, cold boot, no snapshot loading/saving**.
- Guest ADB observations identified **Android 14 / API 34 / 42dot**. No CRN was required for this image.

SDK/image files and the AVD are under `/workspace/work/android-sdk` and `/workspace/work/android-avds`. Publisher binaries and authentication files were not added to the public repository.

## Actual boot results

| Check | Observed result |
| --- | --- |
| Normal hardware startup | Exited with code 1: no usable hardware GPU, incompatible Vulkan driver, and x86_64 acceleration unavailable because KVM/virtualization CPU flags are absent. |
| Software fallback | Started the same official image with `-accel off -gpu swiftshader -feature -Vulkan -no-window -no-audio -no-boot-anim`. This is an unsupported diagnostic configuration. |
| ADB | Reached `emulator-5554 device`; shell commands worked. ADB connection alone did not mean Android had finished booting. |
| Android initialization | `sys.boot_completed` stayed unset through an approximately 18-minute observation. Package/activity services appeared and disappeared as `system_server` restarted. |
| Framework diagnostics | Repeated 60-second watchdog kills: the main thread was blocked in `SystemProperties.native_set`, through `ActivityManagerService.watchDeviceProvisioning` / `systemReady`. |
| Vendor diagnostics | Repeated native aborts were observed in Pleos hardware services, including vehicle extension and placesense services. |
| APK installation | Vehicle debug APK transfer succeeded, but installation failed inside Android initialization: `PackageManagerInternal.freeStorage` was null. No successful install was reported. |
| Launch / screenshots | No ROAMY activity was launched and no valid device screenshot was obtained. No app lifecycle, navigation, safety or animation-performance result is claimed. |

The supported startup errors establish the host's missing hardware prerequisites. The fallback logs establish that **this configuration failed to initialize Android reliably**; they do not establish KVM/GPU absence as the sole cause of every guest crash, or a defect in ROAMY.

ADB's hardcoded configuration directory initially hit the read-only home filesystem. A narrowly scoped host path adapter stored its configuration in the permitted workspace; it changed no image bytes or authentication behavior. The image's production ADB-root restriction was retained. No boot-complete property, watchdog, vehicle restriction or PARKED state was overridden.

## Evidence and next action

[Structured result](../artifacts/roamy-pleos-install/result.json), [archive verification](../artifacts/roamy-pleos-install/archive-verification.json), [hardware startup errors](../artifacts/roamy-pleos-install/supported-startup-errors.log), [framework watchdog](../artifacts/roamy-pleos-install/framework-watchdog.log), and [install failure](../artifacts/roamy-pleos-install/apk-install-failure.log) retain the relevant results. Raw system logs, host authentication data and proprietary image files remain outside Git. The read-only host/source preflight describes checks it performs, not the global installation state; this installation record supersedes earlier “not downloaded / no AVD” observations.

**Minimum infrastructure action:** provide a cloud worker with usable `/dev/kvm`, exposed CPU virtualization support and a Pleos-supported GPU/driver. The [official configuration guide](https://document.pleos.ai/en/docs/connect/guide/getting-started/application-development/configure-pleos-connect-emulator) specifies GPU requirements and cold boot for VHAL. All work can remain in the cloud.

Then cold-boot the official AVD, require `sys.boot_completed=1`, verify stable package/activity services and ADB, install/launch the vehicle APK, and exercise the restriction/lifecycle matrix before changing production authorization. Rendering diagnostics in a clearly identified development preview can follow, with frame-time, dropped-frame and sustained-session measurements. Software rendering cannot establish supported-hardware smoothness.
