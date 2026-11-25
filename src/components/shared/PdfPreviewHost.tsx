import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Maximize2, Printer, Share2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { PDF_PREVIEW_EVENT, PdfPreviewRequest, downloadBlob, registerPdfPreviewHost } from '../../utils/pdfPreview';

type PdfDoc = import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

/** One page drawn to a canvas, crisp on high-density screens, re-drawn when the width changes. */
const PdfPage: React.FC<{ doc: PdfDoc; pageNumber: number; cssWidth: number; onVisible: (n: number) => void }> = ({ doc, pageNumber, cssWidth, onVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1.414);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    void (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const render = page.render({ canvasContext: ctx, viewport });
      task = render;
      try { await render.promise; } catch { /* cancelled by a newer render */ }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, pageNumber, cssWidth]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) onVisible(pageNumber); }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [pageNumber, onVisible]);

  return (
    <div ref={wrapRef} data-page={pageNumber} className="mx-auto mb-3 bg-white shadow-md" style={{ width: cssWidth, minHeight: cssWidth * ratio }}>
      <canvas ref={canvasRef} aria-label={`Page ${pageNumber}`} className="block" />
    </div>
  );
};

export const PdfPreviewHost: React.FC = () => {
  const { t } = useLanguage();
  const [req, setReq] = useState<PdfPreviewRequest | null>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [boxWidth, setBoxWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => registerPdfPreviewHost(), []);
  useEffect(() => {
    const onOpen = (e: Event) => { setReq((e as CustomEvent<PdfPreviewRequest>).detail); setZoom(1); setPage(1); };
    window.addEventListener(PDF_PREVIEW_EVENT, onOpen);
    return () => window.removeEventListener(PDF_PREVIEW_EVENT, onOpen);
  }, []);

  const close = useCallback(() => { setReq(null); }, []);

  // load the document (pdf.js is fetched only when somebody actually previews a PDF)
  useEffect(() => {
    if (!req) { setDoc(null); setError(false); return; }
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    setDoc(null); setError(false);
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const data = new Uint8Array(await req.blob.arrayBuffer());
        const d = await pdfjs.getDocument({ data }).promise;
        if (cancelled) { void d.destroy(); return; }
        loaded = d;
        setDoc(d);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; if (loaded) void loaded.destroy(); };
  }, [req]);

  // dialog behaviour: Escape, scroll lock, focus
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(MAX_ZOOM, +(z * 1.25).toFixed(2)));
      else if (e.key === '-') setZoom((z) => Math.max(MIN_ZOOM, +(z / 1.25).toFixed(2)));
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [req, close]);

  // fit-to-width follows the window (rotation, resize)
  useEffect(() => {
    const el = scrollRef.current;
    if (!req || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    setBoxWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [req, doc]);

  const cssWidth = useMemo(() => {
    const fit = Math.max(240, Math.min(boxWidth - 24, 860));
    return Math.round(fit * zoom);
  }, [boxWidth, zoom]);

  const canShareFile = useMemo(() => {
    if (!req || typeof navigator === 'undefined' || !navigator.canShare) return false;
    try { return navigator.canShare({ files: [new File([req.blob], req.filename, { type: 'application/pdf' })] }); } catch { return false; }
  }, [req]);

  if (!req) return null;

  const download = () => downloadBlob(req.blob, req.filename);
  const share = async () => {
    try { await navigator.share({ files: [new File([req.blob], req.filename, { type: 'application/pdf' })], title: req.filename }); } catch { /* user cancelled */ }
  };
  const print = () => {
    const url = URL.createObjectURL(req.blob);
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    if (touch) { window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 120_000); return; } // phones print from their own viewer
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    frame.src = url;
    frame.onload = () => { try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { window.open(url, '_blank'); } };
    document.body.appendChild(frame);
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 120_000);
  };

  const base = 'items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-lg text-sm font-semibold border';
  const neutral = 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100';
  const primary = 'border-amber-600 bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800';
  const btn = `${base} inline-flex ${neutral}`;
  const btnPrimary = `${base} inline-flex ${primary}`;
  const total = doc?.numPages ?? 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch sm:items-center justify-center bg-slate-900/70 sm:p-4 no-print" role="dialog" aria-modal="true" aria-label={t('Document preview', 'Aperçu du document')}>
      <div className="flex flex-col w-full sm:max-w-5xl sm:h-[92vh] h-full bg-slate-100 sm:rounded-xl overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-b border-slate-200">
          <div className="min-w-0 flex-1 basis-40">
            <div className="text-sm font-bold text-slate-900 truncate" title={req.filename}>{req.filename}</div>
            <div className="text-xs text-slate-500" aria-live="polite">{total > 0 ? t(`Page ${page} of ${total}`, `Page ${page} sur ${total}`) : t('Loading…', 'Chargement…')}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z / 1.25).toFixed(2)))} aria-label={t('Zoom out', 'Réduire')} disabled={zoom <= MIN_ZOOM}><ZoomOut className="w-4 h-4" /></button>
            <button type="button" className={`${base} hidden sm:inline-flex ${neutral}`} onClick={() => setZoom(1)} aria-label={t('Fit to width', 'Ajuster à la largeur')}><Maximize2 className="w-4 h-4" /><span>{Math.round(zoom * 100)}%</span></button>
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z * 1.25).toFixed(2)))} aria-label={t('Zoom in', 'Agrandir')} disabled={zoom >= MAX_ZOOM}><ZoomIn className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1.5">
            {canShareFile && <button type="button" className={btn} onClick={share} aria-label={t('Share', 'Partager')}><Share2 className="w-4 h-4" /><span className="hidden sm:inline">{t('Share', 'Partager')}</span></button>}
            <button type="button" className={btn} onClick={print} aria-label={t('Print', 'Imprimer')}><Printer className="w-4 h-4" /><span className="hidden sm:inline">{t('Print', 'Imprimer')}</span></button>
            <button type="button" className={btnPrimary} onClick={download} aria-label={t('Download PDF', 'Télécharger le PDF')}><Download className="w-4 h-4" /><span className="hidden sm:inline">{t('Download', 'Télécharger')}</span></button>
            <button ref={closeRef} type="button" className={btn} onClick={close} aria-label={t('Close preview', 'Fermer l’aperçu')}><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto p-3 bg-slate-200" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
          {error ? (
            <div className="max-w-md mx-auto mt-10 p-5 rounded-xl bg-white border border-slate-200 text-center space-y-3">
              <p className="text-sm text-slate-700">{t('This document cannot be previewed on this device.', 'Ce document ne peut pas être affiché sur cet appareil.')}</p>
              <button type="button" className={btnPrimary} onClick={download}><Download className="w-4 h-4" />{t('Download PDF', 'Télécharger le PDF')}</button>
            </div>
          ) : !doc ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-600" role="status">{t('Preparing preview…', 'Préparation de l’aperçu…')}</div>
          ) : (
            Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i + 1} doc={doc} pageNumber={i + 1} cssWidth={cssWidth} onVisible={setPage} />)
          )}
        </div>
      </div>
    </div>
  );
};
