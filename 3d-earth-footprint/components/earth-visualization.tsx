"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import type { FootprintLocation } from "@/data/footprint-data"

interface EarthVisualizationProps {
  footprintData: FootprintLocation[]
  onSelectLocation: (name: string | null) => void
  isRotationPaused: boolean
}

// Convert latitude and longitude to 3D coordinates on a sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)

  const x = -radius * Math.sin(phi) * Math.cos(theta)
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)

  return new THREE.Vector3(x, y, z)
}

export default function EarthVisualization({
  footprintData,
  onSelectLocation,
  isRotationPaused,
}: EarthVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Store references to Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const earthRef = useRef<THREE.Mesh | null>(null)
  const markersRef = useRef<THREE.Mesh[]>([])
  const controlsRef = useRef<OrbitControls | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())

  // Mouse position tracking
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())

  // Label for tooltips
  const labelRef = useRef<HTMLDivElement | null>(null)

  // Selected marker tracking
  const selectedMarkerRef = useRef<string | null>(null)

  // Track if we're on a mobile device
  const [isMobile, setIsMobile] = useState(false)

  // Earth radius constant
  const EARTH_RADIUS = 200

  // Rotation speed (radians per frame)
  const ROTATION_SPEED = 0.0005 // Very slow rotation

  // Initialize the scene
  useEffect(() => {
    if (!containerRef.current) return

    // Check if we're on a mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)

    // Create canvas element
    const canvas = document.createElement("canvas")
    canvas.id = "webglcanvas"
    containerRef.current.appendChild(canvas)
    canvasRef.current = canvas

    // Create camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000)
    camera.position.z = 500
    cameraRef.current = camera

    // Create scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000) // Black background
    sceneRef.current = scene

    // Create group for Earth and markers
    const group = new THREE.Group()
    scene.add(group)
    groupRef.current = group

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    rendererRef.current = renderer

    // Create label element for tooltips
    const label = document.createElement("div")
    label.className = "absolute hidden bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap"
    containerRef.current.appendChild(label)
    labelRef.current = label

    // Create orbit controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 250
    controls.maxDistance = 800
    controls.autoRotate = false // No automatic rotation from controls
    controlsRef.current = controls

    // Add ambient light - increased intensity for full daylight effect
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    // Add directional light - positioned to light the entire globe
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(1, 0.5, 1).normalize()
    scene.add(directionalLight)

    // Add a second directional light from the opposite side to ensure full illumination
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight2.position.set(-1, 0.5, -1).normalize()
    scene.add(directionalLight2)

    // Add stars background
    const starGeometry = new THREE.BufferGeometry()
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.7,
    })

    const starVertices = []
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 2000
      const y = (Math.random() - 0.5) * 2000
      const z = (Math.random() - 0.5) * 2000
      starVertices.push(x, y, z)
    }

    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starVertices, 3))
    const stars = new THREE.Points(starGeometry, starMaterial)
    scene.add(stars)

    // Load Earth texture - using a daylight-only texture
    const textureLoader = new THREE.TextureLoader()

    // Load Earth base texture (land and oceans)
    textureLoader.load(
      "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
      (baseTexture) => {
        // Create Earth sphere with base texture
        const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64)
        const earthMaterial = new THREE.MeshPhongMaterial({
          map: baseTexture,
          bumpScale: 0.05,
          specular: new THREE.Color("grey"),
          shininess: 5,
        })

        const earth = new THREE.Mesh(earthGeometry, earthMaterial)
        group.add(earth)
        earthRef.current = earth

        // Add footprint markers
        addFootprintMarkers()

        // Start animation loop
        animate()
      },
      undefined,
      (error) => {
        console.error("Error loading Earth texture:", error)

        // Fallback to a simple colored sphere if texture loading fails
        const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64)
        const earthMaterial = new THREE.MeshPhongMaterial({
          color: 0x2233aa, // Blue color for Earth
          shininess: 5,
        })

        const earth = new THREE.Mesh(earthGeometry, earthMaterial)
        group.add(earth)
        earthRef.current = earth

        // Add footprint markers
        addFootprintMarkers()

        // Start animation loop
        animate()
      },
    )

    // Handle window resize
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return

      cameraRef.current.aspect = window.innerWidth / window.innerHeight
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(window.innerWidth, window.innerHeight)

      // Update mobile status
      checkMobile()
    }

    window.addEventListener("resize", handleResize)

    // Handle mouse movement for tooltips only
    const onDocumentMouseMove = (event: MouseEvent) => {
      if (!containerRef.current) return

      // Update mouse position for raycaster
      const rect = containerRef.current.getBoundingClientRect()
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      // Show tooltip for markers
      if (cameraRef.current && sceneRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)
        const intersects = raycasterRef.current.intersectObjects(markersRef.current)

        if (intersects.length > 0) {
          // Show cursor as pointer
          document.body.style.cursor = "pointer"

          // Show tooltip
          if (labelRef.current) {
            const marker = intersects[0].object
            const name = marker.userData.name

            labelRef.current.textContent = name
            labelRef.current.style.display = "block"
            labelRef.current.style.left = `${event.clientX + 10}px`
            labelRef.current.style.top = `${event.clientY + 10}px`
          }
        } else {
          // Reset cursor
          document.body.style.cursor = "auto"

          // Hide tooltip
          if (labelRef.current) {
            labelRef.current.style.display = "none"
          }
        }
      }
    }

    // Handle click events
    const onDocumentClick = (event: MouseEvent) => {
      if (!cameraRef.current || !sceneRef.current) return

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)

      // Increase the precision for mobile devices by using a larger threshold
      if (isMobile) {
        raycasterRef.current.params.Points.threshold = 10
      } else {
        raycasterRef.current.params.Points.threshold = 1
      }

      const intersects = raycasterRef.current.intersectObjects(markersRef.current)

      if (intersects.length > 0) {
        const marker = intersects[0].object
        const name = marker.userData.name

        // Update selected marker
        const newSelected = selectedMarkerRef.current === name ? null : name
        selectedMarkerRef.current = newSelected
        onSelectLocation(newSelected)

        // Update marker appearance
        markersRef.current.forEach((m) => {
          const material = m.material as THREE.MeshPhongMaterial

          if (m.userData.name === newSelected) {
            material.color.set(0xff9900)
            material.emissive.set(0xff6600)
            material.emissiveIntensity = 0.5
          } else {
            material.color.set(0x00aaff)
            material.emissive.set(0x0088cc)
            material.emissiveIntensity = 0.2
          }
        })
      } else {
        // Reset selection when clicking on empty space
        selectedMarkerRef.current = null
        onSelectLocation(null)

        // Reset all markers
        markersRef.current.forEach((m) => {
          const material = m.material as THREE.MeshPhongMaterial
          material.color.set(0x00aaff)
          material.emissive.set(0x0088cc)
          material.emissiveIntensity = 0.2
        })
      }
    }

    // Handle touch events for mobile
    const onTouchStart = (event: TouchEvent) => {
      if (!containerRef.current || !event.touches[0]) return

      // Update mouse position for raycaster based on touch
      const rect = containerRef.current.getBoundingClientRect()
      const touch = event.touches[0]
      mouseRef.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1
    }

    document.addEventListener("mousemove", onDocumentMouseMove, false)
    document.addEventListener("click", onDocumentClick, false)
    document.addEventListener("touchstart", onTouchStart, false)

    // Function to add footprint markers with object3D parent for scaling
    function addFootprintMarkers() {
      if (!groupRef.current) return

      // Clear existing markers
      markersRef.current.forEach((marker) => {
        if (marker.geometry) marker.geometry.dispose()
        if (marker.material) {
          if (Array.isArray(marker.material)) {
            marker.material.forEach((m) => m.dispose())
          } else {
            marker.material.dispose()
          }
        }
        if (marker.parent) {
          marker.parent.remove(marker)
        }
      })
      markersRef.current = []

      // Create markers - all with the same base size
      // We'll use a fixed size and scale them in the update function
      // Increase base size for better mobile touch targets
      const markerSize = isMobile ? 3 : 2 // Larger for mobile

      footprintData.forEach((location) => {
        const position = latLngToVector3(location.lat, location.lng, EARTH_RADIUS * 1.025) // Slightly above Earth surface

        const markerGeometry = new THREE.SphereGeometry(markerSize, 16, 16)
        const markerMaterial = new THREE.MeshPhongMaterial({
          color: 0x00aaff,
          emissive: 0x0088cc,
          emissiveIntensity: 0.2,
          shininess: 30,
        })

        const marker = new THREE.Mesh(markerGeometry, markerMaterial)
        marker.position.copy(position)
        marker.userData = { name: location.name }

        // Store the original position vector for scaling calculations
        marker.userData.originalPosition = position.clone()

        // Add to scene
        if (groupRef.current) {
          groupRef.current.add(marker)
          markersRef.current.push(marker)
        }
      })
    }

    // Animation function
    function animate() {
      requestAnimationFrame(animate)
      render()
    }

    // Render function - this is where we need to check isRotationPaused
    function render() {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !groupRef.current) return

      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update()
      }

      // Update marker sizes based on camera distance
      updateMarkerSizes()

      // Render scene
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }

    // Function to update marker sizes based on camera distance
    function updateMarkerSizes() {
      if (!cameraRef.current || markersRef.current.length === 0 || !earthRef.current) return

      // Get camera distance from center of Earth
      const cameraDistance = cameraRef.current.position.length()

      // Calculate the scale factor based on camera distance
      // We want markers to be smaller when closer and larger when farther
      const minDistance = 250 // Min camera distance
      const maxDistance = 800 // Max camera distance

      // Calculate normalized distance (0 to 1)
      const normalizedDistance = Math.min(1, Math.max(0, (cameraDistance - minDistance) / (maxDistance - minDistance)))

      // Calculate marker size - smaller when close, larger when far
      // This is the key change - we're using a non-linear scaling to make the effect more pronounced
      // Increase minimum scale for mobile devices
      const minScale = isMobile ? 0.006 : 0.004 // Minimum marker scale (when zoomed in) - larger for mobile
      const maxScale = isMobile ? 0.025 : 0.02 // Maximum marker scale (when zoomed out) - larger for mobile

      // Use a power function to make the scaling more dramatic
      const scaleFactor = minScale + Math.pow(normalizedDistance, 1.5) * (maxScale - minScale)

      // Apply the scale to all markers
      markersRef.current.forEach((marker) => {
        // Calculate the marker size as a percentage of Earth radius
        const markerSize = EARTH_RADIUS * scaleFactor

        // Set the scale relative to the original size
        const baseSize = isMobile ? 3 : 2
        const scale = markerSize / baseSize

        // Make selected marker slightly larger
        const finalScale = marker.userData.name === selectedMarkerRef.current ? scale * 1.5 : scale

        // Apply the scale
        marker.scale.set(finalScale, finalScale, finalScale)
      })
    }

    // Cleanup function
    return () => {
      window.removeEventListener("resize", handleResize)
      document.removeEventListener("mousemove", onDocumentMouseMove)
      document.removeEventListener("click", onDocumentClick)
      document.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("resize", checkMobile)

      if (canvasRef.current && containerRef.current) {
        containerRef.current.removeChild(canvasRef.current)
      }

      if (labelRef.current && containerRef.current) {
        containerRef.current.removeChild(labelRef.current)
      }

      // Dispose of Three.js resources
      if (rendererRef.current) {
        rendererRef.current.dispose()
      }
    }
  }, [footprintData, onSelectLocation, isRotationPaused, isMobile])

  // Add a separate useEffect to handle rotation based on isRotationPaused
  useEffect(() => {
    // This function will be called on each animation frame
    let animationFrameId: number | null = null

    const rotateEarth = () => {
      if (groupRef.current && !isRotationPaused) {
        groupRef.current.rotation.y += ROTATION_SPEED
      }
      animationFrameId = requestAnimationFrame(rotateEarth)
    }

    // Start the rotation animation
    animationFrameId = requestAnimationFrame(rotateEarth)

    // Clean up on unmount or when dependencies change
    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isRotationPaused])

  return <div ref={containerRef} className="w-full h-screen" />
}
