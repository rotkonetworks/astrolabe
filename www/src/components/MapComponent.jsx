import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "uno.css";
import { debounce } from "lodash-es";

let wasmModule;

const MapComponent = () => {
  const [lat, setLat] = createSignal("");
  const [lon, setLon] = createSignal("");
  const [alt, setAlt] = createSignal("0");
  const [error, setError] = createSignal(null);
  const [encodedValues, setEncodedValues] = createSignal(null);
  const [communityValues, setCommunityValues] = createSignal(["", "", ""]);
  const [decodedValues, setDecodedValues] = createSignal([null, null, null]);
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

  const decodeCommunity = (index, value) => {
    if (!wasmModule) {
      showError("WASM module not initialized");
      return;
    }
    try {
      const communityValueInt = parseInt(value);
      if (
        isNaN(communityValueInt) ||
        value.length !== 9 ||
        (!value.startsWith("6") && !value.startsWith("9"))
      ) {
        throw new Error(
          "Invalid input: Must be a 9-digit number starting with 6 or 9",
        );
      }

      const decoded = wasmModule.decode_community(communityValueInt);
      console.log(`Decoded value for community ${value}:`, decoded);

      setDecodedValues((prev) => {
        const updated = [...prev];
        updated[index] = decoded;
        return updated;
      });

      setHistory((prev) => [
        { type: "decode", value, result: decoded },
        ...prev.slice(0, 9),
      ]);

      const decodedParts = decoded.split(", ");
      if (decodedParts.length === 2) {
        const [decodedLat, decodedLon] = decodedParts.map((part) =>
          parseFloat(part),
        );

        if (!isNaN(decodedLat) && !isNaN(decodedLon)) {
          setLat(decodedLat.toFixed(6));
          setLon(decodedLon.toFixed(6));
          smoothFlyTo(map(), decodedLat, decodedLon);
          updateMarkerPosition(decodedLat, decodedLon);
          encodeCommunity(decodedLat, decodedLon, alt());
        } else {
          throw new Error("Decoded values are not valid numbers");
        }
      } else {
        throw new Error(
          "Decoded value does not contain valid latitude and longitude",
        );
      }
    } catch (err) {
      showError(`Decoding error: ${err.message}`);
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
    <div class="relative w-full h-screen">
      <div id="map" class="absolute inset-0 w-full h-full"></div>

      <Show when={showAlert()}>
        <div class="absolute top-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded animate-fade-out">
          {error()}
        </div>
      </Show>

      <div class="absolute top-4 right-4 z-10 flex space-x-2">
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
        <div class="absolute bottom-4 left-4 w-96 bg-white bg-opacity-90 backdrop-blur-sm p-4 rounded shadow-lg max-h-[80vh] overflow-y-auto">
          <div class="flex justify-around mb-4">
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
                {communityValues().map((value, index) => (
                  <div key={index}>
                    <label class="block text-sm font-medium text-gray-700">
                      Decode Community #{index + 1}
                    </label>
                    <input
                      type="text"
                      placeholder="Enter 9-digit value"
                      value={value}
                      onInput={(e) => {
                        const newValue = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 9);
                        setCommunityValues((prev) => {
                          const updated = [...prev];
                          updated[index] = newValue;
                          return updated;
                        });
                        if (
                          newValue.length === 9 &&
                          (newValue.startsWith("6") || newValue.startsWith("9"))
                        ) {
                          decodeCommunity(index, newValue);
                        }
                      }}
                      class="w-full p-2 border rounded"
                    />
                    <Show when={decodedValues()[index]}>
                      <div class="bg-gray-100 p-3 rounded mt-2">
                        <h4 class="font-semibold mb-2">
                          Decoded Value #{index + 1}:
                        </h4>
                        <p>{decodedValues()[index]}</p>
                      </div>
                    </Show>
                  </div>
                ))}
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
      </Show>

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
