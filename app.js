// Initialize the map
const map = L.map('map').setView([27.382, 79.602], 14);

// Add base layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/positron/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
    minZoom: 10
}).addTo(map);

// Create layer groups
const lineLayer = L.featureGroup();
const nodeLayer = L.featureGroup();
const allLayers = L.featureGroup();

// Style functions
function getLineStyle(feature) {
    return {
        color: '#3498db',
        weight: 3,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
    };
}

function getNodeStyle(feature, nodeCount) {
    const isMultiNode = nodeCount > 1;
    return {
        radius: isMultiNode ? 6 : 4,
        fillColor: isMultiNode ? '#f39c12' : '#e74c3c',
        color: 'white',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
    };
}

// Statistics
let stats = {
    totalFeatures: 0,
    lineCount: 0,
    nodeCount: 0,
    lineString: 0,
    multiLineString: 0,
    nodeCounts: {},
    nodeIndex: 0
};

// Track all nodes for indexing
const nodesList = [];

// Load and process GeoJSON
function loadGeoJSON() {
    fetch('FRK_for_Webcast_v02_4326.geojson')
        .then(response => response.json())
        .then(data => {
            console.log('GeoJSON loaded:', data);
            processGeoJSON(data);
        })
        .catch(error => console.error('Error loading GeoJSON:', error));
}

function processGeoJSON(geojson) {
    const nodeCoordinates = new Map();

    // First pass: collect all node coordinates
    geojson.features.forEach(feature => {
        const geometry = feature.geometry;

        if (geometry.type === 'LineString') {
            geometry.coordinates.forEach(coord => {
                const key = `${coord[0]},${coord[1]}`;
                nodeCoordinates.set(key, (nodeCoordinates.get(key) || 0) + 1);
            });
            stats.lineString++;
        } else if (geometry.type === 'MultiLineString') {
            geometry.coordinates.forEach(lineString => {
                lineString.forEach(coord => {
                    const key = `${coord[0]},${coord[1]}`;
                    nodeCoordinates.set(key, (nodeCoordinates.get(key) || 0) + 1);
                });
            });
            stats.multiLineString++;
        }
    });

    // Second pass: render features
    geojson.features.forEach(feature => {
        const geometry = feature.geometry;
        stats.totalFeatures++;

        // Handle LineString
        if (geometry.type === 'LineString') {
            const coordinates = geometry.coordinates.map(coord => [coord[1], coord[0]]);
            const line = L.polyline(coordinates, getLineStyle(feature))
                .bindPopup(createPopup(feature, 'LineString'))
                .addTo(lineLayer);
            allLayers.addLayer(line);
            stats.lineCount++;
        }
        // Handle MultiLineString
        else if (geometry.type === 'MultiLineString') {
            geometry.coordinates.forEach(lineStringCoords => {
                const coordinates = lineStringCoords.map(coord => [coord[1], coord[0]]);
                const line = L.polyline(coordinates, getLineStyle(feature))
                    .bindPopup(createPopup(feature, 'MultiLineString'))
                    .addTo(lineLayer);
                allLayers.addLayer(line);
            });
            stats.lineCount++;
        }
    });

    // Render nodes
    let nodeIndex = 0;
    nodeCoordinates.forEach((count, key) => {
        const [lng, lat] = key.split(',').map(Number);
        stats.nodeCounts[key] = count;
        stats.nodeCount++;
        const nodeId = `NODE_${nodeIndex}`;

        const nodeData = {
            id: nodeId,
            index: nodeIndex,
            lat: lat,
            lng: lng,
            key: key,
            connections: count,
            type: count > 1 ? 'Junction' : 'Endpoint'
        };

        nodesList.push(nodeData);

        const circle = L.circleMarker([lat, lng], getNodeStyle(null, count))
            .bindPopup(createNodePopup(lat, lng, count))
            .on('click', () => displayNodeData(nodeData))
            .addTo(nodeLayer);
        allLayers.addLayer(circle);
        
        nodeIndex++;
    });

    // Add layers to map
    lineLayer.addTo(map);
    nodeLayer.addTo(map);

    // Update UI
    updateStatistics();
    fitMapToBounds();
}

function createPopup(feature, type) {
    return `
        <div style="font-size: 12px;">
            <strong>Pipeline Segment</strong><br>
            Type: ${type}<br>
            Layer: ${feature.properties?.Layer || 'N/A'}<br>
            <hr style="margin: 5px 0;">
            <small>Click for coordinates</small>
        </div>
    `;
}

function createNodePopup(lat, lng, count) {
    return `
        <div style="font-size: 12px;">
            <strong>Pipeline Node</strong><br>
            Latitude: ${lat.toFixed(6)}<br>
            Longitude: ${lng.toFixed(6)}<br>
            Connections: ${count}<br>
            <hr style="margin: 5px 0;">
            <small style="color: ${count > 1 ? '#f39c12' : '#e74c3c'};">
                ${count > 1 ? 'Junction Point' : 'Endpoint'}
            </small>
        </div>
    `;
}

function updateStatistics() {
    document.getElementById('totalFeatures').textContent = stats.totalFeatures;
    document.getElementById('nodeCount').textContent = stats.nodeCount;
    document.getElementById('lineCount').textContent = stats.lineCount;
    
    // Calculate center
    const bounds = allLayers.getBounds();
    if (bounds.isValid()) {
        const center = bounds.getCenter();
        document.getElementById('centerLat').textContent = `${center.lat.toFixed(6)}°`;
        document.getElementById('centerLon').textContent = `${center.lng.toFixed(6)}°`;
    }

    // Calculate approximate coverage
    if (bounds.isValid()) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const latDiff = ne.lat - sw.lat;
        const lngDiff = ne.lng - sw.lng;
        const coverage = (latDiff * lngDiff).toFixed(4);
        document.getElementById('coverage').textContent = `${coverage}°²`;
    }
}

function fitMapToBounds() {
    const bounds = allLayers.getBounds();
    if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Control buttons
document.getElementById('zoomIn').addEventListener('click', () => {
    map.zoomIn();
});

document.getElementById('zoomOut').addEventListener('click', () => {
    map.zoomOut();
});

document.getElementById('fitBounds').addEventListener('click', () => {
    fitMapToBounds();
});

// Load data on page load
window.addEventListener('load', loadGeoJSON);

// Display node data in panel
function displayNodeData(nodeData) {
    const dataPanel = document.getElementById('dataPanel');
    const pointTypeInfo = document.getElementById('pointTypeInfo');
    
    // Set basic info
    document.getElementById('pointLat').textContent = nodeData.lat.toFixed(8);
    document.getElementById('pointLng').textContent = nodeData.lng.toFixed(8);
    document.getElementById('pointCoords').textContent = `${nodeData.lng.toFixed(6)}, ${nodeData.lat.toFixed(6)}`;
    document.getElementById('connectionCount').textContent = nodeData.connections;
    document.getElementById('pointId').textContent = nodeData.id;
    document.getElementById('pointIndex').textContent = nodeData.index + 1;
    
    // Set type badge
    const badgeClass = nodeData.connections > 1 ? 'badge-junction' : 'badge-endpoint';
    const typeLabel = nodeData.connections > 1 ? 'Junction Point' : 'End Point';
    document.getElementById('pointTypeLabel').innerHTML = `<span class="badge ${badgeClass}">${typeLabel}</span>`;
    
    pointTypeInfo.innerHTML = `
        <div class="data-info" style="border-left-color: ${nodeData.connections > 1 ? '#f39c12' : '#e74c3c'};">
            <div style="font-size: 14px; font-weight: 600; color: ${nodeData.connections > 1 ? '#f39c12' : '#e74c3c'};">
                ${nodeData.connections > 1 ? '🔀 Junction Point' : '🔴 Endpoint'}
            </div>
            <div style="font-size: 12px; color: #7f8c8d; margin-top: 5px;">
                ${nodeData.connections > 1 
                    ? `Connected to ${nodeData.connections} pipeline segments` 
                    : 'Terminal point of the pipeline'}
            </div>
        </div>
    `;
    
    // Show panel
    dataPanel.classList.add('active');
    
    // Center map on clicked point with slight animation
    map.setView([nodeData.lat, nodeData.lng], 16, { animate: true });
}

// Close data panel
document.getElementById('closePanelBtn').addEventListener('click', () => {
    document.getElementById('dataPanel').classList.remove('active');
});

// Close panel when clicking outside
map.on('click', (e) => {
    // Only close if clicking on map, not on a marker
    if (e.latlng) {
        // Check if click was on a circle marker
        const circle = document.querySelector('.leaflet-interactive:hover');
        if (!circle) {
            document.getElementById('dataPanel').classList.remove('active');
        }
    }
});
