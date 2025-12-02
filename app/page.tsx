import { FaceVerification } from "@/components/face-verification"
import { Suspense } from "react"

export const metadata = {
  title: "Face Verification",
  description: "Secure identity verification with face recognition",
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<div>Loading...</div>}>
        <FaceVerification />
      </Suspense>
    </main>
  )
}
