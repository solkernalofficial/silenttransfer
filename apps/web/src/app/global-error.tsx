'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const noise =
    typeof error?.message === 'string' &&
    (error.message.includes('Cannot redefine property: ethereum') ||
      error.message.includes('Cannot redefine property: solana'));

  if (noise) {
    // Minimal shell — extension race, not app failure
    return (
      <html lang="en">
        <body style={{ fontFamily: 'system-ui', padding: 40, textAlign: 'center' }}>
          <p>Loading…</p>
          <script
            dangerouslySetInnerHTML={{
              __html: 'setTimeout(function(){ location.reload(); }, 400);',
            }}
          />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui', padding: 40, textAlign: 'center' }}>
        <h2>Something went wrong</h2>
        <p style={{ color: '#666', maxWidth: 420, margin: '12px auto' }}>{error.message}</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}
