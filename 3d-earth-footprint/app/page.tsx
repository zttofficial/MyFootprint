"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ChevronUp, ChevronDown, Pause, Play } from "lucide-react"
import { footprintData } from "@/data/footprint-data"

// Dynamically import the Earth component to avoid SSR issues with Three.js
const EarthVisualization = dynamic(() => import("@/components/earth-visualization"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  ),
})

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [isCardMinimized, setIsCardMinimized] = useState(false)
  const [isRotationPaused, setIsRotationPaused] = useState(false)

  const toggleCard = () => {
    setIsCardMinimized(!isCardMinimized)
  }

  const toggleRotation = () => {
    setIsRotationPaused(!isRotationPaused)
  }

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <div
        className={`fixed ${isCardMinimized ? "bottom-4" : "top-4"} left-4 right-4 md:left-4 md:right-auto md:top-4 md:bottom-auto z-10`}
      >
        <Card
          className={`w-full md:w-80 bg-black/70 text-white border-gray-800 transition-all duration-300 ${isCardMinimized ? "shadow-lg" : ""}`}
        >
          <div className="flex justify-between items-center">
            <CardHeader className="pb-2">
              <CardTitle>Zttofficial Footprints</CardTitle>
              <CardDescription className="text-gray-400">
                Interactive 3D visualization of places I've visited
              </CardDescription>
            </CardHeader>
            <button
              onClick={toggleCard}
              className="mr-4 p-1 rounded-full hover:bg-gray-800 transition-colors"
              aria-label={isCardMinimized ? "Expand help" : "Minimize help"}
            >
              {isCardMinimized ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>

          {!isCardMinimized && (
            <CardContent>
              <div className="text-sm">
                {selectedLocation ? (
                  <p>
                    Currently viewing: <span className="font-bold">{selectedLocation}</span>
                  </p>
                ) : (
                  <p>Click on a marker to see location details</p>
                )}
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-400">Controls:</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Drag to rotate the Earth</li>
                  <li>• Scroll to zoom in/out</li>
                  <li>• Right-click + drag to pan</li>
                </ul>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Pause/Play rotation button */}
      <div className="fixed bottom-4 right-4 z-10">
        <button
          onClick={toggleRotation}
          className="p-3 rounded-full bg-black/70 text-white border border-gray-800 hover:bg-gray-800 transition-colors"
          aria-label={isRotationPaused ? "Resume rotation" : "Pause rotation"}
        >
          {isRotationPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
      </div>

      <EarthVisualization
        footprintData={footprintData}
        onSelectLocation={setSelectedLocation}
        isRotationPaused={isRotationPaused}
      />
    </main>
  )
}
