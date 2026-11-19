export default function Spinner({ className = "h-4 w-4 border-2 border-white border-t-transparent" }: { className?: string }) {
  return <span className={`inline-block flex-shrink-0 animate-spin rounded-full ${className}`} aria-hidden />;
}
