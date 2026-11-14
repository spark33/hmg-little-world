plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "ai.littleworld"
    compileSdk = 35
    defaultConfig { applicationId = "ai.littleworld"; minSdk = 28; targetSdk = 34; versionCode = 1; versionName = "0.1.0" }
    buildFeatures { buildConfig = true }
    flavorDimensions += "environment"
    productFlavors {
        create("vehicle") { dimension = "environment"; resValue("string", "app_name", "Little World"); buildConfigField("boolean", "DEVELOPMENT_PREVIEW", "false") }
        create("preview") { dimension = "environment"; resValue("string", "app_name", "Little World Dev Preview"); applicationIdSuffix = ".preview"; buildConfigField("boolean", "DEVELOPMENT_PREVIEW", "true") }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isReturnDefaultValues = true }
}
val buildWeb by tasks.registering(Exec::class) { workingDir("../../web"); commandLine("npm", "run", "build"); inputs.dir("../../web/src"); inputs.dir("../../web/public"); inputs.files("../../web/package-lock.json", "../../web/package.json", "../../web/index.html", "../../web/vite.config.ts", "../../web/tsconfig.json"); outputs.dir("../../web/dist") }
val bundleWeb by tasks.registering(Sync::class) { dependsOn(buildWeb); from("../../web/dist"); into("src/main/assets/web") }
tasks.named("preBuild") { dependsOn(bundleWeb) }
dependencies { "vehicleImplementation"("ai.pleos.playground:NaviHelper:3.0.5"); implementation("androidx.webkit:webkit:1.12.1"); implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.1"); testImplementation("junit:junit:4.13.2"); testImplementation("org.json:json:20240303") }
