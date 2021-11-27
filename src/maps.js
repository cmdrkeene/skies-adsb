import * as THREE from 'three'
import * as GEOJSON from './geojson'
import { Text } from 'troika-three-text'
import * as UTILS from './utils.js'

export const map = {}
export const poiLabels = []

const TEXT_COLOR = new THREE.Color(0xed225d)
const MAP_COLOR = new THREE.Color(0x81efff)

const TEXT_FONT = "./static/Orbitron-VariableFont_wght.ttf"


// support for GeoJSON generated by http://geojson.io/
// only Point and Polygon are supported


function initGeoJSON(scene) {
  for (const feature of GEOJSON.json["features"]) {
    console.log(feature)
    switch (feature["geometry"]["type"]) {
      case "Polygon": {
        const points = feature["geometry"]["coordinates"][0].map(coord => {
          const { x, y } = UTILS.getXY(UTILS.origin, { lat: coord[1], lng: coord[0] })
          return new THREE.Vector2(x * UTILS.SCALE, y * UTILS.SCALE)
        })
        console.log(points)
        const shape = new THREE.Shape(points)
        const geometry = new THREE.ShapeGeometry(shape)
        geometry.rotateX(Math.PI / 2)
        const edges = new THREE.EdgesGeometry(geometry)
        const lineSegments = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
          color: MAP_COLOR,
          linewidth: 2
        }))
        scene.add(lineSegments)
      }
        break;
      case "Point": {
      }
        break;
    }
  }
}

export function setFallbackOrigin(origin) {
  origin.lat = GEOJSON.mia_poi['HOME'][0]
  origin.lng = GEOJSON.mia_poi['HOME'][1]
}

export function initGroundPlaneBoundariesAndPOI(scene) {

  initGeoJSON(scene)

  const poiVertices = []

  // TODO start websocket connection once geolocation has been updated
  // TODO update geometries once geolocation has been updated

  for (const key in GEOJSON.sofla_zones) {
    console.log(`loading ground plane for: ${key}`);
    const zone = GEOJSON.sofla_zones[key]
    // TODO export map meshes for selection
    map[key] = []
    let points = []
    for (let i = 0; i < zone.length; i += 2) {
      const { x, y } = UTILS.getXY(UTILS.origin, { lat: zone[i], lng: zone[i + 1] })
      points.push(new THREE.Vector2(x * UTILS.SCALE, y * UTILS.SCALE))
    }

    let shape = new THREE.Shape(points)
    let geometry = new THREE.ShapeGeometry(shape)
    geometry.rotateX(Math.PI / 2)
    let edges = new THREE.EdgesGeometry(geometry)
    let lineSegments = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: MAP_COLOR,
      linewidth: 2
    }))
    scene.add(lineSegments)
  }

  const refPointMaterial = new THREE.PointsMaterial({ size: 0.5, color: 0xff00ff })

  for (const key in GEOJSON.mia_poi) {
    const ref_pt = GEOJSON.mia_poi[key]
    console.log(`${key} -> ${ref_pt}`)
    const { x, y } = UTILS.getXY(UTILS.origin, { lat: ref_pt[0], lng: ref_pt[1] })
    poiVertices.push(new THREE.Vector3(x * UTILS.SCALE, 0, y * UTILS.SCALE))

    const label = new Text()
    label.text = key
    label.fontSize = 1
    label.anchorX = 'center'
    label.color = new THREE.Color(TEXT_COLOR)
    label.font = TEXT_FONT

    label.position.x = x * UTILS.SCALE
    label.position.y = 2
    label.position.z = y * UTILS.SCALE

    poiLabels.push(label)
    scene.add(label)
  }
  const poiGeometry = new THREE.BufferGeometry().setFromPoints(poiVertices)

  const poiMesh = new THREE.Points(poiGeometry, refPointMaterial)
  scene.add(poiMesh)
}

