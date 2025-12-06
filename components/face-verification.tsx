"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, AlertCircle, Camera, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useFaceDetection } from "@/hooks/use-face-detection"

type Step = "intro" | "camera" | "success" | "error"

// Default callback URL if none provided
const DEFAULT_CALLBACK_URL = "https://merchant.heydollr.app/auth/verification-callback"

export function FaceVerification() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Get token and callback from URL params
  const token = searchParams.get("token")
  const callbackUrl = searchParams.get("callback") || DEFAULT_CALLBACK_URL
  
  const { 
    videoRef, 
    canvasRef, 
    feedbackMessage, 
    isFaceValid, 
    startDetection, 
    stopDetection 
  } = useFaceDetection()

  const [step, setStep] = useState<Step>("intro")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [verificationResult, setVerificationResult] = useState<{
    verificationId?: number;
    userId?: number;
    status?: string;
    reason?: string;
  } | null>(null)

  // Check for token on mount
  useEffect(() => {
    if (!token) {
      setErrorMessage("Missing authentication token. Please return to the app and try again.")
      setStep("error")
    }
  }, [token])

  useEffect(() => {
    let mounted = true
    let currentStream: MediaStream | null = null

    if (step === "camera" && !capturedImage) {
      const startCamera = async () => {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          })
          
          if (!mounted) {
            mediaStream.getTracks().forEach((track) => track.stop())
            return
          }

          currentStream = mediaStream
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream
            setStream(mediaStream)
            // Start detection loop once video plays
            videoRef.current.onloadeddata = () => {
               startDetection()
            }
          }
        } catch (error) {
          if (mounted) {
            setErrorMessage("Unable to access camera. Please check permissions.")
          }
        }
      }
      startCamera()
    }

    return () => {
      mounted = false
      stopDetection()
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [step, capturedImage])

  const handleCapture = async () => {
    setIsCapturing(true)
    // Simulate processing delay for UX
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d")
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth
        canvasRef.current.height = videoRef.current.videoHeight
        context.drawImage(videoRef.current, 0, 0)
        const imageData = canvasRef.current.toDataURL("image/jpeg")
        setCapturedImage(imageData)
      }
    }
    setIsCapturing(false)
  }

  const handleRetake = () => {
    setCapturedImage(null)
    setErrorMessage("")
  }

  const handleSubmit = async () => {
    if (!capturedImage || !token) return

    setIsSubmitting(true)
    setErrorMessage("")
    
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          image: capturedImage,
          token: token,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setVerificationResult({
          verificationId: data.verificationId,
          userId: data.userId,
          status: 'success',
        })
        setStep("success")
      } else {
        setVerificationResult({
          userId: data.userId,
          status: 'failed',
          reason: data.error || 'Verification failed',
        })
        setErrorMessage(data.error || "Verification failed. Please try again.")
      }
    } catch (error) {
      setVerificationResult({
        status: 'failed',
        reason: 'Network error',
      })
      setErrorMessage("Verification failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleContinue = () => {
    // Redirect to merchant dashboard
    window.location.assign("https://merchant.heydollr.app/dashboard")
  }

  const handleReset = () => {
    setStep("intro")
    setCapturedImage(null)
    setErrorMessage("")
  }

  const handleGoBack = () => {
    // Redirect back with failed status
    try {
      const url = new URL(callbackUrl)
      url.searchParams.set('status', 'failed')
      url.searchParams.set('reason', 'user_cancelled')
      window.location.href = url.toString()
    } catch (error) {
      // Fallback to default dashboard if callback is invalid
      window.location.href = "https://merchant.heydollr.app/dashboard"
    }
  }

  // Error state - no token
  if (step === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-6 sm:py-8">
        <div className="mx-auto w-full max-w-sm">
          <Card className="space-y-6 border-0 shadow-lg">
            <div className="space-y-4 px-4 pt-6 sm:px-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-red-100 p-4">
                  <AlertCircle className="h-12 w-12 text-red-500" />
                </div>
              </div>
              <div className="space-y-2 text-center">
                <h1 className="text-xl font-bold text-foreground">Authentication Required</h1>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
            <div className="px-4 pb-6 sm:px-6">
              <Button
                onClick={handleGoBack}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                size="lg"
              >
                Return to App
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-sm">
        {/* Intro Step */}
        {step === "intro" && (
          <Card className="space-y-1 border-0 shadow-lg">
            <div className="space-y-4 px-4 pt-6 sm:px-6">
              {/* Header */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Dollr Identity Verification</h1>
                <p className="text-sm text-muted-foreground">Scan your face to verify your identity for KYC.</p>
              </div>

              <div className="flex justify-center py-4 sm:py-6">
                <img
                  src="/sample_image.png"
                  alt="Sample selfie"
                  className="h-40 w-40 rounded-lg object-cover sm:h-48 sm:w-48"
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-foreground">Requirements:</p>
                <div className="flex flex-col gap-2 rounded-lg bg-[#fcd200]/10 p-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 flex-shrink-0 text-[#fcd200]" />
                    <span className="text-xs font-medium text-foreground">Ensure good lighting and center your face</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 flex-shrink-0 text-[#fcd200]" />
                    <span className="text-xs font-medium text-foreground">Keep a neutral expression</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 flex-shrink-0 text-[#fcd200]" />
                    <span className="text-xs font-medium text-foreground">Remove sunglasses or hat</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Button Section */}
            <div className="space-y-3 px-4 pb-6 sm:px-6">
              <Button
                onClick={() => setStep("camera")}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                size="lg"
              >
                Begin Verification
              </Button>
              <p className="text-center text-xs text-muted-foreground">We will automatically detect the face</p>
            </div>
          </Card>
        )}

        {/* Camera Step */}
        {step === "camera" && (
          <Card className="overflow-hidden border-0 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-4 sm:px-6">
              <h2 className="font-semibold text-foreground">Face detection</h2>
              <button onClick={handleReset} className="text-muted-foreground hover:text-foreground text-sm font-medium">
                ✕
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              {/* Camera/Preview */}
              <div className="relative aspect-square overflow-hidden rounded-lg bg-black">
                {!capturedImage ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover scale-x-[-1]" />
                    {/* Face guide frame overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative h-40 w-32 sm:h-48 sm:w-40">
                        <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-yellow-400" />
                        <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-yellow-400" />
                        <div className="absolute bottom-0 left-0 h-6 w-6 border-l-2 border-b-2 border-yellow-400" />
                        <div className="absolute bottom-0 right-0 h-6 w-6 border-r-2 border-b-2 border-yellow-400" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img
                    src={capturedImage || "/placeholder.svg"}
                    alt="Captured face"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              {/* Status message */}
              <div className={`rounded-lg p-4 text-center ${isFaceValid ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`text-sm font-medium ${isFaceValid ? 'text-green-700' : 'text-red-700'}`}>
                  {feedbackMessage}
                </p>
                {!isFaceValid && (
                  <p className="mt-1 text-xs text-red-600/80">
                    Ensure good lighting, remove sunglasses/cap, and face forward.
                  </p>
                )}
              </div>

              {/* Error message */}
              {errorMessage && (
                <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />

              {/* Action buttons */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                {!capturedImage ? (
                  <Button
                    onClick={handleCapture}
                    disabled={isCapturing || !isFaceValid}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold disabled:opacity-50"
                    size="lg"
                  >
                    {isCapturing ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Capturing...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Capture Selfie
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={handleRetake} 
                      variant="outline" 
                      className="flex-1 font-semibold bg-transparent text-primary border-primary hover:bg-primary/5"
                    >
                      Retake
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Submitting...
                        </>
                      ) : (
                        "Submit"
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Success Step */}
        {step === "success" && (
          <Card className="space-y-6 border-0 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-4 sm:px-6">
              <h2 className="font-semibold text-foreground">Face detection</h2>
              <button onClick={handleReset} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="space-y-6 px-4 pb-6 pt-4 sm:px-6">
              {/* Captured image with checkmark */}
              <div className="flex justify-center">
                <div className="relative">
                  <img
                    src={capturedImage || "/placeholder.svg"}
                    alt="Verified face"
                    className="h-28 w-28 rounded-full object-cover border-4 border-background sm:h-32 sm:w-32"
                  />
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-primary p-2">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              {/* Success message */}
              <div className="space-y-2 text-center">
                <h3 className="text-xl font-bold text-foreground sm:text-2xl">Identity Verified!</h3>
                <p className="text-sm text-muted-foreground">
                  Your face just unlocked a world of possibilities. You're officially you, and that's awesome!
                </p>
              </div>

              {/* Continue button */}
              <Button
                type="button"
                onClick={handleContinue}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                size="lg"
              >
                Continue
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
