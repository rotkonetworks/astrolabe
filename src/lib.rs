use wasm_bindgen::prelude::*;
use std::fmt;

// Constants for geospatial encoding
const LAT_SCALE: f64 = (1 << 25) as f64 - 1.0; // 25 bits for latitude
const LON_SCALE: f64 = (1 << 26) as f64 - 1.0; // 26 bits for longitude
const ALT_BASE: i32 = 690_000_000; // 690,000,000 as sea level (0 meters)
const ALT_MAX: i32 = 8_388_607; // Maximum altitude value

// Utility function to round to five decimal places
fn round_to_five_decimals(value: f64) -> f64 {
    (value * 100000.0).round() / 100000.0
}

// Encode latitude in degrees to a BGP community value
#[wasm_bindgen]
pub fn encode_latitude(lat: f64) -> u32 {
    let lat = round_to_five_decimals(lat.clamp(-90.0, 90.0));
    let lat_normalized = ((lat + 90.0) * LAT_SCALE / 180.0).round() as u32;
    600_000_000 + lat_normalized
}

// Encode longitude in degrees to a BGP community value
#[wasm_bindgen]
pub fn encode_longitude(lon: f64) -> u32 {
    let lon = round_to_five_decimals(lon.clamp(-180.0, 180.0));
    let lon_normalized = ((lon + 180.0) * LON_SCALE / 360.0).round() as u32;
    900_000_000 + lon_normalized
}

// Encode altitude in meters to a BGP community value
#[wasm_bindgen]
pub fn encode_altitude(alt_m: f64) -> u32 {
    let altitude_normalized = alt_m.round() as i32;
    (ALT_BASE + altitude_normalized.clamp(-ALT_MAX, ALT_MAX)) as u32
}

// Decode a BGP community value to latitude in degrees
#[wasm_bindgen]
pub fn decode_latitude(lat_community: u32) -> f64 {
    let lat_normalized = (lat_community.saturating_sub(600_000_000)) as f64;
    round_to_five_decimals((lat_normalized * 180.0 / LAT_SCALE) - 90.0)
}

// Decode a BGP community value to longitude in degrees
#[wasm_bindgen]
pub fn decode_longitude(lon_community: u32) -> f64 {
    let lon_normalized = (lon_community.saturating_sub(900_000_000)) as f64;
    round_to_five_decimals((lon_normalized * 360.0 / LON_SCALE) - 180.0)
}

// Decode a BGP community value to altitude in meters
#[wasm_bindgen]
pub fn decode_altitude(alt_community: u32) -> f64 {
    let altitude_normalized = (alt_community as i32 - ALT_BASE) as f64;
    altitude_normalized.clamp(-ALT_MAX as f64, ALT_MAX as f64)
}

// Detect the type of community and decode it appropriately
#[wasm_bindgen]
pub fn decode_community(value: u32) -> String {
    match value {
        600_000_000..=633_554_431 => format!("Latitude: {:.5}", decode_latitude(value)),
        900_000_000..=967_108_863 => format!("Longitude: {:.5}", decode_longitude(value)),
        681_611_393..=698_388_607 => format!("Altitude: {:.0} meters", decode_altitude(value)),
        _ => "Unknown community".to_string(),
    }
}

// Struct to hold decoded community values
#[wasm_bindgen]
pub struct Communities {
    pub lat_community: u32,
    pub lon_community: u32,
    pub alt_community: u32,
}

// Implement `fmt::Debug` for Communities to facilitate debugging
impl fmt::Debug for Communities {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Communities {{ lat_community: {}, lon_community: {}, alt_community: {} }}",
            self.lat_community, self.lon_community, self.alt_community
        )
    }
}
