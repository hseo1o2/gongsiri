'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

interface Props {
  corpCode: string
}

export default function ReanalyzeButton({ corpCode }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      onClick={() =>
        startTransition(async () => {
          await fetch(`/api/reports/${corpCode}/refresh`, {
            method: 'POST',
          })
          router.refresh()
        })
      }
      disabled={pending}
    >
      {pending ? '재분석 중...' : '지금 재분석'}
    </Button>
  )
}
