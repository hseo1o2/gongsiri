import Topbar from '@/components/layout/Topbar'
import RiskBadge from '@/components/ui/RiskBadge'
import { fetchReportDetailViewModel, type ReportCacheMiss, type ReportDetailViewModel } from '@/lib/api/reports'
import ChecklistPanel from './_components/ChecklistPanel'
import ReportSection from './_components/ReportSection'
import ReanalyzeButton from './_components/ReanalyzeButton'

export const dynamic = 'force-dynamic'

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ corpCode: string }>
}) {
  const { corpCode } = await params

  const detail = await fetchReportDetailViewModel(corpCode)
    .then(value => ({ value, error: '' }))
    .catch(error => ({
      value: null,
      error: error instanceof Error ? error.message : '저 공시리가 리포트 상세를 불러오지 못했습니다.',
    }))

  if (detail.value && (detail.value as ReportCacheMiss).cacheMiss === true) {
    return (
      <div>
        <Topbar title="리포트 상세" showSearch={false} />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#E6F1FB', borderLeft: '3px solid #3B8BFF', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#185FA5', letterSpacing: '-0.03em' }}>
              분석 중...
            </p>
            <p style={{ fontSize: 12, color: '#185FA5', marginTop: 4, letterSpacing: '-0.02em' }}>
              아직 캐시된 리포트가 없습니다. 재분석 버튼을 눌러 분석을 시작하세요.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ReanalyzeButton corpCode={corpCode} />
          </div>
        </div>
      </div>
    )
  }

  if (!detail.value) {
    return (
      <div>
        <Topbar title="리포트 상세" showSearch={false} />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#FCEBEB', borderLeft: '3px solid #E24B4A', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#791F1F', letterSpacing: '-0.03em' }}>
              리포트 상세를 불러오지 못했습니다.
            </p>
            <p style={{ fontSize: 12, color: '#A32D2D', marginTop: 4, letterSpacing: '-0.02em' }}>{detail.error}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ReanalyzeButton corpCode={corpCode} />
          </div>
        </div>
      </div>
    )
  }

  const { corpCode: resolvedCorpCode, corpName, analyzedAt, result, fallback } = detail.value as ReportDetailViewModel
  const isHigh = result.risk_level === 'high'
  const headerBg = result.risk_level === 'high' ? '#FCEBEB' : result.risk_level === 'caution' ? '#FAEEDA' : '#EAF3DE'
  const headerBorder = result.risk_level === 'high' ? '#E24B4A' : result.risk_level === 'caution' ? '#BA7517' : '#639922'
  const scoreColor = result.risk_level === 'high' ? '#E24B4A' : result.risk_level === 'caution' ? '#BA7517' : '#639922'

  return (
    <div>
      <Topbar title="리포트 상세" showSearch={false} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {fallback.used && (
          <div style={{ background: '#E6F1FB', borderLeft: '3px solid #3B8BFF', padding: '10px 14px' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#185FA5', letterSpacing: '-0.03em' }}>
              임시 생성 리포트
            </p>
            <p style={{ fontSize: 12, color: '#185FA5', marginTop: 3, letterSpacing: '-0.02em' }}>
              {fallback.reason ?? '캐시된 상세 리포트가 없어 현재 분석 결과로 상세 화면을 구성했습니다.'}
            </p>
          </div>
        )}

        <div style={{ background: headerBg, border: `0.5px solid ${headerBorder}`, borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '-0.01em', marginBottom: 4 }}>종목코드 {resolvedCorpCode}</p>
            <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em' }}>{corpName}</p>
            <p className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
              최근 분석 {analyzedAt || '시각 정보 없음'}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <RiskBadge level={result.risk_level} />
            <ReanalyzeButton corpCode={resolvedCorpCode} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="font-mono" style={{ fontSize: 28, fontWeight: 500, color: scoreColor, letterSpacing: '-0.02em' }}>
              {result.risk_score}<span style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }}> / 6</span>
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '-0.01em' }}>작전주 점수</p>
          </div>
        </div>

        <ChecklistPanel checklist={result.checklist} />

        {isHigh ? (
          <ReportSection title="⚠ 위험 경고 리포트" content={result.short_term_report} variant="warning" />
        ) : (
          <>
            <ReportSection title="단기 분석 (1~3개월)" content={result.short_term_report} />
            {result.long_term_report && <ReportSection title="장기 분석 (6개월 이상)" content={result.long_term_report} />}
          </>
        )}

        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '-0.01em', textAlign: 'center', paddingBottom: 8 }}>
          {result.disclaimer}
        </p>
      </div>
    </div>
  )
}
