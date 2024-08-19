import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "uno.css";
import { debounce } from "lodash-es";
import { A } from "@solidjs/router";


let wasmModule;

const MapComponent = () => {
  const [accumulatedCoords, setAccumulatedCoords] = createSignal({});
  const [lat, setLat] = createSignal("");
  const [lon, setLon] = createSignal("");
  const [alt, setAlt] = createSignal("0");
  const [error, setError] = createSignal(null);
  const [decodeInput, setDecodeInput] = createSignal("");
  const [isValidInput, setIsValidInput] = createSignal(false);
  const [decodedValues, setDecodedValues] = createSignal([]);
  const [encodedValues, setEncodedValues] = createSignal(null);
  const [map, setMap] = createSignal(null);
  const [isOverlayVisible, setIsOverlayVisible] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal("encode");
  const [showAlert, setShowAlert] = createSignal(false);
  const [marker, setMarker] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [mapStyle, setMapStyle] = createSignal(
    "mapbox://styles/mapbox/dark-v10",
  );
  const [history, setHistory] = createSignal([]);
  const [zoomLevel, setZoomLevel] = createSignal(10);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [favorites, setFavorites] = createSignal([]);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = createSignal(false);
  const [itemToDelete, setItemToDelete] = createSignal(null);

  const deleteFavorite = (index) => {
    setItemToDelete(index);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = () => {
    setFavorites((prev) => prev.filter((_, i) => i !== itemToDelete()));
    setShowDeleteConfirmation(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirmation(false);
  };


  const smoothFlyTo = (map, targetLat, targetLon) => {
    map.flyTo({
      center: [targetLon, targetLat],
      essential: true,
      duration: 2000,
      zoom: zoomLevel(),
    });
  };

  const updateMarkerPosition = (newLat, newLon) => {
    if (marker()) {
      marker().setLngLat([newLon, newLat]);
    }
  };

  const initializeMap = (centerLat, centerLon) => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    const mapInstance = new mapboxgl.Map({
      container: "map",
      style: mapStyle(),
      center: [centerLon, centerLat],
      zoom: zoomLevel(),
    });
    setMap(mapInstance);

    const newMarker = new mapboxgl.Marker({
      draggable: true,
    })
    .setLngLat([centerLon, centerLat])
    .addTo(mapInstance);
    setMarker(newMarker);

    newMarker.on("dragend", () => {
      const { lng, lat } = newMarker.getLngLat();
      setLat(lat.toFixed(6));
      setLon(lng.toFixed(6));
      encodeCommunity(lat, lng, alt());
    });

    mapInstance.on("click", (e) => {
      const newLat = e.lngLat.lat;
      const newLon = e.lngLat.lng;
      setLat(newLat.toFixed(6));
      setLon(newLon.toFixed(6));
      updateMarkerPosition(newLat, newLon);
      smoothFlyTo(mapInstance, newLat, newLon);
      encodeCommunity(newLat, newLon, alt());
    });

    mapInstance.on("zoom", () => {
      setZoomLevel(mapInstance.getZoom());
    });

    mapInstance.addControl(new mapboxgl.NavigationControl());
    mapInstance.addControl(new mapboxgl.FullscreenControl());
  };

  const fetchLocation = async () => {
    setIsLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      return {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
    } catch (err) {
      showError(`Failed to get current location: ${err.message}`);
      const response = await fetch("/api/ip-location");
      if (!response.ok) throw new Error("Failed to fetch IP location");
      const data = await response.json();
      if (!data.loc) throw new Error("Location data is undefined");
      const [lat, lon] = data.loc.split(",").map(Number);
      return { lat, lon };
    } finally {
      setIsLoading(false);
    }
  };

  onMount(async () => {
    try {
      wasmModule = await import("../../pkg/astrolabe.js");
      await wasmModule.default();
      console.log("WASM module initialized successfully");

      const { lat: centerLat, lon: centerLon } = await fetchLocation();
      initializeMap(centerLat, centerLon);
      setLat(centerLat.toFixed(6));
      setLon(centerLon.toFixed(6));
      encodeCommunity(centerLat, centerLon, alt());
    } catch (err) {
      console.error("Error:", err);
      showError(`Failed to initialize map or fetch location: ${err.message}`);
      initializeMap(0, 0);
    }
  });

  onCleanup(() => {
    if (map()) {
      map().remove();
    }
  });

  const showError = (message) => {
    setError(message);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  const encodeCommunity = (latitude, longitude, altitude) => {
    if (!wasmModule) {
      showError("WASM module not initialized");
      return;
    }
    try {
      const latValue = parseFloat(latitude);
      const lonValue = parseFloat(longitude);
      const altValue = parseFloat(altitude);
      if (isNaN(latValue) || isNaN(lonValue) || isNaN(altValue)) {
        throw new Error("Invalid input values");
      }
      const latCommunity = wasmModule.encode_latitude(latValue);
      const lonCommunity = wasmModule.encode_longitude(lonValue);
      const altCommunity = wasmModule.encode_altitude(altValue);
      const newEncodedValues = {
        lat: latCommunity,
        lon: lonCommunity,
        alt: altCommunity,
      };
      setEncodedValues(newEncodedValues);

      setHistory((prev) => [
        {
          type: "encode",
          values: newEncodedValues,
          coordinates: { lat: latValue, lon: lonValue, alt: altValue },
        },
        ...prev.slice(0, 9),
      ]);

      smoothFlyTo(map(), latValue, lonValue);
      updateMarkerPosition(latValue, lonValue);
    } catch (err) {
      showError(`Encoding error: ${err.message}`);
    }
  };

  const decodeCommunity = async (value) => {
    if (!wasmModule) {
      showError("WASM module not initialized");
      return null;
    }
    try {
      const decoded = wasmModule.decode_community(parseInt(value));
      console.log(`Decoded value: ${decoded}`);
      const [type, decodedValue] = decoded.split(": ");
      return { type: type.toLowerCase(), value: parseFloat(decodedValue) };
    } catch (err) {
      showError(`Decoding error: ${err.message}`);
      return null;
    }
  };

  const goToAccumulatedLocation = () => {
    const coords = accumulatedCoords();
    if (coords.latitude && coords.longitude) {
      setLat(coords.latitude.toFixed(6));
      setLon(coords.longitude.toFixed(6));
      if (coords.altitude !== undefined) setAlt(coords.altitude.toString());
      smoothFlyTo(map(), coords.latitude, coords.longitude);
      updateMarkerPosition(coords.latitude, coords.longitude);
      encodeCommunity(coords.latitude, coords.longitude, coords.altitude || alt());
    }
  };

  const debouncedDecodeCommunity = debounce(async (value) => {
    setIsLoading(true);
    try {
      const result = await decodeCommunity(value);
      if (result) {
        setAccumulatedCoords(prev => ({ ...prev, [result.type]: result.value }));
        setDecodedValues((prev) => [{...result}, ...prev.slice(0, 4)]);

        setHistory((prev) => [
          { type: "decode", value, result: `${result.type}: ${result.value}` },
          ...prev.slice(0, 9),
        ]);
      }
    } catch (error) {
      console.error("Error in debouncedDecodeCommunity:", error);
    } finally {
      setIsLoading(false);
      setDecodeInput(""); // Clear input after decoding
      setIsValidInput(false);
    }
  }, 300);

  // Add this function to handle input changes
  const handleDecodeInputChange = (e) => {
    const newValue = e.target.value.replace(/\D/g, "").slice(0, 9);
    setDecodeInput(newValue);
    setIsValidInput(newValue.length === 9);
    if (newValue.length === 9) {
      debouncedDecodeCommunity(newValue);
    }
  };

  const debouncedEncodeCommunity = debounce(encodeCommunity, 300);

  createEffect(() => {
    if (lat() && lon()) {
      debouncedEncodeCommunity(lat(), lon(), alt());
    }
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        showError("Copied to clipboard!");
      },
      (err) => {
        showError("Failed to copy: " + err);
      },
    );
  };

  const exportData = () => {
    const data = JSON.stringify({
      encodedValues: encodedValues(),
      decodedValues: decodedValues(),
      history: history(),
      favorites: favorites(),
    });
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "astrolabe_data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          setEncodedValues(data.encodedValues);
          setDecodedValues(data.decodedValues);
          setHistory(data.history);
          setFavorites(data.favorites || []);
        } catch (err) {
          showError("Failed to import data: " + err.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const searchLocation = async () => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery())}.json?access_token=${mapboxgl.accessToken}`,
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const [lon, lat] = data.features[0].center;
        setLat(lat.toFixed(6));
        setLon(lon.toFixed(6));
        smoothFlyTo(map(), lat, lon);
        updateMarkerPosition(lat, lon);
        encodeCommunity(lat, lon, alt());
      } else {
        showError("Location not found");
      }
    } catch (err) {
      showError(`Search error: ${err.message}`);
    }
  };

  const addToFavorites = () => {
    const newFavorite = {
      lat: lat(),
      lon: lon(),
      alt: alt(),
      encoded: encodedValues(),
    };
    setFavorites((prev) => [...prev, newFavorite]);
  };

  const loadFavorite = (favorite) => {
    setLat(favorite.lat);
    setLon(favorite.lon);
    setAlt(favorite.alt);
    smoothFlyTo(map(), parseFloat(favorite.lat), parseFloat(favorite.lon));
    updateMarkerPosition(parseFloat(favorite.lat), parseFloat(favorite.lon));
    encodeCommunity(favorite.lat, favorite.lon, favorite.alt);
  };

  return (
    <div class="relative w-full h-screen pt-[260px]">

      <div id="map" class="absolute inset-0 w-full h-full"></div>

      <Show when={showAlert()}>
        <div class="absolute top-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded animate-fade-out">
          {error()}
        </div>
      </Show>

      <div class="absolute top-4 right-4 z-10 flex space-x-2 mr-8">
        <button
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300"
          onClick={() => setIsOverlayVisible(!isOverlayVisible())}
        >
          {isOverlayVisible() ? "Hide" : "Show"} Controls
        </button>
        <select
          class="px-4 py-2 bg-white rounded"
          onChange={(e) => {
            setMapStyle(e.target.value);
            map().setStyle(e.target.value);
          }}
        >
          <option value="mapbox://styles/mapbox/dark-v10">Dark</option>
          <option value="mapbox://styles/mapbox/light-v10">Light</option>
          <option value="mapbox://styles/mapbox/satellite-v9">Satellite</option>
          <option value="mapbox://styles/mapbox/outdoors-v11">Terrain</option>
        </select>
      </div>

      <Show when={isOverlayVisible()}>
        <div class="absolute bottom-4 left-4 w-64 md:w-96 bg-white bg-opacity-50 backdrop-blur-sm p-4 rounded shadow-lg">
          <div class="max-h-[80vh] overflow-y-auto">
          <Show when={activeTab() === "encode"}>
            <div>
              <h2 class="text-xl font-bold mb-4">Encode Astrolabe</h2>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Latitude
                  </label>
                  <input
                    type="number"
                    value={lat()}
                    onInput={(e) => setLat(e.target.value)}
                    class="w-full p-2 border rounded"
                    step="0.000001"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Longitude
                  </label>
                  <input
                    type="number"
                    value={lon()}
                    onInput={(e) => setLon(e.target.value)}
                    class="w-full p-2 border rounded"
                    step="0.000001"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Altitude (meters)
                  </label>
                  <input
                    type="number"
                    value={alt()}
                    onInput={(e) => setAlt(e.target.value)}
                    class="w-full p-2 border rounded"
                  />
                </div>
                <button
                  class="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300"
                  onClick={() =>
                    fetchLocation().then(({ lat, lon }) => {
                      setLat(lat.toFixed(6));
                      setLon(lon.toFixed(6));
                    })
                  }
                >
                  Use Current Location
                </button>

                <Show when={encodedValues()}>
                  <div class="bg-gray-100 p-3 rounded">
                    <h4 class="font-semibold mb-2">Encoded Values:</h4>
                    <p>
                      Latitude Community: {encodedValues().lat}{" "}
                      <button
                        onClick={() => copyToClipboard(encodedValues().lat)}
                        class="ml-2 text-blue-500"
                      >
                        Copy
                      </button>
                    </p>
                    <p>
                      Longitude Community: {encodedValues().lon}{" "}
                      <button
                        onClick={() => copyToClipboard(encodedValues().lon)}
                        class="ml-2 text-blue-500"
                      >
                        Copy
                      </button>
                    </p>
                    <p>
                      Altitude Community: {encodedValues().alt}{" "}
                      <button
                        onClick={() => copyToClipboard(encodedValues().alt)}
                        class="ml-2 text-blue-500"
                      >
                        Copy
                      </button>
                    </p>
                  </div>
                </Show>

                <button
                  class="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition duration-300"
                  onClick={addToFavorites}
                >
                  Add to Favorites
                </button>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === "decode"}>
            <div>
              <h2 class="text-xl font-bold mb-4">Decode Astrolabe</h2>
              <div class="space-y-4">
                <div class="relative">
                  <input
                    type="text"
                    placeholder="Enter 9-digit Astrolabe code"
                    value={decodeInput()}
                    onInput={handleDecodeInputChange}
                    class={`w-full p-2 pr-10 border rounded ${
decodeInput().length > 0
? isValidInput()
? "border-green-500"
: "border-red-500"
: ""
}`}
                    maxLength={9}
                  />
                  <div class="absolute right-2 top-2">
                    {isLoading() && (
                      <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                    )}
                    {!isLoading() && decodeInput().length > 0 && (
                      <span class={isValidInput() ? "text-green-500" : "text-red-500"}>
                        {decodeInput().length}/9
                      </span>
                    )}
                  </div>
                </div>

                <Show when={Object.keys(accumulatedCoords()).length > 0}>
                  <div class="bg-gray-100 p-3 rounded">
                    <h4 class="font-semibold mb-2">Accumulated Coordinates:</h4>
                    <p>Latitude: {accumulatedCoords().latitude?.toFixed(6) ?? 'N/A'}</p>
                    <p>Longitude: {accumulatedCoords().longitude?.toFixed(6) ?? 'N/A'}</p>
                    {accumulatedCoords().altitude !== undefined && <p>Altitude: {accumulatedCoords().altitude.toFixed(2)} meters</p>}
                    <Show when={accumulatedCoords().latitude !== undefined && accumulatedCoords().longitude !== undefined}>
                      <button
                        onClick={goToAccumulatedLocation}
                        class="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300"
                      >
                        Go to Location
                      </button>
                    </Show>
                  </div>
                </Show>

                <Show when={decodedValues().length > 0}>
                  <h4 class="font-semibold mb-2">Recent Decodes:</h4>
                  <For each={decodedValues()}>
                    {(result) => (
                      <div class="bg-gray-100 p-3 rounded mt-2">
                        <p class="font-semibold">{result.type.charAt(0).toUpperCase() + result.type.slice(1)}</p>
                        <p>{result.value.toFixed(6)}</p>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === "history"}>
            <div>
              <h2 class="text-xl font-bold mb-4">History</h2>
              <div class="space-y-4">
                {history().map((item, index) => (
                  <div key={index} class="bg-gray-100 p-3 rounded">
                    <p class="font-semibold">
                      {item.type === "encode" ? "Encoded" : "Decoded"}
                    </p>
                    {item.type === "encode" ? (
                      <>
                        <p>
                          Lat: {item.coordinates.lat}, Lon:{" "}
                          {item.coordinates.lon}, Alt: {item.coordinates.alt}
                        </p>
                        <p>
                          Encoded: {item.values.lat}, {item.values.lon},{" "}
                          {item.values.alt}
                        </p>
                      </>
                    ) : (
                        <>
                          <p>Input: {item.value}</p>
                          <p>Result: {item.result}</p>
                        </>
                      )}
                    <button
                      class="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300"
                      onClick={() => {
                        if (item.type === "encode") {
                          setLat(item.coordinates.lat);
                          setLon(item.coordinates.lon);
                          setAlt(item.coordinates.alt);
                          smoothFlyTo(
                            map(),
                            parseFloat(item.coordinates.lat),
                            parseFloat(item.coordinates.lon),
                          );
                          updateMarkerPosition(
                            parseFloat(item.coordinates.lat),
                            parseFloat(item.coordinates.lon),
                          );
                        } else {
                          const [decodedLat, decodedLon] = item.result
                          .split(", ")
                          .map(parseFloat);
                          setLat(decodedLat.toFixed(6));
                          setLon(decodedLon.toFixed(6));
                          smoothFlyTo(map(), decodedLat, decodedLon);
                          updateMarkerPosition(decodedLat, decodedLon);
                        }
                      }}
                    >
                      Go to Location
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Show>

          <Show when={activeTab() === "favorites"}>
            <div>
              <h2 class="text-xl font-bold mb-4">Favorites</h2>
              <div class="space-y-4">
                {favorites().map((favorite, index) => (
                  <div key={index} class="bg-gray-100 p-3 rounded flex justify-between items-center">
                    <div>
                      <p>Lat: {favorite.lat}, Lon: {favorite.lon}, Alt: {favorite.alt}</p>
                      <p>Encoded: {favorite.encoded.lat}, {favorite.encoded.lon}, {favorite.encoded.alt}</p>
                    </div>
                    <div>
                      <button
                        class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300"
                        onClick={() => loadFavorite(favorite)}
                      >
                        Load
                      </button>
                      <button
                        class="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition duration-300"
                        onClick={() => deleteFavorite(index)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Show>

          <div class="mt-4 space-y-2">
            <div class="flex space-x-2">
              <input
                type="text"
                placeholder="Search location"
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.target.value)}
                class="flex-grow p-2 border rounded"
              />
              <button
                class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300"
                onClick={searchLocation}
              >
                Search
              </button>
            </div>
            <div class="flex space-x-2">
              <button
                class="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300"
                onClick={exportData}
              >
                Export Data
              </button>
              <label class="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300 text-center cursor-pointer">
                Import Data
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  class="hidden"
                />
              </label>
            </div>
          </div>
          </div>
          <div class="flex justify-around mt-4">
            <button
              class={`px-4 py-2 rounded transition duration-300 ${activeTab() === "encode" ? "bg-blue-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
              onClick={() => setActiveTab("encode")}
            >
              Encode
            </button>
            <button
              class={`px-4 py-2 rounded transition duration-300 ${activeTab() === "decode" ? "bg-blue-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
              onClick={() => setActiveTab("decode")}
            >
              Decode
            </button>
            <button
              class={`px-4 py-2 rounded transition duration-300 ${activeTab() === "history" ? "bg-blue-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
              onClick={() => setActiveTab("history")}
            >
              History
            </button>
            <button
              class={`px-4 py-2 rounded transition duration-300 ${activeTab() === "favorites" ? "bg-blue-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
              onClick={() => setActiveTab("favorites")}
            >
              Favorites
            </button>
          </div>
        </div>
      </Show>

      <A href="/about" class="absolute bottom-4 right-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300">
        Learn more
      </A>

      <Show when={showDeleteConfirmation()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div class="bg-white p-4 rounded">
            <p>Are you sure you want to delete this favorite?</p>
            <div class="mt-4 flex justify-end space-x-2">
              <button
                class="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400 transition duration-300"
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button
                class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition duration-300"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={isLoading()}>
        <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div class="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-white"></div>
        </div>
      </Show>
    </div>
  );
};

export default MapComponent;
