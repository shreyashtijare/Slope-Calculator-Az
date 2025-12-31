/* -------- Load Azure Maps API Dynamically -------- */
(function() {
  let mapsLoaded = false;

  window.loadAzureMaps = async function() {
    if (mapsLoaded) return true;
    
    try {
      const response = await fetch('/api/maps-config');
      const data = await response.json();
      
      if (!data.clientId && !data.subscriptionKey) {
        console.error('No credentials received');
        return false;
      }
      
      window.azureMapsClientId = data.clientId;
      window.azureMapsSubscriptionKey = data.subscriptionKey;
      
      const mapScript = document.createElement('script');
      mapScript.src = 'https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js';
      
      await new Promise((resolve, reject) => {
        mapScript.onload = resolve;
        mapScript.onerror = reject;
        document.head.appendChild(mapScript);
      });
      
      const drawScript = document.createElement('script');
      drawScript.src = 'https://atlas.microsoft.com/sdk/javascript/drawing/0/atlas-drawing.min.js';
      
      await new Promise((resolve, reject) => {
        drawScript.onload = () => {
          mapsLoaded = true;
          resolve();
        };
        drawScript.onerror = reject;
        document.head.appendChild(drawScript);
      });
      
      console.log('Azure Maps loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading Azure Maps:', error);
      return false;
    }
  };
})();

/* -------- Sidebar -------- */
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

if (sidebarToggle) {
  sidebarToggle.onclick = () => {
    sidebar.classList.toggle("open");
  };
}

/* -------- Panel Navigation -------- */
const panels = document.querySelectorAll(".panel");
let mapInitialized = false;
let map;
let drawingManager;
let activeShape = null;
let contextLatLng = null;
let distancePath = [];
let distanceDataSource = null;
let measuringDistance = false;

const contextMenu = document.getElementById("contextMenu");
const infoPanel = document.getElementById("infoPanel");

document.querySelectorAll(".sidebar a").forEach(link => {
  link.addEventListener("click", async (e) => {
    e.preventDefault();
    if (sidebar) sidebar.classList.remove("open");

    panels.forEach(p => p.classList.remove("active"));
    const target = document.getElementById(link.dataset.panel);
    if (target) target.classList.add("active");

    if (link.dataset.panel === "mapPanel") {
      if (!mapInitialized) {
        const loaded = await window.loadAzureMaps();
        if (loaded) {
          initMap();
          mapInitialized = true;
        } else {
          alert('Failed to load Azure Maps.');
        }
      } else if (map) {
        map.resize();
      }
    }
  });
});

/* -------- Slope Calculator -------- */
const he = document.getElementById("he");
const le = document.getElementById("le");
const distance = document.getElementById("distance");
const slope = document.getElementById("slope");
const result = document.getElementById("result");
const calculateBtn = document.getElementById("calculateBtn");
const resetBtn = document.getElementById("resetBtn");

if (calculateBtn) {
  calculateBtn.onclick = () => {
    const HE = parseFloat(he.value);
    const LE = parseFloat(le.value);
    const D = parseFloat(distance.value);
    const S = parseFloat(slope.value);

    if ([HE, LE, D, S].filter(v => !isNaN(v)).length < 3) {
      if (result) result.textContent = "⚠️ Enter any 3 values.";
      return;
    }

    if (isNaN(S)) {
      slope.value = (((HE - LE) / D) * 100).toFixed(3);
      if (result) result.textContent = "Slope calculated.";
    } else if (isNaN(D)) {
      distance.value = ((HE - LE) / (S / 100)).toFixed(3);
      if (result) result.textContent = "Distance calculated.";
    } else if (isNaN(HE)) {
      he.value = (LE + D * (S / 100)).toFixed(3);
      if (result) result.textContent = "Higher elevation calculated.";
    } else if (isNaN(LE)) {
      le.value = (HE - D * (S / 100)).toFixed(3);
      if (result) result.textContent = "Lower elevation calculated.";
    }
  };
}

if (resetBtn) {
  resetBtn.onclick = () => {
    if (he) he.value = "";
    if (le) le.value = "";
    if (distance) distance.value = "";
    if (slope) slope.value = "";
    if (result) result.textContent = "";
  };
}

/* -------- Conversion -------- */
const convPercent = document.getElementById("convPercent");
const ratioRise = document.getElementById("ratioRise");
const ratioRun = document.getElementById("ratioRun");
const convAngle = document.getElementById("convAngle");
const convertBtn = document.getElementById("convertBtn");

if (convertBtn) {
  convertBtn.onclick = () => {
    const p = parseFloat(convPercent.value);
    const r = parseFloat(ratioRise.value);
    const run = parseFloat(ratioRun.value);
    const a = parseFloat(convAngle.value);
    const out = document.getElementById("convResult");

    if (!isNaN(p)) {
      const angle = Math.atan(p / 100) * 180 / Math.PI;
      if (out) out.innerHTML = `${p}%<br>Ratio: 1:${(100 / p).toFixed(3)}<br>Angle: ${angle.toFixed(3)}°`;
      return;
    }

    if (!isNaN(r) && !isNaN(run)) {
      const percent = (r / run) * 100;
      const angle = Math.atan(r / run) * 180 / Math.PI;
      if (out) out.innerHTML = `${r}:${run}<br>Percent: ${percent.toFixed(3)}%<br>Angle: ${angle.toFixed(3)}°`;
      return;
    }

    if (!isNaN(a)) {
      const percent = Math.tan(a * Math.PI / 180) * 100;
      if (out) out.innerHTML = `${a}°<br>Percent: ${percent.toFixed(3)}%<br>Ratio: 1:${(100 / percent).toFixed(3)}`;
      return;
    }

    if (out) out.textContent = "⚠️ Enter a value to convert.";
  };
}

/* -------- Azure Map -------- */
function initMap() {
  const mapElement = document.getElementById("map");
  
  // Try Client ID first (more reliable for Gen2), fallback to subscription key
  const authOptions = window.azureMapsClientId ? {
    authType: 'anonymous',
    clientId: window.azureMapsClientId,
    getToken: function(resolve, reject, map) {
      // Use built-in anonymous authentication with client ID
      resolve(window.azureMapsClientId);
    }
  } : {
    authType: 'subscriptionKey',
    subscriptionKey: window.azureMapsSubscriptionKey
  };

  if (!mapElement || (!window.azureMapsClientId && !window.azureMapsSubscriptionKey)) {
    console.error("Map element or credentials not found");
    return;
  }

  console.log('Initializing map with', window.azureMapsClientId ? 'Client ID' : 'Subscription Key');

  map = new atlas.Map('map', {
    center: [78.9629, 20.5937],
    zoom: 4,
    style: 'road',
    view: 'Auto',
    authOptions: authOptions,
    renderWorldCopies: false,
    preserveDrawingBuffer: true
  });

  map.events.add('ready', function() {
    console.log('Map is ready!');
    
    drawingManager = new atlas.drawing.DrawingManager(map, {
      toolbar: new atlas.control.DrawingToolbar({
        buttons: ['draw-polygon', 'draw-rectangle', 'edit-geometry'],
        position: 'top-right',
        style: 'light'
      })
    });

    map.events.add('drawingcomplete', drawingManager, function(shape) {
      if (activeShape) {
        drawingManager.getSource().remove(activeShape);
      }
      activeShape = shape;
    });

    if (contextMenu) {
      map.events.add('contextmenu', function(e) {
        e.preventDefault();
        contextLatLng = e.position;

        const pixel = map.positionsToPixels([e.position])[0];
        contextMenu.style.left = pixel[0] + 'px';
        contextMenu.style.top = pixel[1] + 'px';
        contextMenu.style.display = 'block';
      });

      map.events.add('click', function(e) {
        if (contextMenu.style.display === 'block') {
          contextMenu.style.display = 'none';
        }

        if (measuringDistance && e.position) {
          contextLatLng = e.position;
          distancePath.push(e.position);
          updateDistanceLine();
        }
      });

      document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target) && !mapElement.contains(e.target)) {
          contextMenu.style.display = 'none';
        }
      });
    }
  });
  
  map.events.add('error', function(e) {
    if (e.error && !e.error.message?.includes('aborted') && 
        !e.error.message?.includes('Expected value to be of type number')) {
      console.error('Map error:', e);
      alert('Map authentication error. Check Azure Maps account permissions.');
    }
  });
}

function showInfo(html) {
  if (infoPanel) {
    infoPanel.innerHTML = html;
    infoPanel.style.display = "block";
  }
}

function hideInfo() {
  if (infoPanel) {
    infoPanel.style.display = "none";
  }
}

function getShapeArea(shape) {
  if (!shape) return 0;
  
  const geometry = shape.toJson().geometry;
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates[0];
    return Math.abs(atlas.math.getArea(coords));
  }
  return 0;
}

const clearShapeBtn = document.getElementById("clearShape");
if (clearShapeBtn) {
  clearShapeBtn.onclick = () => {
    if (activeShape && drawingManager) {
      drawingManager.getSource().remove(activeShape);
      activeShape = null;
    }
  };
}

const toggleStyleBtn = document.getElementById("toggleStyle");
let currentStyle = 'road';
let isChangingStyle = false;

if (toggleStyleBtn) {
  toggleStyleBtn.onclick = () => {
    if (!map || isChangingStyle) return;
    
    isChangingStyle = true;
    toggleStyleBtn.disabled = true;
    
    if (currentStyle === 'road') {
      map.setStyle({ style: 'satellite_road_labels' });
      currentStyle = 'satellite';
      toggleStyleBtn.textContent = '🗺️ Road';
    } else {
      map.setStyle({ style: 'road' });
      currentStyle = 'road';
      toggleStyleBtn.textContent = '🛰️ Satellite';
    }
    
    setTimeout(() => {
      isChangingStyle = false;
      toggleStyleBtn.disabled = false;
    }, 1000);
  };
}

if (contextMenu) {
  contextMenu.addEventListener("click", e => {
    const action = e.target.dataset.action;
    contextMenu.style.display = "none";

    if (!action || !contextLatLng) return;

    const lng = contextLatLng[0];
    const lat = contextLatLng[1];

    if (action === "coords") {
      showInfo(`
        <b>Coordinates</b><br>
        Latitude: ${lat.toFixed(6)}<br>
        Longitude: ${lng.toFixed(6)}
      `);
    }

    if (action === "area") {
      if (!activeShape) {
        showInfo("⚠️ Draw a polygon or rectangle first.");
        return;
      }

      const area = getShapeArea(activeShape);
      showInfo(`
        <b>Area</b><br>
        ${area.toFixed(2)} m²<br>
        ${(area / 10000).toFixed(4)} ha<br>
        ${(area * 0.000247105).toFixed(4)} acres
      `);
    }

    if (action === "startDistance") {
      measuringDistance = true;
      distancePath = [];
      
      if (!distanceDataSource) {
        distanceDataSource = new atlas.source.DataSource();
        map.sources.add(distanceDataSource);
        
        map.layers.add(new atlas.layer.LineLayer(distanceDataSource, null, {
          strokeColor: 'red',
          strokeWidth: 2
        }));
      } else {
        distanceDataSource.clear();
      }
      
      showInfo("📏 Distance measurement started.<br>Click to add points.");
    }

    if (action === "finishDistance") {
      measuringDistance = false;
      if (distancePath.length > 1) {
        const length = atlas.math.getLength(distancePath);
        showInfo(`
          <b>Distance</b><br>
          ${length.toFixed(2)} m<br>
          ${(length * 3.28084).toFixed(2)} ft
        `);
      } else {
        showInfo("⚠️ Click at least 2 points to measure.");
      }
    }

    if (action === "export") {
      if (!activeShape) {
        showInfo("⚠️ Draw an area first.");
        return;
      }

      const center = map.getCamera().center;
      const zoom = map.getCamera().zoom;
      const mapType = map.getStyle().style;

      fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          center: center,
          zoom: Math.round(zoom),
          mapType: mapType.includes('satellite') ? 'satellite' : 'road'
        })
      })
        .then(res => {
          if (!res.ok) throw new Error('Export failed');
          return res.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "map_export.png";
          a.click();
          showInfo("✅ Map exported successfully!");
        })
        .catch((err) => {
          console.error(err);
          showInfo("❌ Export failed.");
        });
    }
  });
}

function updateDistanceLine() {
  if (distanceDataSource && distancePath.length > 0) {
    distanceDataSource.clear();
    const line = new atlas.data.LineString(distancePath);
    distanceDataSource.add(new atlas.data.Feature(line));
  }
}
