import { useState, useRef, useEffect } from "react"
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision"

export function useFaceDetection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [feedbackMessage, setFeedbackMessage] = useState("Scanning your face...")
  const [isFaceValid, setIsFaceValid] = useState(false)
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const requestRef = useRef<number>(0)

  useEffect(() => {
    const loadModel = async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      )
      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      })
    }
    loadModel()
  }, [])

  const detectFace = () => {
    if (!videoRef.current || !faceLandmarkerRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      // Brightness Check
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        canvas.width = 100 // Small size for performance
        canvas.height = 100
        ctx.drawImage(video, 0, 0, 100, 100)
        const imageData = ctx.getImageData(0, 0, 100, 100)
        let totalBrightness = 0
        for (let i = 0; i < imageData.data.length; i += 4) {
          totalBrightness += (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3
        }
        const avgBrightness = totalBrightness / (imageData.data.length / 4)
        
        if (avgBrightness < 40) {
          setFeedbackMessage("Too dark. Ensure good lighting.")
          setIsFaceValid(false)
          requestRef.current = requestAnimationFrame(detectFace)
          return
        }
      }

      try {
        const startTimeMs = performance.now()
        const results = faceLandmarkerRef.current.detectForVideo(video, startTimeMs)

        if (results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0]
          
          // Centering Check (Nose tip: index 1)
          const nose = landmarks[1]
          if (nose.x < 0.3 || nose.x > 0.7 || nose.y < 0.3 || nose.y > 0.7) {
            setFeedbackMessage("Position your face in the center.")
            setIsFaceValid(false)
          } else {
            // Facing Forward Check (Simple Yaw approximation)
            // Left Ear: 234, Right Ear: 454
            const leftEar = landmarks[234]
            const rightEar = landmarks[454]
            
            // Calculate distances from nose to ears
            const distToLeftEar = Math.abs(nose.x - leftEar.x)
            const distToRightEar = Math.abs(nose.x - rightEar.x)
            const ratio = distToLeftEar / (distToLeftEar + distToRightEar)

            if (ratio < 0.3 || ratio > 0.7) {
               setFeedbackMessage("Look straight at the camera.")
               setIsFaceValid(false)
            } else {
               // Check for eyes closed
               const blendshapes = results.faceBlendshapes?.[0]?.categories
               const eyeBlinkLeft = blendshapes?.find(c => c.categoryName === 'eyeBlinkLeft')?.score ?? 0
               const eyeBlinkRight = blendshapes?.find(c => c.categoryName === 'eyeBlinkRight')?.score ?? 0

               if (eyeBlinkLeft > 0.5 || eyeBlinkRight > 0.5) {
                  setFeedbackMessage("Make sure your eyes are open.")
                  setIsFaceValid(false)
               } else {
                  setFeedbackMessage("Perfect! Hold still and capture.")
                  setIsFaceValid(true)
               }
            }
          }
        } else {
          setFeedbackMessage("No face detected. Remove sunglasses or cap.")
          setIsFaceValid(false)
        }
      } catch (error) {
        // Ignore errors from MediaPipe (usually related to timestamps or video state)
      }
    }
    requestRef.current = requestAnimationFrame(detectFace)
  }

  const startDetection = () => {
    detectFace()
  }

  const stopDetection = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current)
    }
  }

  return {
    videoRef,
    canvasRef,
    feedbackMessage,
    isFaceValid,
    startDetection,
    stopDetection
  }
}
