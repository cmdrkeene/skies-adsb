import * as THREE from 'three'
import { Text } from 'troika-three-text'
import * as UTILS from './utils.js'

export const map = {}
export const poiLabels = []

// Default theme
var GRASS_COLOR = new THREE.Color(0x2D3D3C)
var TEXT_COLOR = new THREE.Color(0xff00ff)
var POINT_COLOR = new THREE.Color(0xff00ff)
var BORDER_COLOR = new THREE.Color(0x81efff)
var LAND_COLOR = new THREE.Color(0x00ff00)
var WATER_COLOR = new THREE.Color(0x0000ff)
var ROAD_COLOR = new THREE.Color(0xff0000)

// Pick a theme
var COLOR_THEME = "apple_maps_night"
switch (COLOR_THEME) {
  case "realistic":
    // Realistic theme
    TEXT_COLOR =  new THREE.Color(0xff00ff) // Magenta
    POINT_COLOR = new THREE.Color(0xff00ff) // Magenta
    BORDER_COLOR = new THREE.Color(0xa0a0a0) // Light gray
    LAND_COLOR = new THREE.Color(0x556b2f) // Dark olive green
    WATER_COLOR = new THREE.Color(0x4682b4) // Steel blue
    ROAD_COLOR = new THREE.Color(0x808080) // Gray
    break
  case "apple_maps_night":
    // Apple Maps Night theme
    GRASS_COLOR = new THREE.Color(0x2D3D3C)
    TEXT_COLOR =  new THREE.Color(0xCED0D6)
    POINT_COLOR = new THREE.Color(0xD89453)
    BORDER_COLOR = new THREE.Color(0x2A2F3B)
    LAND_COLOR = new THREE.Color(0x2C2D2F)
    WATER_COLOR = new THREE.Color(0x384364)
    ROAD_COLOR = new THREE.Color(0x4C4F51)
    break
  case "mapbox":
    // Mapbox theme
    TEXT_COLOR =  new THREE.Color(0xff00ff)
    POINT_COLOR = new THREE.Color(0xff00ff)
    BORDER_COLOR = new THREE.Color(0xCCCCCC)
    LAND_COLOR = new THREE.Color(0xEBE7E4)
    WATER_COLOR = new THREE.Color(0x9AC9E6)
    ROAD_COLOR = new THREE.Color(0xF4B673)
    break
}

// Default Font
const TEXT_FONT = "./static/Orbitron-VariableFont_wght.ttf"

// Supported GeoJSON geometry types
const GEOJSON_GEOMETRY_TYPE_LINE_STRING = "LineString"
const GEOJSON_GEOMETRY_TYPE_POLYGON = "Polygon"
const GEOJSON_GEOMETRY_TYPE_MULTI_POLYGON = "MultiPolygon"
const GEOJSON_GEOMETRY_TYPE_POINT = "Point"

export const POI_KEY_DEFAULT_ORIGIN = "default origin"
export const POI_KEY_CURRENT_LNG_LAT = "current lng/lat"

export function init(scene, json, overrideOrigin = false) {

  const mapGroup = new THREE.Group()

  const refPointMaterial = new THREE.PointsMaterial({ size: 0.5, color: POINT_COLOR })

  const poiVertices = []

  const poi = []

  poi[POI_KEY_DEFAULT_ORIGIN] = {
    longitude: process.env.DEFAULT_ORIGIN_LONGITUDE,
    latitude: process.env.DEFAULT_ORIGIN_LATITUDE
  }

  poi[POI_KEY_CURRENT_LNG_LAT] = {
    longitude: 0,
    latitude: 0
  }

  let originId = POI_KEY_DEFAULT_ORIGIN

  if (overrideOrigin) {
    poi[POI_KEY_CURRENT_LNG_LAT].longitude = UTILS.origin.longitude
    poi[POI_KEY_CURRENT_LNG_LAT].latitude = UTILS.origin.latitude
    originId = POI_KEY_CURRENT_LNG_LAT
  } else {

    //
    // must find origin for this map first
    //
    let originFound = false


    for (const feature of json["features"]) {
      if ("origin" in feature["properties"]) {
        const lngLat = feature["geometry"]["coordinates"]
        UTILS.initOrigin(lngLat)
        console.log(`[ origin: ${lngLat} ]`)
        originId = feature["properties"]["id"]
        originFound = true
        break
      }
    }

    if (!originFound) {
      UTILS.initOrigin([
        poi[POI_KEY_DEFAULT_ORIGIN].longitude,
        poi[POI_KEY_DEFAULT_ORIGIN].latitude,
      ])
    }
  }

  for (const feature of json["features"]) {
    switch (feature["geometry"]["type"]) {
      case GEOJSON_GEOMETRY_TYPE_LINE_STRING: {
        const mode = "tube";
        
        // Thin lines
        if (mode == "line") {
          const points = feature["geometry"]["coordinates"].flatMap(coord => {
            const [x, y] = UTILS.getXY(coord);
            return [x * UTILS.SCALE, y * UTILS.SCALE, 0]; // Flat coordinates with z = 0
          });
    
          // Create a buffer geometry
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    
          // Create lines
          const lines = new THREE.Line(
            geometry, 
            new THREE.LineBasicMaterial({
              color: ROAD_COLOR,
              linewidth: 2 // Note: linewidth might not work as expected in WebGL renderer
            })
          );
          lines.rotateX(Math.PI / 2);
          
          // Add lines to the map group
          mapGroup.add(lines);
        } else {
          // Tube geometry to make roads thicker
          const points = feature["geometry"]["coordinates"].map(coord => {
              const [x, y] = UTILS.getXY(coord);
              return new THREE.Vector3(x * UTILS.SCALE, y * UTILS.SCALE, 0); // Flat coordinates with z = 0
          });
      
          // Create a curve path from points
          const curvePath = new THREE.CurvePath();
          for (let i = 1; i < points.length; i++) {
              const start = points[i - 1];
              const end = points[i];
              const curve = new THREE.LineCurve3(start, end);
              curvePath.add(curve);
          }
      
          // Create the TubeGeometry
          const tubeGeometry = new THREE.TubeGeometry(curvePath, 32, 0.05, 3, false);
          const tubeMaterial = new THREE.MeshBasicMaterial({ color: ROAD_COLOR });
          const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
      
          // Rotate and add the tube mesh to the map group
          tubeMesh.rotateX(Math.PI / 2);
          mapGroup.add(tubeMesh);
        }
      }
        break;
      case GEOJSON_GEOMETRY_TYPE_POLYGON:
      case GEOJSON_GEOMETRY_TYPE_MULTI_POLYGON: {
        // Handle both Polygon and MultiPolygon types
        const polygons = feature["geometry"]["type"] === GEOJSON_GEOMETRY_TYPE_POLYGON
          ? [feature["geometry"]["coordinates"]]
          : feature["geometry"]["coordinates"];

        for (const polygon of polygons) {
          // Handle exterior and holes
          const exteriorCoordinates = polygon[0];
          const holesCoordinates = polygon.slice(1);

          // Convert exterior ring to Vector2 and create shape
          const exteriorPoints = exteriorCoordinates.map(coord => {
            const [x, y] = UTILS.getXY(coord);
            return new THREE.Vector2(x * UTILS.SCALE, y * UTILS.SCALE);
          });
          const shape = new THREE.Shape(exteriorPoints);

          // Add holes if any
          for (const hole of holesCoordinates) {
            const holePoints = hole.map(coord => {
              const [x, y] = UTILS.getXY(coord);
              return new THREE.Vector2(x * UTILS.SCALE, y * UTILS.SCALE);
            });
            const holeShape = new THREE.Path(holePoints);
            shape.holes.push(holeShape);
          }

          // Create geometry for the land
          const geometry = new THREE.ShapeGeometry(shape);
          geometry.rotateX(Math.PI / 2);

          // Create mesh for the land
          const landMaterial = new THREE.MeshBasicMaterial({ color: LAND_COLOR, side: THREE.DoubleSide });
          const landMesh = new THREE.Mesh(geometry, landMaterial);
          mapGroup.add(landMesh);

          // Create edges for the border
          const edges = new THREE.EdgesGeometry(geometry);
          const borderMaterial = new THREE.LineBasicMaterial({
            color: BORDER_COLOR,
            linewidth: 2 // Note: linewidth might not work as expected in WebGL renderer
          });
          const lineSegments = new THREE.LineSegments(edges, borderMaterial);
          mapGroup.add(lineSegments);
        }
      }
      break;
      case GEOJSON_GEOMETRY_TYPE_POINT: {
        const coord = feature["geometry"]["coordinates"]

        const poiId = feature["properties"]["id"]
        poi[poiId] = {
          id: poiId,
          longitude: coord[0],
          latitude: coord[1]
        }

        const [x, y] = UTILS.getXY(coord)
        const vector3 = new THREE.Vector3(x * UTILS.SCALE, 0, y * UTILS.SCALE)
        poiVertices.push(vector3)

        const label = new Text()
        label.text = feature["properties"]["id"]
        label.fontSize = 1
        label.anchorX = 'center'
        label.color = new THREE.Color(TEXT_COLOR)
        label.font = TEXT_FONT

        label.position.x = x * UTILS.SCALE
        label.position.y = 2
        label.position.z = y * UTILS.SCALE

        poiLabels.push(label)
        mapGroup.add(label)
      }
        break;
    }
  }

  // Draw other layers

  // Add Points of Interest
  const poiGeometry = new THREE.BufferGeometry().setFromPoints(poiVertices)
  const poiMesh = new THREE.Points(poiGeometry, refPointMaterial)
  mapGroup.add(poiMesh)

  // Create a large circle for water
  const waterGeometry = new THREE.CircleGeometry(512, 32);

  // Create a water material from image texture static/water.jpg
  const waterTexture = new THREE.TextureLoader().load('./static/ocean-tile-3.jpg');
  waterTexture.wrapS = THREE.RepeatWrapping;
  waterTexture.wrapT = THREE.RepeatWrapping;
  waterTexture.repeat.set( 128, 128 );
  const waterMaterial = new THREE.MeshBasicMaterial({ map: waterTexture, side: THREE.DoubleSide });
  // const waterMaterial = new THREE.MeshBasicMaterial({ color: WATER_COLOR, side: THREE.DoubleSide });
  const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);

  // Position the water mesh below your land masses
  waterMesh.rotateX(-Math.PI / 2);
  waterMesh.position.y = -0.1; // Adjust this value based on your map's elevation

  // Add water mesh to your map group or scene
  mapGroup.add(waterMesh);

  scene.add(mapGroup)

  return {
    mapGroup,
    originId,
    poi
  }
}

