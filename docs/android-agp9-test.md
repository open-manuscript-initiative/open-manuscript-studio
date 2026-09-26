# AGP 9 compatibility and production adoption

Dates: 2026-09-13–14. PR: https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/409

The work started as an isolated ARM64 release-build experiment. On 2026-09-26 the
tested compatibility adapter was promoted into the production Android Release
workflow. The compatibility-test AAB and APK still use a disposable signing key
and are not Google Play upload packages; the production workflow continues to use
the normal release signing and Play verification gates.

## Build evidence

| versionCode | Toolchain | Result |
| --- | --- | --- |
| 1015 | AGP 8.11.0 / Gradle 8.14.3 | Release AAB/APK and ARM64 ELF 16 KB alignment passed. |
| 1016 | AGP 9.0.1 / Gradle 9.1.0 | Failed: AGP's Java target 11 differed from Tauri's Kotlin target 1.8. |
| 1017 | AGP 9.0.1 / Gradle 9.1.0 | Java/Kotlin compilation passed; R8 required non-final resource IDs. |
| 1018 | AGP 9.0.1 / Gradle 9.1.0 | Failed in release Lint: Kotlin FIR analysis crashed on the applied dependency script. |
| 1019 | AGP 9.0.1 / Gradle 9.1.0 | Release AAB/APK, including R8 and release Lint, succeeded. ARM64 ELF 16 KB alignment passed for both outputs. |

- Baseline and 1016: https://github.com/open-manuscript-initiative/open-manuscript-studio/actions/runs/34780629211
- 1017: https://github.com/open-manuscript-initiative/open-manuscript-studio/actions/runs/34781144417
- 1018: https://github.com/open-manuscript-initiative/open-manuscript-studio/actions/runs/34781594885
- 1019: https://github.com/open-manuscript-initiative/open-manuscript-studio/actions/runs/34797430180
- Tested code revision: `d3a1f04eb0b781d3a12957517aa39a424323b055`.

## Conclusion

The ARM64 release build works with AGP 9.0.1 in compatibility mode after the
adaptations below. The separate default-Kotlin/DSL configuration probe failed:
`Cannot add extension with name 'kotlin'`, because the current generated project
still applies the Kotlin Android plugin. The workflow's overall green status
means the compatibility release build and alignment checks passed; it does not
mean AGP 9 defaults passed. The probe deliberately uses `continue-on-error` and
records its raw outcome in the run summary.

Artifacts from the compatibility run are under `android-toolchain-agp9`, with
14-day retention. They use disposable test signing. The production Android Release
workflow now applies the same compatibility adapter after Tauri generates the
Android project and before release signing.

## Required adaptations found by the experiment

The script `scripts/configure-android-agp9-test.mjs` modifies generated files only.
Production releases invoke it in `compatibility` mode; `defaults` remains an
experimental probe:

1. Set AGP 9.0.1 in both the root build script and `buildSrc`.
2. Set the Gradle wrapper to 9.1.0.
3. Replace Tauri 2.11.4's removed `Project.exec` call in `BuildTask.kt` with
   constructor-injected `ExecOperations`. The initial AGP 9 build demonstrated
   the unresolved `exec` reference before this adaptation.
4. Preserve Tauri's JVM 1.8 Kotlin target by explicitly setting Java source and
   target compatibility to 1.8.
5. Enable `android.nonFinalResIds=true` and
   `android.r8.optimizedResourceShrinking=true` for optimized resource shrinking.
6. Build with `android.builtInKotlin=false` and `android.newDsl=false` to retain
   compatibility with the current Kotlin Android plugins and generated DSL.

7. Load the generated dependency script with `apply(from = file("tauri.build.gradle.kts"))`
   to avoid the Lint K2 script-analysis crash tracked in
   https://issuetracker.google.com/issues/430991549. Release Lint remains enabled.

The existing release signing configuration enables both code minification and
resource shrinking, while preserving Tauri's ProGuard rules.

The workflow probes AGP 9's default Kotlin/DSL configuration only after Tauri has
created its runtime Gradle settings during a real build. Running Gradle directly
immediately after `android init` was not a valid compatibility probe because
`tauri.settings.gradle` did not yet exist. A default-probe failure is recorded
separately; release-build or ELF-alignment failures fail the job.

## Validation scope

The baseline uses JDK 17, Android SDK 36, and NDK 28.2.13676358, as does the
experiment. Three local Node tests cover repeatable configuration, rejecting
unexpected generated templates, and preserving release shrinking/signing setup.
The CI build compiles the actual Tauri-generated Kotlin code and application.

The compatibility smoke test remains ARM64-only. The production Android Release
workflow is the all-ABI acceptance gate: it builds with the release signing key,
runs the existing Play bundle and 16 KB checks, and produces both the Play AAB and
the direct-install APK. For the first AGP 9 production run, dispatch the workflow
with Play upload disabled, test launch, ORCID, document open/save, file dialogs,
and update behavior on a physical device, and only then upload the resulting or a
subsequent signed AAB to Play. The compatibility opt-outs are transitional and do
not demonstrate support for AGP 9 defaults or AGP 10.

Reference: https://developer.android.com/build/releases/agp-9-0-0-release-notes

## Build number policy

Each new build must reserve a higher Android versionCode, including retries after
failures. Codes through 1019 have been reserved by this experiment; the next build
must use at least 1020 and must account for any intervening builds/uploads.
See [Android release instructions](android-release.md).
