'use client';

import { useState } from 'react';

interface CheckButtonProps {
  corpCode: string;
}

export default function CheckButton({ corpCode }: CheckButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/disclosure/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corp_code: corpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('공시 체크에 실패했습니다');
        return;
      }
      alert(
        data.hasNewDisclosure
          ? '신규 공시 ' + data.newDisclosureCount + '건'
          : '신규 공시 없음',
      );
    } catch {
      alert('공시 체크에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        fontSize: 11,
        padding: '4px 8px',
        borderRadius: 4,
        border: '0.5px solid var(--color-border-tertiary)',
        background: 'var(--color-bg-secondary)',
        cursor: loading ? 'not-allowed' : 'pointer',
        color: 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? '확인 중...' : '지금 체크'}
    </button>
  );
}
