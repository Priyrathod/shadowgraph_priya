export default function LoadingSpinner({ size = 'h-5 w-5' }) {
  return (
    <span
      className={`${size} inline-block rounded-full border-2 border-accent border-r-transparent animate-spin`}
      aria-hidden="true"
    />
  );
}
