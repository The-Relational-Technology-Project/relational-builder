/** Small relational mark: three connected nodes — people in relationship */
export function RBMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path d="M14 32 L24 14 L34 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      <path d="M14 32 L34 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
      <circle cx="24" cy="13" r="5.5" fill="#E86F4E" />
      <circle cx="13" cy="33" r="5.5" fill="#3D8B6D" />
      <circle cx="35" cy="33" r="5.5" fill="#E8B84E" />
    </svg>
  );
}
