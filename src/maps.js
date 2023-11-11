import * as THREE from 'three'
import { Text } from 'troika-three-text'
import * as UTILS from './utils.js'

export const map = {}
export const poiLabels = []

// Default theme
// const TEXT_COLOR = new THREE.Color(0xff00ff)
// const POINT_COLOR = new THREE.Color(0xff00ff)
// const BORDER_COLOR = new THREE.Color(0x81efff)
// const LAND_COLOR = new THREE.Color(0x00ff00)
// const WATER_COLOR = new THREE.Color(0x0000ff)
// const ROAD_COLOR = new THREE.Color(0xff0000)

// Realistic theme
// const TEXT_COLOR =  new THREE.Color(0xff00ff) // Magenta
// const POINT_COLOR = new THREE.Color(0xff00ff) // Magenta
// const BORDER_COLOR = new THREE.Color(0xa0a0a0) // Light gray
// const LAND_COLOR = new THREE.Color(0x556b2f) // Dark olive green
// const WATER_COLOR = new THREE.Color(0x4682b4) // Steel blue
// const ROAD_COLOR = new THREE.Color(0x808080) // Gray

// Mapbox theme
const TEXT_COLOR =  new THREE.Color(0xff00ff)
const POINT_COLOR = new THREE.Color(0xff00ff)
const BORDER_COLOR = new THREE.Color(0xCCCCCC)
const LAND_COLOR = new THREE.Color(0xEBE7E4)
const WATER_COLOR = new THREE.Color(0x9AC9E6)
const ROAD_COLOR = new THREE.Color(0xF4B673)

// Default Font
const TEXT_FONT = "./static/Orbitron-VariableFont_wght.ttf"

// Road width
const ROAD_WIDTH = 10 // Note: linewidth might not work as expected in WebGL renderer

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
            linewidth: ROAD_WIDTH
          })
        );
        lines.rotateX(Math.PI / 2);
        
        // Add lines to the map group
        mapGroup.add(lines);
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

  const poiGeometry = new THREE.BufferGeometry().setFromPoints(poiVertices)
  const poiMesh = new THREE.Points(poiGeometry, refPointMaterial)
  mapGroup.add(poiMesh)

  // Create a large circle for water
  const waterGeometry = new THREE.CircleGeometry(1010, 32);
  const waterMaterial = new THREE.MeshBasicMaterial({ color: WATER_COLOR, side: THREE.DoubleSide });
  const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);

  // Position the water mesh below your land masses
  waterMesh.rotateX(-Math.PI / 2);
  waterMesh.position.y = -1; // Adjust this value based on your map's elevation

  // Add water mesh to your map group or scene
  mapGroup.add(waterMesh);

  scene.add(mapGroup)

  return {
    mapGroup,
    originId,
    poi
  }
}

