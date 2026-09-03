import { ChevronLeft, ChevronRight } from 'lucide-react'

const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, pageSize }) => {
  if (totalPages <= 1) return null

  const pages = []
  const delta = 2
  const left  = Math.max(2, currentPage - delta)
  const right = Math.min(totalPages - 1, currentPage + delta)

  pages.push(1)
  if (left > 2) pages.push('...')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < totalPages - 1) pages.push('...')
  if (totalPages > 1) pages.push(totalPages)

  const start = (currentPage - 1) * pageSize + 1
  const end   = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#E8F5EC' }}>
      <p className="text-sm" style={{ color: '#6B7280' }}>
        {start}–{end} sur <span className="font-medium" style={{ color: '#0D3B1F' }}>{totalItems}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:bg-gray-100"
          style={{ color: '#1A6B35' }}
        >
          <ChevronLeft size={18} />
        </button>

        {pages.map((page, i) =>
          page === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-sm" style={{ color: '#9CA3AF' }}>…</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className="w-8 h-8 text-sm rounded-lg font-medium transition-colors"
              style={{
                background: page === currentPage ? '#1A6B35' : 'transparent',
                color: page === currentPage ? 'white' : '#374151'
              }}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:bg-gray-100"
          style={{ color: '#1A6B35' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

export default Pagination
