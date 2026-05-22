import Link from 'next/link'

export default function SignupPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg-secondary)', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 440, background: 'var(--color-bg-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--radius-lg)', padding: 28, boxShadow: '0 18px 40px rgba(10,15,28,0.08)' }}>
        <p className="font-display" style={{ fontSize: 38, color: 'var(--color-navy)', lineHeight: 1 }}>공시리<span style={{ color: 'var(--color-blue)' }}>.</span></p>
        <h1 style={{ fontSize: 20, letterSpacing: '-0.04em', marginTop: 10 }}>회원가입 준비 중</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginTop: 10 }}>
          지금 slice에서는 데모용 로그인 shell만 제공합니다. 운영 회원가입, JWT refresh, Supabase Auth는 별도 production auth 작업에서 다룹니다.
        </p>
        <div style={{ background: '#FAEEDA', borderLeft: '3px solid var(--color-amber)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: '#854F0B', fontSize: 12, lineHeight: 1.55, marginTop: 16 }}>
          데모 접근은 로그인 화면의 <span className="font-mono">admin/admin</span> 경로를 사용해 주세요.
        </div>
        <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 40, padding: '0 16px', borderRadius: 'var(--radius-md)', background: 'var(--color-blue)', color: '#fff', textDecoration: 'none', fontWeight: 700, marginTop: 18 }}>
          로그인으로 돌아가기
        </Link>
      </section>
    </main>
  )
}
