import { createSignal } from "solid-js";
import { A } from "@solidjs/router";

export default function About() {
  const [showSecurityDetails, setShowSecurityDetails] = createSignal(false);

  return (
    <div class="max-w-4xl mx-auto p-4 bg-gray-100 text-gray-800">
      <h1 class="text-3xl font-bold mb-4">Astrolabe: BGP Geospatial Encoding</h1>
      
      <p class="mb-4">
        Astrolabe is a protocol for encoding geospatial data in BGP communities. It's designed to enhance routing decisions and network diagnostics without compromising the existing BGP infrastructure.
      </p>

      <h2 class="text-2xl font-semibold mt-6 mb-2">Technical Specifications</h2>
      <ul class="list-disc pl-6 mb-4">
	<li>Uses standard 32-bit BGP communities (AS:NNNNNNNNNN format)</li>
        <li>Encodes latitude, longitude, and altitude</li>
        <li>Precision: ~1 meter for all dimensions</li>
        <li>Range:
          <ul class="list-disc pl-6">
            <li>Latitude: -90° to 90°</li>
            <li>Longitude: -180° to 180°</li>
            <li>Altitude: -8,388,607 to 8,388,607 meters</li>
          </ul>
        </li>
      </ul>

      <h2 class="text-2xl font-semibold mt-6 mb-2">Encoding Scheme</h2>
      <pre class="bg-gray-200 p-2 rounded mb-4">
        {`ASN:GeospatialValue

Latitude:  600,000,000 to 633,554,431
Longitude: 900,000,000 to 967,108,863
Altitude:  681,611,393 to 698,388,607

Total BGP community space usage: 2.734%`}
      </pre>

      <h2 class="text-2xl font-semibold mt-6 mb-2">Implementation</h2>
      <pre class="bg-gray-200 p-2 rounded mb-4">
        {`const LAT_SCALE: f64 = (1 << 25) as f64 - 1.0;
const LON_SCALE: f64 = (1 << 26) as f64 - 1.0;
const ALT_BASE: i32 = 690_000_000;
const ALT_MAX: i32 = 8_388_607;

pub fn encode_latitude(lat: f64) -> u32 {
    let lat = lat.clamp(-90.0, 90.0);
    let lat_normalized = ((lat + 90.0) * LAT_SCALE / 180.0).round() as u32;
    600_000_000 + lat_normalized
}

pub fn decode_latitude(lat_community: u32) -> f64 {
    let lat_normalized = (lat_community.saturating_sub(600_000_000)) as f64;
    ((lat_normalized * 180.0 / LAT_SCALE) - 90.0).clamp(-90.0, 90.0)
}

// Similar functions for longitude and altitude`}
      </pre>

      <h2 class="text-2xl font-semibold mt-6 mb-2">Security Considerations</h2>
      <ul class="list-disc pl-6 mb-4">
        <li>Data Exposure: Geolocation data is sensitive. Use only on necessary prefixes.</li>
        <li>Unauthorized Updates: Implement strict update policies to prevent malicious alterations.</li>
        <li>Precision vs. Privacy: Consider using reduced precision for sensitive locations.</li>
        <li>Validation: Always validate incoming Astrolabe data. Reject out-of-range or nonsensical values.</li>
        <li>Spoofing: Astrolabe data should not be trusted implicitly. Cross-verify with other data sources when critical.</li>
      </ul>

      <button
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={() => setShowSecurityDetails(!showSecurityDetails())}
      >
        {showSecurityDetails() ? "Hide" : "Show"} Detailed Security Info
      </button>

      {showSecurityDetails() && (
        <div class="mt-4">
          <h3 class="text-xl font-semibold mt-4 mb-2">Potential Vulnerabilities</h3>
          <ol class="list-decimal pl-6 mb-4">
            <li>Information Leakage: Could expose network topology details to adversaries.</li>
            <li>Targeted Attacks: Precise location data might facilitate physical or network-based targeted attacks.</li>
            <li>Traffic Analysis: May assist in mapping network structure and data flows.</li>
          </ol>

          <h3 class="text-xl font-semibold mt-4 mb-2">Hardening Recommendations</h3>
          <ol class="list-decimal pl-6 mb-4">
            <li>Implement Astrolabe selectively. Not every prefix needs geolocation data.</li>
            <li>Use BGP authentication mechanisms (e.g., RPKI) in conjunction with Astrolabe.</li>
            <li>Monitor for unexpected changes in advertised locations.</li>
            <li>Develop and enforce strict policies on Astrolabe data propagation.</li>
            <li>Regularly audit Astrolabe implementations and associated routing policies.</li>
          </ol>
        </div>
      )}

      <p class="mt-8 text-center">
        <A href="/" class="text-blue-500 hover:underline">Mapcoder</A>
        {" - "}
        <span>About</span>
      </p>
    </div>
  );
}
