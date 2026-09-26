# AGP 9.1 compatibility experiment

Date: 2026-09-26.

This experiment is intentionally isolated from the production Android Release workflow.
Production remains on AGP 9.0.1 until the AGP 9.1 build, R8 repackaging, native alignment,
and device smoke tests have all passed.

## Target toolchain

- Android Gradle Plugin 9.1.1
- Gradle 9.3.1
- JDK 17
- Android SDK 36 / Build Tools 36.0.0
- NDK 28.2.13676358 for the isolated ARM64 compatibility build
- Tauri CLI 2.11.4

The adapter retains the same generated-project compatibility workarounds required by
the AGP 9.0.1 experiment: Gradle `Project.exec` replacement, Java/Kotlin target
alignment, non-final resource IDs, optimized resource shrinking, and the generated
Kotlin/DSL compatibility opt-outs.

## Acceptance checks

The pull-request workflow must:

1. build a signed ARM64 release AAB and APK with R8,
2. produce `mapping.txt`,
3. demonstrate that at least one obfuscated class is mapped to the unnamed package,
   which is the AGP 9.1 default class-repackaging behavior,
4. pass the existing 16 KB native-library alignment verification,
5. preserve release shrinking and the generated Tauri ProGuard configuration.

The compatibility artifacts use a disposable key and must not be uploaded to Google Play.

If all CI checks pass, the next step is a separate production-rollout PR followed by
a signed all-ABI release with Play upload disabled and physical-device smoke testing.
