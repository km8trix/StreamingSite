import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getMetadataBaseUrl } from './metadata'

const FALLBACK = 'https://streaming-site-one.vercel.app/'

describe('getMetadataBaseUrl', () => {
  let prevVercel: string | undefined
  let prevSite: string | undefined

  beforeEach(() => {
    prevVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
    prevSite = process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
  })
  afterEach(() => {
    if (prevVercel === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    else process.env.VERCEL_PROJECT_PRODUCTION_URL = prevVercel
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite
  })

  it('uses VERCEL_PROJECT_PRODUCTION_URL (https-prefixed) when set', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'my-app.vercel.app'
    expect(getMetadataBaseUrl().href).toBe('https://my-app.vercel.app/')
  })

  it('prefers the Vercel prod url over NEXT_PUBLIC_SITE_URL', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'prod.vercel.app'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom.example'
    expect(getMetadataBaseUrl().hostname).toBe('prod.vercel.app')
  })

  it('falls back to NEXT_PUBLIC_SITE_URL (accepting a full origin) when no Vercel url', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom.example'
    expect(getMetadataBaseUrl().href).toBe('https://custom.example/')
  })

  it('uses the hardcoded production fallback when nothing is set', () => {
    expect(getMetadataBaseUrl().href).toBe(FALLBACK)
  })

  it('never returns the senpai.example placeholder', () => {
    expect(getMetadataBaseUrl().hostname).not.toBe('senpai.example')
  })

  it('degrades to the fallback on a malformed value', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'http://'
    expect(getMetadataBaseUrl().href).toBe(FALLBACK)
  })
})
