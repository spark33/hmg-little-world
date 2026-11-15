plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
val releaseStoreFile = providers.environmentVariable("ROAMY_RELEASE_STORE_FILE").orNull
val releaseStorePassword = providers.environmentVariable("ROAMY_RELEASE_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("ROAMY_RELEASE_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("ROAMY_RELEASE_KEY_PASSWORD").orNull
val releaseSigningValues = listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword)
require(releaseSigningValues.all { it == null } || releaseSigningValues.all { !it.isNullOrBlank() }) {
    "Release signing requires all four ROAMY_RELEASE_* variables. Values are never logged."
}
android {
    namespace = "ai.littleworld"
    compileSdk = 35
    defaultConfig { applicationId = "ai.littleworld"; minSdk = 28; targetSdk = 34; versionCode = 2; versionName = "0.2.0" }
    useLibrary("android.car", false)
    signingConfigs {
        if (releaseStoreFile != null) create("release") {
            storeFile = file(releaseStoreFile)
            storePassword = releaseStorePassword
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
            enableV1Signing = false
            enableV2Signing = true
            enableV3Signing = true
        }
    }
    buildTypes {
        getByName("release") {
            isDebuggable = false
            if (releaseStoreFile != null) signingConfig = signingConfigs.getByName("release")
        }
    }
    buildFeatures { buildConfig = true }
    flavorDimensions += "environment"
    productFlavors {
        create("vehicle") { dimension = "environment"; resValue("string", "app_name", "ROAMY"); buildConfigField("boolean", "DEVELOPMENT_PREVIEW", "false") }
        create("preview") { dimension = "environment"; resValue("string", "app_name", "ROAMY"); applicationIdSuffix = ".preview"; buildConfigField("boolean", "DEVELOPMENT_PREVIEW", "true") }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isReturnDefaultValues = true }
}
val buildWeb by tasks.registering(Exec::class) { workingDir("../../web"); commandLine("npm", "run", "build"); inputs.dir("../../web/src"); inputs.dir("../../web/public"); inputs.files("../../web/package-lock.json", "../../web/package.json", "../../web/index.html", "../../web/vite.config.ts", "../../web/tsconfig.json"); outputs.dir("../../web/dist") }
val verifyWebAttribution by tasks.registering(Exec::class) {
    dependsOn(buildWeb)
    workingDir("../..")
    commandLine("python3", "scripts/generate-notices.py", "--check", "--bundle-inventory", "web/dist/bundle-dependencies.json")
}
val bundleWeb by tasks.registering(Sync::class) { dependsOn(verifyWebAttribution); from("../../web/dist"); into("src/main/assets/web") }
tasks.named("preBuild") { dependsOn(bundleWeb) }
dependencies { "vehicleImplementation"("ai.pleos.playground:NaviHelper:3.0.5"); implementation("androidx.webkit:webkit:1.12.1"); implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.1"); testImplementation("junit:junit:4.13.2"); testImplementation("org.json:json:20240303") }
