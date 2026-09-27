import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

test.beforeAll(async () => { await mkdir('render', { recursive: true }) })

test('all views use Helvetica and search text clears its icon', async ({ page }) => {
  const routes = ['/suites', '/cases/case-weather', '/profiles', '/launch', '/runs', '/runs/run-weather', '/compare?run_id=run-weather&run_id=run-policy']
  for (const route of routes) {
    await page.goto(route)
    await expect(page.locator('h1')).toBeVisible()
    const mismatches = await page.evaluate(() => {
      const expectedFont = 'Helvetica, Arial, sans-serif'
      return [...document.querySelectorAll<HTMLElement>('body *')]
        .filter(element => element.textContent?.trim() || element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
        .filter(element => getComputedStyle(element).fontFamily !== expectedFont)
        .slice(0, 5)
        .map(element => `${element.tagName.toLowerCase()}.${element.className}: ${getComputedStyle(element).fontFamily}`)
    })
    expect(mismatches, `${route} uses a non-Helvetica font stack`).toEqual([])
  }

  await page.goto('/suites')
  const search = page.getByPlaceholder('Search cases')
  const spacing = await search.evaluate(input => {
    const field = input.closest('.search-field')!
    const padding = Number.parseFloat(getComputedStyle(input).paddingLeft)
    const icon = getComputedStyle(field, '::before')
    const iconEnd = Number.parseFloat(icon.left) + Number.parseFloat(icon.width) + Number.parseFloat(icon.borderLeftWidth) + Number.parseFloat(icon.borderRightWidth)
    return { padding, iconEnd }
  })
  expect(spacing.padding).toBeGreaterThan(spacing.iconEnd + 10)
  await page.screenshot({ path: 'render/suites-search-fixed.png', fullPage: true })
})

test('desktop library and run detail render', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/suites')
  await expect(page.getByRole('heading', { name: 'Suites & cases' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Weather lookup' })).toBeVisible()
  await page.screenshot({ path: 'render/suites-desktop.png', fullPage: true })
  await page.goto('/runs/run-weather')
  await expect(page.getByRole('heading', { name: 'Trace timeline' })).toBeVisible()
  await page.getByText('View payload').first().click()
  await expect(page.getByText('What is the weather in Tokyo?')).toBeVisible()
  await page.screenshot({ path: 'render/run-detail-desktop.png', fullPage: true })
  expect(errors).toEqual([])
})

test('launch, compare, and mobile layout work', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/launch')
  await expect(page.getByRole('heading', { name: 'Launch a run' })).toBeVisible()
  await page.getByRole('button', { name: 'Launch run set' }).click()
  await expect(page.getByText('Select at least one case to launch.')).toBeVisible()
  await page.locator('.case-selection').first().getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Launch run set' }).click()
  await expect(page).toHaveURL(/\/runs\?set=/)
  await expect(page.getByRole('link', { name: 'Weather lookup' })).toBeVisible()
  await expect(page.locator('.runs-table tbody tr').first().getByText('Completed')).toBeVisible({ timeout: 10000 })
  await page.goto('/compare?run_id=run-weather&run_id=run-policy')
  await expect(page.getByRole('heading', { name: 'Comparison has differences' })).toBeVisible()
  await page.screenshot({ path: 'render/compare-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/suites')
  await expect(page.getByRole('heading', { name: 'Suites & cases' })).toBeVisible()
  await page.screenshot({ path: 'render/suites-mobile.png', fullPage: true })
  const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, elements: [...document.querySelectorAll<HTMLElement>('*')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(element => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })) }))
  expect(overflow, JSON.stringify(overflow)).toMatchObject({ width: 375 })
  expect(errors).toEqual([])
})

test('suite editing, case revisions, profiles, and import controls respond', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/suites')
  await expect(page.getByRole('heading', { name: 'Suites & cases' })).toBeVisible()
  await page.getByRole('button', { name: 'Create suite' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Suite name').fill('Regression checks')
  await dialog.getByLabel('Description').fill('Synthetic cases for local review.')
  await dialog.getByRole('button', { name: 'Create suite' }).click()
  await expect(page.getByRole('heading', { name: 'Regression checks' })).toBeVisible()
  await page.getByRole('button', { name: 'Agent reliability' }).click()
  await page.getByRole('link', { name: 'Weather lookup' }).click()
  await page.getByRole('button', { name: 'Edit draft' }).click()
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Checks fixture weather and a city mention.')
  await page.getByRole('button', { name: 'Save as new revision' }).click()
  await expect(page.getByText('Revision saved.')).toBeVisible()
  await expect(page.getByText('Revision 4').first()).toBeVisible()

  await page.goto('/profiles')
  await page.getByRole('button', { name: 'Check connection' }).click()
  await expect(page.getByText('FakeProvider ready for local demo.')).toBeVisible()

  await page.goto('/launch')
  await page.getByRole('button', { name: 'Import trace' }).click()
  await page.getByLabel('JSON file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{broken') })
  await expect(page.getByText('/file: malformed JSON or unreadable file.')).toBeVisible()
  const canonical = {
    schema_version: '1.0', case_snapshot: { case_key: 'import.sample', name: 'Imported sample', revision_number: 1 },
    profile_snapshot: { model: 'sample-model' }, runner_limits: {}, run: { status: 'completed', duration_ms: 42 },
    events: [{ event_id: 'import-event', sequence: 1, type: 'input_message', occurred_at: '2026-09-23T00:00:00Z', parent_event_id: null, payload: { authorization: 'Bearer secret-value', content: 'Hello' } }],
  }
  await page.getByLabel('JSON file').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(canonical)) })
  await expect(page.getByText('Client preview checks passed.')).toBeVisible()
  await page.getByRole('button', { name: 'Open imported preview' }).click()
  await expect(page.getByRole('heading', { name: 'Imported sample' })).toBeVisible()
  await page.getByText('View payload').click()
  await expect(page.getByText('[REDACTED]')).toBeVisible()
  await page.getByRole('button', { name: 'Delete run data' }).click()
  await page.getByRole('dialog').getByLabel('Confirmation').fill('DELETE')
  await page.getByRole('dialog').getByRole('button', { name: 'Delete run data' }).click()
  await expect(page).toHaveURL(/\/runs$/)
  expect(errors).toEqual([])
})

test('every main view fits a 320 pixel viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  const routes = ['/suites', '/cases/case-weather', '/profiles', '/launch', '/runs', '/runs/run-weather', '/compare?run_id=run-weather&run_id=run-policy']
  for (const route of routes) {
    await page.goto(route)
    await expect(page.locator('h1')).toBeVisible()
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width, `${route} overflowed to ${width}px`).toBeLessThanOrEqual(320)
  }
})

test('secondary controls expose their intended state changes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/suites')
  await expect(page.getByRole('heading', { name: 'Suites & cases' })).toBeVisible()
  await page.getByRole('button', { name: 'Duplicate' }).first().click()
  await page.getByRole('dialog').getByLabel('New case key').fill('weather.copy')
  await page.getByRole('dialog').getByRole('button', { name: 'Duplicate case' }).click()
  await expect(page.getByRole('heading', { name: 'Weather lookup copy' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit draft' }).click()
  await page.getByRole('button', { name: 'Add message' }).click()
  await expect(page.locator('.message-editor')).toHaveCount(2)
  await page.locator('.message-editor').last().getByRole('button', { name: 'Remove' }).click()
  await page.getByRole('button', { name: 'Add evaluator' }).click()
  await expect(page.locator('.evaluator-editor')).toHaveCount(3)
  await page.locator('.evaluator-editor').last().getByRole('button', { name: 'Remove' }).click()
  await page.getByRole('button', { name: 'Save as new revision' }).click()
  await expect(page.getByText('Revision saved.')).toBeVisible()

  await page.goto('/profiles')
  await page.getByRole('button', { name: 'Create profile' }).click()
  await page.getByLabel('Profile name').fill('Second fixture agent')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByRole('heading', { name: 'Second fixture agent' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete profile' }).click()
  await expect(page.getByRole('heading', { name: 'Fixture agent' })).toBeVisible()

  await page.goto('/runs/run-weather')
  await page.getByRole('button', { name: 'Re-evaluate stored run' }).click()
  await expect(page.getByText('A new demo evaluation batch was created from stored evidence.')).toBeVisible()
  await page.getByRole('button', { name: 'Copy canonical JSON' }).click()
  await expect(page.getByText(/schema 1.0 JSON copied|Clipboard unavailable/)).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download redacted export' }).click()
  expect((await download).suggestedFilename()).toMatch(/run-.*-redacted\.json/)
  await page.getByRole('link', { name: 'Compare' }).last().click()
  await page.getByRole('button', { name: 'Select runs' }).first().click()
  await page.locator('.picker-option').filter({ hasText: 'policy.no_external' }).getByRole('checkbox').check()
  await expect(page.getByRole('heading', { name: 'Comparison has differences' })).toBeVisible()

  await page.goto('/suites')
  await page.getByRole('button', { name: 'Clear workspace' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Clear workspace' }).click()
  await expect(page.getByRole('heading', { name: 'Start with a suite' })).toBeVisible()
  await page.getByRole('button', { name: 'Reload demo data' }).click()
  await expect(page.getByRole('link', { name: 'Weather lookup' })).toBeVisible()
  expect(errors).toEqual([])
})

test('visible text meets AA contrast on the main views', async ({ page }) => {
  const routes = ['/suites', '/cases/case-weather', '/profiles', '/launch', '/runs', '/runs/run-weather', '/compare?run_id=run-weather&run_id=run-policy']
  for (const route of routes) {
    await page.goto(route)
    await expect(page.locator('h1')).toBeVisible()
    const failures = await page.evaluate(() => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number)
      const luminance = (components: number[]) => components.slice(0, 3).map(channel => channel / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
      const failures: string[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim()
        const element = node.parentElement
        if (!text || !element || element.closest('.sr-only,[aria-hidden="true"]')) continue
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden' || element.getBoundingClientRect().width === 0) continue
        let backgroundElement: Element | null = element
        let background = [255, 255, 255]
        while (backgroundElement) {
          const parts = rgb(getComputedStyle(backgroundElement).backgroundColor)
          if (parts.length >= 3 && (parts[3] ?? 1) > 0) { background = parts; break }
          backgroundElement = backgroundElement.parentElement
        }
        const color = rgb(style.color)
        if (color.length < 3) continue
        const light = Math.max(luminance(color), luminance(background))
        const dark = Math.min(luminance(color), luminance(background))
        const ratio = (light + 0.05) / (dark + 0.05)
        const large = Number.parseFloat(style.fontSize) >= 24 || Number.parseFloat(style.fontSize) >= 18 && Number.parseInt(style.fontWeight) >= 700
        if (ratio < (large ? 3 : 4.5)) failures.push(`${text.slice(0, 30)}: ${ratio.toFixed(2)} (${style.color} on ${background.join(',')})`)
      }
      return [...new Set(failures)].slice(0, 30)
    })
    expect(failures, `${route}: ${failures.join('; ')}`).toEqual([])
  }
})

test('keyboard focus and modal Escape return to the trigger', async ({ page }) => {
  await page.goto('/suites')
  await expect(page.getByRole('heading', { name: 'Suites & cases' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  const trigger = page.getByRole('button', { name: 'Create suite' })
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
