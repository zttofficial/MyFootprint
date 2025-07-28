"use client"

import { useRef, useState, useEffect } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Stars, useTexture, Html } from "@react-three/drei"
import * as THREE from "three"

// Types for our footprint data
interface FootprintLocation {
  lat: number
  lng: number
  name: string
}

interface EarthProps {
  footprintData: FootprintLocation[]
  onSelectLocation: (name: string | null) => void
  isRotationPaused?: boolean
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

// Marker component for footprint locations
function LocationMarker({
  position,
  name,
  isSelected,
  onClick,
  isMobile,
}: {
  position: THREE.Vector3
  name: string
  isSelected: boolean
  onClick: () => void
  isMobile: boolean
}) {
  const markerRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (markerRef.current) {
      markerRef.current.rotation.y += 0.01
    }
  })

  // Increase marker size for mobile
  const markerSize = isMobile ? 0.035 : 0.025

  return (
    <group position={position}>
      <mesh
        ref={markerRef}
        onClick={onClick}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <sphereGeometry args={[markerSize, 16, 16]} />
        <meshStandardMaterial
          color={isSelected ? "#ff9900" : "#00aaff"}
          emissive={isSelected ? "#ff6600" : "#0088cc"}
          emissiveIntensity={1}
        />
      </mesh>

      {isSelected && (
        <Html distanceFactor={10}>
          <div className="bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap">{name}</div>
        </Html>
      )}
    </group>
  )
}

// The main Earth component
function EarthModel({ footprintData, onSelectLocation, isRotationPaused = false }: EarthProps) {
  const earthRef = useRef<THREE.Mesh>(null)
  const cloudsRef = useRef<THREE.Mesh>(null)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const { camera } = useThree()
  const [isMobile, setIsMobile] = useState(false)

  // Check if we're on a mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Load Earth textures
  const textures = useTexture({
    map: "/assets/earth_daymap.jpg",
    bumpMap: "/assets/earth_bumpmap.jpg",
    specularMap: "/assets/earth_specularmap.jpg",
    cloudsMap: "/assets/earth_clouds.jpg",
  })

  // Rotation based on isRotationPaused prop
  useFrame(() => {
    if (!isRotationPaused && earthRef.current) {
      earthRef.current.rotation.y += 0.0005
      if (cloudsRef.current) {
        cloudsRef.current.rotation.y += 0.0007 // Clouds rotate slightly faster
      }
    }
  })

  // Handle marker selection
  const handleMarkerClick = (name: string) => {
    const newSelected = selectedMarker === name ? null : name
    setSelectedMarker(newSelected)
    onSelectLocation(newSelected)
  }

  // Reset selection when clicking on empty space
  useEffect(() => {
    const handleCanvasClick = (event: MouseEvent) => {
      // Only reset if we're clicking on the canvas background, not on a marker
      if ((event.target as HTMLElement).tagName === "CANVAS") {
        setSelectedMarker(null)
        onSelectLocation(null)
      }
    }

    document.addEventListener("click", handleCanvasClick)
    return () => document.removeEventListener("click", handleCanvasClick)
  }, [onSelectLocation])

  // Earth radius
  const radius = 1

  return (
    <>
      {/* Earth sphere */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhongMaterial
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={0.05}
          specularMap={textures.specularMap}
          specular={new THREE.Color("grey")}
          shininess={5}
        />
      </mesh>

      {/* Cloud layer */}
      <mesh ref={cloudsRef} scale={[1.003, 1.003, 1.003]}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhongMaterial map={textures.cloudsMap} transparent={true} opacity={0.4} depthWrite={false} />
      </mesh>

      {/* Location markers */}
      {footprintData.map((location, index) => {
        const position = latLngToVector3(location.lat, location.lng, radius * 1.01)
        return (
          <LocationMarker
            key={index}
            position={position}
            name={location.name}
            isSelected={selectedMarker === location.name}
            onClick={() => handleMarkerClick(location.name)}
            isMobile={isMobile}
          />
        )
      })}

      {/* Atmosphere glow */}
      <mesh scale={[1.02, 1.02, 1.02]}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhongMaterial color="#0077ff" transparent={true} opacity={0.05} side={THREE.BackSide} />
      </mesh>
    </>
  )
}

// Main component that sets up the 3D scene
export default function Earth({ footprintData, onSelectLocation, isRotationPaused = false }: EarthProps) {
  return (
    <div className="w-full h-screen">
      <Canvas camera={{ position: [0, 0, 2.5], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={["#000"]} />

        <ambientLight intensity={0.1} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <directionalLight position={[5, 3, 5]} intensity={1.5} castShadow />

        <EarthModel
          footprintData={footprintData}
          onSelectLocation={onSelectLocation}
          isRotationPaused={isRotationPaused}
        />

        <Stars radius={100} depth={50} count={5000} factor={4} />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1.5}
          maxDistance={10}
          autoRotate={false}
        />
      </Canvas>
    </div>
  )
}
