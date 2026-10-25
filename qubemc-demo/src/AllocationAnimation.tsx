import { useEffect, useRef, useState } from 'react';
import officeArt from './scene/assets/office.jpg';

/** Anne's original animation loops until the board adapter finishes allocation. */
export function AllocationAnimation({ playing }: { playing: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => !document.hidden);
  const animate = playing && !reduced && visible && !failed;
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => setReduced(media.matches);
    const visibility = () => setVisible(!document.hidden);
    media.addEventListener('change', preference);
    document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', preference); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    setReady(false);
    if (!animate) return;
    let disposed = false;
    const media = video.current;
    const timeout = setTimeout(() => setFailed(true), 15000);
    const loaded = () => { clearTimeout(timeout); setReady(true); };
    const failed = () => { clearTimeout(timeout); setFailed(true); };
    media?.addEventListener('loadeddata', loaded);
    media?.addEventListener('error', failed);
    if (media && media.readyState >= 2) loaded();
    void media?.play().catch(() => { if (!disposed) failed(); });
    return () => { disposed = true; clearTimeout(timeout); media?.pause(); media?.removeEventListener('loadeddata', loaded); media?.removeEventListener('error', failed); };
  }, [animate]);
  return <div className="allocation-art" aria-hidden="true" data-animation={animate && ready ? 'playing' : 'static'}>
    <img src={officeArt} alt=""/>
    {animate && <video ref={video} src={`${import.meta.env.BASE_URL}allocation/scan-drop.mp4`} autoPlay muted loop playsInline preload="auto" className={ready ? 'is-ready' : ''}/>}
  </div>;
}
