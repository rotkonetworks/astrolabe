use astrolabe::{encode_latitude, encode_longitude, encode_altitude, decode_latitude, decode_longitude, decode_altitude, decode_community};

const LAT_TOLERANCE: f64 = 0.00001; // 5 decimal places tolerance for latitude/longitude
                                    //
// Test encoding and decoding of latitude
#[test]
fn test_encode_decode_latitude() {
    let test_values = [
        (-90.0, 600000000),    // Minimum latitude
        (0.0, 616777216),      // Equator
        (45.0, 625165823),     // Midway between equator and north pole
        (90.0, 633554431),     // Maximum latitude
        (37.7749, 623818967),  // Specific latitude (San Francisco)
    ];

    for &(lat, expected_encoding) in &test_values {
        let encoded = encode_latitude(lat);
        assert_eq!(encoded, expected_encoding, "Latitude encoding failed for {}", lat);

        let decoded = decode_latitude(encoded);
        assert!((lat - decoded).abs() < LAT_TOLERANCE, "Latitude decoding failed for {}", lat);
    }
}

// Test encoding and decoding of longitude
#[test]
fn test_encode_decode_longitude() {
    let test_values = [
        (-180.0, 900000000),   // Minimum longitude
        (0.0, 933554432),      // Prime meridian
        (90.0, 950331647),     // 90° east longitude
        (180.0, 967108863),    // Maximum longitude
        (-122.4194, 910733802),// Specific longitude (San Francisco)
    ];

    for &(lon, expected_encoding) in &test_values {
        let encoded = encode_longitude(lon);
        assert_eq!(encoded, expected_encoding, "Longitude encoding failed for {}", lon);

        let decoded = decode_longitude(encoded);
        assert!((lon - decoded).abs() < LAT_TOLERANCE, "Longitude decoding failed for {}", lon);
    }
}

// Test encoding and decoding of altitude in meters
#[test]
fn test_encode_decode_altitude() {
    let test_values = [
        (0.0, 690000000),        // Sea level
        (100.0, 690000100),      // 100 meters above sea level
        (-100.0, 689999900),     // 100 meters below sea level
        (8388607.0, 698388607),  // Maximum altitude (8,388,607 meters)
        (-8388607.0, 681611393), // Minimum altitude (-8,388,607 meters)
    ];

    for &(alt, expected_encoding) in &test_values {
        let encoded = encode_altitude(alt);
        assert_eq!(encoded, expected_encoding, "Altitude encoding failed for {} meters", alt);

        let decoded = decode_altitude(encoded);
        assert_eq!(decoded, alt, "Altitude decoding failed for {} meters", alt);
    }
}

// Test the decode_community function for latitude, longitude, and altitude
#[test]
fn test_decode_community() {
    let lat_value = encode_latitude(37.7749);      // San Francisco latitude
    let lon_value = encode_longitude(-122.4194);   // San Francisco longitude
    let alt_value = encode_altitude(15.0);         // 15 meters above sea level

    let lat_decoded = decode_community(lat_value);
    assert_eq!(lat_decoded, "Latitude: 37.77490", "Latitude decoding via decode_community failed");

    let lon_decoded = decode_community(lon_value);
    assert_eq!(lon_decoded, "Longitude: -122.41940", "Longitude decoding via decode_community failed");

    let alt_decoded = decode_community(alt_value);
    assert_eq!(alt_decoded, "Altitude: 15 meters", "Altitude decoding via decode_community failed");
}

// Test generating communities and decoding them
#[test]
fn test_generate_and_decode_communities() {
    let lat = 51.5074; // London latitude
    let lon = -0.1278; // London longitude
    let alt = 35.0;    // 35 meters above sea level

    let lat_community = encode_latitude(lat);
    let lon_community = encode_longitude(lon);
    let alt_community = encode_altitude(alt);

    assert_eq!(decode_latitude(lat_community), lat);
    assert_eq!(decode_longitude(lon_community), lon);
    assert_eq!(decode_altitude(alt_community), alt);
}

// Test encoding and decoding of latitude and longitude without altitude
#[test]
fn test_lat_lon_without_altitude() {
    let lat = 40.7128;  // New York latitude
    let lon = -74.0060; // New York longitude

    let lat_community = encode_latitude(lat);
    let lon_community = encode_longitude(lon);

    assert_eq!(decode_latitude(lat_community), lat, "Latitude decoding failed");
    assert_eq!(decode_longitude(lon_community), lon, "Longitude decoding failed");
}
