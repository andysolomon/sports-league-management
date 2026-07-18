/**
 * @description Shared utility class for REST resource URI parsing
 * @author Sports Management Team
 * @date 2024
 */
public with sharing class RestUtils {

    /**
     * Extracts a record ID from a REST request URI.
     * @param requestUri The full request URI (e.g., /services/apexrest/sportsmgmt/v1/leagues/a01...)
     * @param basePath The base path to strip (e.g., /sportsmgmt/v1/leagues)
     * @return The extracted ID string, or null if no ID segment exists
     */
    public static String extractIdFromUri(String requestUri, String basePath) {
        if (String.isBlank(requestUri) || String.isBlank(basePath)) {
            return null;
        }

        // Find the basePath in the URI and extract everything after it
        Integer baseIndex = requestUri.indexOf(basePath);
        if (baseIndex < 0) {
            return null;
        }

        String remainder = requestUri.substring(baseIndex + basePath.length());

        // Remove leading slash
        if (remainder.startsWith('/')) {
            remainder = remainder.substring(1);
        }

        // Remove trailing slash
        if (remainder.endsWith('/')) {
            remainder = remainder.substring(0, remainder.length() - 1);
        }

        return String.isBlank(remainder) ? null : remainder;
    }
}