// Mapbox state
// Used to store state of map, including layers etc

const state = {
  mapboxStyle: "dark",
  mapSettingsIsOpen: false,
  baseMATSimLayer: null,
  loadedMATSimLayers: [],
  loadedMATSimSource: null,
  selectedRegion: null,
  selectedFire: null,
  reloadOverlayLayersOnStyleData: false,
  mapInstance: null, // MapboxGL object
  mapCenter: [144.968447, -37.818232] // Federeation Square Melbourne
};

const getters = {
  mapOpts: state => {
    var opts = {
      style: "mapbox://styles/mapbox/" + state.mapboxStyle + "-v9",
      center: state.mapCenter,
      minZoom: 0,
      zoom: 6,
      maxZoom: 14
    };
    return opts;
  },
  mapInstance: state => state.mapInstance,
  mapboxStyle: state => state.mapboxStyle,
  mapCenter: state => state.mapCenter,
  mapSettingsIsOpen: state => state.mapSettingsIsOpen,
  baseMATSimLayer: state => state.baseMATSimLayer,
  loadedMATSimLayers: state => state.loadedMATSimLayers,
  loadedMATSimSource: state => state.loadedMATSimSource,
  selectedRegion: state => state.selectedRegion,
  selectedFire: state => state.selectedFire,
  reloadOverlayLayersOnStyleData: state => state.reloadOverlayLayersOnStyleData,
  firesInSelectedRegion: (state, getters, rootState, rootGetters) => {
    if (!state.selectedRegion) return null;
    return rootGetters.firesInRegion(state.selectedRegion);
  },
  selectedFireData: (state, getters) => {
    var fires = getters.firesInSelectedRegion;
    if (!fires) {
      return null;
    }
    var fire = fires.find(obj => obj.id === state.selectedFire);
    return fire;
  }
};

const mutations = {
  setMapInstance(state, newMap) {
    state.mapInstance = newMap;
  },
  setMapboxStyle(state, newStyle) {
    state.mapboxStyle = newStyle;
    state.mapInstance.setStyle(
      "mapbox://styles/mapbox/" + state.mapboxStyle + "-v9"
    );
    state.reloadOverlayLayersOnStyleData = true;
  },
  setMapSettingsIsOpen(state, newVal) {
    state.mapSettingsIsOpen = newVal;
  },
  setReloadOverlayLayersOnStyleData(state, newVal) {
    state.reloadOverlayLayersOnStyleData = newVal;
  },
  setSelectedRegion(state, newVal) {
    state.selectedRegion = newVal;
  },
  setBaseMATSimLayer(state, newVal) {
    state.baseMATSimLayer = newVal;
  },
  addMATSimLayer(state, layer) {
    state.loadedMATSimLayers.push(layer);
  },
  loadedMATSimSource(state, newVal) {
    state.loadedMATSimSource = newVal;
  },
  clearMATSimLayers(state) {
    state.baseMATSimLayer = null;
    state.loadedMATSimLayers = [];
  },
  setSelectedFire(state, newVal) {
    state.selectedFire = newVal;
  }
};

const actions = {
  loadMATSimRegion({ dispatch, getters }) {
    // ensure any existing matsim artifacts are removed
    dispatch("removeMATSimLayers");
    // Load new regions layers and fly there
    dispatch("loadLayers");
    dispatch("flyTo", getters.region(getters.selectedRegion).center);
  },
  removeMATSimLayers({ commit, getters }) {
    var map = getters.mapInstance;
    var loadedMATSimLayers = getters.loadedMATSimLayers;
    for (const layer of loadedMATSimLayers) {
      try {
        map.removeLayer(layer);
      } catch (e) {
        // ignore!
      }
    }
    commit("clearMATSimLayers");
    //console.log(map.getSource("statictest"));
    if (getters.loadedMATSimSource) {
      map.removeSource("statictest");
      commit("loadedMATSimSource", null);
    }
  },
  loadLayers({ dispatch, commit, getters, rootGetters }) {
    var region = rootGetters.region(getters.selectedRegion);
    var matsimNetworkLayer = region.matsimNetworkLayer;

    dispatch("addMATSimNetworkSource", {
      name: "statictest",
      pbfurl: region.matsimNetworkTiles
    });
    commit("setBaseMATSimLayer", matsimNetworkLayer);
    dispatch("addMATSimNetworkLayer", matsimNetworkLayer);

    var selectedFire = getters.selectedFireData;
    if (selectedFire) {
      dispatch("setFireLayer", selectedFire.geojson);
    }
  },
  flyTo({ getters }, target) {
    getters.mapInstance.flyTo({
      // These options control the ending camera position: centered at
      // the target, at given zoom level, and north up.
      center: target,
      zoom: 8,
      bearing: 0,
      // These options control the flight curve, making it move
      // slowly and zoom out almost completely before starting
      // to pan.
      speed: 0.5, // make the flying slow
      curve: 1, // change the speed at which it zooms out

      // This can be any easing function: it takes a number between
      // 0 and 1 and returns another number between 0 and 1.
      easing: function(t) {
        return t;
      }
    });
  },
  setFireLayer({ getters }, url) {
    var map = getters.mapInstance;
    var name = "phoenix-layer";
    // Set the data only if layer exists
    var layer = map.getLayer(name);
    if (typeof layer != "undefined") {
      map.getSource(name).setData(url);
      return;
    }
    // Else create the layer
    var layers = map.getStyle().layers;
    // Find the index of the first symbol layer in the map style
    var firstSymbolId;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].type === "symbol") {
        firstSymbolId = layers[i].id;
        break;
      }
    }
    map.addLayer(
      {
        id: name,
        type: "line",
        source: {
          type: "geojson",
          data: url
        },
        layout: {},
        paint: {
          "line-color": "#f00",
          "line-opacity": 0.4,
          "line-width": 2.0
        }
      },
      firstSymbolId
    );
  },
  addMATSimNetworkSource({ commit, getters }, source) {
    getters.mapInstance.addSource(source.name, {
      type: "vector",
      tiles: [source.pbfurl],
      minzoom: 0,
      maxzoom: 14
    });
    commit("loadedMATSimSource", source.name);
  },
  addMATSimNetworkLayer({ commit, getters }, matsimLayer) {
    var map = getters.mapInstance;
    var layers = map.getStyle().layers;
    // Find the index of the first symbol layer in the map style
    var firstSymbolId;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].type === "symbol") {
        firstSymbolId = layers[i].id;
        break;
      }
    }

    map.addLayer(
      {
        id: matsimLayer,
        type: "line",
        source: "statictest",
        "source-layer": matsimLayer,
        minzoom: 0,
        maxzoom: 22,
        paint: {
          "line-color": "#7777ff",
          "line-width": 0.5
        }
      },
      // This is the important part of this example: the addLayer
      // method takes 2 arguments: the layer as an object, and a string
      // representing another layer's name. if the other layer
      // exists in the stylesheet already, the new layer will be positioned
      // right before that layer in the stack, making it possible to put
      // 'overlays' anywhere in the layer stack.
      // Insert the layer beneath the first symbol layer.
      firstSymbolId
    );
    commit("addMATSimLayer", matsimLayer);
    map.addLayer(
      {
        id: matsimLayer + "-highlighted",
        type: "line",
        source: "statictest",
        "source-layer": matsimLayer,
        minzoom: 0,
        maxzoom: 22,
        paint: {
          "line-color": "#FF8C00",
          "line-width": 1.5
        },
        filter: ["in", "ID", ""]
      },
      firstSymbolId
    );
    commit("addMATSimLayer", matsimLayer + "-highlighted");
  }
};

export default {
  state,
  getters,
  mutations,
  actions
};