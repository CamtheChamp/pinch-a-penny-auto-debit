import GoogleSignInButton from './GoogleSignInButton'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-6">
        <div className="text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded bg-blue-600 text-white font-bold text-lg mb-3">
            PW
          </span>
          <h1 className="text-xl font-semibold text-gray-900">PennyWise Ledger</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to access your account.</p>
        </div>

        {error === 'not_authorized' && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            This Google account is not authorized to access this application.
          </div>
        )}

        <GoogleSignInButton />
      </div>
    </div>
  )
}
