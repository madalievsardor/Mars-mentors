import { AlertCircle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ErrorMessageProps {
  message?: string
  onRetry?: () => void
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 animate-fade-in">
      <div className="bg-red-500/[0.08] border border-red-500/20 rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle size={24} className="text-red-400" />
        </div>
        <div>
          <p className="text-red-400 font-semibold">{t('common.error')}</p>
          {message && <p className="text-slate-500 text-sm mt-1.5">{message}</p>}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors"
          >
            <RefreshCw size={13} />
            {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  )
}
