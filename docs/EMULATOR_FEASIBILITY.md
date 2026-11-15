# Official Pleos emulator: cloud feasibility

Initial inspection 2026-11-15 (Asia/Seoul); cloud-only environment, repository baseline `4879837`.

**Follow-up:** the official image is now downloaded/checksum-verified and installed, and an official-profile AVD was created. Hardware startup failed; software fallback reached ADB but entered a framework boot loop. No completed Android boot or ROAMY runtime test is claimed. See the [installation and boot-attempt report](PLEOS_INSTALL_ATTEMPT.md).

## Host findings

| Check | Observed result |
| --- | --- |
| OS / architecture | Debian GNU/Linux 13.6, Linux 6.18.57, x86_64 |
| CPU | AMD EPYC 9V74; 5 visible logical CPUs; cgroup quota 4 CPU equivalents |
| RAM | 17 GiB host reported; cgroup limit 16 GiB; no swap |
| Disk | 32 GB overlay; approximately 30 GB available at initial inspection |
| Virtualization | Host reports KVM hypervisor, but guest exposes neither `vmx` nor `svm`; `/dev/kvm` absent. Host virtualization does not imply nested guest acceleration. |
| Graphics | `/dev/dri` absent; no exposed hardware GPU; Chromium software WebGL available for browser checks only |
| Initial Android tools | No `adb`, `emulator`, `sdkmanager`, `avdmanager`, Android SDK or image found in workspace/standard tool locations; JDK 21 installed |
| Project configuration | minSdk 28, targetSdk 34, compileSdk 35; Gradle 8.10.2; API 35/build-tools 35.0.0 required to compile |

## Official source and access checks

Read the official [installation guide](https://document.pleos.ai/en/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator), [configuration guide](https://document.pleos.ai/en/docs/connect/guide/getting-started/application-development/configure-pleos-connect-emulator), [project/access guide](https://document.pleos.ai/en/docs/pleos-only/create-my-project) and [competition development guide](https://appdevchallenge.auto-hmg.io/guide/development).

The documented baseline is Pleos 2.1.0 on API 34 with a 4 GB AVD and cold boot. Cold boot is necessary for VHAL. The configuration guide specifies a discrete GPU, with RTX 3060 Laptop 6 GB or listed AMD equivalents as minimum. The competition guide points to the official requirements and Vehicle, NaviHelper, location and speech SDKs; their current availability must be checked individually.

The exact Windows/Linux manifest linked by the official guide was fetched successfully:

`https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-sys-img.xml`

It declares `system-images;android-34;pleos_car_emulator;x86_64`, revision 2, displayed as Pleos Connect v2.1.0 APIs. Its archive URL was read from the manifest, not guessed:

`https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp_car_emulator.zip`

An unauthenticated HEAD request returned HTTP 200 and Content-Length **4,087,751,964** bytes. Published SHA-1: `b4f858d5bcc6c71506d7edfc872bcb9e5a11acaa`. The initial check proved source availability only. The subsequent follow-up downloaded the complete archive and verified this checksum; installation and boot results are recorded separately below. No access controls were bypassed.

CRN is explicitly unnecessary starting with emulator 2.1.0. No Pleos/CRN environment configuration was found (values were not logged); account/project credential stores were not searched. A project may still be needed for publication or SDKs requiring credentials. The official access guide lists Vehicle State and NaviHelper as ready to use; this must not be confused with Vehicle Control availability. No credential or sensitive project identifier belongs in committed evidence.

## Decision and minimum action

**Blocked for the documented official Pleos runtime validation on this cloud worker.** Missing nested CPU acceleration and GPU exposure are infrastructure limitations; installing an SDK or supplying a CRN does not resolve them. An unaccelerated software experiment would not establish supported graphics performance or official validation readiness. No generic Android emulator is used as a substitute.

Minimum user/platform action: provision a cloud worker with nested virtualization enabled, an accessible `/dev/kvm`, exposed virtualization CPU flags, and a Pleos-supported GPU/driver. Retain at least the documented 4 GB AVD allocation plus build/host overhead and enough disk for the image and writable AVD. All development and validation can remain in the cloud.

Once available: verify `emulator -accel-check` and GPU capabilities; install the manifest-provided image and validate its published checksum; create the official automotive API 34 AVD, allocate 4 GB and cold boot; wait for Android boot completion; verify `adb devices`; install/launch the freshly built **vehicle** APK. Capture Pleos screenshots and filtered logcat; exercise startup, UNKNOWN/DRIVING safety, foreground/background, service disconnect, rendering, navigation permission/errors and recovery. The vehicle must remain locked until a trusted stationary restriction integration is verified.

At initial inspection no AVD existed. The [follow-up](PLEOS_INSTALL_ATTEMPT.md) installed the genuine image and created an AVD, reached ADB in software mode, and captured Android boot/watchdog diagnostics. Android never completed boot, so no ROAMY launch, device screenshot or smoothness validation is claimed. Earlier build/test observations remain in [CLOUD_VALIDATION.md](CLOUD_VALIDATION.md).
