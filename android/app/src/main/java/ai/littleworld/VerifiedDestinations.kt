package ai.littleworld

import java.net.URI

/** A vetted provider owns coordinates. JavaScript can only select a registry ID. */
data class VerifiedDestination(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val name: String,
    val address: String,
    val poiId: String,
    val sourceUrl: String,
    val verifiedOn: String
) {
    fun isValid(): Boolean = id.matches(Regex("[a-z0-9][a-z0-9-]{0,63}")) &&
        id !in SAMPLE_DESTINATION_IDS && latitude.isFinite() && longitude.isFinite() &&
        latitude in -90.0..90.0 && longitude in -180.0..180.0 &&
        name.isNotBlank() && name.length <= 120 && address.isNotBlank() && address.length <= 300 &&
        poiId.isNotBlank() && poiId.length <= 120 &&
        validSourceUrl(sourceUrl) &&
        validDate(verifiedOn)

    fun asDestination() = Destination(id, latitude, longitude, name, address, poiId, sample = false)

    private fun validSourceUrl(value: String): Boolean {
        if (value.length !in 1..500 || value.any { it.isWhitespace() || it.isISOControl() }) return false
        return try {
            val uri = URI(value)
            uri.scheme.equals("https", ignoreCase = true) && !uri.isOpaque &&
                !uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.rawFragment == null &&
                (uri.port == -1 || uri.port == 443)
        } catch (_: Exception) { false }
    }

    private fun validDate(value: String): Boolean = try {
        java.time.LocalDate.parse(value).toString() == value
    } catch (_: Exception) { false }
}

val SAMPLE_DESTINATION_IDS = setOf("nearby", "weekend", "chicago")

class DestinationRegistry(destinations: List<VerifiedDestination>) {
    private val entries: Map<String, VerifiedDestination>
    init {
        require(destinations.size <= 100)
        require(destinations.all { it.isValid() })
        require(destinations.map { it.id }.toSet().size == destinations.size)
        entries = destinations.associateBy { it.id }
    }
    val ids: Set<String> get() = entries.keys
    fun find(id: String): VerifiedDestination? = entries[id]
}

/** No authorized verified POI provider has been configured. Do not substitute sample venues. */
val ProductionDestinations = DestinationRegistry(emptyList())
