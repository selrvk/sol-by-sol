// Fetching the art before it is needed. Online, every picture is its own
// download: a world opened cold drew its map a building at a time. So the
// start screen fetches both worlds' pictures while the player reads it, and
// the map waits for its own pictures before it appears (useArtReady).

import { useEffect, useRef, useState } from 'react'

const loading = new Map<string, Promise<void>>()
const loaded = new Set<string>()

// Download one picture, once. Done means downloaded (load or error), not
// decoded: browsers can put off decoding in a tab that is not showing,
// which held the map back for a player who switched tabs. A picture that
// fails to load counts as done too: the map shows without it rather than
// waiting forever.
function preload(url: string): Promise<void> {
  let job = loading.get(url)
  if (!job) {
    const img = new Image()
    job = new Promise<void>((resolve) => {
      img.onload = img.onerror = () => resolve()
      img.src = url
    }).then(() => {
      loaded.add(url)
    })
    loading.set(url, job)
  }
  return job
}

export function preloadAll(urls: string[]): Promise<void> {
  return Promise.all(urls.map(preload)).then(() => {})
}

// Whether the pictures for `key` (a world) are in. Before they are, the map
// is held back; it then appears whole. It never waits longer than maxWaitMs:
// on a slow connection the game starts and the rest fill in as they come.
// Already-fetched pictures (the start screen's work) mean no wait at all.
// Once in, the key stays ready, so a later stage change never hides the map,
// and `later` -- everything else the world can show -- is fetched quietly.
export function useArtReady(key: string, urls: string[], later: string[], maxWaitMs = 5000): boolean {
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const alreadyIn = urls.every((u) => loaded.has(u))
  // The pictures are read when the world opens (the effect below runs only
  // when the key changes): a later change to the list, a stage change, must
  // not hold the map back again.
  const latest = useRef({ urls, later })
  useEffect(() => {
    latest.current = { urls, later }
  })
  useEffect(() => {
    let live = true
    const done = () => {
      if (live) setReadyKey(key)
    }
    const timer = setTimeout(done, maxWaitMs)
    preloadAll(latest.current.urls).then(() => {
      done()
      preloadAll(latest.current.later)
    })
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [key, maxWaitMs])
  return readyKey === key || alreadyIn
}
