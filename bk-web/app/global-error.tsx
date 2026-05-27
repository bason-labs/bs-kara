'use client';

import { useEffect } from 'react';
import { logError } from '@/lib/logger';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    logError('global-error', error);
  }, [error]);

  return (
    <html lang="vi">
      <body
        style={{
          minHeight: '100dvh',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1.5rem',
          backgroundColor: '#06100f',
          color: '#e0ffff',
          fontFamily:
            '"Be Vietnam Pro", "Segoe UI", system-ui, Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '22rem',
            padding: '2rem',
            borderRadius: '1rem',
            border: '1px solid rgba(125, 249, 255, 0.4)',
            backgroundColor: '#152a2a',
            boxShadow: '0 0 24px -4px rgba(125, 249, 255, 0.55)',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Không thể tải trang
          </h1>
          <p
            style={{
              marginTop: '0.5rem',
              fontSize: '0.875rem',
              color: '#7aa8a8',
            }}
          >
            Có lỗi xảy ra. Vui lòng tải lại trang để tiếp tục.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              color: '#ffffff',
              fontWeight: 600,
              letterSpacing: '0.025em',
              background:
                'linear-gradient(135deg, #008b8b 0%, #006d6f 60%, #0d98ba 100%)',
              boxShadow: '0 0 24px -4px rgba(125, 249, 255, 0.55)',
            }}
          >
            Tải lại trang
          </button>
        </div>
      </body>
    </html>
  );
}
