interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
}

export default function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const sizeClass = size === 'sm' ? 'loading-sm' : size === 'lg' ? 'loading-lg' : 'loading-md'
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 animate-fade-in">
      <div className="relative">
        <span className={`loading loading-spinner text-indigo-500 ${sizeClass}`} />
        <div className="absolute inset-0 blur-md bg-indigo-500/20 rounded-full" />
      </div>
      {message && <p className="text-slate-500 text-sm">{message}</p>}
    </div>
  )
}
